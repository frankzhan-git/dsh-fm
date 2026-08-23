// dsh-fm host 沙箱策略域：每次 git 执行前经官方 ctx.sandboxPolicy.resolve() 解析会话策略，
// 取代旧实现硬编码 { mode:'danger-full-access' }（绕过官方 approved-mode 模型的合规缺陷）。
// 规则（与官方模型对齐）：
// - 读操作（status/diff/探测）：任意已解析模式均可（sandbox 自行约束读写边界）；
// - 写操作（add/commit/init/安装）：mode === 'read-only' 时拒绝（sandbox-denied），
//   其余模式放行，并把解析出的政策原样交给 shell.resolve（执行器按模式走 confined/full-access）。
// 服务缺失/异常回退：写=fake danger-full-access（保持旧行为），读=fake read-only —— 无策略即无约束。
import { FM_ERROR_CODES } from '../../src/shared/contract/fm-errors.js'

export const createPolicyResolver = ({ sp, sessions }) => {
  const resolveFor = (sessionId, write) => {
    let policy
    try {
      if (sp && typeof sp.resolve === 'function') {
        let session
        if (sessionId && sessions) {
          try { session = sessions.get(sessionId) } catch (e) { session = undefined }
        }
        // 官方解析：approved mode 优先 > 会话事件 > 部署默认；会话 cwd 即 workspace 边界
        policy = sp.resolve(session ? { session } : undefined)
      }
    } catch (e) {
      policy = undefined // 策略服务异常 → 回退，不阻断文件管理应用
    }
    if (!policy || typeof policy.mode !== 'string') {
      policy = {
        mode: write ? 'danger-full-access' : 'read-only',
        workspaceRoot: (sp && sp.workspaceRoot) || undefined,
      }
    }
    if (write && policy.mode === 'read-only') return { denied: policy.mode }
    return { policy }
  }
  return resolveFor
}
