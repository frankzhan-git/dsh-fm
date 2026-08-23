// dsh-fm host git 安装域：跨平台 git 安装链路与「安装并初始化仓库」RPC。
// Windows：winget → MinGit 便携版；macOS：Homebrew → Xcode CLT；Linux：root 直装 / 无密码 sudo + 包管理器级联。
// 纯函数常量（POSIX_PKG_MANAGERS / mingitArchPattern）导出便于单测。
import { quote, tail } from './shell.js'
import { FM_LIMITS, FM_ERROR_CODES } from '../../src/shared/contract/index.js'
import { failWith } from './errors.js'

// Linux/BSD 包管理器级联表（导出便于单测）。
// install(sudo)：sudo 为 'sudo -n ' 或 ''（root 直装）；manual：失败时给用户的手动命令提示。
export const POSIX_PKG_MANAGERS = [
  { id: 'apt', bin: 'apt-get', install: (sudo) => sudo + 'apt-get update; ' + sudo + 'apt-get install -y git', manual: 'sudo apt-get install -y git' },
  { id: 'dnf', bin: 'dnf', install: (sudo) => sudo + 'dnf install -y git', manual: 'sudo dnf install -y git' },
  { id: 'yum', bin: 'yum', install: (sudo) => sudo + 'yum install -y git', manual: 'sudo yum install -y git' },
  { id: 'apk', bin: 'apk', install: (sudo) => sudo + 'apk add git', manual: 'sudo apk add git' },
  { id: 'pacman', bin: 'pacman', install: (sudo) => sudo + 'pacman -Sy --noconfirm git', manual: 'sudo pacman -Sy --noconfirm git' },
  { id: 'zypper', bin: 'zypper', install: (sudo) => sudo + 'zypper --non-interactive install git', manual: 'sudo zypper install git' },
]

// 按 CPU 架构选择 MinGit 资产文件名模式（导出便于单测）
export const mingitArchPattern = (arch) => arch === 'arm64'
  ? 'MinGit-.*-arm64\\.zip'
  : (arch === 'x64' ? 'MinGit-.*-64-bit\\.zip' : 'MinGit-.*-32-bit\\.zip')

const MINGIT_FALLBACKS = [
  'https://github.com/git-for-windows/git/releases/download/v2.55.0.windows.3/MinGit-2.55.0-64-bit.zip',
  'https://github.com/git-for-windows/git/releases/download/v2.52.0.windows.1/MinGit-2.52.0-64-bit.zip',
]

