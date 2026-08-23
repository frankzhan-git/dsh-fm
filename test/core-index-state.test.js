// 索引状态派生（src/core/index-state.js）测试：目录三态 / 文件二态 / 前缀边界。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { indexStateOf, INDEX_STATE } from '../src/core/index-state.js'

test('on：无任何未索引条目（含空目录视为全部索引）', () => {
  assert.equal(indexStateOf('/ws/docs', new Set()), INDEX_STATE.ON)
  assert.equal(indexStateOf('/ws/docs/sub', new Set(['/ws/other/x'])), INDEX_STATE.ON)
})

test('off：自身在未索引集合（整目录未跟踪/忽略标记）', () => {
  assert.equal(indexStateOf('/ws/docs', new Set(['/ws/docs'])), INDEX_STATE.OFF)
  assert.equal(indexStateOf('/ws/docs/new.txt', new Set(['/ws/docs/new.txt'])), INDEX_STATE.OFF)
})

test('关键回归：祖先在未索引集合 → 子项全部 off（取消勾选文件夹后子文件一并未选中）', () => {
  // 取消勾选 docs/ → 集合含整目录标记 '/ws/docs'（porcelain !! docs/）
  const set = new Set(['/ws/docs'])
  assert.equal(indexStateOf('/ws/docs/a.md', set), INDEX_STATE.OFF, '直接文件继承')
  assert.equal(indexStateOf('/ws/docs/sub', set), INDEX_STATE.OFF, '子目录继承')
  assert.equal(indexStateOf('/ws/docs/sub/a.md', set), INDEX_STATE.OFF, '深层文件继承')
  // 祖先未索引优先于 part（自身也曾有更深的未索引条目）
  assert.equal(indexStateOf('/ws/docs/sub/x', new Set(['/ws/docs', '/ws/docs/sub/x'])), INDEX_STATE.OFF)
  // 未受影响的兄弟路径保持原判
  assert.equal(indexStateOf('/ws/other/file', set), INDEX_STATE.ON)
})

test('part：目录不在集合但存在任意层级未索引条目', () => {
  assert.equal(indexStateOf('/ws/docs', new Set(['/ws/docs/new.txt'])), INDEX_STATE.PART)
  assert.equal(indexStateOf('/ws/docs', new Set(['/ws/docs/sub/tmp/a'])), INDEX_STATE.PART)
  assert.equal(indexStateOf('/ws/docs', new Set(['/ws/docs/sub'])), INDEX_STATE.PART, '子目录整目录未跟踪 → 部分')
})

test('前缀边界：docs2 不得影响 docs（同名前缀目录不误判）', () => {
  assert.equal(indexStateOf('/ws/docs', new Set(['/ws/docs2/x'])), INDEX_STATE.ON)
  assert.equal(indexStateOf('/ws/docs', new Set(['/ws/docsx/y'])), INDEX_STATE.ON)
})

test('文件：二态（在集合=off，不在=on）', () => {
  assert.equal(indexStateOf('/ws/docs/a.md', new Set(['/ws/docs/a.md'])), INDEX_STATE.OFF)
  assert.equal(indexStateOf('/ws/docs/a.md', new Set()), INDEX_STATE.ON)
})

test('空路径 → off（安全兜底）', () => {
  assert.equal(indexStateOf('', new Set()), INDEX_STATE.OFF)
  assert.equal(indexStateOf(null, new Set()), INDEX_STATE.OFF)
})
