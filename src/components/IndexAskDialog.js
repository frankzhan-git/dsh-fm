// 索引二次确认决策卡（产品语义 v2：单一选项）：
// 勾选/取消勾选非空文件夹 → 唯一确认 —— 目录下所有内容统一纳入/取消索引（无作用域二选一）。
// 文案主动语态并明示后果（磁盘文件保留）；签名元素为方向色 impact 条（等宽台账行）。
// 无障碍：role=alertdialog + aria-label；破坏性操作默认焦点在「取消」防误触 Enter；Esc 关闭；reduced-motion 无动画。
import React from 'react'

const el = React.createElement

export function IndexAskDialog({ ask, onClose, onConfirm, busy }) {
  const include = !!ask.checked
  const name = ask.node.name
  const count = ask.count
  const title = (include ? '加入索引 ' : '取消索引 ') + name + '？'

  const confirm = () => {
    if (busy) return
    onConfirm(true) // 唯一语义：目录下所有内容统一处理
  }

  return el(React.Fragment, null,
    el('div', { className: 'fm-menu-backdrop', onClick: onClose }),
    el('div', {
      className: 'fm-ask',
      role: 'alertdialog',
      'aria-modal': 'true',
      'aria-label': title,
      onClick: (e) => e.stopPropagation(),
      onKeyDown: (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } },
    },
      // —— 标题（action-first + mono 文件夹名）——
      el('div', { className: 'fm-ask-title' },
        include ? '加入索引 ' : '取消索引 ',
        el('span', { className: 'fm-ask-name' }, name),
        '？',
      ),
      el('div', { className: 'fm-ask-desc' },
        include
          ? ('文件夹内所有文件、文件夹将一起加入索引（恢复 git 跟踪）；磁盘上的文件原样保留。')
          : ('文件夹内所有文件、文件夹将一起取消索引；磁盘上的文件保留，不会被删除。'),
      ),
      // —— 签名：方向色 impact 条（等宽台账行）——
      el('div', { className: 'fm-ask-impact ' + (include ? 'fm-ask-impact-include' : 'fm-ask-impact-exclude') },
        include ? '将全部加入索引' : '将全部取消索引',
        el('span', { className: 'fm-ask-impact-sep' }, '·'),
        name + ' 内 ' + (count || '若干') + ' 项',
      ),

      // —— 底部动作：取消 + 主动作（排除=破坏性样式；默认焦点在取消，防误触）——
      el('div', { className: 'fm-ask-actions' },
        el('button', { type: 'button', className: 'fm-btn', onClick: onClose, autoFocus: !include }, '取消'),
        el('button', {
          type: 'button',
          className: include ? 'fm-btn fm-ask-primary' : 'fm-btn fm-btn-danger',
          disabled: busy,
          onClick: confirm,
        }, busy ? '处理中…' : (include ? '全部加入索引' : '全部取消索引')),
      ),
    ),
  )
}
