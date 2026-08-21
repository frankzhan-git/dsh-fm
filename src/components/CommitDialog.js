// 提交变更浮窗：自 TreePanel 拆分，内聚提交信息状态与提交动作
import React from 'react'
import { api } from '../core/api.js'
import { store } from '../core/store.js'
import { FM_METHODS } from '../shared/fm-contract.js'

const el = React.createElement

export function CommitDialog({ onClose, onDone, onError }) {
  const [msg, setMsg] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const doCommit = async () => {
    const m = msg.trim()
    if (!m || busy) return
    setBusy(true)
    if (onError) onError(null)
    try {
      const r = await api(FM_METHODS.GIT_COMMIT, { msg: m, sessionId: store.sessionId, root: store.root })
      if (r && r.ok) {
        setMsg('')
        onClose()
        if (onDone) onDone()
      } else if (onError) {
        onError((r && r.error) || '提交失败')
      }
    } catch (e) {
      if (onError) onError(e && e.message ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return el(React.Fragment, null,
    el('div', { className: 'fm-menu-backdrop', onClick: onClose }),
    el('div', { className: 'fm-menu fm-pop2', onClick: (e) => e.stopPropagation() },
      el('div', { className: 'fm-menu-title' }, '提交变更'),
      el('input', {
        className: 'fm-commit-input',
        value: msg,
        placeholder: '提交信息',
        onChange: (e) => setMsg(e.target.value),
        onKeyDown: (e) => {
          if (e.key === 'Enter') { e.preventDefault(); doCommit() }
          if (e.key === 'Escape') { e.stopPropagation(); onClose() }
        },
      }),
      el('div', { className: 'fm-menu-actions' },
        el('button', { className: 'fm-btn fm-btn-danger', disabled: busy || !msg.trim(), onClick: doCommit }, '提交'),
        el('button', { className: 'fm-btn', onClick: onClose }, '取消'),
      ),
    ),
  )
}
