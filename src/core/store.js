// 跨组件共享的轻量会话状态（仅插件存活期内有效，不持久化）
import React from 'react'

export const store = { open: false, sessionId: null, root: null, lastRoot: null, draft: '', inputActions: null }

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
