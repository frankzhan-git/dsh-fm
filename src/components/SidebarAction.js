// 侧边栏底部入口按钮（sidebar.footer.action，与知识库同位置同形式）：
// wide 模式 = 图标 + 文字行，rail（收起）模式 = 圆形图标；
// 会话上下文取自根作用域标准 props 的 useSessions（当前会话 cwd）
import React from 'react'
import { IconFolderClose16 } from '@deepseek-ai/dsh-client-ui-primitives'
import { store, setOpen, useOpen } from '../core/store.js'
import { norm } from '../core/format.js'

const el = React.createElement

export function SidebarAction(props) {
  const open = useOpen()
  const p = props || {}
  const wide = !!p.wide
  const useSessions = p.useSessions || (() => null)
  const sid = useSessions((s) => (s ? s.current : undefined))
  const cwd = useSessions((s) => {
    const row = s && s.byId ? s.byId[String(sid)] : undefined
    return row && row.cwd ? row.cwd : null
  })
  return el('button', {
    type: 'button',
    className: 'fm-sidebar-btn' + (wide ? '' : ' fm-sidebar-btn-rail') + (open ? ' fm-sidebar-btn-on' : ''),
    title: '工作目录文件管理器',
    'aria-pressed': open,
    onClick: () => {
      store.sessionId = sid || null
      const rc = cwd ? norm(cwd) : null
      if (store.root !== rc) {
        store.root = rc
        store.lastRoot = null
      }
      setOpen(!store.open)
    },
  }, el(IconFolderClose16, { size: wide ? 16 : 18 }), wide ? el('span', { className: 'fm-sidebar-label' }, '文件') : null)
}
