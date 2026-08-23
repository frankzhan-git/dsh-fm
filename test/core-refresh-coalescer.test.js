// 合并式单飞行刷新器（src/core/refresh-coalescer.js）测试：
// 并发合并、显式刷新不丢失、最新锚点补跑。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCoalescer } from '../src/core/refresh-coalescer.js'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

test('顺序调用：依次执行', async () => {
  const seen = []
  const fire = createCoalescer(async (k) => { seen.push(k) })
  await fire('a')
  await fire('b')
  assert.deepEqual(seen, ['a', 'b'])
})

test('关键回归：在途时的新刷新不被丢弃（索引/提交后 refreshGit 必达）', async () => {
  const seen = []
  let releaseFirst
  const fire = createCoalescer(async (k) => {
    seen.push(k)
    if (k === 'poll') await new Promise((r) => { releaseFirst = r }) // 轮询请求挂起
  })
  const p1 = fire('poll') // 轮询发起（在途）
  await sleep(1)
  const p2 = fire('explicit') // 显式刷新（旧布尔实现此处被静默吞掉）
  assert.equal(await p2, false, '在途时返回 false（已合并）')
  releaseFirst() // 轮询完成
  await p1
  await sleep(5)
  assert.deepEqual(seen, ['poll', 'explicit'], '显式刷新必须以最新锚点补跑')
})

test('多轮并发合并：只保留最新锚点', async () => {
  const seen = []
  let release
  const fire = createCoalescer(async (k) => {
    seen.push(k)
    if (k === 'a') await new Promise((r) => { release = r })
  })
  const p1 = fire('a')
  await sleep(1)
  fire('b') // 在途：合并（pending=b）
  fire('c') // 在途：最新覆盖（pending=c）
  release()
  await p1
  await sleep(5)
  assert.deepEqual(seen, ['a', 'c'], '同批并发仅补跑最新锚点（同键收敛）')
})

test('空 key 安全（不触发 run）', async () => {
  let runs = 0
  const fire = createCoalescer(async () => { runs++ })
  await fire(null)
  assert.equal(runs, 0)
})
