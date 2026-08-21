// dsh-fm host 仓库状态缓存：按仓库根短 TTL 缓存 fm-git-status 的解析结果，
// 消除导航/轮询的重复计算（单次 spawn 仍约 100-300ms，快速往返会重复触发）。
// 提交/初始化/索引变更会主动失效，避免短窗口内的陈旧展示。
// 实例级（createStatusCache 每次调用独立 Map），避免跨测试/跨实例串扰。
import { norm } from './util.js'

const STATUS_TTL = 1500 // 毫秒

export const createStatusCache = () => {
  const cache = new Map()
  return {
    // 命中且未过期 → 返回缓存数据；否则 null
    get: (repoRoot) => {
      const hit = cache.get(norm(repoRoot))
      return hit && Date.now() - hit.ts < STATUS_TTL ? hit : null
    },
    set: (repoRoot, data) => {
      cache.set(norm(repoRoot), Object.assign({ ts: Date.now() }, data))
    },
    // 仓库状态变更（提交/初始化/.gitignore 写入）后失效：精确 key + 该路径下的所有子仓库
    invalidate: (path) => {
      const p = norm(String(path || '')).replace(/\/+$/, '')
      for (const k of Array.from(cache.keys())) {
        if (k === p || k.indexOf(p + '/') === 0) cache.delete(k)
      }
    },
  }
}
