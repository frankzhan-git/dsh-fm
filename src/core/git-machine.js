// git 展示状态机（纯 reducer，零 React/零 DOM —— 单测直接 import）。
//
// 根治目标（与旧 useFmGit 的差异）：
// 1. phase 判别联合取代 `null/对象` 二元值：boot（无锚点）/ loading / ready / error 四态，
//    error 携带 {code,message}，胶囊可渲染"失败 + 重试"，不再把错误伪装成 loading；
// 2. 数据签名跳过只允许发生在 ready 态（sig 相同且数据已渲染），
//    loading→ready 与 error→ready 永不跳过 —— 修复旧款"重置后同签名被丢弃"导致的永久 loading；
// 3. 锚点（anchor）进入状态机，过期响应在 reducer 内被丢弃（竞态防护与状态同一处）。
//
// 迁移表（T1–T6）：
//   T1 reset(anchor)      → boot/loading + 清空 data/sig/error
//   T2 success(旧锚点)     → 丢弃（状态不变）
//   T3 success(同锚点, ready 且 sig 相同) → 状态不变（唯一允许跳过的情形）
//   T4 success(同锚点, 其余) → ready + data/sig
//   T5 failure(同锚点)     → error（保留上次 ready 数据，供重试后直接回 ready）
//   T6 retry              → loading（仅 error/boot 态可触发）
export const GIT_PHASE = Object.freeze({ BOOT: 'boot', LOADING: 'loading', READY: 'ready', ERROR: 'error' })

export const initialGitState = () => ({ phase: GIT_PHASE.BOOT, anchor: null, sig: '', data: null, error: null })

// status 数据签名：仅用于"ready 且数据未变则跳过重渲染"；anchor 变化必然改变 data 来源，故不参与签名
export const gitSigOf = (value) => {
  if (!value) return ''
  return JSON.stringify({
    hr: !!value.hasRepo,
    gi: !!value.gitInstalled,
    f: value.files || [],
    ig: value.ignored || [],
    ta: value.totalAdded || 0,
    td: value.totalDeleted || 0,
    c: value.context ? (value.context.root + '|' + !!value.context.hasOwnRepo + '|' + !!value.context.anchorIndexed) : '',
  })
}

// action 形态：
//   { type:'reset', anchor }
//   { type:'success', result:{ anchor, data } }
//   { type:'failure', result:{ anchor, code, message } }
//   { type:'retry' }
//   { type:'close' }
export const gitMachine = (state, action) => {
  switch (action.type) {
    case 'reset': {
      const anchor = action.anchor || null
      return { phase: anchor ? GIT_PHASE.LOADING : GIT_PHASE.BOOT, anchor, sig: '', data: null, error: null }
    }
    case 'success': {
      const r = action.result || {}
      // T2：过期锚点响应 → 丢弃（导航竞态）
      if (state.anchor === null || r.anchor !== state.anchor) return state
      const sig = gitSigOf(r.data)
      // T3：ready 且数据未变 → 跳过（不触发重渲染，也不覆盖 error 之外的任何态）
      if (state.phase === GIT_PHASE.READY && state.sig === sig) return state
      // T4：进入/保持 ready
      return { phase: GIT_PHASE.READY, anchor: state.anchor, sig, data: r.data || null, error: null }
    }
    case 'failure': {
      const r = action.result || {}
      // 过期锚点失败 → 丢弃
      if (state.anchor === null || r.anchor !== state.anchor) return state
      // T5：错误态（保留上次 ready 数据与签名）
      return { phase: GIT_PHASE.ERROR, anchor: state.anchor, sig: state.sig, data: state.data, error: { code: r.code || 'internal', message: r.message || 'git 状态获取失败' } }
    }
    case 'retry': {
      if (state.phase !== GIT_PHASE.ERROR && state.phase !== GIT_PHASE.BOOT) return state
      // T6：仅 error/boot 可重试；保留 data（成功后直接渲染，避免闪烁）
      return { phase: state.anchor ? GIT_PHASE.LOADING : GIT_PHASE.BOOT, anchor: state.anchor, sig: state.sig, data: state.data, error: null }
    }
    case 'close': {
      return initialGitState()
    }
    default:
      return state
  }
}
