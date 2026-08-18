// 会话标题栏「文件」入口按钮：绑定当前会话 cwd，控制弹窗开合
import React from 'react'
import { IconFolderClose16 } from '@deepseek-ai/dsh-client-ui-primitives'
import { store, setOpen, useOpen } from '../core/store.js'
import { norm } from '../core/format.js'

const el = React.createElement

export function FilesButton(props) {
  const open = useOpen()
  const p = props || {}
  const sid = p.sessionId
  const cwd = (p.useSessions || (() => null))((state) => {
    const row = state && state.byId ? state.byId[String(sid)] : undefined
    return row && row.cwd ? row.cwd : null
  })
  const draft = (p.useInput || (() => null))((s) => (s && typeof s.draft === 'string' ? s.draft : ''))
  store.draft = draft
  store.inputActions = p.inputActions || null
  return el('button', {
    className: 'fm-files-btn' + (open ? ' fm-files-btn-on' : ''),
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
  }, el(IconFolderClose16, { size: 16 }), el('span', null, '文件'))
}
