// host /api/fm RPC 客户端（官方四相信封驱动）。
// - 经 contract/fm-envelope.js 构造 client-request、解析 server-response（协议与 DSH 官方一致）
// - 超时预算来自 contract/fm-limits.js（git 类 20s / 其余 8s；官方信使兜底 30s）
// - 契约驱动：方法名必须来自 FM_METHODS；运行时校验防裸字符串
// - 永不抛错（避免调用方各写一套 catch）：一律返回
//     { ok:true, ...value }                         —— success（兼容旧调用点 r.ok 用法）
//     { ok:false, message, code, details }          —— 业务/传输失败（code 来源 FM_ERROR_CODES）
import { FM_METHODS, FM_ROUTE, FM_LIMITS, FM_ERROR_CODES, makeClientRequest, parseServerResponse } from '../shared/contract/index.js'

const KNOWN = new Set(Object.values(FM_METHODS))
const GIT_LIKE = new Set([
  FM_METHODS.GIT_STATUS, FM_METHODS.GIT_CONTEXT, FM_METHODS.GIT_DIFF,
  FM_METHODS.GIT_COMMIT, FM_METHODS.GIT_INIT,
  FM_METHODS.GIT_INSTALL_INIT, FM_METHODS.GIT_INDEX_SET,
])

const fail = (code, message, details) => ({ ok: false, code, message, details: details || {} })

export const api = async (method, args) => {
  if (!KNOWN.has(method)) return fail(FM_ERROR_CODES.BAD_REQUEST, '未知 RPC 方法：' + method)

  const timeoutMs = GIT_LIKE.has(method) ? FM_LIMITS.CLIENT_GIT_TIMEOUT_MS : FM_LIMITS.CLIENT_OTHER_TIMEOUT_MS
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null
  try {
    const envelope = makeClientRequest(method, args || {})
    const res = await fetch(FM_ROUTE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(envelope),
      signal: ctl ? ctl.signal : undefined,
    })
    if (!res.ok) {
      let detail = ''
      try { detail = String(await res.text()).trim().slice(0, 200) } catch (e) { /* ignore */ }
      return fail(FM_ERROR_CODES.TRANSPORT, '文件管理器接口不可用（HTTP ' + res.status + '）' + (detail ? ' ' + detail : ''))
    }
    let parsed
    try {
      const value = await res.json()
      parsed = parseServerResponse(value) // 非法信封 → 抛错走下方 catch
    } catch (e) {
      return fail(FM_ERROR_CODES.INTERNAL, '接口响应无法解析：' + (e && e.message ? e.message : String(e)))
    }
    if (!parsed.ok) return fail(parsed.error.code, parsed.error.message, parsed.error.details)
    const value = parsed.value
    // 归一化：官方 value 槽 → 旧调用点兼容形态 { ok:true, ...fields }
    if (value && typeof value === 'object' && 'ok' in value) return Object.assign({}, value, { ok: true })
    return Object.assign({ ok: true }, value || {})
  } catch (e) {
    // 传输中断 / 超时 abort：区分超时（fetch 无默认超时，AbortController 是唯一判定点）
    const aborted = ctl && ctl.signal && ctl.signal.aborted
    return fail(
      aborted ? FM_ERROR_CODES.TIMEOUT : FM_ERROR_CODES.TRANSPORT,
      aborted ? '接口请求超时（' + timeoutMs + 'ms）' : ('接口请求失败：' + (e && e.message ? e.message : String(e))),
    )
  } finally {
    if (timer) clearTimeout(timer)
  }
}

// 便捷：取错误文案（调用点不再手写 (r && r.error) || 'fallback'）
export const msgOf = (r, fallback) => (r && r.message) || (r && r.error) || fallback || '操作失败'
