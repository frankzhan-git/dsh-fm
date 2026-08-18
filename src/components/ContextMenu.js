// 通用右键菜单：固定定位在光标处，点击外部 / 右键外部关闭
// 树行菜单与选项卡菜单共用；确认型浮窗（提交/二次确认）不经过此组件
import React from 'react'

const el = React.createElement

export function ContextMenu({ x, y, onClose, children }) {
  return el('div', { className: 'fm-menu-backdrop', onClick: onClose, onContextMenu: (e) => { e.preventDefault(); onClose() } },
    el('div', { className: 'fm-menu', style: { left: x, top: y }, onClick: (e) => e.stopPropagation() },
      children,
    ),
  )
}

// 单项：icon 为 DSH 图标组件；disabled 时保留显示但不可交互
export function MenuItem({ icon, danger, disabled, onClick, children }) {
  const props = {
    className: 'fm-menu-item' + (danger ? ' fm-menu-danger' : '') + (disabled ? ' fm-menu-disabled' : ''),
    tabIndex: disabled ? -1 : 0,
  }
  if (disabled) {
    props['aria-disabled'] = true
  } else {
    props.onClick = onClick
    props.onKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() }
    }
  }
  return el('div', props,
    icon ? el(icon, { size: 14 }) : null,
    children,
  )
}
