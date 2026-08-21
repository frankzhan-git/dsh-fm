// 文件树行渲染：递归行（展开/双击导航/右键菜单/git 徽标/未跟踪暗色/索引复选框）
// 自 TreePanel 拆分；ws 为工作区状态（只读），ui 为行交互回调集合。
import React from 'react'
import {
  IconBranchOutline16,
  IconFolderClose16,
  IconFolderOpen16,
  IconTriangleRightFill14,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { DBL_CLICK_MS } from '../core/constants.js'
import { fmtSize, sortKids } from '../core/format.js'
import { fileBadge } from './FileBadge.js'

const el = React.createElement

export function FileRow({ ws, node, depth, dim, ui }) {
  const { tree, gitMap, dirGit, untrackedSet, ignoredSet, visible, changedSet, diffOnly, toggleDir, navigate, rootPath } = ws
  const { indexMode, indexBusy, onIndexToggle, onRowMenu, onOpenFile, lastDirClickRef, ignoredAncestorOf, isIgnoredEff } = ui

  const isDir = node.type === 'directory'
  const dimmed = dim || untrackedSet.has(node.path) || ignoredSet.has(node.path)
  if (diffOnly) {
    if (isDir && !visible.has(node.path)) return null
    if (!isDir && !changedSet.has(node.path)) return null
  }
  const kids = sortKids(isDir ? node.childPaths.map((cp) => tree[cp]).filter(Boolean) : [])
  const rowProps = {
    className: 'fm-row' + (dimmed ? ' fm-untracked' : ''),
    key: node.path,
    style: { paddingLeft: 8 + depth * 20 },
    tabIndex: 0,
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        if (isDir) {
          toggleDir(node.path)
        } else {
          onOpenFile(node)
        }
      }
    },
    onContextMenu: (e) => {
      e.preventDefault()
      e.stopPropagation()
      onRowMenu(node, e)
    },
  }
  if (isDir) {
    // 手动双击检测：两次单击间隔 ≤ DBL_CLICK_MS 视为双击进入目录。
    // 不用浏览器原生 dblclick（跟随系统设置约 500ms，慢速连续单击会被误判），
    // 缩短到 250ms：故意连续展开/收起两次不会触发，快速双击仍然有效。
    rowProps.onClick = () => {
      const now = Date.now()
      const last = lastDirClickRef.current
      if (last && last.path === node.path && now - last.time <= DBL_CLICK_MS) {
        lastDirClickRef.current = null
        if (node.path !== rootPath) navigate(node.path)
        return
      }
      lastDirClickRef.current = { path: node.path, time: now }
      toggleDir(node.path)
    }
  } else {
    rowProps.onClick = () => onOpenFile(node)
  }
  const g = gitMap[node.path]
  const dg = isDir ? dirGit[node.path] : null
  const row = el('div', rowProps,
    indexMode ? el('input', {
      type: 'checkbox',
      className: 'fm-index-cb',
      checked: !isIgnoredEff(node.path),
      disabled: indexBusy || !!ignoredAncestorOf(node.path),
      title: ignoredAncestorOf(node.path)
        ? '上级目录已忽略（' + ignoredAncestorOf(node.path) + '），请先取消上级目录的忽略'
        : (isIgnoredEff(node.path) ? '已排除（未加入索引）' : '已加入索引'),
      onClick: (e) => e.stopPropagation(),
      onChange: (e) => onIndexToggle(node, e.target.checked),
    }) : null,
    el('span', { className: 'fm-icon' },
      isDir ? el('span', { className: 'fm-chev' + (node.expanded ? ' fm-chev-open' : '') }, el(IconTriangleRightFill14, { size: 12 })) : el('span', { className: 'fm-chev-gap' }),
      isDir ? el(node.expanded ? IconFolderOpen16 : IconFolderClose16, { size: 16 }) : fileBadge(node.name),
    ),
    el('span', { className: 'fm-name' }, node.name),
    // 规则四：目录自带 .git → 无论亮暗/是否被索引，一律显示独立仓库 git 标签
    isDir && node.hasGit ? el('span', { className: 'fm-git-tag', title: '独立 git 仓库' }, el(IconBranchOutline16, { size: 12 })) : null,
    g && !isDir && (g.added > 0 || g.deleted > 0) ? el('span', { className: 'fm-git-diff' },
      g.added > 0 ? el('span', { className: 'fm-git-add' }, '+' + g.added) : null,
      g.deleted > 0 ? el('span', { className: 'fm-git-del' }, '-' + g.deleted) : null,
    ) : null,
    dg ? el('span', { className: 'fm-git-diff', title: dg.count + ' files changed' + (dg.added > 0 ? ', +' + dg.added : '') + (dg.deleted > 0 ? ', -' + dg.deleted : '') },
      el('span', { className: 'fm-git-count' }, dg.count + ' files'),
      dg.added > 0 ? el('span', { className: 'fm-git-add' }, '+' + dg.added) : null,
      dg.deleted > 0 ? el('span', { className: 'fm-git-del' }, '-' + dg.deleted) : null,
    ) : null,
    el('span', { className: 'fm-size' }, fmtSize(node.size)),
  )
  if (!isDir) return row
  return el(React.Fragment, { key: node.path },
    row,
    node.expanded ? kids.map((k) => el(FileRow, { ws, node: k, depth: depth + 1, dim: dimmed, ui })) : null,
  )
}
