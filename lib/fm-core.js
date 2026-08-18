// dsh-fm host 业务核心：文件浏览/读取/删除 + git 状态/差异/提交
// 依赖注入式工厂：createFmCore({ fs, shell, sessions, sp }) → RPC handlers 映射
// 与入口（index.js）解耦：入口只做服务获取、路由注册与 mermaid 渲染装配。

export const fail = (e) => ({ ok: false, error: e && e.message ? e.message : String(e) })
export const ok = (extra) => Object.assign({ ok: true }, extra || {})

export function createFmCore(services) {
  const { fs, shell, sessions, sp } = services

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
  const TEXT_LIMIT = 512 * 1024
  const IMAGE_LIMIT = 30 * 1024 * 1024

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

  const norm = (p) => String(p).replace(/\\/g, '/')
  // 单引号转义按 shell 区分：PowerShell 用 ''（两个单引号），bash 用 '\''
  const quote = (p) => process.platform === 'win32'
    ? "'" + String(p).replace(/'/g, "''") + "'"
    : "'" + String(p).replace(/'/g, "'\\''") + "'"
  const tail = (res) => {
    const s = (res.stderr && res.stderr.text) || (res.stdout && res.stdout.text) || ''
    return String(s).trim() || '未知错误'
  }

  // 工作区根解析链：会话 cwd → sandboxPolicy.workspaceRoot
  async function rootOf(sessionId) {
    if (sessionId && sessions) {
      try {
        const session = sessions.get(sessionId)
        if (session && session.header && session.header.cwd) return session.header.cwd
      } catch (e) { /* fall through */ }
    }
    return sp ? sp.workspaceRoot : null
  }

  async function sh(root, command, stdoutMaxBytes, timeoutMs) {
    if (shell === undefined) throw new Error('shell 服务不可用')
    const spec = shell.resolve({
      command,
      workdir: root,
      timeoutMs: timeoutMs || 30000,
      stdoutMaxBytes: stdoutMaxBytes || 65536,
      sandboxPolicy: { mode: 'danger-full-access', workspaceRoot: root },
    })
    return shell.run(spec)
  }

  const HANDLERS = {
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
      return ok({
        path: target.displayPath,
        entries: entries.map((e) => ({
          name: e.name,
          type: e.type,
          size: e.size == null ? null : e.size,
          path: e.target.displayPath,
        })),
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
        const bytes = await fs.readBytes(target, undefined, IMAGE_LIMIT)
        return ok({ kind: 'image', mime: IMAGE_MIME[ext], base64: base64(bytes), size: info.size == null ? bytes.length : info.size })
      }
      if (TEXT_EXT.has(ext) || ext === '') {
        if (info.size != null && info.size > TEXT_LIMIT) return ok({ kind: 'tooLarge', size: info.size })
        let content = await fs.readText(target)
        let truncated = false
        if (content.length > TEXT_LIMIT) { content = content.slice(0, TEXT_LIMIT); truncated = true }
        return ok({ kind: 'text', content, truncated, size: info.size == null ? content.length : info.size })
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
    'fm-git-status': async (args) => {
      const root = (args && args.root) || await rootOf(args && args.sessionId)
      if (!root) return { ok: false, error: '无法确定工作目录' }
      // 注意：Windows 上 DSH 的 shell 后端是 PowerShell（bash-sandbox 被禁用），
      // 命令必须兼容 PowerShell 与 bash：不能用 || / 2>/dev/null / if...fi 等 bash 专有语法。
      // 第 1 条命令同时检测 repo 与 HEAD（无 HEAD 时 git 仍在 stdout 输出 true，仅 stderr 报错）
      const chk = await sh(root, 'git --no-optional-locks rev-parse --is-inside-work-tree HEAD', 4096, 10000)
      const chkLines = String(chk.stdout && chk.stdout.text || '').split('\n').map((s) => s.trim()).filter(Boolean)
      if (!chkLines.some((l) => l === 'true')) return ok({ hasRepo: false })
      const hasHead = chkLines.some((l) => l !== 'true' && l !== 'false')
      // 第 2 条命令合并 numstat 与 status（'; echo 标记' 在 PowerShell 与 bash 下均有效）
      const cmd = hasHead
        ? 'git --no-optional-locks diff HEAD --numstat; echo __FM_DIFF_END__; git --no-optional-locks status --porcelain --ignored'
        : 'git --no-optional-locks diff --numstat; echo __FM_DIFF_END__; git --no-optional-locks diff --cached --numstat; echo __FM_DIFF_END__; git --no-optional-locks status --porcelain --ignored'
      const st = await sh(root, cmd, 8 * 1024 * 1024, 15000)
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
          if (rel) ignored.push(norm(root + '/' + rel))
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
        out.push({ path: norm(root + '/' + rel), rel, added: files[rel].added, deleted: files[rel].deleted, untracked: files[rel].untracked })
      }
      return ok({ hasRepo: true, totalAdded, totalDeleted, files: out, ignored })
    },
    'fm-git-diff': async (args) => {
      const root = (args && args.root) || await rootOf(args && args.sessionId)
      if (!root) return { ok: false, error: '无法确定工作目录' }
      const rel = args && args.rel
      if (!rel) return { ok: false, error: '缺少路径' }
      // 两条普通 git 命令（兼容 PowerShell 与 bash，不要用 bash 专有的 if/||/重定向语法）
      const head = await sh(root, 'git --no-optional-locks rev-parse --verify HEAD', 4096, 10000)
      const hasHead = head.exitCode === 0
      const cmd = hasHead ? 'git --no-optional-locks diff HEAD -- ' + quote(rel) : 'git --no-optional-locks diff -- ' + quote(rel)
      const r = await sh(root, cmd, 8 * 1024 * 1024, 20000)
      if (r.exitCode !== 0) return { ok: false, error: '获取 diff 失败: ' + tail(r) }
      const text = String(r.stdout && r.stdout.text || '')
      if (text.trim() === '') {
        try {
          const tp = await fs.resolve(rel, { cwd: root })
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
      const r1 = await sh(root, 'git add -A', 4096, 20000)
      if (r1.exitCode !== 0) return { ok: false, error: 'git add 失败: ' + tail(r1) }
      const r2 = await sh(root, 'git commit -m ' + quote(msg), 65536, 20000)
      if (r2.exitCode !== 0) return { ok: false, error: 'git commit 失败: ' + tail(r2) }
      return ok()
    },
  }

  return HANDLERS
}
