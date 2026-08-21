// dsh-fm host git 域：状态（numstat + porcelain 解析/聚合）、差异、提交、初始化。
// 依赖注入式工厂 createGitHandlers({ fs, rootOf, probeGit, gitCmd, tail, quote }) → git 类 RPC handlers。
// 命令串保持「双 shell 兼容」约定：只用普通命令串联 + '; echo 标记' 分段，禁止 || / && / 重定向 / if...fi。
import { norm } from './util.js'

export function createGitHandlers(services) {
  const { fs, rootOf, probeGit, gitCmd, tail, quote } = services

  return {
    'fm-git-status': async (args) => {
      const root = (args && args.root) || await rootOf(args && args.sessionId)
      if (!root) return { ok: false, error: '无法确定工作目录' }
      const git = await probeGit(root)
      if (git.bin === null) return ok({ hasRepo: false, gitInstalled: false, gitVersion: null })
      // 注意：Windows 上 DSH 的 shell 后端是 PowerShell（bash-sandbox 被禁用），
      // 命令必须兼容 PowerShell 与 bash：不能用 || / 2>/dev/null / if...fi 等 bash 专有语法。
      // 第 1 条命令同时检测 repo、仓库根（--show-toplevel）与 HEAD：
      // git 输出的路径基准是「仓库根」，而会话 cwd 可能是仓库根的子目录（monorepo 形态）——
      // 必须用仓库根拼接路径，否则与树节点（绝对路径）无法匹配。
      const chk = await gitCmd(root, '--no-optional-locks rev-parse --is-inside-work-tree --show-toplevel HEAD', { stdoutMaxBytes: 4096, timeoutMs: 10000 })
      const chkLines = String(chk.stdout && chk.stdout.text || '').split('\n').map((s) => s.trim()).filter(Boolean)
      if (!chkLines.some((l) => l === 'true')) return ok({ hasRepo: false, gitInstalled: true, gitVersion: git.version })
      // 逐行区分：'true'/'false' 标志、仓库根绝对路径（含 / 或 \）、40 位 HEAD sha
      const repoRoot = chkLines.find((l) => l !== 'true' && l !== 'false' && !/^[0-9a-f]{40,}$/i.test(l)) || null
      const hasHead = chkLines.some((l) => /^[0-9a-f]{40,}$/i.test(l))
      // 路径基准：仓库根优先；拿不到时退回会话 cwd（兼容旧行为）
      const base = repoRoot || root
      // 第 2 条命令合并 numstat 与 status（'; echo 标记' 在 PowerShell 与 bash 下均有效）
      const cmd = hasHead
        ? 'git --no-optional-locks diff HEAD --numstat; echo __FM_DIFF_END__; git --no-optional-locks status --porcelain --ignored'
        : 'git --no-optional-locks diff --numstat; echo __FM_DIFF_END__; git --no-optional-locks diff --cached --numstat; echo __FM_DIFF_END__; git --no-optional-locks status --porcelain --ignored'
      const st = await gitCmd(root, cmd, { stdoutMaxBytes: 8 * 1024 * 1024, timeoutMs: 15000 })
      const parts = String(st.stdout && st.stdout.text || '').replace(/\r/g, '').split('__FM_DIFF_END__')
      let numText = ''
      let statusText = ''
      if (hasHead) { numText = parts[0] || ''; statusText = parts[1] || '' }
      else { numText = (parts[0] || '') + '\n' + (parts[1] || ''); statusText = parts[2] || '' }
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
      return ok({ hasRepo: true, gitInstalled: true, gitVersion: git.version, totalAdded, totalDeleted, files: out, ignored })
    },
    'fm-git-diff': async (args) => {
      const root = (args && args.root) || await rootOf(args && args.sessionId)
      if (!root) return { ok: false, error: '无法确定工作目录' }
      // path（绝对路径，新客户端）优先；rel（相对 cwd，旧客户端兼容）转绝对路径
      const abs = (args && args.path)
        ? norm(String(args.path))
        : ((args && args.rel) ? norm(root + '/' + args.rel) : null)
      if (!abs) return { ok: false, error: '缺少路径' }
      // 仓库根与 HEAD 一次命令获取（git 输出路径基准为仓库根，与 cwd 可能不同）
      const topl = await gitCmd(root, '--no-optional-locks rev-parse --show-toplevel --verify HEAD', { stdoutMaxBytes: 4096, timeoutMs: 10000 })
      const lines = String(topl.stdout && topl.stdout.text || '').split('\n').map((s) => s.trim()).filter(Boolean)
      const repoRoot = lines.find((l) => !/^[0-9a-f]{40,}$/i.test(l)) || null
      const hasHead = lines.some((l) => /^[0-9a-f]{40,}$/i.test(l))
      // diff 路径相对仓库根（git 命令的路径基准）
      const rel = repoRoot && abs.indexOf(repoRoot + '/') === 0
        ? abs.slice(repoRoot.length + 1)
        : ((args && args.rel) || abs)
      // 两条普通 git 命令（兼容 PowerShell 与 bash，不要用 bash 专有的 if/||/重定向语法）
      const cmd = hasHead ? '--no-optional-locks diff HEAD -- ' + quote(rel) : '--no-optional-locks diff -- ' + quote(rel)
      const r = await gitCmd(root, cmd, { stdoutMaxBytes: 8 * 1024 * 1024, timeoutMs: 20000 })
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
      const r1 = await gitCmd(root, 'add -A', { stdoutMaxBytes: 4096, timeoutMs: 20000 })
      if (r1.exitCode !== 0) return { ok: false, error: 'git add 失败: ' + tail(r1) }
      const r2 = await gitCmd(root, 'commit -m ' + quote(msg), { stdoutMaxBytes: 65536, timeoutMs: 20000 })
      if (r2.exitCode !== 0) return { ok: false, error: 'git commit 失败: ' + tail(r2) }
      return ok()
    },
    'fm-git-init': async (args) => {
      const root = (args && args.root) || await rootOf(args && args.sessionId)
      if (!root) return { ok: false, error: '无法确定工作目录' }
      const git = await probeGit(root)
      if (git.bin === null) return { ok: false, error: '未检测到 git，请先安装 git（或使用「安装并初始化仓库」）' }
      const r = await gitCmd(root, 'init', { stdoutMaxBytes: 8192, timeoutMs: 30000 })
      if (r.exitCode !== 0) return { ok: false, error: 'git init 失败: ' + tail(r) }
      return ok({ gitVersion: git.version })
    },
  }
}

export const ok = (extra) => Object.assign({ ok: true }, extra || {})
