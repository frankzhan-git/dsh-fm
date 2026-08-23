// dsh-fm RPC 错误码 —— 单一副本（host/client/test 一律引用常量，禁止裸字符串错误码）。
// 风格对齐官方 dsh-host-apiproxy 的 rpcErrorSchema：kebab-case + details 必填 + internal 兜底；
// 域错误码由 dsh-fm 扩展（git-* 前缀），官方码（bad-request/internal/…）原样复用。
export const FM_ERROR_CODES = Object.freeze({
  // —— 官方通用码（与 dsh-host-apiproxy rpcErrorSchema 同义）——
  BAD_REQUEST: 'bad-request',
  INTERNAL: 'internal',
  CANCELLED: 'cancelled',
  DIRECTORY_UNREADABLE: 'directory-unreadable',
  // —— dsh-fm 域码 ——
  GIT_NOT_INSTALLED: 'git-not-installed',
  NO_GIT_REPO: 'no-git-repo',
  CONTEXT_UNAVAILABLE: 'context-unavailable',
  GIT_STATUS_FAILED: 'git-status-failed',
  GIT_DIFF_FAILED: 'git-diff-failed',
  GIT_COMMIT_FAILED: 'git-commit-failed',
  GIT_INIT_FAILED: 'git-init-failed',
  GIT_INDEX_FAILED: 'git-index-failed',
  GIT_INSTALL_FAILED: 'git-install-failed',
  GIT_TIMEOUT: 'git-timeout',
  TIMEOUT: 'timeout',
  TRANSPORT: 'transport-failure',
  SANDBOX_DENIED: 'sandbox-denied',
})

export const isFmErrorCode = (code) => Object.values(FM_ERROR_CODES).includes(code)

// 结构化错误：handler 抛错/返回时的统一形态（与官方 error 分支同构）
export const fmError = (code, message, details) => ({
  code: isFmErrorCode(code) ? code : FM_ERROR_CODES.INTERNAL,
  message: String(message || code),
  details: details || {},
})
