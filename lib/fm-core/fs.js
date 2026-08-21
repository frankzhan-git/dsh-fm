// dsh-fm host 文件域：工作目录解析、列表、读取（文本/图片/大小限制）、删除。
// 依赖注入式工厂 createFsHandlers({ fs, rootOf, sh, quote }) → 文件类 RPC handlers。
import { norm } from './util.js'
import { tail } from './shell.js'

const IMAGE_MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  avif: 'image/avif',
}
const TEXT_EXT = new Set([
  'txt', 'md', 'markdown', 'json', 'jsonl', 'ndjson', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx',
  'py', 'java', 'c', 'h', 'cpp', 'cc', 'cxx', 'hpp', 'cs', 'go', 'rs', 'rb', 'php', 'swift',
  'kt', 'kts', 'dart', 'lua', 'r', 'scala', 'clj', 'hs', 'ex', 'exs', 'erl', 'sh', 'bash',
  'zsh', 'bat', 'cmd', 'ps1', 'html', 'htm', 'css', 'scss', 'less', 'sass', 'xml', 'yml',
  'yaml', 'toml', 'ini', 'cfg', 'conf', 'env', 'properties', 'csv', 'tsv', 'sql', 'graphql',
  'vue', 'svelte', 'log', 'lock', 'gitignore', 'diff', 'patch', 'tex', 'rst', 'adoc', 'org',
  'pl', 'pm', 'groovy', 'gradle', 'kotlin', 'cmake', 'ninja', 'wasm', 'proto', 'zig', 'nim',
])
// 预览分层阈值（结合运行环境：本地 DSH Web，磁盘/传输无瓶颈，前端渲染才是瓶颈）：
// - 文本 ≤ TEXT_LIMIT：全文预览；
// - 文本 > TEXT_LIMIT：streamText 流式截断预览（不拒绝，任意大小可看开头）；
// - 图片 > IMAGE_LIMIT：明确提示（readBytes 超限会抛 FS_TOO_LARGE，需前置检查）。
const TEXT_LIMIT = 2 * 1024 * 1024 // 文本完整/截断预览的字符上限（约 2 MB）
const IMAGE_LIMIT = 30 * 1024 * 1024 // 图片 base64 传输上限（30 MB）
const fmtMb = (n) => (n / 1048576) + ' MB'

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
function base64(bytes) {
  let out = ''
  const len = bytes.length
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i]
    const b1 = i + 1 < len ? bytes[i + 1] : 0
    const b2 = i + 2 < len ? bytes[i + 2] : 0
    out += B64[b0 >> 2] + B64[((b0 & 3) << 4) | (b1 >> 4)]
    out += i + 1 < len ? B64[((b1 & 15) << 2) | (b2 >> 6)] : '='
    out += i + 2 < len ? B64[b2 & 63] : '='
  }
  return out
}

