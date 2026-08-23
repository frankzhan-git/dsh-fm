// 索引状态派生（纯函数，零 React —— 单测直接 import）。
// 输入：unindexed 集合 = 未跟踪（??）与忽略（!!）的条目路径（已规范化、无尾斜杠、含整目录标记）。
// git 的 porcelain 折叠规则保证判定可靠：
//   - 整目录全未跟踪 → 该目录作为一条 `?? dir/` 出现 → 集合含 dir（标记）
//   - 整目录全被忽略 → `!! dir/` → 同样为标记
//   - 混合目录 → git 逐条目列出（`?? dir/file` / `!! dir/file`），目录本身不出现在集合
//   因此"目录不在集合" ⟺ 目录内必有索引内容；"集合内存在目录之下条目" ⟺ 存在未索引内容。
// 继承规则（体验修复）：目录标记意味着**整棵子树**未索引 —— 任意祖先（或自身）在集合
// 即判定 off，保证"取消勾选文件夹后其下所有子项一并显示未选中"，避免勾选状态歧义。
export const INDEX_STATE = Object.freeze({ ON: 'on', PART: 'part', OFF: 'off' })

// 派生规则（与产品对齐）：
//   off    = 自身或**任一祖先**在未索引集合（整目录未跟踪/忽略，含其子树全部内容）
//   part   = 自身与祖先均不在集合，但其下（任意层级）存在未索引条目 —— ≥1 项索引 + ≥1 项未索引
//   on     = 其余（目录下全部内容索引；空目录视为全部索引）
export const indexStateOf = (path, unindexedSet) => {
  const p = String(path || '')
  if (!p) return INDEX_STATE.OFF
  // 祖先/自身继承：整目录标记向下传播（取消勾选文件夹 → 子项全部未选中）
  let anc = p
  while (anc.length > 0) {
    if (unindexedSet.has(anc)) return INDEX_STATE.OFF
    const i = anc.lastIndexOf('/')
    if (i <= 0) break
    anc = anc.slice(0, i)
  }
  const prefix = p + '/'
  for (const entry of unindexedSet) {
    if (entry.length > p.length && entry.indexOf(prefix) === 0) return INDEX_STATE.PART
  }
  return INDEX_STATE.ON
}
