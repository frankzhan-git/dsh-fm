// dsh-fm host 业务核心（领域拆分版）：组装文件域 / git 域 / 安装域 / 索引域为 RPC handlers 映射。
// 保持旧入口兼容：fail/ok/escIgnorePattern/parseIgnoreLine/POSIX_PKG_MANAGERS/mingitArchPattern/createFmCore
// 均继续从这里导出（lib/fm-core.js 为转发层）。
// 依赖注入式工厂：createFmCore({ fs, shell, sessions, sp }) → { 'fm-xxx': handler } 映射。
import { FM_METHODS } from '../../src/shared/fm-contract.js'
import { createShell } from './shell.js'
import { createFsHandlers } from './fs.js'
import { createGitHandlers } from './git.js'
import { createGitInstallHandlers, POSIX_PKG_MANAGERS, mingitArchPattern } from './git-install.js'
import { createGitIndexHandlers, escIgnorePattern, parseIgnoreLine } from './git-index.js'
import { createStatusCache } from './git-cache.js'

export const fail = (e) => ({ ok: false, error: e && e.message ? e.message : String(e) })
export const ok = (extra) => Object.assign({ ok: true }, extra || {})

// 纯函数 re-export（单测与外部引用入口）
export { escIgnorePattern, parseIgnoreLine }
export { POSIX_PKG_MANAGERS, mingitArchPattern }

export function createFmCore(services) {
  const { fs, shell, sessions, sp } = services
  const infra = createShell({ fs, shell })
  // 仓库状态缓存：实例级，跨 git/索引域共享（提交/初始化/索引变更时失效）
  const statusCache = createStatusCache()

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

  return Object.assign({},
    createFsHandlers({ fs, rootOf, sh: infra.sh, quote: infra.quote }),
    createGitHandlers({ fs, rootOf, probeGit: infra.probeGit, gitCmd: infra.gitCmd, tail: infra.tail, quote: infra.quote, statusCache }),
    createGitInstallHandlers({
      fs, rootOf,
      probeGit: infra.probeGit,
      setGitBin: infra.setGitBin,
      getGitVersion: infra.getGitVersion,
      findGitBin: infra.findGitBin,
      gitCmd: infra.gitCmd,
      sh: infra.sh,
    }),
    createGitIndexHandlers({ fs, rootOf, statusCache }),
  )
}

// 契约引用守卫：HANDLERS 必须覆盖契约声明的全部方法（运行时自检，防漏配）
export function assertContractCoverage(handlers) {
  const missing = Object.values(FM_METHODS).filter((m) => typeof handlers[m] !== 'function')
  if (missing.length > 0) throw new Error('契约方法未实现: ' + missing.join(', '))
  return handlers
}
