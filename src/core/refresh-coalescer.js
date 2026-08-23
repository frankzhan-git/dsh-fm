// 合并式单飞行刷新器（纯函数，零 React —— 单测直接 import）。
// 背景（体验修复）：旧实现用布尔 busy 标志，轮询 tick 在途时显式刷新（索引/提交后的 refreshGit）
// 会被静默吞掉 —— 索引已更新但 git 数据/皮肤状态不刷新，用户看到"操作后状态未更新"。
// 语义：
//   - 并发调用合并：在途时新调用只记录最新 key，绝不丢弃；
//   - 每次 run 完成后若存在待处理 key，立即继续执行 → 显式刷新必然以最新状态落地；
//   - 同 key 收敛：轮询与显式刷新同一锚点只多跑一次（数据签名跳过保证无多余重渲染）。
export const createCoalescer = (run) => {
  let busy = false
  let pending = null
  const fire = async (key) => {
    if (pending === null) pending = key
    else if (key !== pending) pending = key
    if (busy) return false // 在途：仅记录，返回后由运行中的循环补跑
    busy = true
    try {
      let current
      while ((current = pending) !== null) {
        pending = null
        await run(current)
      }
    } finally {
      busy = false
    }
    return true
  }
  return fire
}
