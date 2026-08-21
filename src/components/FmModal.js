// 弹窗控制器：编排工作区（树/git）与预览选项卡状态，处理弹窗级交互
// （遮罩/关闭按钮/Esc 关闭、行右键菜单、引用到会话、删除联动），
// 并组合 左侧树列 + 右侧预览列
import React from 'react'
import { IconLinkOutline14, IconTrashOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import { api } from '../core/api.js'
import { store, setOpen, useOpen } from '../core/store.js'
import { FM_METHODS } from '../shared/fm-contract.js'
import { useFmWorkspace } from '../hooks/useFmWorkspace.js'
import { useFmPreviews } from '../hooks/useFmPreviews.js'
import { TreePanel } from './TreePanel.js'
import { PreviewPanel } from './PreviewPanel.js'
import { ContextMenu, MenuItem } from './ContextMenu.js'

const el = React.createElement

export function FmModal() {
  const open = useOpen()
  const [error, setError] = React.useState(null)
  const [busy, setBusy] = React.useState(false)
  const [menu, setMenu] = React.useState(null) // 树行右键菜单：{ x, y, path, name, isDir, confirm }
  const closeBtnRef = React.useRef(null)

  const pv = useFmPreviews({ onError: setError })
  const ws = useFmWorkspace({ open, onError: setError, onBusy: setBusy, pruneMissing: pv.pruneMissing })

  // 弹窗级关闭：Esc 键关闭；打开时聚焦关闭按钮（与 dsh web 设置弹窗一致）
  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKeyDown)
    if (closeBtnRef.current) closeBtnRef.current.focus()
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  // 弹窗关闭仅收起界面；目录记忆与已打开的预览选项卡保留（重开恢复）
  const closeModal = () => setOpen(false)

  const doReference = async () => {
    if (!menu) return
    const ref = '`' + menu.path + '`'
    // 入口移至侧边栏底部（根作用域）后不持有输入框上下文：一律复制路径到剪贴板
    try {
      await navigator.clipboard.writeText(ref)
    } catch (e) {
      try {
        const ta = document.createElement('textarea')
        ta.value = ref
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      } catch (e2) { /* 复制失败则忽略 */ }
    }
    setMenu(null)
  }

  const doDelete = async () => {
    if (!menu) return
    setBusy(true)
    setError(null)
    try {
      const r = await api(FM_METHODS.REMOVE, { path: menu.path, sessionId: store.sessionId, root: store.root })
      if (r && r.ok) {
        const deleted = menu.path
        const wasDir = menu.isDir
        setMenu(null)
        pv.removePreviews((p) => p.path !== deleted && !(wasDir && p.path.indexOf(deleted + '/') === 0))
        if (deleted === ws.rootPath) {
          const i = ws.rootPath.lastIndexOf('/')
          const parent = i > 0 ? ws.rootPath.slice(0, i) : null
          if (parent) ws.navigate(parent)
          else ws.goWorkspaceRoot()
        } else {
          ws.loadDir(ws.rootPath)
        }
      } else setError((r && r.error) || '删除失败')
    } catch (e) { setError(e && e.message ? e.message : String(e)) }
    finally { setBusy(false) }
  }

  if (!open) return null

  const rowMenu = menu ? el(ContextMenu, { x: menu.x, y: menu.y, onClose: () => setMenu(null) },
    menu.confirm ? [
      el('div', { className: 'fm-menu-title', key: 't' }, '确认删除“' + menu.name + '”' + (menu.isDir ? '（目录及其内容）' : '') + '？'),
      el('div', { className: 'fm-menu-actions', key: 'a' },
        el('button', { className: 'fm-btn fm-btn-danger', onClick: doDelete }, menu.isDir ? '删除目录' : '删除文件'),
        el('button', { className: 'fm-btn', onClick: () => setMenu(null) }, '取消'),
      ),
    ] : [
      el(MenuItem, { key: 'r', icon: IconLinkOutline14, onClick: doReference }, '复制路径'),
      menu.path === ws.rootPath ? null : el(MenuItem, { key: 'd', icon: IconTrashOutline16, danger: true, onClick: () => setMenu(Object.assign({}, menu, { confirm: true })) }, '删除'),
    ],
  ) : null

  return el('div', { className: 'fm-modal-overlay' },
    el('div', { className: 'fm-modal-mask', 'aria-hidden': true, onClick: closeModal }),
    el('div', { className: 'fm-modal-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': '文件管理器' },
      el(TreePanel, {
        ws,
        error,
        busy,
        onError: setError,
        onOpenFile: pv.openFile,
        onRowMenu: (node, e) => {
          if (!node) { setMenu(null); return }
          setMenu({ x: e.clientX, y: e.clientY, path: node.path, name: node.name, isDir: node.type === 'directory', confirm: false })
        },
      }),
      el(PreviewPanel, { pv, gitMap: ws.gitMap, closeBtnRef, onCloseModal: closeModal }),
    ),
    rowMenu,
  )
}
