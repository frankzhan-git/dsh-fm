// git 状态机：状态轮询（数据签名一致时跳过重渲染）、聚合徽标/未跟踪/忽略/筛选、
// 「仅显示变更文件」可见性计算与祖先目录自动加载（从 useFmWorkspace 拆分，聚焦 git）
import React from 'react'
import { api } from '../core/api.js'
import { store } from '../core/store.js'
import { norm } from '../core/format.js'
import { POLL_MS } from '../core/constants.js'
import { FM_METHODS } from '../shared/fm-contract.js'

export function useFmGit(opts) {
  const { open, onError, rootPath, tree, treeRef, loadDir, safePatch } = opts || {}
  const [gitInfo, setGitInfo] = React.useState(null)
  const [diffOnly, setDiffOnly] = React.useState(false)

  const gitBusy = React.useRef(false)
  const gitSigRef = React.useRef('')

  // 仅已跟踪的修改/删除文件参与 git 徽标与筛选（未跟踪/忽略内容不关心其新增状态）
  const gitMap = {}
  if (gitInfo && gitInfo.files) for (const f of gitInfo.files) if (!f.untracked) gitMap[f.path] = f
  const changedSet = new Set(Object.keys(gitMap))

  // 按目录聚合 git 变更：每个目录 → 其下（含更深层）变更文件数、加/减行数
  const dirGit = React.useMemo(() => {
    const map = {}
    if (!gitInfo || !gitInfo.files) return map
    const rootNorm = rootPath ? norm(rootPath) : null
    for (const f of gitInfo.files) {
      if (f.untracked) continue
      let p = norm(f.path)
      if (p.endsWith('/')) p = p.slice(0, -1)
      let idx = p.lastIndexOf('/')
      while (idx > 0) {
        const dir = p.slice(0, idx)
        if (rootNorm && dir !== rootNorm && dir.indexOf(rootNorm + '/') !== 0) break
        let e = map[dir]
        if (!e) e = map[dir] = { count: 0, added: 0, deleted: 0 }
        e.count++
        if (typeof f.added === 'number') e.added += f.added
        if (typeof f.deleted === 'number') e.deleted += f.deleted
        idx = dir.lastIndexOf('/')
      }
    }
    return map
  }, [gitInfo, rootPath])

  // 未被 git 索引的路径集合：未跟踪（??）与被忽略（!!）的文件/目录，用于暗色显示
  const untrackedSet = React.useMemo(() => {
    const s = new Set()
    if (gitInfo && gitInfo.files) for (const f of gitInfo.files) {
      if (!f.untracked) continue
      let p = norm(f.path)
      if (p.endsWith('/')) p = p.slice(0, -1)
      s.add(p)
    }
    return s
  }, [gitInfo])
  const ignoredSet = React.useMemo(() => {
    const s = new Set()
    if (gitInfo && gitInfo.ignored) for (const p0 of gitInfo.ignored) {
      let p = norm(p0)
      if (p.endsWith('/')) p = p.slice(0, -1)
      s.add(p)
    }
    return s
  }, [gitInfo])

  // 「仅显示变更文件」模式下可见的节点集合
  const visible = React.useMemo(() => {
    if (!diffOnly) return null
    const vis = new Set()
    const walk = (n) => {
      let v = changedSet.has(n.path)
      for (const cp of n.childPaths) {
        const c = tree[cp]
        if (c && walk(c)) v = true
      }
      if (v) vis.add(n.path)
      return v
    }
    if (rootPath && tree[rootPath]) walk(tree[rootPath])
    return vis
  }, [diffOnly, gitInfo, tree, rootPath])

  const refreshGit = async () => {
    try {
      const r = await api(FM_METHODS.GIT_STATUS, { sessionId: store.sessionId, root: store.root })
      if (r && r.ok) {
        // 数据签名一致时跳过 setState，避免每轮轮询都触发整组件重渲染
        const sig = JSON.stringify({ hr: !!r.hasRepo, gi: !!r.gitInstalled, f: r.files || [], ig: r.ignored || [], ta: r.totalAdded || 0, td: r.totalDeleted || 0 })
        if (gitSigRef.current !== sig) {
          gitSigRef.current = sig
          setGitInfo({ hasRepo: !!r.hasRepo, gitInstalled: !!r.gitInstalled, files: r.files || [], ignored: r.ignored || [], totalAdded: r.totalAdded || 0, totalDeleted: r.totalDeleted || 0 })
        }
      } else {
        if (gitSigRef.current !== 'none') {
          gitSigRef.current = 'none'
          setGitInfo({ hasRepo: false, gitInstalled: false, files: [], ignored: [], totalAdded: 0, totalDeleted: 0 })
        }
      }
    } catch (e) {
      if (gitSigRef.current !== 'err') {
        gitSigRef.current = 'err'
        setGitInfo(null)
      }
    }
  }

  // 「仅显示变更文件」模式下自动加载并展开变更文件的祖先目录
  React.useEffect(() => {
    if (!diffOnly || !gitInfo || !gitInfo.files) return
    const rootNorm = rootPath ? norm(rootPath) : null
    const dirs = new Set()
    for (const f of gitInfo.files) {
      if (f.untracked) continue
      let p = norm(f.path)
      if (p.endsWith('/')) p = p.slice(0, -1)
      let idx = p.lastIndexOf('/')
      while (idx > 0) {
        const dir = p.slice(0, idx)
        if (rootNorm && dir !== rootNorm && dir.indexOf(rootNorm + '/') !== 0) break
        dirs.add(dir)
        idx = dir.lastIndexOf('/')
      }
    }
    ;(async () => {
      for (const d of dirs) {
        const node = treeRef.current[d]
        if (node && node.loaded) {
          if (!node.expanded) safePatch(d, { expanded: true })
          continue
        }
        await loadDir(d, true)
      }
    })()
  }, [diffOnly, gitInfo, rootPath])

  // git 状态轮询（与目录轮询解耦）
  React.useEffect(() => {
    if (!open) return
    const gitTimer = setInterval(async () => {
      if (gitBusy.current) return
      gitBusy.current = true
      try {
        await refreshGit()
      } finally {
        gitBusy.current = false
      }
    }, POLL_MS)
    return () => { clearInterval(gitTimer) }
  }, [open])

  return {
    gitInfo, diffOnly, setDiffOnly,
    gitMap, changedSet, dirGit, untrackedSet, ignoredSet, visible,
    refreshGit,
  }
}
