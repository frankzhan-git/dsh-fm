// 契约/信封/错误码/限额测试：wire 定义单一副本的可信度校验（治根治本的防退化护栏）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  FM_METHODS, FM_ARGS, FM_ROUTE, FM_ERROR_CODES, FM_LIMITS,
  RPC_TYPE, makeClientRequest, makeServerResponse,
  parseClientRequest, parseServerResponse,
} from '../src/shared/contract/index.js'

test('信封：client-request 构造（type/rpcId/method/payload）', () => {
  const m = makeClientRequest('fm-git-status', { anchor: '/ws' })
  assert.equal(m.type, RPC_TYPE.CLIENT_REQUEST)
  assert.equal(typeof m.rpcId, 'string')
  assert.ok(m.rpcId.length > 0)
  assert.equal(m.method, 'fm-git-status')
  assert.deepEqual(m.payload, { anchor: '/ws' })
})

test('信封：client-request 解析（含坏输入边界）', () => {
  const m = makeClientRequest('fm-root', {})
  assert.deepEqual(parseClientRequest(JSON.stringify(m)), { rpcId: m.rpcId, method: 'fm-root', payload: {} })
  assert.throws(() => parseClientRequest('not json'))
  assert.throws(() => parseClientRequest('{}'))
  assert.throws(() => parseClientRequest(JSON.stringify({ type: 'server-response', rpcId: 'x', method: 'a', payload: {} })))
  assert.throws(() => parseClientRequest(JSON.stringify({ type: 'client-request', rpcId: '', method: 'a', payload: {} })))
})

test('信封：server-response ok/error 解析与非法分支', () => {
  const ok = parseServerResponse(makeServerResponse('r1', { ok: true, value: { hasRepo: true } }))
  assert.deepEqual(ok, { ok: true, value: { hasRepo: true } })
  const err = parseServerResponse(makeServerResponse('r2', { ok: false, error: { code: 'git-not-installed', message: 'x', details: {} } }))
  assert.deepEqual(err, { ok: false, error: { code: 'git-not-installed', message: 'x', details: {} } })
  assert.throws(() => parseServerResponse({ type: 'client-request', rpcId: 'x', result: { ok: true, value: {} } }))
  assert.throws(() => parseServerResponse({}))
  assert.throws(() => parseServerResponse(makeServerResponse('r3', { bogus: true })))
})

test('错误码：全部 kebab-case 且唯一（官方 rpcErrorSchema 风格）', () => {
  const values = Object.values(FM_ERROR_CODES)
  assert.equal(new Set(values).size, values.length)
  for (const v of values) assert.match(v, /^[a-z][a-z0-9-]*$/)
})

test('限额：端到端预算单调（probe ≤ 单命令 ≤ status 预算 < 客户端；客户端 < 官方 30s 兜底）', () => {
  assert.ok(FM_LIMITS.HOST_PROBE_TIMEOUT_MS <= FM_LIMITS.HOST_CMD_TIMEOUT_MS)
  assert.ok(FM_LIMITS.HOST_CMD_TIMEOUT_MS <= FM_LIMITS.HOST_STATUS_BUDGET_MS)
  assert.ok(FM_LIMITS.HOST_STATUS_BUDGET_MS < FM_LIMITS.CLIENT_GIT_TIMEOUT_MS)
  assert.ok(FM_LIMITS.CLIENT_GIT_TIMEOUT_MS <= 30000, '客户端预算不得超过官方信使默认 30s')
  assert.ok(FM_LIMITS.POLL_MS > 0 && FM_LIMITS.POLL_JITTER_MS < FM_LIMITS.POLL_MS)
})

test('契约：新切片方法已声明且参数覆盖（fm-git-context / fm-git-capability）', () => {
  assert.equal(FM_METHODS.GIT_CONTEXT, 'fm-git-context')
  assert.equal(FM_METHODS.GIT_CAPABILITY, 'fm-git-capability')
  for (const k of Object.keys(FM_METHODS)) {
    assert.ok(Array.isArray(FM_ARGS[FM_METHODS[k]]), '缺少参数声明: ' + FM_METHODS[k])
  }
  assert.ok(FM_ARGS[FM_METHODS.GIT_CONTEXT].includes('anchor'))
  assert.ok(FM_ARGS[FM_METHODS.GIT_CAPABILITY].includes('sessionId'))
})

test('路由：FM_ROUTE 保持 /api/fm（线兼容）', () => {
  assert.equal(FM_ROUTE, '/api/fm')
})
