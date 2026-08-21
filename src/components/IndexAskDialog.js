// 索引批量询问浮窗：自 TreePanel 拆分；ask = { node, checked }（目录非空时询问）
import React from 'react'

const el = React.createElement

export function IndexAskDialog({ ask, onClose, onConfirm, busy }) {
  return el(React.Fragment, null,
    el('div', { className: 'fm-menu-backdrop', onClick: onClose }),
    el('div', {
      className: 'fm-menu fm-pop2',
      onClick: (e) => e.stopPropagation(),
      onKeyDown: (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } },
    },
      el('div', { className: 'fm-menu-title' },
        '「' + ask.node.name + '」文件夹内非空，是否' + (ask.checked ? '批量加入索引' : '批量排除（忽略）') + '内部所有文件？',
      ),
      el('div', { className: 'fm-menu-actions' },
        el('button', { className: 'fm-btn', disabled: busy, onClick: () => onConfirm(true) }, '批量设置'),
        el('button', { className: 'fm-btn', disabled: busy, onClick: () => onConfirm(false) }, '仅本文件夹'),
        el('button', { className: 'fm-btn', disabled: busy, onClick: onClose }, '取消'),
      ),
    ),
  )
}
