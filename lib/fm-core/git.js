// dsh-fm host git 域：状态（numstat + porcelain 解析/聚合）、差异、提交、初始化。
// 依赖注入式工厂 createGitHandlers({ fs, rootOf, probeGit, gitCmd, tail, quote }) → git 类 RPC handlers。
// 命令串保持「双 shell 兼容」约定：只用普通命令串联 + '; echo 标记' 分段，禁止 || / && / 重定向 / if...fi。
// 仓库上下文（规则）：以 anchor（视图锚点=当前根目录）判定所属仓库——锚点自带 .git 用自身，
// 否则用最近上级仓库；git 命令一律在该仓库根执行，输出路径基准=仓库根。
import { norm } from './util.js'
import { resolveRepoContext } from './repo-context.js'
import { createStatusCache } from './git-cache.js'

export function createGitHandlers(services) {
  const { fs, rootOf, probeGit, gitCmd, tail, quote } = services
  // 状态缓存（实例级；未注入时自建，保证独立可用）
  const statusCache = services.statusCache || createStatusCache()

  return {
    'fm-git-status': async (args) => {
      const root = (args && args.root) || await rootOf(args && args.sessionId)
      if (!root) return { ok: false, error: '无法确定工作目录' }
      // 锚点 = 当前根目录（视图锚点）；旧客户端无 anchor 时回退会话根
      const anchor = (args && args.anchor) ? norm(String(args.anchor)) : root
      const git = await probeGit(anchor)
      if (git.bin === null) return ok({ hasRepo: false, gitInstalled: false, gitVersion: null, context: null })
      // 仓库上下文：锚点自带 .git → 自身仓库；否则最近上级仓库；都无 → 非仓库视图
      const ctx = await resolveRepoContext(fs, anchor)
      if (!ctx) return ok({ hasRepo: false, gitInstalled: true, gitVersion: git.version, context: null })
      const cwd = ctx.root
      const ctxKey = norm(ctx.root)
      // 锚点是否被索引：锚点自身或任一祖先在 ignored 列表 → 未索引（暗色/无 diff/初始化胶囊）
      const anchorIndexedOf = (ignored) => {
        const anchorNorm = norm(anchor).replace(/\/+$/, '')
        return !ignored.some((ig) => {
          const igNorm = norm(ig).replace(/\/+$/, '')
          return anchorNorm === igNorm || anchorNorm.indexOf(igNorm + '/') === 0
        })
      }
      // 短 TTL 缓存：同仓库快速往返（导航/轮询去抖）不再重复 spawn
      const hit = statusCache.get(ctxKey)
      if (hit) {
        return ok({
          hasRepo: true, gitInstalled: true, gitVersion: git.version,
          totalAdded: hit.totalAdded, totalDeleted: hit.totalDeleted,
          files: hit.files, ignored: hit.ignored,
          context: { root: ctxKey, hasOwnRepo: !!ctx.own, anchorIndexed: anchorIndexedOf(hit.ignored) },
        })
      }
      // 注意：Windows 上 DSH 的 shell 后端是 PowerShell（bash-sandbox 被禁用），
      // 命令必须兼容 PowerShell 与 bash：不能用 || / 2>/dev/null / if...fi 等 bash 专有语法。
      // 性能：仓库探测 + 双段 numstat + porcelain 合并为单次 spawn（'; echo 标记' 分段）。
      // 双段 numstat（diff + diff --cached）之和等价于 diff HEAD，且兼容无 HEAD（未提交）仓库。
      const cmd = [
        'git --no-optional-locks rev-parse --is-inside-work-tree --show-toplevel HEAD',
        'git --no-optional-locks diff --numstat',
        'git --no-optional-locks diff --cached --numstat',
        'git --no-optional-locks status --porcelain --ignored',
      ].join('; echo __FM_DIFF_END__; ')
      const st = await gitCmd(cwd, cmd, { stdoutMaxBytes: 8 * 1024 * 1024, timeoutMs: 15000 })
      const parts = String(st.stdout && st.stdout.text || '').replace(/\r/g, '').split('__FM_DIFF_END__')
      // part0：'true'/'false' 标志、仓库根绝对路径、40 位 HEAD sha（无 HEAD 时缺 sha）
      const chkLines = (parts[0] || '').split('\n').map((s) => s.trim()).filter(Boolean)
      if (!chkLines.some((l) => l === 'true')) return ok({ hasRepo: false, gitInstalled: true, gitVersion: git.version, context: null })
      const repoRoot = chkLines.find((l) => l !== 'true' && l !== 'false' && !/^[0-9a-f]{40,}$/i.test(l)) || null
      // 路径基准：仓库根优先；拿不到时退回上下文仓库根
      const base = repoRoot || cwd
      // part1（未暂存）+ part2（已暂存）合并为 numstat 文本
      const numText = (parts[1] || '') + '\n' + (parts[2] || '')
      const statusText = parts[3] || ''
      const files = {}
      let totalAdded = 0
      let totalDeleted = 0
      for (const ln of numText.split('\n')) {
        const t = ln.split('\t')
        if (t.length >= 3 && /^\d+$/.test(t[0]) && /^\d+$/.test(t[1])) {
          let rel = t.slice(2).join('\t').trim().replace(/^"/, '').replace(/"$/, '')
          const mv = rel.match(/^(.*) => (.*)$/)
          if (mv) rel = mv[2].trim()
          if (!rel) continue
          const a = parseInt(t[0], 10)
          const d = parseInt(t[1], 10)
          if (files[rel]) { files[rel].added += a; files[rel].deleted += d }
          else files[rel] = { added: a, deleted: d, untracked: false }
          totalAdded += a
          totalDeleted += d
        }
      }
      const ignored = []
      for (const ln of statusText.split('\n')) {
        const ig = ln.match(/^!!\s+(.+)$/)
        if (ig) {
          const rel = ig[1].trim().replace(/^"/, '').replace(/"$/, '')
          if (rel) ignored.push(norm(base + '/' + rel))
          continue
        }
        const m = ln.match(/^\?\?\s+(.+)$/)
        if (!m) continue
        const rel = m[1].trim().replace(/^"/, '').replace(/"$/, '')
        if (!rel || files[rel]) continue
        // 未跟踪内容只用于客户端暗色显示，不统计行数（逐文件读内容开销大，
        // 会让 git 状态请求延迟数秒；新增行数对未索引内容没有意义）
        files[rel] = { added: null, deleted: 0, untracked: true }
      }
      const out = []
      for (const rel of Object.keys(files)) {
        out.push({ path: norm(base + '/' + rel), rel, added: files[rel].added, deleted: files[rel].deleted, untracked: files[rel].untracked })
      }
      statusCache.set(ctxKey, { files: out, ignored, totalAdded, totalDeleted })
      return ok({
        hasRepo: true, gitInstalled: true, gitVersion: git.version,
        totalAdded, totalDeleted, files: out, ignored,
        context: { root: ctxKey, hasOwnRepo: !!ctx.own, anchorIndexed: anchorIndexedOf(ignored) },
      })
    },
    'fm-git-diff': async (args) => {
      const root = (args && args.root) || await rootOf(args && args.sessionId)
      if (!root) return { ok: false, error: '无法确定工作目录' }
      // path（绝对路径，新客户端）优先；rel（相对 cwd，旧客户端兼容）转绝对路径
      const abs = (args && args.path)
        ? norm(String(args.path))
        : ((args && args.rel) ? norm(root + '/' + args.rel) : null)
      if (!abs) return { ok: false, error: '缺少路径' }
      // 文件自身的仓库上下文：从父目录向上探测（嵌套仓库内的文件 → 其所属仓库，
      // 否则会被上级仓库误判为未跟踪；旧客户端无 .git 时回退会话根）
      const parent = abs.lastIndexOf('/') > 0 ? abs.slice(0, abs.lastIndexOf('/')) : abs
      const ctx = await resolveRepoContext(fs, parent)
      const cwd = ctx ? ctx.root : root
      // 仓库根与 HEAD 一次命令获取（git 输出路径基准为仓库根，与 cwd 可能不同）
      const topl = await gitCmd(cwd, '--no-optional-locks rev-parse --show-toplevel --verify HEAD', { stdoutMaxBytes: 4096, timeoutMs: 10000 })
      const lines = String(topl.stdout && topl.stdout.text || '').split('\n').map((s) => s.trim()).filter(Boolean)
      const repoRoot = lines.find((l) => !/^[0-9a-f]{40,}$/i.test(l)) || null
      const hasHead = lines.some((l) => /^[0-9a-f]{40,}$/i.test(l))
      // diff 路径相对仓库根（git 命令的路径基准）
      const rel = repoRoot && abs.indexOf(repoRoot + '/') === 0
        ? abs.slice(repoRoot.length + 1)
        : ((args && args.rel) || abs)
      // 两条普通 git 命令（兼容 PowerShell 与 bash，不要用 bash 专有的 if/||/重定向语法）
      const cmd = hasHead ? '--no-optional-locks diff HEAD -- ' + quote(rel) : '--no-optional-locks diff -- ' + quote(rel)
      const r = await gitCmd(cwd, cmd, { stdoutMaxBytes: 8 * 1024 * 1024, timeoutMs: 20000 })
      if (r.exitCode !== 0) return { ok: false, error: '获取 diff 失败: ' + tail(r) }
      const text = String(r.stdout && r.stdout.text || '')
      if (text.trim() === '') {
        try {
          const tp = await fs.resolve(abs, { cwd: root })
          const info = await fs.stat(tp)
          if (info && info.type === 'file') {
            const content = await fs.readText(tp)
            return ok({ raw: null, untracked: true, untrackedContent: content })
          }
        } catch (e) { /* fall through */ }
      }
      return ok({ raw: text, untracked: false })
    },
    'fm-git-commit': async (args) => {
      const root = (args && args.root) || await rootOf(args && args.sessionId)
      if (!root) return { ok: false, error: '无法确定工作目录' }
      const msg = args && args.msg ? String(args.msg).trim() : ''
      if (!msg) return { ok: false, error: '提交信息不能为空' }
      // 提交上下文仓库（锚点自身仓库优先，否则最近上级仓库）；不做跨仓库提交
      const anchor = (args && args.anchor) ? norm(String(args.anchor)) : root
      const ctx = await resolveRepoContext(fs, anchor)
      if (!ctx) return { ok: false, error: '当前目录不在任何 git 仓库中，无法提交' }
      const cwd = ctx.root
      const r1 = await gitCmd(cwd, 'add -A', { stdoutMaxBytes: 4096, timeoutMs: 20000 })
      if (r1.exitCode !== 0) return { ok: false, error: 'git add 失败: ' + tail(r1) }
      const r2 = await gitCmd(cwd, 'commit -m ' + quote(msg), { stdoutMaxBytes: 65536, timeoutMs: 20000 })
      if (r2.exitCode !== 0) return { ok: false, error: 'git commit 失败: ' + tail(r2) }
      // 提交改变仓库状态：失效缓存，避免下一次 status 返回提交前的陈旧数据
      statusCache.invalidate(ctx.root)
      return ok()
    },
    'fm-git-init': async (args) => {
      const root = (args && args.root) || await rootOf(args && args.sessionId)
      if (!root) return { ok: false, error: '无法确定工作目录' }
      // 初始化胶囊作用于当前根目录（锚点）
      const anchor = (args && args.anchor) ? norm(String(args.anchor)) : root
      const git = await probeGit(anchor)
      if (git.bin === null) return { ok: false, error: '未检测到 git，请先安装 git（或使用「安装并初始化仓库」）' }
      const r = await gitCmd(anchor, 'init', { stdoutMaxBytes: 8192, timeoutMs: 30000 })
      if (r.exitCode !== 0) return { ok: false, error: 'git init 失败: ' + tail(r) }
      statusCache.invalidate(anchor)
      return ok({ gitVersion: git.version })
    },
  }
}

export const ok = (extra) => Object.assign({ ok: true }, extra || {})
