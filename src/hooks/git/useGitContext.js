// git 上下文切片：锚点 → 所属仓库（零 shell、纯 fs 探测，毫秒级）。
// 作用：胶囊骨架先行 —— capability/context 就绪即可渲染"初始化/工具条"形态，
// 不再等待 status（shell 管线）完成；status 失败也只影响变更数据，不拖死胶囊。
import React from 'react'
import { api } from '../../core/api.js'
import { store } from '../../core/store.js'
import { FM_METHODS } from '../../shared/contract/index.js'

export function useGitContext({ open, anchor }) {
  const [ctx, setCtx] = React.useState(null) // { hasRepo, repoRoot, hasOwnRepo } | null
  const [ctxError, setCtxError] = React.useState(null)
  const anchorRef = React.useRef(anchor)
  anchorRef.current = anchor

  React.useEffect(() => {
    if (!open) {
      setCtx(null)
      setCtxError(null)
      return
    }
    const a = anchor || store.root || null
    if (!a) {
      setCtx(null)
      setCtxError(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const r = await api(FM_METHODS.GIT_CONTEXT, { sessionId: store.sessionId, root: store.root, anchor: a })
        if (cancelled) return
        // 锚点已变 → 丢弃（本切片只服务当前锚点）
        if (anchorRef.current !== a) return
        if (r && r.ok) {
          setCtx({ hasRepo: !!r.hasRepo, repoRoot: r.repoRoot || null, hasOwnRepo: !!r.hasOwnRepo })
          setCtxError(null)
        } else {
          setCtxError((r && (r.message || r.error)) || 'git 上下文获取失败')
        }
      } catch (e) {
        if (!cancelled) setCtxError(e && e.message ? e.message : String(e))
      }
    })()
    return () => { cancelled = true }
  }, [open, anchor])

  return { gitCtx: ctx, gitCtxError: ctxError }
}
