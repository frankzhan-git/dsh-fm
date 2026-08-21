// host /api/fm RPC 封装（POST JSON，返回解析后的 JSON）
// 契约驱动：方法名必须来自 FM_METHODS（src/shared/fm-contract.js 单一副本），
// 运行时校验防裸字符串与方法名拼写错误。
import { FM_METHODS, FM_ROUTE } from '../shared/fm-contract.js'

const KNOWN = new Set(Object.values(FM_METHODS))

export const api = async (method, args) => {
  if (!KNOWN.has(method)) throw new Error('未知 RPC 方法：' + method)
  const res = await fetch(FM_ROUTE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ method, args: args || {} }),
  })
  if (!res.ok) {
    let detail = ''
    try { detail = String(await res.text()).trim().slice(0, 200) } catch (e) { /* ignore */ }
    throw new Error('文件管理器接口不可用（HTTP ' + res.status + '）' + (detail ? ' ' + detail : ''))
  }
  return res.json()
}
