// client core 纯函数测试：format.js（路径/大小/排序）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { norm, fmtSize, base, extOf, sortKids, relOf } from '../src/core/format.js'

test('norm 将反斜杠归一为斜杠', () => {
  assert.equal(norm('a\\b\\c'), 'a/b/c')
  assert.equal(norm('a/b/c'), 'a/b/c')
})

test('fmtSize 格式化大小', () => {
  assert.equal(fmtSize(null), '')
  assert.equal(fmtSize(512), '512 B')
  assert.equal(fmtSize(2048), '2.0 KB')
  assert.equal(fmtSize(3145728), '3.0 MB')
})

test('base 取路径末段', () => {
  assert.equal(base('/a/b/file.txt'), 'file.txt')
  assert.equal(base('file.txt'), 'file.txt')
})

test('extOf 取小写扩展名', () => {
  assert.equal(extOf('a.TXT'), 'txt')
  assert.equal(extOf('noext'), '')
  assert.equal(extOf('.hidden'), 'hidden')
})

test('sortKids 目录优先、数字感知、扩展名分组', () => {
  const kids = [
    { name: 'b.txt', type: 'file' },
    { name: 'a2', type: 'directory' },
    { name: 'a10', type: 'directory' },
    { name: 'a1', type: 'directory' },
    { name: 'a.js', type: 'file' },
  ]
  const sorted = sortKids(kids).map((k) => k.name)
  assert.deepEqual(sorted, ['a1', 'a2', 'a10', 'a.js', 'b.txt'])
})

test('relOf 相对工作区根', () => {
  assert.equal(relOf('/root', '/root/a/b.txt'), 'a/b.txt')
  assert.equal(relOf('/root', '/other/x'), '/other/x')
  assert.equal(relOf('', '/x'), '/x')
})
