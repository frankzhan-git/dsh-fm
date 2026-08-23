// git 状态机接线：useReducer(gitMachine) + 合并式单飞行刷新（jitter 轮询）+ 竞态由 reducer 丢弃。
// 只负责"何时发请求"与"把响应交给状态机"；数据选择/渲染决策在组件层。
// 刷新语义（体验修复）：并发刷新经 core/refresh-coalescer.js 合并 —— 轮询在途时，
// 索引/提交后的显式 refreshGit 不再被静默吞掉，当前请求完成后立即以最新锚点补跑，
// 保证"操作后状态必定刷新"。
import React from 'react'
import { api } from '../../core/api.js'
import { store } from '../../core/store.js'
import { createCoalescer } from '../../core/refresh-coalescer.js'
import { FM_METHODS, FM_LIMITS, FM_ERROR_CODES } from '../../shared/contract/index.js'
import { gitMachine, initialGitState } from '../../core/git-machine.js'

export function useGitMachine({ open, anchor }) {
  const [state, dispatch] = React.useReducer(gitMachine, undefined, initialGitState)
  const anchorRef = React.useRef(anchor)
  anchorRef.current = anchor

  // 单次拉取：api → 状态机（过期锚点由 reducer T2 丢弃）
  const doRefresh = React.useCallback(async (a) => {
    if (!a) return
    const r = await api(FM_METHODS.GIT_STATUS, { sessionId: store.sessionId, root: store.root, anchor: a })
    if (r && r.ok) {
      dispatch({ type: 'success', result: { anchor: a, data: {
        hasRepo: !!r.hasRepo, gitInstalled: !!r.gitInstalled,
        files: r.files || [], ignored: r.ignored || [],
        totalAdded: r.totalAdded || 0, totalDeleted: r.totalDeleted || 0,
        context: r.context || null,
      } } })
    } else {
      dispatch({ type: 'failure', result: { anchor: a, code: (r && r.code) || FM_ERROR_CODES.GIT_STATUS_FAILED, message: (r && (r.message || r.error)) || 'git 状态获取失败' } })
    }
  }, [])

  // 合并式单飞行：并发合并、绝不吞掉显式刷新（见 core/refresh-coalescer.js）
  const fireRefresh = React.useMemo(() => createCoalescer(doRefresh), [doRefresh])
  const refresh = React.useCallback((anch) => {
    const a = anch || anchorRef.current || store.root || null
    if (a) return fireRefresh(a)
  }, [fireRefresh])

  // 打开/关闭与锚点变化：reset → 立即刷新 → 进入轮询（随机抖动，避免与目录轮询锁步）
  React.useEffect(() => {
    if (!open) {
      dispatch({ type: 'close' })
      return
    }
    if (!anchor) {
      // 锚点未就绪：boot 等待（树设置锚点后本 effect 重跑）
      dispatch({ type: 'reset', anchor: null })
      return
    }
    dispatch({ type: 'reset', anchor })
    refresh(anchor)
    let stopped = false
    let timer = null
    const schedule = () => {
      if (stopped) return
      const jitter = Math.floor(Math.random() * FM_LIMITS.POLL_JITTER_MS * 2) - FM_LIMITS.POLL_JITTER_MS
      timer = setTimeout(tick, Math.max(500, FM_LIMITS.POLL_MS + jitter))
    }
    const tick = () => {
      if (stopped) return
      const a = anchorRef.current || null
      const p = refresh(a)
      if (p && p.then) p.then(schedule).catch(schedule)
      else schedule()
    }
    schedule()
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
    }
  }, [open, anchor, refresh])

  // 手动重试：错误态 → loading + 立即重拉（保留上次数据，成功后无闪烁）
  const retryGit = React.useCallback(() => {
    if (state.phase !== 'error' && state.phase !== 'boot') return
    dispatch({ type: 'retry' })
    refresh(anchorRef.current || store.root || null)
  }, [state.phase, refresh])

  const refreshNow = React.useCallback(() => refresh(anchorRef.current || store.root || null), [refresh])

  return { gitMachineState: state, retryGit, refreshNow }
}
