// dsh-fm host 路由域：handler 映射 → 官方四相信封的编解码（纯函数，可单测）。
// 职责：parseClientRequest（信封校验）→ 方法分派 → handler 结果归一化
//       {ok:true,...}/{ok:false,...} → 官方 value/error 分支 → makeServerResponse。
// lib/index.js 只做 webServer.register 装配；本文件承载全部线协议语义。
import { FM_ERROR_CODES, parseClientRequest, makeServerResponse } from '../../src/shared/contract/index.js'
import { toRpcError } from './errors.js'

export const createDispatcher = (handlers, loggerWarn) => {
  const warn = loggerWarn || (() => {})
  return async (body) => {
    let message
    try {
      message = parseClientRequest(body)
    } catch (e) {
      // 非法信封：rpcId 不可回显 → 哨兵空串；坏请求归 bad-request（官方错误码）
      return makeServerResponse('', {
        ok: false,
        error: { code: FM_ERROR_CODES.BAD_REQUEST, message: '请求体不是合法的 RPC 信封：' + (e && e.message ? e.message : String(e)), details: {} },
      })
    }
    const fn = Object.prototype.hasOwnProperty.call(handlers, message.method) ? handlers[message.method] : undefined
    if (typeof fn !== 'function') {
      warn('dsh-fm: 未知方法 ' + message.method)
      return makeServerResponse(message.rpcId, {
        ok: false,
        error: { code: FM_ERROR_CODES.BAD_REQUEST, message: '未知方法：' + message.method, details: { method: message.method } },
      })
    }
    try {
      const result = await fn(message.payload || {})
      // handler 返回 {ok:true,...}/{ok:false,...}（领域内语义）→ 归一化为官方 value/error
      if (result !== null && typeof result === 'object' && typeof result.ok === 'boolean') {
        if (result.ok === false) return makeServerResponse(message.rpcId, { ok: false, error: toRpcError(result) })
        const { ok: _ok, ...rest } = result
        return makeServerResponse(message.rpcId, { ok: true, value: rest })
      }
      return makeServerResponse(message.rpcId, { ok: true, value: result === undefined ? null : result })
    } catch (e) {
      warn('dsh-fm: ' + message.method + ' 处理失败: ' + (e && e.message ? e.message : String(e)))
      return makeServerResponse(message.rpcId, { ok: false, error: toRpcError(e) })
    }
  }
}
