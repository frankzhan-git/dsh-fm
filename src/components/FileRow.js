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
import { indexStateOf, INDEX_STATE } from '../core/index-state.js'
import { fileBadge } from './FileBadge.js'

const el = React.createElement

export function FileRow({ ws, node, depth, dim, ui }) {
  const { tree, gitMap, dirGit, untrackedSet, ignoredSet, visible, changedSet, diffOnly, toggleDir, navigate, rootPath } = ws
  const { indexMode, indexBusy, onIndexToggle, onRowMenu, onOpenFile, lastDirClickRef, ignoredAncestorOf } = ui

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
    // 双击根目录节点 = 回退上级（替代原「上级」按钮，间隔与下钻一致）。
    rowProps.onClick = () => {
      const now = Date.now()
      const last = lastDirClickRef.current
      if (last && last.path === node.path && now - last.time <= DBL_CLICK_MS) {
        lastDirClickRef.current = null
        if (node.path !== rootPath) navigate(node.path)
        else if (ws.goParent) ws.goParent()
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
  // 索引状态（产品语义 v2）：目录三态（全部索引/部分索引/未索引），文件二态；
  // 派生规则见 core/index-state.js（porcelain 折叠保证集合判定可靠；祖先继承：整目录标记向下传播）。
  // 祖先被忽略 → 禁用并提示先取消上级忽略
  const ancestor = ignoredAncestorOf(node.path)
  const idxState = indexStateOf(node.path, ws.unindexedSet || new Set())
  // 未跟踪祖先（?? dir/ 标记）：用于 OFF 态文案区分「未跟踪」与「已排除」
  let untrackedAnc = null
  if (!ancestor && idxState === INDEX_STATE.OFF) {
    let i = node.path.lastIndexOf('/')
    while (i > 0) {
      const a = node.path.slice(0, i)
      if (untrackedSet.has(a)) { untrackedAnc = a; break }
      i = a.lastIndexOf('/')
    }
  }
  const untracked = untrackedSet.has(node.path)
  const row = el('div', rowProps,
    indexMode ? el('input', {
      type: 'checkbox',
      className: 'fm-index-cb',
      checked: idxState === INDEX_STATE.ON || idxState === INDEX_STATE.PART,
      ref: (eb) => { if (eb) eb.indeterminate = idxState === INDEX_STATE.PART },
      disabled: indexBusy || !!ancestor,
      title: ancestor
        ? '上级目录已忽略（' + ancestor + '），请先取消上级目录的忽略'
        : (idxState === INDEX_STATE.ON ? '已加入索引'
          : idxState === INDEX_STATE.PART ? '部分索引（目录内部分内容未加入索引）'
            : ((untracked || untrackedAnc) ? '未跟踪（未加入索引）' : '已排除（未加入索引）')),
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
