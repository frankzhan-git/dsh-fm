// 文件树状态机：懒加载 + 展开/导航 + 目录轮询（从 useFmWorkspace 拆分，聚焦树）
import React from 'react'
import { api } from '../core/api.js'
import { store } from '../core/store.js'
import { norm, base } from '../core/format.js'
import { mergeListing } from '../core/tree-merge.js'
import { POLL_MS } from '../core/constants.js'
import { FM_METHODS } from '../shared/contract/index.js'

export function useFmTree(opts) {
  const { open, onError, onBusy, pruneMissing } = opts || {}
  const [rootPath, setRootPath] = React.useState(null)
  const [tree, setTree] = React.useState({})

  const treeRef = React.useRef(tree)
  treeRef.current = tree
  const pollBusy = React.useRef(false)

  const safePatch = (path, patch) => setTree((t) => (t[path] ? Object.assign({}, t, { [path]: Object.assign({}, t[path], patch) }) : t))

  const loadDir = async (dirPath, expand) => {
    if (onError) onError(null)
    try {
      const r = await api(FM_METHODS.LIST, { path: dirPath, sessionId: store.sessionId, root: store.root })
      if (!r || !r.ok) {
        if (onError) onError((r && (r.message || r.error)) || '加载失败')
        return
      }
      setTree((t) => {
        const cur = t[dirPath]
        const name = (cur && cur.name) || base(dirPath) || dirPath
        // 合并式刷新：已存在节点仅更新数据元信息，UI 状态（loaded/expanded/childPaths）保留 ——
        // 任何来源（轮询/索引后刷新/提交后刷新）的重刷都不会让用户展开的子目录收起
        const { childPaths, additions, removed } = mergeListing(t, dirPath, r.entries)
        const next = {}
        for (const k of Object.keys(t)) {
          if (removed.indexOf(k) !== -1) continue
          next[k] = t[k]
        }
        return Object.assign(next, additions, {
          [dirPath]: { path: dirPath, name, type: 'directory', size: null, loaded: true, expanded: expand ? true : (cur ? !!cur.expanded : true), loading: false, childPaths },
        })
      })
    } catch (e) {
      if (onError) onError(e && e.message ? e.message : String(e))
    }
  }

  const toggleDir = async (dirPath) => {
    const node = tree[dirPath]
    if (!node) return
    if (!node.loaded) await loadDir(dirPath, true)
    else safePatch(dirPath, { expanded: !node.expanded })
  }

  const navigate = async (dirPath) => {
    store.lastRoot = dirPath
    setRootPath(dirPath)
    await loadDir(dirPath, true)
  }

  const goWorkspaceRoot = async () => {
    store.lastRoot = null
    const target = store.root
    if (target) {
      setRootPath(target)
      await loadDir(target, true)
    }
  }

  const goParent = () => {
    if (!rootPath) return
    const i = rootPath.lastIndexOf('/')
    if (i <= 0) return
    navigate(rootPath.slice(0, i))
  }

  // 打开弹窗时初始加载：记忆目录 > 工作区根
  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    if (onBusy) onBusy(true)
    if (onError) onError(null)
    ;(async () => {
      try {
        const raw = store.lastRoot || store.root
        const target = raw ? norm(raw) : null
        if (target) {
          setRootPath(target)
          await loadDir(target, true)
        } else {
          const r = await api(FM_METHODS.ROOT, { root: store.root, sessionId: store.sessionId })
          if (cancelled) return
          const rootPath0 = r && r.root ? norm(r.root) : null
          if (rootPath0) { setRootPath(rootPath0); await loadDir(rootPath0, true) }
          else if (onError) onError('无法获取工作目录')
        }
      } catch (e) {
        if (!cancelled && onError) onError(e && e.message ? e.message : String(e))
      } finally {
        if (!cancelled && onBusy) onBusy(false)
      }
    })()
    return () => { cancelled = true }
  }, [open])

  const sigOf = (dirPath, t) => {
    const node = t[dirPath]
    if (!node) return ''
    return node.childPaths.map((p) => {
      const n = t[p]
      return n ? n.name + '|' + n.type + '|' + (n.size == null ? '' : n.size) : p
    }).join(',')
  }

  // 目录轮询：仅轮询当前视图内（根目录下已展开分支）的已加载目录，且并行请求；
  // 与 git 轮询解耦（git 命令慢不再阻塞目录更新）
  React.useEffect(() => {
    if (!open || !rootPath) return
    const timer = setInterval(async () => {
      if (pollBusy.current) return
      pollBusy.current = true
      try {
        const t = treeRef.current
        const dirs = []
        const collect = (p) => {
          const n = t[p]
          if (!n || n.type !== 'directory') return
          dirs.push(p)
          if (n.expanded) for (const cp of n.childPaths) collect(cp)
        }
        if (t[rootPath]) collect(rootPath)
        const loaded = dirs.filter((p) => t[p].loaded)
        const stale = (await Promise.all(loaded.map(async (d) => {
          try {
            const r = await api(FM_METHODS.LIST, { path: d, sessionId: store.sessionId, root: store.root })
            if (!r || !r.ok) return null
            const fresh = r.entries.map((e) => e.name + '|' + e.type + '|' + (e.size == null ? '' : e.size)).join(',')
            return sigOf(d, treeRef.current) !== fresh ? d : null
          } catch (e) { return null }
        }))).filter(Boolean)
        if (stale.length > 0) {
          await Promise.all(stale.map((d) => loadDir(d)))
          if (pruneMissing) pruneMissing((path) => !!treeRef.current[path])
        }
      } finally {
        pollBusy.current = false
      }
    }, POLL_MS)
    return () => { clearInterval(timer) }
  }, [open, rootPath])

  return {
    rootPath, tree, treeRef, safePatch,
    loadDir, toggleDir, navigate, goParent, goWorkspaceRoot,
  }
}