export function createGitInstallHandlers(services) {
  const { fs, rootOf, probeGit, setGitBin, getGitVersion, findGitBin, gitCmd, sh, resolvePolicy } = services

  // 通过 GitHub API 获取最新 MinGit zip 直链（按 CPU 架构选资产；PS 5.1 需显式启用 TLS 1.2），
  // 失败时仅 x64 回退到已知版本
  const mingitUrl = async (root) => {
    const pat = mingitArchPattern(process.arch)
    const cmd = "[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12; $r = Invoke-RestMethod -Headers @{ 'User-Agent' = 'dsh-fm' } -Uri 'https://api.github.com/repos/git-for-windows/git/releases/latest'; $a = $r.assets | Where-Object { $_.name -match " + quote(pat) + " } | Select-Object -First 1; if ($a) { $a.browser_download_url }"
    const r = await sh(root, cmd, 8192, 30000)
    const u = String(r.stdout && r.stdout.text || '').trim()
    if (u) return u
    return process.arch === 'x64' ? MINGIT_FALLBACKS[0] : null
  }

  const installGitWindows = async (root) => {
    const local = process.env.LOCALAPPDATA || ((process.env.USERPROFILE || '') + '\\AppData\\Local')
    // 0) 常见安装位置 / PATH 已存在则直接复用（覆盖探测缓存的滞后）
    const pre = await findGitBin(root)
    if (pre !== null) return { bin: pre }
    // 1) winget：先探测可用性（缺失时快速跳过，不留错误噪音）；
    //    --scope user 免管理员，--silent/--disable-interactivity 防止交互挂起
    const wgChk = await sh(root, 'winget --version', 4096, 10000)
    if (wgChk.exitCode === 0) {
      await sh(root, 'winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements --scope user --silent --disable-interactivity', 16384, 300000)
      const b = await findGitBin(root)
      if (b !== null) return { bin: b }
    }
    // 2) MinGit 便携版：下载 zip → 解压到 %LOCALAPPDATA%\Programs\MinGit → 追加用户 PATH
    const minDir = local + '\\Programs\\MinGit'
    const zipPath = (process.env.TEMP || local + '\\Temp') + '\\dsh-fm-mingit.zip'
    const bin = minDir + '\\cmd\\git.exe'
    try {
      const t0 = await fs.resolve(bin)
      const i0 = await fs.stat(t0)
      if (i0 && i0.type === 'file') return { bin } // 已装过便携版
    } catch (e) { /* 继续下载 */ }
    const url = await mingitUrl(root)
    if (!url) return { bin: null, hint: '无法获取 MinGit 下载地址（网络/代理或架构不受支持），请手动安装 git' }
    const urls = [url].concat(MINGIT_FALLBACKS.filter((u) => u !== url))
    let downloaded = false
    for (const u of urls) {
      const dl = await sh(root, 'curl.exe -L --fail --silent --show-error -o ' + quote(zipPath) + ' ' + quote(u), 16384, 300000)
      if (dl.exitCode === 0) { downloaded = true; break }
    }
    if (!downloaded) return { bin: null, hint: 'MinGit 下载失败（请检查网络/代理后重试）' }
    const ex = await sh(root, 'Expand-Archive -LiteralPath ' + quote(zipPath) + ' -DestinationPath ' + quote(minDir) + ' -Force', 16384, 300000)
    if (ex.exitCode !== 0) return { bin: null, hint: 'MinGit 解压失败' }
    try {
      const t = await fs.resolve(bin)
      const info = await fs.stat(t)
      if (!info || info.type !== 'file') return { bin: null, hint: 'MinGit 解压后未找到 git.exe' }
    } catch (e) { return { bin: null, hint: 'MinGit 解压后未找到 git.exe' } }
    // 追加到用户 PATH（供其他终端使用；本进程后续命令直接走 bin 绝对路径，无需刷新 PATH）
    await sh(root, "$u = [Environment]::GetEnvironmentVariable('Path','User'); $d = " + quote(minDir + '\\cmd') + "; if (-not $u) { [Environment]::SetEnvironmentVariable('Path', $d, 'User') } elseif ($u -notlike ('*' + $d + '*')) { [Environment]::SetEnvironmentVariable('Path', $u.TrimEnd(';') + ';' + $d, 'User') }", 4096, 15000)
    return { bin }
  }

  const installGitPosix = async (root) => {
    // macOS：Homebrew（无需 root）→ Xcode Command Line Tools（弹出系统对话框，需用户确认）
    if (process.platform === 'darwin') {
      await sh(root, 'if command -v brew >/dev/null 2>&1; then brew install git; fi', 65536, 300000)
      let b = await findGitBin(root)
      if (b !== null) return { bin: b }
      await sh(root, 'if command -v xcode-select >/dev/null 2>&1; then xcode-select --install; fi', 4096, 15000)
      b = await findGitBin(root)
      if (b !== null) return { bin: b }
      return { bin: null, hint: '已尝试 Homebrew 与 Xcode Command Line Tools；若弹出系统安装对话框，请完成安装后重试' }
    }
    // Linux 等：root 用户直装（容器/无 sudo 场景），否则无密码 sudo；按发行版包管理器级联
    const uid = await sh(root, 'id -u', 4096, 10000)
    const isRoot = String(uid.stdout && uid.stdout.text || '').trim() === '0'
    const sudo = isRoot ? '' : 'sudo -n '
    let found = null
    for (const pm of POSIX_PKG_MANAGERS) {
      const chk = await sh(root, 'command -v ' + pm.bin + ' >/dev/null 2>&1', 4096, 10000)
      if (chk.exitCode !== 0) continue
      found = pm
      const run = await sh(root, 'if command -v ' + pm.bin + ' >/dev/null 2>&1; then ' + pm.install(sudo) + '; fi', 65536, 300000)
      if (run.exitCode === 0) {
        const b = await findGitBin(root)
        if (b !== null) return { bin: b }
      }
    }
    if (found) return { bin: null, hint: '检测到 ' + found.id + ' 但安装失败（可能需要管理员密码或网络），请手动执行：' + found.manual }
    return { bin: null, hint: '未检测到受支持的包管理器（apt/dnf/yum/apk/pacman/zypper），请手动安装 git' }
  }

  return {
    'fm-git-install-init': async (args) => {
      const root = (args && args.root) || await rootOf(args && args.sessionId)
      if (!root) return failWith(FM_ERROR_CODES.CONTEXT_UNAVAILABLE, '无法确定工作目录')
      // 安装/初始化属写操作：read-only 会话拒绝（官方策略模型）
      const pol = resolvePolicy(args && args.sessionId, true)
      if (pol.denied) return failWith(FM_ERROR_CODES.SANDBOX_DENIED, '沙箱策略为只读，无法安装/初始化 git（当前模式 ' + pol.denied + '）')
      // 初始化胶囊作用于当前根目录（锚点）
      const anchor = (args && args.anchor) ? String(args.anchor) : root
      const git = await probeGit(anchor, pol.policy)
      let installed = false
      if (git.bin === null) {
        const res = process.platform === 'win32' ? await installGitWindows(anchor) : await installGitPosix(anchor)
        if (!res || res.bin === null) {
          return { ok: false, code: FM_ERROR_CODES.GIT_INSTALL_FAILED, error: 'git 安装失败：' + ((res && res.hint) || '请检查网络后重试，或手动安装 git') }
        }
        await setGitBin(res.bin, anchor)
        installed = true
      }
      const r = await gitCmd(anchor, 'init', { stdoutMaxBytes: 8192, timeoutMs: FM_LIMITS.HOST_CMD_TIMEOUT_MS, policy: pol.policy })
      if (r.exitCode !== 0) return failWith(FM_ERROR_CODES.GIT_INIT_FAILED, 'git init 失败: ' + tail(r))
      return ok({ installed, gitVersion: getGitVersion() })
    },
  }
}

export const ok = (extra) => Object.assign({ ok: true }, extra || {})
