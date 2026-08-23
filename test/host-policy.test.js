// 沙箱政策解析（lib/fm-core/policy.js）与错误映射（lib/fm-core/errors.js）测试。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPolicyResolver } from '../lib/fm-core/policy.js'
import { toRpcError, codeOfMessage } from '../lib/fm-core/errors.js'
import { FM_ERROR_CODES } from '../src/shared/contract/index.js'

test('读操作：任意模式放行（read-only 会话可读 git 状态）', () => {
  const rp = createPolicyResolver({ sp: { resolve: () => ({ mode: 'read-only', workspaceRoot: '/ws' }) } })
  const r = rp(null, false)
  assert.deepEqual(r, { policy: { mode: 'read-only', workspaceRoot: '/ws' } })
})

test('写操作：read-only 会话拒绝（sandbox-denied）', () => {
  const rp = createPolicyResolver({ sp: { resolve: () => ({ mode: 'read-only', workspaceRoot: '/ws' }) } })
  const r = rp(null, true)
  assert.deepEqual(r, { denied: 'read-only' }, '写操作必须被拒绝')
})

test('写操作：workspace-write / danger-full-access 放行', () => {
  const rp1 = createPolicyResolver({ sp: { resolve: () => ({ mode: 'workspace-write', workspaceRoot: '/ws' }) } })
  const r1 = rp1(null, true)
  assert.equal(r1.denied, undefined)
  assert.equal(r1.policy.mode, 'workspace-write')
  const rp2 = createPolicyResolver({ sp: { resolve: () => ({ mode: 'danger-full-access', workspaceRoot: '/ws' }) } })
  assert.equal(rp2(null, true).denied, undefined)
})

test('官方解析：会话传入 sessions.get(id)（approved-mode 模型前提）', () => {
  const session = { header: { cwd: '/ws' } }
  let gotSession
  const rp = createPolicyResolver({
    sp: { resolve: (req) => { gotSession = req.session; return { mode: 'workspace-write', workspaceRoot: '/ws' } } },
    sessions: { get: (id) => (id === 's1' ? session : undefined) },
  })
  rp('s1', true)
  assert.equal(gotSession, session, '必须把官方 session 对象交给 sandboxPolicy.resolve')
})

test('回退：sp 无 resolve（旧环境/测试）→ 写=danger-full-access，读=read-only，均不拒绝', () => {
  const rp = createPolicyResolver({ sp: { workspaceRoot: '/ws' } })
  assert.deepEqual(rp(null, true), { policy: { mode: 'danger-full-access', workspaceRoot: '/ws' } })
  assert.equal(rp(null, false).denied, undefined)
})

test('回退：sp 不存在 / resolve 抛错 → 不阻断（写仍放行）', () => {
  const rp1 = createPolicyResolver({ sp: undefined })
  assert.equal(rp1(null, true).denied, undefined)
  const rp2 = createPolicyResolver({ sp: { resolve: () => { throw new Error('boom') } } })
  assert.equal(rp2(null, true).denied, undefined)
})

test('错误映射：旧式 {ok:false,error} → 官方错误分支（语义表还原码）', () => {
  const e = toRpcError({ ok: false, error: '无法确定工作目录' })
  assert.equal(e.code, FM_ERROR_CODES.CONTEXT_UNAVAILABLE)
  assert.equal(e.message, '无法确定工作目录')
  assert.ok(e.details && typeof e.details === 'object')
})

test('错误映射：已带 code 的错误优先；未知消息 → internal', () => {
  const e1 = toRpcError({ ok: false, code: 'sandbox-denied', error: '沙箱策略为只读' })
  assert.equal(e1.code, 'sandbox-denied')
  const e2 = toRpcError(new Error('某未知错误'))
  assert.equal(e2.code, FM_ERROR_CODES.INTERNAL)
  const e3 = toRpcError('git init 失败: x')
  assert.equal(e3.code, FM_ERROR_CODES.GIT_INIT_FAILED)
})

test('codeOfMessage：语义表覆盖核心失败路径', () => {
  assert.equal(codeOfMessage('未检测到 git'), FM_ERROR_CODES.GIT_NOT_INSTALLED)
  assert.equal(codeOfMessage('当前目录不在任何 git 仓库中'), FM_ERROR_CODES.NO_GIT_REPO)
})
