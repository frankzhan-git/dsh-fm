// dsh-fm host 能力域：git 是否安装 + 版本（低频）。探测由基础设施域（shell.js probeGit）提供：
// 成功后永久缓存（插件生命周期），失败 30s 内不重复探测；本域只做 RPC 装配与结果裁剪。
// 客户端在打开时拉取一次（不轮询）；「安装并初始化」成功后 host setGitBin，客户端再刷新。
import { FM_ERROR_CODES } from '../../src/shared/contract/fm-errors.js'
import { failWith } from './errors.js'

export function createGitCapabilityHandlers(services) {
  const { rootOf, probeGit } = services
  return {
    'fm-git-capability': async (args) => {
      const root = (args && args.root) || await rootOf(args && args.sessionId)
      if (!root) return failWith(FM_ERROR_CODES.CONTEXT_UNAVAILABLE, '无法确定工作目录')
      const git = await probeGit(root)
      return { ok: true, gitInstalled: git.bin !== null, gitVersion: git.version }
    },
  }
}
