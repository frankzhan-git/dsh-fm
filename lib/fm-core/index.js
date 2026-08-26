// dsh-fm host 业务核心（领域拆分版）：组装文件域 / git 域 / 能力域 / 上下文域 / 安装域 / 索引域为 RPC handlers 映射。
// 保持旧入口兼容：fail/ok/escIgnorePattern/parseIgnoreLine/POSIX_PKG_MANAGERS/mingitArchPattern/createFmCore
// 均继续从这里导出（lib/fm-core.js 为转发层）。
// 依赖注入式工厂：createFmCore({ fs, shell, sessions, sp }) → { 'fm-xxx': handler } 映射。
// 架构根治（2026-09）：workRoot 解析链升级为 官方优先 —— 会话 header.cwd → workspaceRegistry
// （canonical 会话路径）→ sandboxPolicy.workspaceRoot；沙箱政策统一经 policy.js 解析（不再硬编码
// danger-full-access）；新增 fm-git-context / fm-git-capability 切片。
import { FM_METHODS } from '../../src/shared/contract/index.js'
import { createShell } from './shell.js'
import { createFsHandlers } from './fs.js'
import { createGitHandlers } from './git.js'
import { createGitContextHandlers } from './context.js'
import { createGitCapabilityHandlers } from './capability.js'
import { createGitInstallHandlers, POSIX_PKG_MANAGERS, mingitArchPattern } from './git-install.js'
import { createGitIndexHandlers, escIgnorePattern, parseIgnoreLine } from './git-index.js'
import { createStatusCache } from './git-cache.js'
import { createPolicyResolver } from './policy.js'

export const fail = (e) => ({ ok: false, error: e && e.message ? e.message : String(e) })
export const ok = (extra) => Object.assign({ ok: true }, extra || {})

// 纯函数 re-export（单测与外部引用入口）
export { escIgnorePattern, parseIgnoreLine }
export { POSIX_PKG_MANAGERS, mingitArchPattern }
export { createPolicyResolver }

export function createFmCore(services) {
  const { fs, shell, sessions, sp } = services
  // 官方沙箱政策解析（会话 → 模式/工作区边界）；sp 缺失/异常时回退（见 policy.js）
  const resolvePolicy = createPolicyResolver({ sp, sessions })
  const infra = createShell({ fs, shell })
  // 仓库状态缓存：实例级，跨 git/索引域共享（提交/初始化/索引变更时失效）
  const statusCache = createStatusCache()

  // 工作区根解析链（官方优先）：会话 header.cwd → workspaceRegistry（canonical + 已验证）
  // → sandboxPolicy.workspaceRoot；workspaceRegistry 为 web-app 提供的官方服务，缺失时跳过。
  const workspaces = services.workspaces
  async function rootOf(sessionId) {
    if (sessionId && sessions) {
      try {
        const session = sessions.get(sessionId)
        if (session && session.header && session.header.cwd) return session.header.cwd
      } catch (e) { /* fall through */ }
    }
    if (sessionId && workspaces && workspaces.host && typeof workspaces.host.sessionPath === 'function') {
      try {
        const p = workspaces.host.sessionPath(sessionId)
        if (p) return p
      } catch (e) { /* fall through */ }
    }
    return sp ? sp.workspaceRoot : null
  }

  return Object.assign({},
    createFsHandlers({ fs, rootOf, sh: infra.sh, quote: infra.quote, resolvePolicy }),
    createGitHandlers({ fs, rootOf, probeGit: infra.probeGit, gitCmd: infra.gitCmd, tail: infra.tail, quote: infra.quote, statusCache, resolvePolicy }),
    createGitContextHandlers({ fs, rootOf }),
    createGitCapabilityHandlers({ rootOf, probeGit: infra.probeGit }),
    createGitInstallHandlers({
      fs, rootOf,
      probeGit: infra.probeGit,
      setGitBin: infra.setGitBin,
      getGitVersion: infra.getGitVersion,
      findGitBin: infra.findGitBin,
      gitCmd: infra.gitCmd,
      sh: infra.sh,
      resolvePolicy,
      statusCache,
    }),
    createGitIndexHandlers({ fs, rootOf, statusCache, gitCmd: infra.gitCmd, tail: infra.tail, resolvePolicy }),
  )
}

// 契约引用守卫：HANDLERS 必须覆盖契约声明的全部方法（运行时自检，防漏配）
export function assertContractCoverage(handlers) {
  const missing = Object.values(FM_METHODS).filter((m) => typeof handlers[m] !== 'function')
  if (missing.length > 0) throw new Error('契约方法未实现: ' + missing.join(', '))
  return handlers
}
