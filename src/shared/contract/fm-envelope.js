// dsh-fm RPC 信封 —— 对齐官方 dsh-host-apiproxy 四相消息模型（C→S / S→C 两相子集）。
// 单一副本：host 解析请求、client 构造请求与解析响应，均引用本文件，禁止裸写 {type, rpcId}。
// 纯函数/零运行时依赖（可在 Node 测试与浏览器 bundle 中直接 import）。
export const RPC_TYPE = Object.freeze({
  CLIENT_REQUEST: 'client-request',
  SERVER_RESPONSE: 'server-response',
})

// rpcId 由发起方铸造（官方约定）；浏览器/Node19+ 用 crypto.randomUUID，退化用时间戳+随机
export const makeRpcId = () => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch (e) { /* 退化 */ }
  return 'rpc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

// C→S 请求全形（payload 槽保持 wide，业务参数由 FM_ARGS 约定）
export const makeClientRequest = (method, payload) => ({
  type: RPC_TYPE.CLIENT_REQUEST,
  rpcId: makeRpcId(),
  method,
  payload: payload || {},
})

// S→C 响应全形
export const makeServerResponse = (rpcId, result) => ({
  type: RPC_TYPE.SERVER_RESPONSE,
  rpcId,
  result,
})

// 解析 C→S 请求：非法信封直接抛错（由路由转 bad-request）
export const parseClientRequest = (text) => {
  let raw = null
  try { raw = JSON.parse(String(text || '')) } catch (e) { throw new Error('请求体不是合法 JSON') }
  if (!raw || typeof raw !== 'object') throw new Error('请求体不是对象')
  if (raw.type !== RPC_TYPE.CLIENT_REQUEST) throw new Error('非 client-request 信封')
  if (typeof raw.rpcId !== 'string' || !raw.rpcId) throw new Error('缺少 rpcId')
  if (typeof raw.method !== 'string' || !raw.method) throw new Error('缺少 method')
  return { rpcId: raw.rpcId, method: raw.method, payload: (raw.payload && typeof raw.payload === 'object') ? raw.payload : {} }
}

// 解析 S→C 响应：返回 { ok:true, value } | { ok:false, error:{code,message,details} }；非法信封抛错
export const parseServerResponse = (json) => {
  if (!json || typeof json !== 'object') throw new Error('响应不是对象')
  if (json.type !== RPC_TYPE.SERVER_RESPONSE) throw new Error('非 server-response 信封')
  const result = json.result
  if (!result || typeof result !== 'object') throw new Error('缺少 result')
  if (result.ok === true) {
    return { ok: true, value: result.value === undefined ? null : result.value }
  }
  if (result.ok === false) {
    const e = result.error || {}
    return {
      ok: false,
      error: {
        code: typeof e.code === 'string' && e.code ? e.code : 'internal',
        message: typeof e.message === 'string' ? e.message : '未知错误',
        details: e.details && typeof e.details === 'object' ? e.details : {},
      },
    }
  }
  throw new Error('非法 result 分支')
}
