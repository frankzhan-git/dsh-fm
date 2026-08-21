// dsh-fm host 仓库上下文解析：给定任意绝对路径，判定它所属的 git 仓库。
// 规则（与产品对齐）：路径自身带 .git（目录或文件）→ 自身仓库；否则逐级向上
// 找最近祖先的 .git → 该祖先仓库；都没有 → null（无仓库上下文）。
// 依赖注入式纯函数（fs.resolve / fs.stat），便于单测；不含任何 shell 调用。
import { norm } from './util.js'

export const resolveRepoContext = async (fs, path, maxDepth = 20) => {
  let p = norm(String(path || '')).replace(/\/+$/, '')
  if (!p) return null
  let depth = 0
  while (depth < maxDepth) {
    try {
      const t = await fs.resolve(p + '/.git')
      const info = await fs.stat(t)
      if (info) return { root: p, own: depth === 0 }
    } catch (e) { /* 不存在或不可读，继续向上 */ }
    const i = p.lastIndexOf('/')
    if (i <= 0) break
    p = p.slice(0, i)
    depth++
  }
  return null
}
