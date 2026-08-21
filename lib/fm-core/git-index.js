// dsh-fm host 索引管理域：.gitignore 解析/转义/读写与 fm-git-index-set。
// 纯函数（escIgnorePattern / parseIgnoreLine）导出便于单测；
// 仅识别「简单路径字面量」行，保证删除操作不会误伤用户手写的高级模式。
import { norm } from './util.js'

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
  const { fs, rootOf } = services

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
      if (!root) return { ok: false, error: '无法确定工作目录' }
      const p = args && args.path
      if (!p) return { ok: false, error: '缺少路径' }
      const rel = relToRoot(root, p)
      if (rel === null) return { ok: false, error: '只能调整工作目录内的路径' }
      const target = await fs.resolve(p, { cwd: root })
      const info = await fs.stat(target)
      if (!info) return { ok: false, error: '路径不存在' }
      const isDir = info.type === 'directory'

      // 探测阶段：目录非空时客户端需弹窗询问是否批量设置内部文件
      if (args && args.probe) {
        let dirNonEmpty = false
        if (isDir) {
          try { dirNonEmpty = (await fs.listDir(target)).length > 0 } catch (e) { /* 视为空 */ }
        }
        return ok({ probe: true, isDir, dirNonEmpty, rel })
      }

      const checked = !!(args && args.checked)
      const recursive = !!(args && args.recursive)
      const text = await readIgnoreText(root)
      const lines = text === '' ? [] : text.split(/\r?\n/)
      const pattern = '/' + escIgnorePattern(rel) + (isDir ? '/' : '')

      if (checked) {
        // 加入索引 = 从 .gitignore 移除对应条目；但 git 无法在已忽略目录内反忽略
        for (const ln of lines) {
          const pl = parseIgnoreLine(ln)
          if (pl && !pl.neg && pl.rel !== rel && rel.indexOf(pl.rel + '/') === 0) {
            return { ok: false, error: '“' + pl.rel + '” 已被忽略，请先取消上级目录的忽略设置' }
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
        if (!changed) return ok({ changed: false, rel, checked, recursive })
        await writeIgnoreText(root, keep.join('\n').replace(/\n+$/, '\n'))
        return ok({ changed: true, rel, checked, recursive })
      }

      // 取消索引 = 写入 .gitignore（文件模式 /rel；目录模式 /rel/ 覆盖其全部内容）
      for (const ln of lines) {
        const pl = parseIgnoreLine(ln)
        if (pl && !pl.neg && rel.indexOf(pl.rel + '/') === 0) return ok({ changed: false, rel, checked, recursive }) // 已在忽略目录内
      }
      const exists = lines.some((ln) => {
        const pl = parseIgnoreLine(ln)
        // 目录目标：任意同名模式（带/不带尾斜杠）都覆盖；文件目标：仅非目录模式覆盖
        return !!pl && !pl.neg && pl.rel === rel && (!pl.isDir || isDir)
      })
      if (exists) return ok({ changed: false, rel, checked, recursive })
      const nl = lines.length && !text.endsWith('\n') ? '\n' : ''
      await writeIgnoreText(root, text + nl + pattern + '\n')
      return ok({ changed: true, rel, checked, recursive })
    },
  }
}

export const ok = (extra) => Object.assign({ ok: true }, extra || {})
