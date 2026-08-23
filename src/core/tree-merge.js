// 目录列表与树状态合并（纯函数，零 React —— 单测直接 import）。
// 背景（体验修复）：旧 loadDir 对每个条目重建节点并覆盖 —— 重刷根目录时会把用户已展开的
// 子树（loaded/expanded/childPaths）整体重置为收起。任何来源（轮询/索引后刷新/提交后刷新）
// 的列表刷新都必须走本合并：已存在节点只更新数据元信息，UI 状态原样保留。
// 所有权约定：节点字段分两类 ——
//   数据元信息：name / type / size / hasGit（跟随最新列表）
//   UI 状态：loaded / expanded / childPaths / loading（用户与加载过程所有，合并永不重置）
export const mergeListing = (t, dirPath, entries) => {
  const childPaths = []
  const additions = {}
  const seen = new Set()
  for (const e of entries) {
    const p = String(e.path || '').replace(/\\/g, '/')
    if (!p) continue
    childPaths.push(p)
    seen.add(p)
    const cur = t[p]
    additions[p] = cur
      ? // 已有节点：仅刷新数据元信息，保留 UI 状态（含其已加载子树的 childPaths）
        Object.assign({}, cur, {
          name: e.name,
          type: e.type,
          size: e.size == null ? null : e.size,
          hasGit: !!(e.hasGit),
        })
      : // 新条目：fresh 节点（未加载、未展开）
        { path: p, name: e.name, type: e.type, size: e.size == null ? null : e.size, loaded: false, expanded: false, loading: false, childPaths: [], hasGit: !!(e.hasGit) }
  }
  // 消失条目：目录自身列表不再包含的直接子节点 → 从树中移除（含其子树，与旧语义一致）
  const removed = []
  const curNode = t[dirPath]
  if (curNode && Array.isArray(curNode.childPaths)) {
    for (const k of curNode.childPaths) if (!seen.has(k)) removed.push(k)
  }
  return { childPaths, additions, removed }
}
