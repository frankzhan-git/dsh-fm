// host /api/fm RPC 封装（POST JSON，返回解析后的 JSON）
// 契约驱动：方法名必须来自 FM_METHODS（src/shared/fm-contract.js 单一副本），
// 运行时校验防裸字符串与方法名拼写错误。
// 超时防护：fetch 无浏览器默认超时，挂起请求会永久 pending（git 轮询会被 gitBusy 卡死）。
// git 类方法给 15s（与 host git 命令超时对齐，避免误杀慢仓库）；其余 8s；超时抛错由调用方重试。
import { FM_METHODS, FM_ROUTE } from '../shared/fm-contract.js'

const KNOWN = new Set(Object.values(FM_METHODS))
const GIT_LIKE = new Set([
  FM_METHODS.GIT_STATUS, FM_METHODS.GIT_DIFF,
  FM_METHODS.GIT_COMMIT, FM_METHODS.GIT_INIT,
  FM_METHODS.GIT_INSTALL_INIT, FM_METHODS.GIT_INDEX_SET,
])
const TIMEOUT_GIT = 15000
const TIMEOUT_OTHER = 8000

export const api = async (method, args) => {
  if (!KNOWN.has(method)) throw new Error('未知 RPC 方法：' + method)
  const timeoutMs = GIT_LIKE.has(method) ? TIMEOUT_GIT : TIMEOUT_OTHER
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null
  try {
    const res = await fetch(FM_ROUTE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ method, args: args || {} }),
      signal: ctl ? ctl.signal : undefined,
    })
    if (!res.ok) {
      let detail = ''
      try { detail = String(await res.text()).trim().slice(0, 200) } catch (e) { /* ignore */ }
      throw new Error('文件管理器接口不可用（HTTP ' + res.status + '）' + (detail ? ' ' + detail : ''))
    }
    return res.json()
  } finally {
    if (timer) clearTimeout(timer)
  }
}
