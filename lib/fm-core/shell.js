// dsh-fm host 基础设施域：shell 封装、git 可执行文件解析与统一命令端口。
// 依赖注入式工厂 createShell({ fs, shell }) → 基础设施句柄；
// gitBin 探测缓存为插件生命周期级状态（与旧实现一致），统一在此管理。
import { norm } from './util.js'

// 单引号转义按 shell 区分：PowerShell 用 ''（两个单引号），bash 用 '\''
export const quote = (p) => process.platform === 'win32'
  ? "'" + String(p).replace(/'/g, "''") + "'"
  : "'" + String(p).replace(/'/g, "'\\''") + "'"

// 从 shell 结果提取错误文本
export const tail = (res) => {
  const s = (res.stderr && res.stderr.text) || (res.stdout && res.stdout.text) || ''
  return String(s).trim() || '未知错误'
}

const WINDOWS_GIT_CANDIDATES = () => {
  const local = process.env.LOCALAPPDATA || ((process.env.USERPROFILE || '') + '\\AppData\\Local')
  return [
    local + '\\Programs\\MinGit\\cmd\\git.exe',
    local + '\\Programs\\Git\\cmd\\git.exe',
    'C:\\Program Files\\Git\\cmd\\git.exe',
    'C:\\Program Files\\Git\\bin\\git.exe',
    'C:\\Program Files (x86)\\Git\\cmd\\git.exe',
  ]
}
const POSIX_GIT_CANDIDATES = ['/usr/bin/git', '/usr/local/bin/git', '/opt/homebrew/bin/git']

const PATH_SEP = process.platform === 'win32' ? ';' : ':'

export function createShell(services) {
  const { fs, shell } = services

  // gitBin：null=未知；''=PATH 上的 git；其他=git 的绝对路径（MinGit/便携安装后使用）
  let gitBin = null
  let gitVersionCache = null
  let gitProbeAt = 0
  const GIT_PROBE_TTL = 30000 // 未找到时 30s 内不重复探测

  async function sh(root, command, stdoutMaxBytes, timeoutMs, env) {
    if (shell === undefined) throw new Error('shell 服务不可用')
    const spec = shell.resolve({
      command,
      workdir: root,
      timeoutMs: timeoutMs || 30000,
      stdoutMaxBytes: stdoutMaxBytes || 65536,
      env,
      sandboxPolicy: { mode: 'danger-full-access', workspaceRoot: root },
    })
    return shell.run(spec)
  }

  const gitVersionOf = async (bin, root) => {
    const cmd = bin ? quote(bin) + ' --version' : 'git --version'
    const r = await sh(root, cmd, 4096, 10000)
    if (r.exitCode !== 0) return null
    return String(r.stdout && r.stdout.text || '').trim() || 'git'
  }

  // 探测 git：PATH → 常见安装路径；结果缓存（TTL 仅作用于「未找到」）
  const probeGit = async (root) => {
    if (gitBin !== null) return { bin: gitBin, version: gitVersionCache }
    if (Date.now() - gitProbeAt < GIT_PROBE_TTL) return { bin: null, version: null }
    const v = await gitVersionOf('', root)
    if (v) { gitBin = ''; gitVersionCache = v; return { bin: gitBin, version: v } }
    const cand = process.platform === 'win32' ? WINDOWS_GIT_CANDIDATES() : POSIX_GIT_CANDIDATES
    for (const c of cand) {
      try {
        const t = await fs.resolve(c)
        const info = await fs.stat(t)
        if (info && info.type === 'file') {
          gitBin = c
          gitVersionCache = await gitVersionOf(c, root)
          return { bin: gitBin, version: gitVersionCache }
        }
      } catch (e) { /* 尝试下一个 */ }
    }
    gitProbeAt = Date.now()
    return { bin: null, version: null }
  }

  // 统一 git 命令入口：自动使用 PATH git；显式路径（MinGit 便携安装）时通过 env 前缀 PATH，
  // 让子进程内的「git」直接解析到刚安装的可执行文件，命令串保持双 shell 兼容写法。
  const binDirOf = (bin) => {
    const i = Math.max(bin.lastIndexOf('/'), bin.lastIndexOf('\\'))
    return i > 0 ? bin.slice(0, i) : bin
  }
  const gitCmd = async (root, argsStr, o) => {
    const git = await probeGit(root)
    if (git.bin === null) throw new Error('未检测到 git，请先安装 git')
    const env = git.bin === ''
      ? undefined
      : { PATH: binDirOf(git.bin) + PATH_SEP + (process.env.PATH || '') }
    // 命令串已自带「git 」前缀（多段拼接时每段都要有）则直接透传，否则补一个前缀
    const cmd = /^\s*git(?:\s|$)/.test(argsStr) ? argsStr : 'git ' + argsStr
    return sh(root, cmd, (o && o.stdoutMaxBytes) || 65536, (o && o.timeoutMs) || 30000, env)
  }

  // 绕过探测缓存、立即查找 git 可执行文件（安装成功后调用）：常见安装位置 → PATH；返回 bin（''=PATH）或 null
  const findGitBin = async (root) => {
    const cand = process.platform === 'win32' ? WINDOWS_GIT_CANDIDATES() : POSIX_GIT_CANDIDATES
    for (const c of cand) {
      try {
        const t = await fs.resolve(c)
        const info = await fs.stat(t)
        if (info && info.type === 'file') return c
      } catch (e) { /* 尝试下一个 */ }
    }
    const v = await gitVersionOf('', root)
    return v ? '' : null
  }

  const setGitBin = async (bin, root) => {
    gitBin = bin
    gitVersionCache = await gitVersionOf(bin, root)
    return gitBin
  }

  const getGitVersion = () => gitVersionCache

  return { sh, quote, tail, gitCmd, probeGit, findGitBin, setGitBin, getGitVersion }
}
