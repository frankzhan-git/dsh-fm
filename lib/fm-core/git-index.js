// dsh-fm host 索引管理域：.gitignore 解析/转义/读写与 fm-git-index-set。
// 纯函数（escIgnorePattern / parseIgnoreLine）导出便于单测；
// 仅识别「简单路径字面量」行，保证删除操作不会误伤用户手写的高级模式。
// 索引上下文（规则）：以 anchor（视图锚点=当前根目录）的仓库上下文为准，
// .gitignore 读写作用域 = 该上下文仓库根（视图内节点继承视图的仓库上下文）。
// 语义根治（2026-09）：
// - 「未索引/已排除」= 不在 git 索引（未跟踪或被 .gitignore 忽略）；
//   对**已跟踪**路径的排除，git 会忽略 .gitignore → 静默无效果（用户可见为"点击无作用"）。
//   修复：已跟踪 → 先 `git rm --cached -r --ignore-unmatch`（工作区保留，取消跟踪）再写 .gitignore；
//   porcelain --ignored 会把结果归一为 `!!`（已实测），客户端复选框随之正确翻转。
// - 「加入索引」对已 rm --cached 过的路径：仅移除 .gitignore 条目不会恢复跟踪 →
//   需 `git add -A -- <rel>`（对从未排除的路径为 no-op）。
// 写操作用 shell（git rm/add/ls-files）且遵循官方策略（resolvePolicy，read-only 会话拒绝）。
import { norm } from './util.js'
import { resolveRepoContext } from './repo-context.js'
import { quote, tail } from './shell.js'
import { FM_LIMITS, FM_ERROR_CODES } from '../../src/shared/contract/index.js'
import { failWith } from './errors.js'

// 把相对路径转成 .gitignore 字面模式（转义 # ! 尾随空格与通配符）
export const escIgnorePattern = (rel) => {
  let s = String(rel)
  if (s.startsWith('#')) s = '\\' + s
  if (s.startsWith('!')) s = '\\' + s
  s = s.replace(/[*?[\]]/g, (c) => '\\' + c)
  s = s.replace(/( +)$/, (m) => m.replace(/ /g, '\\ '))
  return s
}

const unesc = (s) => s.replace(/\\(.)/g, '$1')
// 是否存在未转义的通配符（已转义的 \* 等仍可精确匹配）
const hasWildcard = (s) => /(^|[^\\])[*?[\]]/.test(s)

// 解析一行 .gitignore → { rel, isDir, neg, anchored }；注释/空行/复杂通配模式返回 null。
export const parseIgnoreLine = (ln) => {
  if (ln === '') return null
  if (ln.startsWith('#')) return null
  let neg = false
  let s = ln
  if (s.startsWith('!')) { neg = true; s = s.slice(1) }
  let anchored = false
  if (s.startsWith('/')) { anchored = true; s = s.slice(1) }
  let isDir = false
  if (s.endsWith('/')) { isDir = true; s = s.slice(0, -1) }
  if (s === '' || hasWildcard(s)) return null
  return { rel: unesc(s), isDir, neg, anchored }
}

