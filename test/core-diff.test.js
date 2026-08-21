// client core 纯函数测试：diff.js（git diff 文本解析）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseDiff, allAddRows } from '../src/core/diff.js'

test('parseDiff 解析 hunk/meta/add/del/ctx 行', () => {
  const raw = [
    '--- a/file.js',
    '+++ b/file.js',
    '@@ -1,3 +1,4 @@',
    ' ctx line',
    '-old',
    '+new',
    '\\ No newline at end of file',
  ].join('\n')
  const rows = parseDiff(raw)
  assert.equal(rows[0].t, 'meta')
  assert.equal(rows[1].t, 'meta')
  assert.equal(rows[2].t, 'hunk')
  assert.equal(rows[3].t, 'ctx')
  assert.equal(rows[4].t, 'del')
  assert.equal(rows[4].s, 'old')
  assert.equal(rows[5].t, 'add')
  assert.equal(rows[5].s, 'new')
  assert.equal(rows[6].t, 'meta')
})

test('parseDiff 空输入（既有行为：split 产生一个空 ctx 行）', () => {
  assert.deepEqual(parseDiff(''), [{ t: 'ctx', s: '' }])
  assert.deepEqual(parseDiff(null), [{ t: 'ctx', s: '' }])
})

test('allAddRows 未跟踪文件按全部新增渲染', () => {
  const rows = allAddRows('a\nb')
  assert.equal(rows.length, 2)
  assert.ok(rows.every((r) => r.t === 'add'))
  assert.equal(rows[1].s, 'b')
})
