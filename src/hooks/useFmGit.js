// git 状态组合层（从 useFmWorkspace 拆分而来，聚焦 git —— 架构根治版）：
// 三切片组合：useGitMachine（status 状态机 T1–T6）+ useGitContext（锚点→仓库，零 shell）
//            + useGitCapability（是否安装 git，低频）。
// 对外派生面保持旧接口（gitInfo/gitMap/changedSet/dirGit/untrackedSet/ignoredSet/visible/diffOnly/refreshGit），
// 新增胶囊渲染所需面（gitPhase/gitError/gitCap/gitCtx/retryGit/refreshCapability）。
import React from 'react'
import { norm } from '../core/format.js'
import { GIT_PHASE } from '../core/git-machine.js'
import { useGitMachine } from './git/useGitMachine.js'
import { useGitContext } from './git/useGitContext.js'
import { useGitCapability } from './git/useGitCapability.js'

export function useFmGit(opts) {
  const { open, onError, rootPath, tree, treeRef, loadDir, safePatch } = opts || {}
  const [diffOnly, setDiffOnly] = React.useState(false)

  const { gitMachineState, retryGit, refreshNow } = useGitMachine({ open, anchor: rootPath })
  const { gitCtx, gitCtxError } = useGitContext({ open, anchor: rootPath })
  const { gitCap, gitCapError, refreshCapability } = useGitCapability({ open, anchor: rootPath })

  // ready 态数据（下游徽标/筛选/统计专用）；非 ready 一律 null（胶囊不再以 null 判 loading）
  const gitInfo = gitMachineState.phase === GIT_PHASE.READY ? gitMachineState.data : null

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

  // 未索引集合 = 未跟踪（??）∪ 忽略（!!）：目录三态/文件二态派生（core/index-state.js）的输入
  const unindexedSet = React.useMemo(() => {
    const s = new Set()
    for (const p of untrackedSet) s.add(p)
    for (const p of ignoredSet) s.add(p)
    return s
  }, [untrackedSet, ignoredSet])

  return {
    // —— 胶囊/状态机面（T1–T6）——
    gitPhase: gitMachineState.phase,
    gitError: gitMachineState.error,
    gitCap, gitCapError,
    gitCtx, gitCtxError,
    retryGit,
    refreshCapability,
    // —— 兼容派生面（徽标/筛选/统计/索引三态）——
    gitInfo, diffOnly, setDiffOnly,
    gitMap, changedSet, dirGit, untrackedSet, ignoredSet, unindexedSet, visible,
    refreshGit: refreshNow,
  }
}