export function createGitIndexHandlers(services) {
  const { fs, rootOf, statusCache, gitCmd, tail, resolvePolicy } = services

  // ---------- .gitignore 读写（根目录级别，与 git 工作目录一致） ----------
  const readIgnoreText = async (root) => {
    try {
      const t = await fs.resolve('.gitignore', { cwd: root })
      const info = await fs.stat(t)
      if (info && info.type === 'file') return await fs.readText(t)
    } catch (e) { /* 不存在或不可读 */ }
    return ''
  }

  const writeIgnoreText = async (root, text) => {
    const t = await fs.resolve('.gitignore', { cwd: root })
    await fs.writeText(t, text, undefined, undefined, { mode: 'danger-full-access', workspaceRoot: root })
  }

  // 相对工作区根的路径（已校验在工作区内），非法返回 null
  const relToRoot = (root, p) => {
    const rootNorm = norm(root).replace(/\/+$/, '')
    let rel = norm(String(p))
    if (rel === rootNorm) return null
    if (rel.indexOf(rootNorm + '/') === 0) rel = rel.slice(rootNorm.length + 1)
    else return null
    return rel || null
  }

  return {
    'fm-git-index-set': async (args) => {
      const root = (args && args.root) || await rootOf(args && args.sessionId)
      if (!root) return failWith(FM_ERROR_CODES.CONTEXT_UNAVAILABLE, '无法确定工作目录')
      const anchor = (args && args.anchor) ? norm(String(args.anchor)) : root
      const ctx = await resolveRepoContext(fs, anchor)
      if (!ctx) return failWith(FM_ERROR_CODES.NO_GIT_REPO, '当前目录不在任何 git 仓库中，无法管理索引')
      const repoRoot = ctx.root
      const p = args && args.path
      if (!p) return failWith(FM_ERROR_CODES.BAD_REQUEST, '缺少路径')
      const rel = relToRoot(repoRoot, p)
      if (rel === null) return failWith(FM_ERROR_CODES.BAD_REQUEST, '只能调整工作目录内的路径')
      const target = await fs.resolve(p, { cwd: repoRoot })
      const info = await fs.stat(target)
      if (!info) return failWith(FM_ERROR_CODES.DIRECTORY_UNREADABLE, '路径不存在')
      const isDir = info.type === 'directory'

      // 探测阶段：目录非空时客户端需弹窗询问是否批量设置内部文件（附条目数供影响范围展示）
      if (args && args.probe) {
        let dirNonEmpty = false
        let entryCount = 0
        if (isDir) {
          try {
            const entries = await fs.listDir(target)
            entryCount = entries.length
            dirNonEmpty = entryCount > 0
          } catch (e) { /* 视为空 */ }
        }
        return { ok: true, probe: true, isDir, dirNonEmpty, rel, entryCount }
      }

      const checked = !!(args && args.checked)
      const recursive = !!(args && args.recursive)
      const text = await readIgnoreText(repoRoot)
      const lines = text === '' ? [] : text.split(/\r?\n/)
      const pattern = '/' + escIgnorePattern(rel) + (isDir ? '/' : '')

      // git ls-files -- <rel>：输出非空 = 路径（或目录内任意条目）已被跟踪
      // 写操作先解析策略：read-only 会话拒绝（与 git 域一致）
      const policy = resolvePolicy(args && args.sessionId, true)
      if (policy.denied) return failWith(FM_ERROR_CODES.SANDBOX_DENIED, '沙箱策略为只读，无法管理索引（当前模式 ' + policy.denied + '）')
      const lsTracked = async () => {
        const r = await gitCmd(repoRoot, 'ls-files -- ' + quote(rel), { stdoutMaxBytes: FM_LIMITS.HOST_STDOUT_MAX_BYTES, timeoutMs: FM_LIMITS.HOST_CMD_TIMEOUT_MS, policy: policy.policy })
        if (r.exitCode !== 0) return false
        return String(r.stdout && r.stdout.text || '').trim() !== ''
      }

      if (checked) {
        // 加入索引 = 从 .gitignore 移除条目；但 git 无法在已忽略目录内反忽略
        for (const ln of lines) {
          const pl = parseIgnoreLine(ln)
          if (pl && !pl.neg && pl.rel !== rel && rel.indexOf(pl.rel + '/') === 0) {
            return failWith(FM_ERROR_CODES.GIT_INDEX_FAILED, '“' + pl.rel + '” 已被忽略，请先取消上级目录的忽略设置')
          }
        }
        const keep = []
        let changed = false
        for (const ln of lines) {
          const pl = parseIgnoreLine(ln)
          let drop = false
          if (pl && !pl.neg) {
            if (pl.rel === rel) drop = true
            else if (recursive && pl.anchored && pl.rel.indexOf(rel + '/') === 0) drop = true
          }
          if (drop) changed = true
          else keep.push(ln)
        }
        if (!changed) return { ok: true, changed: false, rel, checked, recursive }
        await writeIgnoreText(repoRoot, keep.join('\n').replace(/\n+$/, '\n'))
        // 曾被 rm --cached 的路径：仅移除 ignore 不会恢复跟踪 → 重新 git add（no-op 提速）
        if (!(await lsTracked())) {
          const ar = await gitCmd(repoRoot, 'add -A -- ' + quote(rel), { stdoutMaxBytes: 8192, timeoutMs: FM_LIMITS.HOST_CMD_TIMEOUT_MS, policy: policy.policy })
          if (ar.exitCode !== 0) return failWith(FM_ERROR_CODES.GIT_INDEX_FAILED, 'git add 失败: ' + tail(ar))
        }
        if (statusCache) statusCache.invalidate(repoRoot) // .gitignore 变更 → 失效状态缓存
        return { ok: true, changed: true, rel, checked, recursive }
      }

      // 取消索引 = 写入 .gitignore（文件模式 /rel；目录模式 /rel/ 覆盖其全部内容）
      for (const ln of lines) {
        const pl = parseIgnoreLine(ln)
        if (pl && !pl.neg && rel.indexOf(pl.rel + '/') === 0) return { ok: true, changed: false, rel, checked, recursive } // 已在忽略目录内
      }
      const exists = lines.some((ln) => {
        const pl = parseIgnoreLine(ln)
        // 目录目标：任意同名模式（带/不带尾斜杠）都覆盖；文件目标：仅非目录模式覆盖
        return !!pl && !pl.neg && pl.rel === rel && (!pl.isDir || isDir)
      })

      // 语义根治：已跟踪路径先取消跟踪（工作区保留），否则 .gitignore 对 git 无效 = 点击无作用
      const tracked = await lsTracked()
      if (tracked) {
        const rr = await gitCmd(repoRoot, 'rm --cached -r --ignore-unmatch -- ' + quote(rel), { stdoutMaxBytes: 65536, timeoutMs: FM_LIMITS.HOST_CMD_TIMEOUT_MS, policy: policy.policy })
        if (rr.exitCode !== 0) return failWith(FM_ERROR_CODES.GIT_INDEX_FAILED, 'git rm --cached 失败: ' + tail(rr))
        // .gitignore 已有该条目（如历史失败残留）→ 不重复追加，仅"取消跟踪"本次生效
        if (exists) {
          if (statusCache) statusCache.invalidate(repoRoot)
          return { ok: true, changed: true, rel, checked, recursive, tracked: true }
        }
      } else if (exists) {
        return { ok: true, changed: false, rel, checked, recursive }
      }
      const nl = lines.length && !text.endsWith('\n') ? '\n' : ''
      await writeIgnoreText(repoRoot, text + nl + pattern + '\n')
      if (statusCache) statusCache.invalidate(repoRoot) // .gitignore 变更 → 失效状态缓存
      return { ok: true, changed: true, rel, checked, recursive, tracked }
    },
  }
}

export const ok = (extra) => Object.assign({ ok: true }, extra || {})
