// 工作区状态机：文件树（懒加载 + 轮询）、git 状态（聚合徽标/未跟踪/筛选）、
// 初始加载与目录轮询、git 轮询（数据签名一致时跳过重渲染）
import React from 'react'
import { api } from '../core/api.js'
import { store } from '../core/store.js'
import { norm, base } from '../core/format.js'
import { POLL_MS } from '../core/constants.js'

export function useFmWorkspace(opts) {
  const { open, onError, onBusy, pruneMissing } = opts || {}
  const [rootPath, setRootPath] = React.useState(null)
  const [tree, setTree] = React.useState({})
  const [gitInfo, setGitInfo] = React.useState(null)
  const [diffOnly, setDiffOnly] = React.useState(false)

  const treeRef = React.useRef(tree)
  treeRef.current = tree
  const pollBusy = React.useRef(false)
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

  const safePatch = (path, patch) => setTree((t) => (t[path] ? Object.assign({}, t, { [path]: Object.assign({}, t[path], patch) }) : t))

  const loadDir = async (dirPath, expand) => {
    if (onError) onError(null)
    try {
      const r = await api('fm-list', { path: dirPath, sessionId: store.sessionId, root: store.root })
      if (!r || !r.ok) {
        if (onError) onError((r && r.error) || '加载失败')
        return
      }
      const childPaths = []
      const additions = {}
      for (const e of r.entries) {
        const p = norm(e.path)
        childPaths.push(p)
        additions[p] = { path: p, name: e.name, type: e.type, size: e.size == null ? null : e.size, loaded: false, expanded: false, loading: false, childPaths: [] }
      }
      setTree((t) => {
        const cur = t[dirPath]
        const name = (cur && cur.name) || base(dirPath) || dirPath
        const next = {}
        for (const k of Object.keys(t)) {
          if (cur && cur.childPaths && cur.childPaths.indexOf(k) !== -1 && childPaths.indexOf(k) === -1) continue
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

  const refreshGit = async () => {
    try {
      const r = await api('fm-git-status', { sessionId: store.sessionId, root: store.root })
      if (r && r.ok) {
        // 数据签名一致时跳过 setState，避免每轮轮询都触发整组件重渲染
        const sig = JSON.stringify({ hr: !!r.hasRepo, f: r.files || [], ig: r.ignored || [], ta: r.totalAdded || 0, td: r.totalDeleted || 0 })
        if (gitSigRef.current !== sig) {
          gitSigRef.current = sig
          setGitInfo({ hasRepo: !!r.hasRepo, files: r.files || [], ignored: r.ignored || [], totalAdded: r.totalAdded || 0, totalDeleted: r.totalDeleted || 0 })
        }
      } else {
        if (gitSigRef.current !== 'none') {
          gitSigRef.current = 'none'
          setGitInfo({ hasRepo: false, files: [], ignored: [], totalAdded: 0, totalDeleted: 0 })
        }
      }
    } catch (e) {
      if (gitSigRef.current !== 'err') {
        gitSigRef.current = 'err'
        setGitInfo(null)
      }
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

  // 打开弹窗时初始加载：记忆目录 > 工作区根；随后刷新 git 状态
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
          const r = await api('fm-root', { root: store.root, sessionId: store.sessionId })
          if (cancelled) return
          const rootPath0 = r && r.root ? norm(r.root) : null
          if (rootPath0) { setRootPath(rootPath0); await loadDir(rootPath0, true) }
          else if (onError) onError('无法获取工作目录')
        }
        await refreshGit()
      } catch (e) {
        if (!cancelled && onError) onError(e && e.message ? e.message : String(e))
      } finally {
        if (!cancelled && onBusy) onBusy(false)
      }
    })()
    return () => { cancelled = true }
  }, [open])

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

  const sigOf = (dirPath, t) => {
    const node = t[dirPath]
    if (!node) return ''
    return node.childPaths.map((p) => {
      const n = t[p]
      return n ? n.name + '|' + n.type + '|' + (n.size == null ? '' : n.size) : p
    }).join(',')
  }

  // 目录轮询与 git 刷新解耦：git 命令慢（如扫描大量未跟踪文件）不再阻塞目录更新；
  // 仅轮询当前视图内（根目录下已展开分支）的已加载目录，且并行请求
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
            const r = await api('fm-list', { path: d, sessionId: store.sessionId, root: store.root })
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
    const gitTimer = setInterval(async () => {
      if (gitBusy.current) return
      gitBusy.current = true
      try {
        await refreshGit()
      } finally {
        gitBusy.current = false
      }
    }, POLL_MS)
    return () => { clearInterval(timer); clearInterval(gitTimer) }
  }, [open, rootPath])

  return {
    rootPath, tree, treeRef, gitInfo, diffOnly, setDiffOnly,
    gitMap, changedSet, dirGit, untrackedSet, ignoredSet, visible,
    loadDir, toggleDir, navigate, goParent, goWorkspaceRoot, refreshGit,
  }
}
