// git 胶囊组件：四态渲染（架构根治——错误不再伪装成 loading）。
//   error   变体（T5 失败态）：错误信息 + 重试按钮 —— 旧版缺失的终端状态
//   ready   工具条（hasRepo 且锚点被索引）：+/− 统计、提交、仅显示变更、索引管理
//   init    初始化胶囊（未装 git → 安装并初始化；装了但无仓库/锚点未索引 → 初始化）
//   loading 与胶囊同形占位（不跳动；仅当数据未就绪且无能力/上下文骨架时显示）
// 数据面简化：data（status 终态）→ cap（能力骨架）→ ctx（仓库骨架）→ loading。
import React from 'react'
import {
  IconBranchOutline16,
  IconChecklistOutline14,
  IconDownloadOutline16,
  IconSearchOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { GIT_PHASE } from '../core/git-machine.js'

const el = React.createElement

export function GitCapsule(props) {
  const {
    phase, error, data, cap, ctx, t,
    diffOnly, onToggleDiff, indexMode, onToggleIndex,
    onCommit, onInit, onRetry, busy,
  } = props || {}
  const tt = t || ((k) => k)

  // —— T5 失败态：错误油丸（唯一"终态"，不再与 loading 同形同义）——
  if (phase === GIT_PHASE.ERROR) {
    return el('div', { className: 'fm-git-error', role: 'alert' },
      el('span', { className: 'fm-git-error-msg' }, tt('git.errorPrefix') + (error && error.message ? error.message : tt('git.errorUnknown'))),
      el('button', {
        type: 'button',
        className: 'fm-git-retry',
        title: tt('git.retryTitle'),
        onClick: () => { if (onRetry) onRetry() },
      }, tt('git.retry')),
    )
  }

  // —— ready 终态：以 status 数据为准（与旧版视觉一致）——
  if (data) {
    const anchorIndexed = !!(data.context && data.context.anchorIndexed)
    const hasChanges = !!data.hasRepo && data.files.length > 0
    if (data.hasRepo && anchorIndexed) {
      return el('div', { className: 'fm-git' },
        el('span', { className: 'fm-git-stat', title: tt('git.statTitle') },
          el('span', { className: 'fm-git-add' }, '+' + data.totalAdded),
          el('span', { className: 'fm-git-del' }, '-' + data.totalDeleted),
        ),
        hasChanges ? el('button', {
          type: 'button',
          className: 'fm-git-btn',
          title: tt('git.commitTitle'),
          onClick: () => { if (onCommit) onCommit() },
        }, el(IconBranchOutline16, { size: 14 })) : null,
        el('button', {
          type: 'button',
          className: 'fm-git-btn' + (diffOnly ? ' fm-git-btn-on' : ''),
          title: diffOnly ? tt('git.showAll') : tt('git.showChanged'),
          onClick: () => { if (onToggleDiff) onToggleDiff() },
        }, el(IconSearchOutline16, { size: 14 })),
        el('button', {
          type: 'button',
          className: 'fm-git-btn' + (indexMode ? ' fm-git-btn-on' : ''),
          title: tt('git.indexTitle'),
          onClick: () => { if (onToggleIndex) onToggleIndex() },
        }, el(IconChecklistOutline14, { size: 14 })),
      )
    }
    return initCapsule(tt, !!data.gitInstalled, busy, onInit)
  }

  // —— 骨架先行：能力/上下文任一就绪即可提前给出正确形态 ——
  if (cap && cap.gitInstalled === false) return initCapsule(tt, false, busy, onInit)
  if (ctx && ctx.hasRepo === false) return initCapsule(tt, true, busy, onInit)

  // —— loading 占位（数据未就绪 + 无骨架可提前渲染）——
  return el('div', { className: 'fm-git-loading', role: 'status' },
    el('span', { className: 'fm-git-loading-spin' }),
    tt('git.loading'),
  )
}

const initCapsule = (tt, gitInstalled, busy, onInit) => el('button', {
  type: 'button',
  className: 'fm-capsule',
  disabled: !!busy,
  title: gitInstalled ? tt('git.initTitle') : tt('git.installInitTitle'),
  onClick: () => { if (onInit) onInit(!gitInstalled) },
},
  gitInstalled ? el(IconBranchOutline16, { size: 14 }) : el(IconDownloadOutline16, { size: 14 }),
  busy ? (gitInstalled ? tt('git.initBusy') : tt('git.installing')) : (gitInstalled ? tt('git.init') : tt('git.installInit')),
)
