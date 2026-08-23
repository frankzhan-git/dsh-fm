// 会话输入框工具行左端的「文件」按钮（conversation.input.left，与画布插件同区）：
// 小图标按钮形态（26×26，仿 wf-input-btn）；点击时取当前会话 cwd 写入 store 再开弹窗。
import React from 'react'
import { IconFolderClose16 } from '@deepseek-ai/dsh-client-ui-primitives'
import { store, setOpen, useOpen } from '../core/store.js'
import { norm } from '../core/format.js'

const el = React.createElement

export function SidebarAction(props) {
  const open = useOpen()
  const p = props || {}
  const t = p.t || ((k) => k)
  const useSessions = p.useSessions || (() => null)
  // 单次订阅同时取当前会话 id 与其 cwd，避免双重订阅
  const sess = useSessions((s) => {
    if (!s) return { sid: undefined, cwd: null }
    const sid = s.current
    const row = s.byId ? s.byId[String(sid)] : undefined
    return { sid, cwd: row && row.cwd ? row.cwd : null }
  })
  const sid = sess ? sess.sid : undefined
  const cwd = sess ? sess.cwd : null
  return el('button', {
    type: 'button',
    className: 'fm-input-btn' + (open ? ' fm-input-btn-on' : ''),
    title: t('input.title'),
    'aria-pressed': open,
    'aria-label': t('input.aria'),
    onClick: () => {
      store.sessionId = sid || null
      const rc = cwd ? norm(cwd) : null
      if (store.root !== rc) {
        store.root = rc
        store.lastRoot = null
      }
      setOpen(!store.open)
    },
  }, el(IconFolderClose16, { size: 16 }))
}
