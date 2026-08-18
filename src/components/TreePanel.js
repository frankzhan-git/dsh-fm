// 左侧文件树列：标题（回工作区根）、错误条、工具栏（上级/刷新/git 统计/提交/筛选）、
// 路径、滚动渐隐列表（行渲染：展开/双击导航/右键菜单/git 徽标/未跟踪暗色）、提交浮窗
import React from 'react'
import {
  IconBranchOutline16,
  IconChevronUpOutline14,
  IconFolderClose16,
  IconFolderOpen16,
  IconRefreshOutline14,
  IconSearchOutline16,
  IconTriangleRightFill14,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { api } from '../core/api.js'
import { store } from '../core/store.js'
import { DBL_CLICK_MS } from '../core/constants.js'
import { fmtSize, sortKids } from '../core/format.js'
import { fileBadge } from './FileBadge.js'

const el = React.createElement

export function TreePanel(props) {
  const { ws, error, busy, onOpenFile, onRowMenu, onError } = props
  const {
    rootPath, tree, gitInfo, diffOnly, gitMap, changedSet, dirGit,
    untrackedSet, ignoredSet, visible,
    loadDir, toggleDir, navigate, goParent, goWorkspaceRoot, refreshGit,
  } = ws

  const [commitOpen, setCommitOpen] = React.useState(false)
  const [commitMsg, setCommitMsg] = React.useState('')
  const [commitBusy, setCommitBusy] = React.useState(false)
  const [listTopFade, setListTopFade] = React.useState(false)
  const [listBotFade, setListBotFade] = React.useState(false)
  const listRef = React.useRef(null)
  const lastDirClick = React.useRef(null)

  const updateListFades = () => {
    const el0 = listRef.current
    if (!el0) return
    setListTopFade(el0.scrollTop > 2)
    setListBotFade(el0.scrollTop + el0.clientHeight < el0.scrollHeight - 2)
  }
  React.useEffect(() => {
    updateListFades()
  }, [tree, rootPath, diffOnly])

  const doCommit = async () => {
    const msg = commitMsg.trim()
    if (!msg || commitBusy) return
    setCommitBusy(true)
    if (onError) onError(null)
    try {
      const r = await api('fm-git-commit', { msg, sessionId: store.sessionId, root: store.root })
      if (r && r.ok) {
        setCommitOpen(false)
        setCommitMsg('')
        await refreshGit()
        loadDir(rootPath)
      } else if (onError) {
        onError((r && r.error) || '提交失败')
      }
    } catch (e) {
      if (onError) onError(e && e.message ? e.message : String(e))
    } finally {
      setCommitBusy(false)
    }
  }

  const renderNode = (node, depth, parentDim) => {
    const isDir = node.type === 'directory'
    const dim = parentDim || untrackedSet.has(node.path) || ignoredSet.has(node.path)
    if (diffOnly) {
      if (isDir && !visible.has(node.path)) return null
      if (!isDir && !changedSet.has(node.path)) return null
    }
    const kids = sortKids(isDir ? node.childPaths.map((cp) => tree[cp]).filter(Boolean) : [])
    const rowProps = {
      className: 'fm-row' + (dim ? ' fm-untracked' : ''),
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
        const last = lastDirClick.current
        if (last && last.path === node.path && now - last.time <= DBL_CLICK_MS) {
          lastDirClick.current = null
          if (node.path !== rootPath) navigate(node.path)
          return
        }
        lastDirClick.current = { path: node.path, time: now }
        toggleDir(node.path)
      }
    } else {
      rowProps.onClick = () => onOpenFile(node)
    }
    const g = gitMap[node.path]
    const dg = isDir ? dirGit[node.path] : null
    const row = el('div', rowProps,
      el('span', { className: 'fm-icon' },
        isDir ? el('span', { className: 'fm-chev' + (node.expanded ? ' fm-chev-open' : '') }, el(IconTriangleRightFill14, { size: 12 })) : el('span', { className: 'fm-chev-gap' }),
        isDir ? el(node.expanded ? IconFolderOpen16 : IconFolderClose16, { size: 16 }) : fileBadge(node.name),
      ),
      el('span', { className: 'fm-name' }, node.name),
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
      node.expanded ? kids.map((k) => renderNode(k, depth + 1, dim)) : null,
    )
  }

  const rootNode = rootPath ? tree[rootPath] : undefined
  const hasChanges = gitInfo && gitInfo.hasRepo && gitInfo.files.length > 0

  return el('div', { className: 'fm-col-tree' },
    el('div', {
      className: 'fm-tree-title',
      title: '回到工作目录',
      tabIndex: 0,
      onClick: goWorkspaceRoot,
      onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goWorkspaceRoot() } },
    }, '工作目录'),
    error ? el('div', { className: 'fm-error' }, error) : null,
    el('div', { className: 'fm-toolbar' },
      el('button', { className: 'fm-btn', title: '上级目录', disabled: !rootPath, onClick: goParent }, el(IconChevronUpOutline14, { size: 14 }), '上级'),
      el('button', { className: 'fm-btn', title: '刷新', disabled: !rootPath, onClick: () => loadDir(rootPath) }, el(IconRefreshOutline14, { size: 14 }), '刷新'),
      el('span', { className: 'fm-spacer' }),
      gitInfo && gitInfo.hasRepo ? el('div', { className: 'fm-git' },
        el('span', { className: 'fm-git-stat', title: '未提交变更统计' },
          el('span', { className: 'fm-git-add' }, '+' + gitInfo.totalAdded),
          el('span', { className: 'fm-git-del' }, '-' + gitInfo.totalDeleted),
        ),
        hasChanges ? el('button', {
          className: 'fm-git-btn',
          title: '提交变更',
          onClick: () => setCommitOpen(true),
        }, el(IconBranchOutline16, { size: 14 })) : null,
        el('button', {
          className: 'fm-git-btn' + (diffOnly ? ' fm-git-btn-on' : ''),
          title: diffOnly ? '显示全部文件' : '仅显示变更文件',
          onClick: () => ws.setDiffOnly(!diffOnly),
        }, el(IconSearchOutline16, { size: 14 })),
      ) : null,
    ),
    el('div', { className: 'fm-hint' }, '单击展开/预览，双击进入目录，右键更多操作'),
    el('div', { className: 'fm-path', title: rootPath }, rootPath || ''),
    busy ? el('div', { className: 'fm-busy' }, '…') : null,
    el('div', {
      className: 'fm-list-wrap' + (listTopFade ? ' fm-list-mask-top' : '') + (listBotFade ? ' fm-list-mask-bot' : ''),
    },
      el('div', {
        className: 'fm-list',
        ref: listRef,
        onScroll: updateListFades,
        onContextMenu: (e) => { e.preventDefault(); onRowMenu(null, e) },
      },
        !rootNode ? el('div', { className: 'fm-empty' }, '加载中…')
          : diffOnly && gitInfo === null ? el('div', { className: 'fm-empty' }, '正在统计变更…')
          : diffOnly && !rootNode.childPaths.some((cp) => {
              const c = tree[cp]
              if (!c) return false
              return c.type === 'directory' ? !!visible.has(cp) : changedSet.has(cp)
            }) ? el('div', { className: 'fm-empty' }, '无变更文件')
          : rootNode.childPaths.length === 0 ? el('div', { className: 'fm-empty' }, '此目录为空')
          : renderNode(rootNode, 0),
      ),
    ),
    commitOpen ? el(React.Fragment, null,
      el('div', { className: 'fm-menu-backdrop', onClick: () => setCommitOpen(false) }),
      el('div', { className: 'fm-menu fm-pop2', onClick: (e) => e.stopPropagation() },
        el('div', { className: 'fm-menu-title' }, '提交变更'),
        el('input', {
          className: 'fm-commit-input',
          value: commitMsg,
          placeholder: '提交信息',
          onChange: (e) => setCommitMsg(e.target.value),
          onKeyDown: (e) => {
            if (e.key === 'Enter') { e.preventDefault(); doCommit() }
            if (e.key === 'Escape') { e.stopPropagation(); setCommitOpen(false) }
          },
        }),
        el('div', { className: 'fm-menu-actions' },
          el('button', { className: 'fm-btn fm-btn-danger', disabled: commitBusy || !commitMsg.trim(), onClick: doCommit }, '提交'),
          el('button', { className: 'fm-btn', onClick: () => setCommitOpen(false) }, '取消'),
        ),
      ),
    ) : null,
  )
}
