// 左侧文件树列：标题（回工作区根）、错误条、工具栏（上级/git 统计/提交/筛选/索引管理）、
// 路径、滚动渐隐列表（行渲染委托 FileRow）、提交/索引浮窗（CommitDialog / IndexAskDialog）
import React from 'react'
import {
  IconBranchOutline16,
  IconChecklistOutline14,
  IconDownloadOutline16,
  IconSearchOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { api } from '../core/api.js'
import { store } from '../core/store.js'
import { shortPath } from '../core/format.js'
import { FM_METHODS } from '../shared/fm-contract.js'
import { FileRow } from './FileRow.js'
import { CommitDialog } from './CommitDialog.js'
import { IndexAskDialog } from './IndexAskDialog.js'

const el = React.createElement

export function TreePanel(props) {
  const { ws, error, busy, onOpenFile, onRowMenu, onError } = props
  const {
    rootPath, tree, gitInfo, diffOnly,
    loadDir, navigate, goWorkspaceRoot, refreshGit,
  } = ws

  const [commitOpen, setCommitOpen] = React.useState(false)
  const [listTopFade, setListTopFade] = React.useState(false)
  const [listBotFade, setListBotFade] = React.useState(false)
  const listRef = React.useRef(null)
  const lastDirClick = React.useRef(null)
  // 索引管理：indexMode 开/关、操作忙态、目录批量弹窗（{ node, checked }）
  const [indexMode, setIndexMode] = React.useState(false)
  const [indexBusy, setIndexBusy] = React.useState(false)
  const [indexAsk, setIndexAsk] = React.useState(null)
  // git 初始化/安装操作忙态
  const [gitOpBusy, setGitOpBusy] = React.useState(false)

  const updateListFades = () => {
    const el0 = listRef.current
    if (!el0) return
    setListTopFade(el0.scrollTop > 2)
    setListBotFade(el0.scrollTop + el0.clientHeight < el0.scrollHeight - 2)
  }
  React.useEffect(() => {
    updateListFades()
  }, [tree, rootPath, diffOnly])

  // ---- git 初始化 / 安装并初始化（作用于当前根目录，即视图锚点） ----
  const doGitOp = async (install) => {
    if (gitOpBusy) return
    setGitOpBusy(true)
    if (onError) onError(null)
    try {
      const r = await api(install ? FM_METHODS.GIT_INSTALL_INIT : FM_METHODS.GIT_INIT, { sessionId: store.sessionId, root: store.root, anchor: rootPath || store.root })
      if (r && r.ok) {
        await refreshGit()
        loadDir(rootPath)
      } else if (onError) {
        onError((r && r.error) || (install ? '安装 git 失败' : '初始化仓库失败'))
      }
    } catch (e) {
      if (onError) onError(e && e.message ? e.message : String(e))
    } finally {
      setGitOpBusy(false)
    }
  }

  // ---- 索引管理 ----
  // 是否被 .gitignore 排除（自身或任一祖先目录被忽略，即「不在索引」）
  const ignoredAncestorOf = (p) => {
    let i = p.lastIndexOf('/')
    while (i > 0) {
      const a = p.slice(0, i)
      if (ws.ignoredSet.has(a)) return a
      i = a.lastIndexOf('/')
    }
    return null
  }
  const isIgnoredEff = (p) => ws.ignoredSet.has(p) || !!ignoredAncestorOf(p)

  const setIndexOp = async (path, checked, recursive) => {
    const r = await api(FM_METHODS.GIT_INDEX_SET, { path, checked, recursive, sessionId: store.sessionId, root: store.root, anchor: rootPath || store.root })
    if (r && r.ok) {
      await refreshGit()
    } else if (onError) {
      onError((r && r.error) || '索引操作失败')
    }
  }

  const onIndexToggle = async (node, checked) => {
    if (indexBusy) return
    setIndexBusy(true)
    if (onError) onError(null)
    try {
      if (node.type !== 'directory') {
        await setIndexOp(node.path, checked, false)
        return
      }
      // 目录：先探测是否非空，非空则弹窗询问是否批量设置内部所有文件
      const r = await api(FM_METHODS.GIT_INDEX_SET, { path: node.path, checked, probe: true, sessionId: store.sessionId, root: store.root })
      if (!r || !r.ok) {
        if (onError) onError((r && r.error) || '操作失败')
        return
      }
      if (r.dirNonEmpty) setIndexAsk({ node, checked })
      else await setIndexOp(node.path, checked, false)
    } catch (e) {
      if (onError) onError(e && e.message ? e.message : String(e))
    } finally {
      setIndexBusy(false)
    }
  }

  const confirmIndex = (recursive) => {
    const ask = indexAsk
    setIndexAsk(null)
    if (!ask || indexBusy) return
    setIndexBusy(true)
    ;(async () => {
      try {
        await setIndexOp(ask.node.path, ask.checked, recursive)
      } catch (e) {
        if (onError) onError(e && e.message ? e.message : String(e))
      } finally {
        setIndexBusy(false)
      }
    })()
  }

  const rowUi = {
    indexMode, indexBusy,
    onIndexToggle, onRowMenu, onOpenFile,
    lastDirClickRef: lastDirClick,
    ignoredAncestorOf, isIgnoredEff,
  }

  const rootNode = rootPath ? tree[rootPath] : undefined
  const hasChanges = gitInfo && gitInfo.hasRepo && gitInfo.files.length > 0
  // 规则三：胶囊组判定——当前根自身有仓库 → 该仓库工具条；
  // 自身无仓库但最近上级仓库索引自身 → 该上级仓库工具条；其余 → 初始化胶囊
  const gitCtx = gitInfo && gitInfo.context
  const anchorIndexed = !!gitCtx && gitCtx.anchorIndexed
  const showGitToolbar = !!gitInfo && !!gitInfo.hasRepo && anchorIndexed
  const showInitCapsule = !!gitInfo && (!gitInfo.hasRepo || !anchorIndexed)

  return el('div', { className: 'fm-col-tree' },
    el('div', { className: 'fm-tree-title' },
      el('button', {
        type: 'button',
        className: 'fm-tree-title-btn',
        title: '回到工作目录',
        onClick: goWorkspaceRoot,
      }, '工作目录'),
      el('span', { className: 'fm-spacer' }),
      // 胶囊组（git 工具条 / 初始化胶囊 / loading 占位）与左上角标题同行、右对齐
      gitInfo === null ? el('div', { className: 'fm-git-loading', role: 'status' },
        el('span', { className: 'fm-git-loading-spin' }),
        '读取 git 状态…',
      ) : showGitToolbar ? el('div', { className: 'fm-git' },
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
        el('button', {
          className: 'fm-git-btn' + (indexMode ? ' fm-git-btn-on' : ''),
          title: '索引管理：勾选=加入索引，取消=排除并同步 .gitignore',
          onClick: () => setIndexMode(!indexMode),
        }, el(IconChecklistOutline14, { size: 14 })),
      ) : showInitCapsule ? el('button', {
        className: 'fm-capsule',
        disabled: gitOpBusy,
        title: gitInfo.gitInstalled === false ? '安装 git 并在当前目录创建本地仓库' : '在当前目录创建本地仓库',
        onClick: () => doGitOp(gitInfo.gitInstalled === false),
      },
        gitInfo.gitInstalled === false ? el(IconDownloadOutline16, { size: 14 }) : el(IconBranchOutline16, { size: 14 }),
        gitOpBusy ? (gitInfo.gitInstalled === false ? '安装中…' : '初始化中…') : (gitInfo.gitInstalled === false ? '安装并初始化仓库' : '初始化仓库'),
      ) : null,
    ),
    error ? el('div', { className: 'fm-error' }, error) : null,
    el('div', { className: 'fm-hint' }, indexMode ? '勾选=加入索引，取消=排除并同步 .gitignore' : '单击展开/预览，双击进入目录，双击根目录返回上级，右键更多操作'),
    // 路径行：精简显示（长路径只保留末尾段，防换行），完整路径在 title
    el('div', { className: 'fm-path', title: rootPath }, shortPath(rootPath) || ''),
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
              return c.type === 'directory' ? !!ws.visible.has(cp) : ws.changedSet.has(cp)
            }) ? el('div', { className: 'fm-empty' }, '无变更文件')
          : rootNode.childPaths.length === 0 ? el('div', { className: 'fm-empty' }, '此目录为空')
          : el(FileRow, { ws, node: rootNode, depth: 0, dim: false, ui: rowUi }),
      ),
    ),
    commitOpen ? el(CommitDialog, {
      anchor: rootPath || store.root,
      onClose: () => setCommitOpen(false),
      onDone: () => { refreshGit(); loadDir(rootPath) },
      onError,
    }) : null,
    indexAsk ? el(IndexAskDialog, {
      ask: indexAsk,
      onClose: () => setIndexAsk(null),
      onConfirm: confirmIndex,
      busy: indexBusy,
    }) : null,
  )
}
