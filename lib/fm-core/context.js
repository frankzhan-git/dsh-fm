// dsh-fm host 仓库上下文域：锚点 → 所属仓库（零 shell、纯 fs 探测，毫秒级）。
// 与 fm-git-status 的关系：context 只回答"有没有仓库/仓库根"，status 继续负责变更数据与
// anchorIndexed（后者依赖 porcelain --ignored，属于 shell 管线）。
// 客户端用它做胶囊骨架先行：context 就绪即可渲染初始化/工具条形态，status 异步补齐。
import { norm } from './util.js'
import { resolveRepoContext } from './repo-context.js'
import { FM_ERROR_CODES } from '../../src/shared/contract/fm-errors.js'
import { failWith } from './errors.js'

export function createGitContextHandlers(services) {
  const { fs, rootOf } = services
  return {
    'fm-git-context': async (args) => {
      const root = (args && args.root) || await rootOf(args && args.sessionId)
      if (!root) return failWith(FM_ERROR_CODES.CONTEXT_UNAVAILABLE, '无法确定工作目录')
      const anchor = (args && args.anchor) ? norm(String(args.anchor)) : root
      const ctx = await resolveRepoContext(fs, anchor)
      if (!ctx) return { ok: true, hasRepo: false, repoRoot: null, hasOwnRepo: false }
      return { ok: true, hasRepo: true, repoRoot: norm(ctx.root), hasOwnRepo: !!ctx.own }
    },
  }
}
