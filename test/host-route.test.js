// 路由域（lib/fm-core/route.js）测试：官方四相信封的线协议语义（P2 核心护栏）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDispatcher } from '../lib/fm-core/route.js'
import { makeClientRequest, parseServerResponse, RPC_TYPE } from '../src/shared/contract/index.js'

const handlers = {
  'fm-ok': async () => ({ ok: true, hasRepo: true, files: [1] }),
  'fm-plain': async () => ({ root: '/ws' }),
  'fm-void': async () => ({ ok: true }),
  'fm-fail': async () => ({ ok: false, code: 'sandbox-denied', error: '沙箱策略拒绝' }),
  'fm-throw': async () => { throw new Error('突发故障') },
}

test('合法请求 → server-response，value 为去除 ok 的字段', async () => {
  const dispatch = createDispatcher(handlers)
  const raw = JSON.stringify(makeClientRequest('fm-ok', {}))
  const out = await dispatch(raw)
  assert.equal(out.type, RPC_TYPE.SERVER_RESPONSE)
  assert.equal(typeof out.rpcId, 'string')
  const parsed = parseServerResponse(out)
  assert.equal(parsed.ok, true)
  assert.deepEqual(parsed.value, { hasRepo: true, files: [1] })
})

test('纯值 handler（fm-root 形态）→ value 原样', async () => {
  const dispatch = createDispatcher(handlers)
  const out = parseServerResponse(await dispatch(JSON.stringify(makeClientRequest('fm-plain', {}))))
  assert.deepEqual(out, { ok: true, value: { root: '/ws' } })
})

test('失败返回 → error 分支（code 透传）', async () => {
  const dispatch = createDispatcher(handlers)
  const out = parseServerResponse(await dispatch(JSON.stringify(makeClientRequest('fm-fail', {}))))
  assert.equal(out.ok, false)
  assert.equal(out.error.code, 'sandbox-denied')
  assert.equal(out.error.message, '沙箱策略拒绝')
})

test('handler 抛错 → internal 错误分支（不泄漏堆栈语义）', async () => {
  const dispatch = createDispatcher(handlers)
  const out = parseServerResponse(await dispatch(JSON.stringify(makeClientRequest('fm-throw', {}))))
  assert.equal(out.ok, false)
  assert.equal(out.error.code, 'internal')
})

test('未知方法 → bad-request', async () => {
  const dispatch = createDispatcher(handlers)
  const out = parseServerResponse(await dispatch(JSON.stringify(makeClientRequest('fm-none', {}))))
  assert.equal(out.ok, false)
  assert.equal(out.error.code, 'bad-request')
  assert.ok(out.error.message.includes('fm-none'))
})

test('坏信封 → bad-request + 哨兵 rpcId', async () => {
  const dispatch = createDispatcher(handlers)
  const out = await dispatch('not json')
  assert.equal(out.type, RPC_TYPE.SERVER_RESPONSE)
  assert.equal(out.rpcId, '')
  assert.equal(out.result.ok, false)
  assert.equal(out.result.error.code, 'bad-request')
})

test('旧约定请求（{method,args} 直传）→ bad-request（协议升级后必须走信封）', async () => {
  const dispatch = createDispatcher(handlers)
  const out = await dispatch(JSON.stringify({ method: 'fm-ok', args: {} }))
  assert.equal(out.result.ok, false)
  assert.equal(out.result.error.code, 'bad-request')
})
