// dsh-fm 共享契约聚合出口：wire 定义（信封/方法/错误码/限额/路由）唯一引用面。
// host（Node ESM）、client（esbuild bundle）与 test 一律从本目录 import；
// src/shared/fm-contract.js 仅为兼容再导出（禁止新增定义）。
export { FM_METHODS, FM_ARGS } from './fm-methods.js'
export { FM_ROUTE } from './fm-route.js'
export { FM_ERROR_CODES, isFmErrorCode, fmError } from './fm-errors.js'
export { FM_LIMITS } from './fm-limits.js'
export {
  RPC_TYPE, makeRpcId,
  makeClientRequest, makeServerResponse,
  parseClientRequest, parseServerResponse,
} from './fm-envelope.js'
