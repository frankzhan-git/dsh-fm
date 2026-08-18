// host /api/fm RPC 封装（POST JSON，返回解析后的 JSON）
export const api = async (method, args) => {
  const res = await fetch('/api/fm', {
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