export function createFsHandlers(services) {
  const { fs, rootOf, sh, quote } = services

  return {
    'fm-root': async (args) => {
      const root = (args && args.root) || await rootOf(args && args.sessionId)
      return { root }
    },
    'fm-list': async (args) => {
      const root = (args && args.root) || await rootOf(args && args.sessionId)
      if (!root) return { ok: false, error: '无法确定工作目录' }
      const p = args && args.path ? args.path : '.'
      const target = await fs.resolve(p, { cwd: root })
      const entries = await fs.listDir(target)
      // 目录条目探测 .git（并行 stat/目录），供客户端渲染「独立仓库」git 标签；
      // 条目过多时跳过探测（git 标签为附加信息，不为它拖慢大目录列表）
      const PROBE_LIMIT = 200
      let hasGitFlags = []
      if (entries.length <= PROBE_LIMIT) {
        hasGitFlags = await Promise.all(entries.map(async (e) => {
          if (e.type !== 'directory' || !e.target || !e.target.displayPath) return false
          try {
            const gt = await fs.resolve(e.target.displayPath + '/.git')
            const gi = await fs.stat(gt)
            return !!gi
          } catch (err) { return false }
        }))
      } else {
        hasGitFlags = entries.map(() => false)
      }
      const out = entries.map((e, i) => ({
        name: e.name,
        type: e.type,
        size: e.size == null ? null : e.size,
        path: e.target.displayPath,
        hasGit: hasGitFlags[i],
      }))
      return ok({
        path: target.displayPath,
        entries: out,
      })
    },
    'fm-read': async (args) => {
      const root = (args && args.root) || await rootOf(args && args.sessionId)
      if (!root) return { ok: false, error: '无法确定工作目录' }
      const p = args && args.path
      if (!p) return { ok: false, error: '缺少路径' }
      const target = await fs.resolve(p, { cwd: root })
      const info = await fs.stat(target)
      if (!info) return { ok: false, error: '文件不存在' }
      if (info.type !== 'file') return { ok: false, error: '不是普通文件' }
      const name = String(args.name || p)
      const dot = name.lastIndexOf('.')
      const ext = dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
      if (IMAGE_MIME[ext]) {
        // 前置检查：超过 base64 传输上限时明确提示，而不是让 readBytes 抛 FS_TOO_LARGE
        if (info.size != null && info.size > IMAGE_LIMIT) {
          return ok({ kind: 'tooLarge', size: info.size, limit: IMAGE_LIMIT, message: '图片过大（超过 ' + fmtMb(IMAGE_LIMIT) + '），无法预览' })
        }
        const bytes = await fs.readBytes(target, undefined, IMAGE_LIMIT)
        return ok({ kind: 'image', mime: IMAGE_MIME[ext], base64: base64(bytes), size: info.size == null ? bytes.length : info.size })
      }
      if (TEXT_EXT.has(ext) || ext === '') {
        // 分层降级：≤ 上限全文预览；更大时 streamText 流式截断（不拒绝，读成本与文件大小无关）
        let content = ''
        let truncated = false
        if (info.size != null && info.size <= TEXT_LIMIT) {
          content = await fs.readText(target)
        } else {
          const stream = await fs.streamText(target)
          let got = 0
          for await (const chunk of stream) {
            content += chunk
            got += chunk.length
            if (got >= TEXT_LIMIT) { truncated = true; break }
          }
        }
        return ok({ kind: 'text', content, truncated, limit: TEXT_LIMIT, size: info.size == null ? content.length : info.size })
      }
      return ok({ kind: 'unsupported', size: info.size == null ? null : info.size, ext })
    },
    'fm-remove': async (args) => {
      const root = (args && args.root) || await rootOf(args && args.sessionId)
      if (!root) return { ok: false, error: '无法确定工作目录' }
      const p = args && args.path
      if (!p) return { ok: false, error: '缺少路径' }
      const target = await fs.resolve(p, { cwd: root })
      const rt = await fs.resolve(root)
      if (target.targetKey === rt.targetKey) return { ok: false, error: '不能删除工作目录本身' }
      if (!fs.contains(rt, target)) return { ok: false, error: '仅允许删除工作目录内的内容' }
      const info = await fs.stat(target)
      if (!info) return { ok: false, error: '文件不存在' }
      // 按平台选择删除命令：Windows 的 shell 后端是 PowerShell（rm -rf 语法无效）
      const delCmd = process.platform === 'win32'
        ? 'Remove-Item -LiteralPath ' + quote(target.displayPath) + ' -Recurse -Force'
        : 'rm -rf -- ' + quote(target.displayPath)
      const res = await sh(root, delCmd, 4096)
      if (res.exitCode !== 0) throw new Error(tail(res))
      return ok()
    },
  }
}

// 供本文件与外部复用的响应包装（与旧 fm-core 语义一致）
export const ok = (extra) => Object.assign({ ok: true }, extra || {})
export const fail = (e) => ({ ok: false, error: e && e.message ? e.message : String(e) })
