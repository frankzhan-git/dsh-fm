// git 状态机（src/core/git-machine.js）全迁移表测试：T1–T6 与"ready 才可跳过"的不变量。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gitMachine, initialGitState, gitSigOf, GIT_PHASE } from '../src/core/git-machine.js'

const status = (over) => Object.assign({
  hasRepo: true, gitInstalled: true,
  files: [], ignored: [], totalAdded: 1, totalDeleted: 2,
  context: { root: '/ws', hasOwnRepo: true, anchorIndexed: true },
}, over || {})

test('T1：reset(null) → boot（锚点未就绪）', () => {
  const s = gitMachine(initialGitState(), { type: 'reset', anchor: null })
  assert.equal(s.phase, GIT_PHASE.BOOT)
  assert.equal(s.anchor, null)
  assert.equal(s.data, null)
})

test('T1：reset(锚点) → loading 并清空数据', () => {
  const s = gitMachine(initialGitState(), { type: 'reset', anchor: '/ws' })
  assert.equal(s.phase, GIT_PHASE.LOADING)
  assert.equal(s.anchor, '/ws')
})

test('T4：success(同锚点) → ready + data', () => {
  const s0 = gitMachine(initialGitState(), { type: 'reset', anchor: '/ws' })
  const s1 = gitMachine(s0, { type: 'success', result: { anchor: '/ws', data: status() } })
  assert.equal(s1.phase, GIT_PHASE.READY)
  assert.equal(s1.data.totalAdded, 1)
  assert.equal(s1.error, null)
})

test('T3：ready 且签名一致 → 跳过（状态引用不变）', () => {
  const s0 = gitMachine(initialGitState(), { type: 'reset', anchor: '/ws' })
  const s1 = gitMachine(s0, { type: 'success', result: { anchor: '/ws', data: status() } })
  const s2 = gitMachine(s1, { type: 'success', result: { anchor: '/ws', data: status() } })
  assert.equal(s2, s1, 'ready 态同签名必须是同一状态对象（不触发重渲染）')
})

test('T4·关键回归：loading 态即使签名与历史一致也更新（旧版 sig-skip 缺陷场景）', () => {
  // 重现旧缺陷：先 ready（sig=X 缓存）→ reset（gitInfo=null）→ 同数据成功 → 旧代码跳过 → 永久 loading
  const s0 = gitMachine(initialGitState(), { type: 'reset', anchor: '/ws' })
  const s1 = gitMachine(s0, { type: 'success', result: { anchor: '/ws', data: status() } })
  const s2 = gitMachine(s1, { type: 'reset', anchor: '/ws' }) // 重开弹窗/锚点往返
  assert.equal(s2.phase, GIT_PHASE.LOADING)
  const s3 = gitMachine(s2, { type: 'success', result: { anchor: '/ws', data: status() } }) // 数据未变
  assert.equal(s3.phase, GIT_PHASE.READY, 'loading→ready 永不跳过')
  assert.notEqual(s3, s2, '必须产生新状态')
})

test('T2：过期锚点响应被丢弃', () => {
  const s0 = gitMachine(initialGitState(), { type: 'reset', anchor: '/ws' })
  const s1 = gitMachine(s0, { type: 'success', result: { anchor: '/other', data: status() } })
  assert.equal(s1, s0, '旧锚点成功响应不得覆盖新锚点状态')
  const s2 = gitMachine(s1, { type: 'failure', result: { anchor: '/other', code: 'x', message: 'y' } })
  assert.equal(s2, s1, '旧锚点失败响应同样丢弃')
})

test('T5：failure → error（保留上次 ready 数据与签名）', () => {
  const s0 = gitMachine(initialGitState(), { type: 'reset', anchor: '/ws' })
  const s1 = gitMachine(s0, { type: 'success', result: { anchor: '/ws', data: status() } })
  const s2 = gitMachine(s1, { type: 'failure', result: { anchor: '/ws', code: 'git-status-failed', message: '超时' } })
  assert.equal(s2.phase, GIT_PHASE.ERROR)
  assert.deepEqual(s2.error, { code: 'git-status-failed', message: '超时' })
  assert.equal(s2.data.totalAdded, 1, '保留上次数据（重试成功后直接回 ready）')
  assert.equal(s2.sig, s1.sig, '签名保留')
})

test('T6：retry（error 态）→ loading + 保留数据', () => {
  const s0 = gitMachine(initialGitState(), { type: 'reset', anchor: '/ws' })
  const s1 = gitMachine(s0, { type: 'success', result: { anchor: '/ws', data: status() } })
  const s2 = gitMachine(s1, { type: 'failure', result: { anchor: '/ws', code: 'x', message: 'y' } })
  const s3 = gitMachine(s2, { type: 'retry' })
  assert.equal(s3.phase, GIT_PHASE.LOADING)
  assert.equal(s3.error, null)
  assert.equal(s3.data, s2.data, '重试期间保留数据，避免闪烁')
})

test('T6 后成功：error→retry→success 直接回 ready', () => {
  let s = gitMachine(initialGitState(), { type: 'reset', anchor: '/ws' })
  s = gitMachine(s, { type: 'failure', result: { anchor: '/ws', code: 'x', message: 'y' } })
  s = gitMachine(s, { type: 'retry' })
  s = gitMachine(s, { type: 'success', result: { anchor: '/ws', data: status() } })
  assert.equal(s.phase, GIT_PHASE.READY)
})

test('close → 回到初始 boot', () => {
  const s0 = gitMachine(initialGitState(), { type: 'reset', anchor: '/ws' })
  const s1 = gitMachine(s0, { type: 'success', result: { anchor: '/ws', data: status() } })
  const s2 = gitMachine(s1, { type: 'close' })
  assert.deepEqual(s2, initialGitState())
})

test('gitSigOf：数据变化反映到签名；空值返回空串', () => {
  const a = gitSigOf(status())
  const b = gitSigOf(status({ totalAdded: 99 }))
  assert.notEqual(a, b)
  assert.equal(gitSigOf(null), '')
})
