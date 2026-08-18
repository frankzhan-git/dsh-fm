// dsh-fm host half —— 正式 Cordis 插件入口（webServer 路由 /api/fm 分发全部 RPC）
// 薄入口模式（与 dsh-kb 一致）：本文件只做服务获取、RPC 装配与路由注册；
// 文件/git 业务逻辑见 ./fm-core.js，mermaid 子集渲染见 ./fm-mermaid.js。
// 必须声明 inject：在 Loader 架构下，插件的 apply 会在依赖服务提供前先行执行，
// 没有 inject 时 ctx.get('fs') 等全部为 undefined，导致 apply 提前返回、路由从未注册。
import { createFmCore, fail } from './fm-core.js'
import { mermaidSvg } from './fm-mermaid.js'

export default {
  name: 'dsh-fm',
  inject: ['fs', 'shell', 'sandboxPolicy', 'sessions', 'webServer'],
  apply(ctx) {
    const fs = ctx.get('fs')
    const shell = ctx.get('shell')
    const sp = ctx.get('sandboxPolicy')
    const sessions = ctx.get('sessions')
    const webServer = ctx.get('webServer')
    if (fs === undefined || webServer === undefined) return

    const HANDLERS = Object.assign(
      createFmCore({ fs, shell, sessions, sp }),
      {
        'fm-mermaid-render': async (args) => {
          const code = args && args.code ? String(args.code) : ''
          if (!code.trim()) return { ok: false, error: '空的 mermaid 代码' }
          return { ok: true, svg: mermaidSvg(code) }
        },
      },
    )

    // ---------- webServer 路由 ----------
    webServer.register({
      kind: 'exact',
      path: '/api/fm',
      handler: (req, res) => {
        let body = ''
        req.on('data', (c) => { body += c })
        req.on('end', async () => {
          let payload = {}
          try {
            payload = body ? JSON.parse(body) : {}
          } catch (e) { payload = {} }
          const method = payload && payload.method
          const fn = HANDLERS[method]
          let result
          try {
            result = fn ? await fn(payload.args || {}) : { ok: false, error: '未知方法：' + method }
          } catch (e) {
            result = fail(e)
          }
          try {
            res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify(result))
          } catch (e) { /* client gone */ }
        })
      },
    })
  },
}
