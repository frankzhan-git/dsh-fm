// dsh-fm host half —— 正式 Cordis 插件入口（webServer 路由 /api/fm 分发全部 RPC）
// 薄入口模式（与 dsh-kb 一致）：本文件只做服务获取、RPC 装配与路由注册；
// 文件/git 业务逻辑见 ./fm-core/（领域拆分），RPC 契约见 ../src/shared/contract/（单一副本）。
// 架构根治（2026-09）：
// - 线协议升级为官方四相信封（client-request → server-response），语义在 fm-core/route.js（可单测）
// - webServer.register 返回的 disposer 挂 ctx.effect（插件卸载/替换时路由被移除）
// - host 启动预热 git 探测（fire-and-forget），首个客户端请求不再承担冷启动成本
// - 沙箱政策经 fm-core/policy.js 按会话解析（不再硬编码 danger-full-access）
// 必须声明 inject：在 Loader 架构下，插件的 apply 会在依赖服务提供前先行执行，
// 没有 inject 时 ctx.get('fs') 等全部为 undefined，导致 apply 提前返回、路由从未注册。
import { createFmCore, assertContractCoverage } from './fm-core/index.js'
import { createDispatcher } from './fm-core/route.js'
import { FM_ROUTE } from '../src/shared/contract/index.js'

const logWarn = (ctx, ...args) => {
  try {
    if (ctx.logger && typeof ctx.logger.warn === 'function') ctx.logger.warn(...args)
  } catch (e) { /* logger 不可用（测试/无日志上下文）时静默 */ }
}

export default {
  name: 'dsh-fm',
  inject: ['fs', 'shell', 'sandboxPolicy', 'sessions', 'webServer'],
  apply(ctx) {
    const fs = ctx.get('fs')
    const shell = ctx.get('shell')
    const sp = ctx.get('sandboxPolicy')
    const sessions = ctx.get('sessions')
    const webServer = ctx.get('webServer')
    // 官方 workspaceRegistry（web-app 挂载的 dsh-workspace）：rootOf 解析链的官方一环，可选
    const workspaces = ctx.get('workspaceRegistry')
    if (fs === undefined || webServer === undefined) return

    // 契约守卫：运行时校验全部契约方法均已实现（防重构遗漏）
    const HANDLERS = assertContractCoverage(createFmCore({ fs, shell, sessions, sp, workspaces }))
    const dispatch = createDispatcher(HANDLERS, (...args) => logWarn(ctx, ...args))

    // 启动预热：git 能力探测成功即永久缓存（失败 30s 内不重复），首个客户端请求直接命中
    try {
      const heat = HANDLERS['fm-git-capability']
      if (heat) heat({ root: sp && sp.workspaceRoot, sessionId: null }).catch(() => { /* 冷启动探测失败不阻断 */ })
    } catch (e) { /* 同上 */ }

    // ---------- webServer 路由（官方扩展点；disposer 挂 effect 保证卸载即移除） ----------
    const dispose = webServer.register({
      kind: 'exact',
      path: FM_ROUTE,
      handler: (req, res) => {
        let body = ''
        req.on('data', (c) => { body += c })
        req.on('end', async () => {
          let out
          try {
            out = await dispatch(body)
          } catch (e) {
            out = await dispatch('') // 兜底：非法/异常请求统一走 bad-request 信封
          }
          try {
            res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify(out))
          } catch (e) { /* client gone */ }
        })
      },
    })
    ctx.effect(() => dispose)
  },
}
