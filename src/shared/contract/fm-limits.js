// dsh-fm 端到端超时/缓存/轮询预算 —— 单一副本（唯一允许出现的数字来源）。
// 约定（自下而上递增，保证"慢的层先超时、快的层兜底"）：
//   probe 6s < 单命令 8s(=status 预算 12s) < 客户端 fetch 20s < 轮询保留 25s(仅注释，无看门狗)
// host 侧：HOST_PROBE_TIMEOUT_MS ≤ HOST_CMD_TIMEOUT_MS ≤ HOST_STATUS_BUDGET_MS
// client 侧：CLIENT_GIT_TIMEOUT_MS > HOST_STATUS_BUDGET_MS（客户端先等，主机后超时）
// 对齐官方信使默认（dsh-host-apiproxy DEFAULT_TIMEOUT_MS=30000）：客户端预算始终低于官方兜底。
export const FM_LIMITS = {
  // —— 客户端 ——
  CLIENT_GIT_TIMEOUT_MS: 20000,
  CLIENT_OTHER_TIMEOUT_MS: 8000,
  POLL_MS: 3000,
  POLL_JITTER_MS: 500,
  // —— host 侧 ——
  HOST_PROBE_TIMEOUT_MS: 6000,
  HOST_CMD_TIMEOUT_MS: 8000,
  HOST_STATUS_BUDGET_MS: 12000,
  HOST_STDOUT_MAX_BYTES: 8 * 1024 * 1024,
  // —— 缓存/探测 ——
  STATUS_CACHE_TTL_MS: 1500,
  PROBE_RETRY_MS: 30000,
}
