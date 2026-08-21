// 跨组件共享的轻量会话状态（仅插件存活期内有效，不持久化）。
// 收敛原则：open 为弹窗开关（SidebarAction 与 FmModal 跨槽位共享，轻量订阅）；
// sessionId/root/lastRoot 为请求上下文（仅作为 RPC 参数，不参与渲染依赖）。
// 已删除 draft/inputActions（旧会话标题栏路径兼容残留，无任何设置者）。
import React from 'react'

export const store = { open: false, sessionId: null, root: null, lastRoot: null }

const listeners = new Set()
export const subscribe = (fn) => { listeners.add(fn); return () => { listeners.delete(fn) } }
export const setOpen = (open) => {
  store.open = open
  listeners.forEach((fn) => fn(open))
}

// 弹窗开关订阅 Hook（SidebarAction 与 FmModal 共用）
export function useOpen() {
  const [open, set] = React.useState(store.open)
  React.useEffect(() => subscribe(set), [])
  return open
}
