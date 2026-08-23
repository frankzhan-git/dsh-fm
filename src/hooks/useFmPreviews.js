// 预览选项卡状态机：打开/读取文件、选项卡关闭（含区间/其他/全部）、
// 删除联动清理（removePreviews）与轮询同步（pruneMissing）
import React from 'react'
import { api } from '../core/api.js'
import { store } from '../core/store.js'
import { extOf, fmtSize } from '../core/format.js'
import { langFor, tokenize } from '../core/highlight.js'
import { HL_LIMIT, MAX_TABS } from '../core/constants.js'
import { FM_METHODS } from '../shared/contract/index.js'

let previewSeq = 0

export function useFmPreviews(opts) {
  const { onError } = opts || {}
  const [previews, setPreviews] = React.useState([])
  const [activeKey, setActiveKey] = React.useState(null)
  const previewsRef = React.useRef(previews)
  previewsRef.current = previews

  const activePreview = previews.find((p) => p.key === activeKey) || previews[0] || null

  // 打开文件：已有同名选项卡则切换激活，否则新建并异步读取
  const openFile = async (entry) => {
    if (previews.some((p) => p.path === entry.path)) {
      const hit = previews.find((p) => p.path === entry.path)
      setActiveKey(hit.key)
      return
    }
    const key = ++previewSeq
    const isMd = extOf(entry.name) === 'md' || extOf(entry.name) === 'markdown'
    setPreviews((prev) => {
      const next = prev.concat([{ key, path: entry.path, name: entry.name, loading: true, size: null, diff: false, diffData: null, diffUntracked: false, diffUntrackedContent: null, md: isMd }])
      return next.length > MAX_TABS ? next.slice(next.length - MAX_TABS) : next
    })
    setActiveKey(key)
    try {
      const r = await api(FM_METHODS.READ, { path: entry.path, sessionId: store.sessionId, root: store.root })
      if (r && r.ok) {
        let data
        if (r.kind === 'image') {
          data = { kind: 'image', dataUrl: 'data:' + r.mime + ';base64,' + r.base64, size: r.size }
        } else if (r.kind === 'text') {
          const conf = langFor(extOf(entry.name))
          const tokens = r.content && r.content.length <= HL_LIMIT ? tokenize(r.content, conf) : null
          data = { kind: 'text', content: r.content || '', tokens, truncated: !!r.truncated, limit: r.limit, size: r.size }
        } else if (r.kind === 'tooLarge') {
          data = { kind: 'unsupported', size: r.size, ext: null, message: r.message || ('文件过大（' + fmtSize(r.size) + '），无法预览') }
        } else {
          data = { kind: 'unsupported', size: r.size, ext: r.ext, message: null }
        }
        setPreviews((prev) => prev.map((p) => p.key === key ? Object.assign({}, p, data, { loading: false }) : p))
      } else {
        if (onError) onError((r && (r.message || r.error)) || '读取失败')
        setPreviews((prev) => prev.filter((p) => p.key !== key))
        setActiveKey((cur) => (cur === key ? null : cur))
      }
    } catch (e) {
      if (onError) onError(e && e.message ? e.message : String(e))
      setPreviews((prev) => prev.filter((p) => p.key !== key))
      setActiveKey((cur) => (cur === key ? null : cur))
    }
  }

  // Diff / Markdown 视图开关
  const toggleDiff = async (pv) => {
    const next = !pv.diff
    setPreviews((prev) => prev.map((p) => p.key === pv.key ? Object.assign({}, p, { diff: next }) : p))
    if (next && pv.diffData == null && !pv.diffUntracked) {
      try {
        const r = await api(FM_METHODS.GIT_DIFF, { path: pv.path, sessionId: store.sessionId, root: store.root })
        if (r && r.ok) {
          setPreviews((prev) => prev.map((p) => p.key === pv.key ? Object.assign({}, p, { diffData: r.raw, diffUntracked: !!r.untracked, diffUntrackedContent: r.untrackedContent || null }) : p))
        } else if (onError) {
          onError((r && (r.message || r.error)) || '获取 diff 失败')
        }
      } catch (e) {
        if (onError) onError(e && e.message ? e.message : String(e))
      }
    }
  }

  const toggleMd = (pv) => {
    setPreviews((prev) => prev.map((p) => p.key === pv.key ? Object.assign({}, p, { md: !p.md }) : p))
  }

  // 关闭单个选项卡：关闭激活项时激活同位置（或末尾）的相邻选项卡
  const closeTab = (key) => {
    const idx = previews.findIndex((p) => p.key === key)
    const next = previews.filter((p) => p.key !== key)
    setPreviews(next)
    if (next.length === 0) setActiveKey(null)
    else if (activeKey === key) setActiveKey(next[Math.min(idx, next.length - 1)].key)
  }

  // 关闭闭区间 [fromIdx, toIdx] 的选项卡；激活项在区间内时回退到区间左邻
  const closeRange = (fromIdx, toIdx) => {
    const prev = previewsRef.current
    if (fromIdx < 0 || toIdx >= prev.length || fromIdx > toIdx) return
    const next = prev.filter((_, i) => i < fromIdx || i > toIdx)
    setPreviews(next)
    if (next.length === 0) {
      setActiveKey(null)
    } else {
      setActiveKey((cur) => {
        const curIdx = prev.findIndex((p) => p.key === cur)
        if (curIdx < fromIdx || curIdx > toIdx) return cur
        return next[Math.min(fromIdx, next.length - 1)].key
      })
    }
  }

  // 关闭其他：仅保留指定选项卡
  const closeOthers = (key) => {
    const prev = previewsRef.current
    const hit = prev.find((p) => p.key === key)
    if (!hit || prev.length <= 1) return
    setPreviews([hit])
    setActiveKey(key)
  }

  // 关闭全部
  const closeAllTabs = () => {
    setPreviews([])
    setActiveKey(null)
  }

  // 按谓词过滤选项卡（删除文件/目录后联动清理）；返回是否发生了移除
  const removePreviews = (pred) => {
    const prev = previewsRef.current
    const after = prev.filter(pred)
    if (after.length === prev.length) return false
    setPreviews(after)
    setActiveKey((cur) => (after.some((p) => p.key === cur) ? cur : (after.length ? after[0].key : null)))
    return true
  }

  // 目录轮询发现条目消失时清理对应选项卡
  const pruneMissing = (exists) => {
    const prev = previewsRef.current
    const after = prev.filter((p) => exists(p.path))
    if (after.length === prev.length) return
    setPreviews(after)
    setActiveKey((cur) => (after.some((p) => p.key === cur) ? cur : (after.length ? after[0].key : null)))
  }

  return {
    previews, previewsRef, activeKey, setActiveKey, activePreview,
    openFile, toggleDiff, toggleMd, closeTab, closeRange, closeOthers, closeAllTabs,
    removePreviews, pruneMissing,
  }
}
