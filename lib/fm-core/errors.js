// dsh-fm host 错误映射域：把 handler 的失败统一转成官方 RPC 错误分支 {code,message,details}。
// - handler 抛错/返回 {ok:false,error:...} 时，先看是否已带 code（FM_ERROR_CODES 常量）；
//   否则用 codeOfMessage 的语义表还原；仍无法判定 → internal。
// - 错误码单一副本在 src/shared/contract/fm-errors.js，本文件不再定义新码。
import { FM_ERROR_CODES, fmError } from '../../src/shared/contract/fm-errors.js'

// 旧式 {ok:false,error:'中文'} 的消息 → 域错误码（新增失败路径应直接携带 code，此表仅兜底）
const CODE_OF_MESSAGE = Object.freeze([
  ['无法确定工作目录', FM_ERROR_CODES.CONTEXT_UNAVAILABLE],
  ['未检测到 git', FM_ERROR_CODES.GIT_NOT_INSTALLED],
  ['不在任何 git 仓库', FM_ERROR_CODES.NO_GIT_REPO],
  ['沙箱', FM_ERROR_CODES.SANDBOX_DENIED],
  ['git init 失败', FM_ERROR_CODES.GIT_INIT_FAILED],
  ['git add 失败', FM_ERROR_CODES.GIT_COMMIT_FAILED],
  ['git commit 失败', FM_ERROR_CODES.GIT_COMMIT_FAILED],
  ['获取 diff 失败', FM_ERROR_CODES.GIT_DIFF_FAILED],
  ['获取 git 状态失败', FM_ERROR_CODES.GIT_STATUS_FAILED],
  ['索引', FM_ERROR_CODES.GIT_INDEX_FAILED],
])

export const codeOfMessage = (message) => {
  const s = String(message || '')
  for (const [needle, code] of CODE_OF_MESSAGE) {
    if (s.includes(needle)) return code
  }
  return FM_ERROR_CODES.INTERNAL
}

// 任意宿主错误/旧式返回 → 官方 RPC error 分支
export const toRpcError = (x) => {
  if (!x) return fmError(FM_ERROR_CODES.INTERNAL, '未知错误')
  if (typeof x === 'string') return fmError(codeOfMessage(x), x)
  const code = x.code || codeOfMessage(x.message || x.error)
  const message = x.message || x.error || (x instanceof Error ? x.message : String(x))
  return fmError(code, message, x.details)
}

// helper：handler 内直接构造带码的失败返回（保持 handlers 的 {ok:false,...} 返回风格）
export const failWith = (code, message, details) => ({ ok: false, code, error: message, details: details || {} })
