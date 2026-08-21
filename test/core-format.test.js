// client core 纯函数测试：format.js（路径/大小/排序）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { norm, fmtSize, base, extOf, sortKids, relOf, shortPath } from '../src/core/format.js'

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

test('shortPath 长路径只保留末尾完整段（防换行）', () => {
  assert.equal(shortPath(null), null)
  assert.equal(shortPath(''), '')
  assert.equal(shortPath('C:/a/b'), 'C:/a/b')
  const long = 'C:/Users/webzh/Documents/项目/dsh/dsh-fm-plugin/src/components/TreePanel.js'
  const s = shortPath(long)
  assert.ok(s.startsWith('…/'), '长路径应以省略号开头: ' + s)
  assert.ok(s.endsWith('TreePanel.js'), '应保留末尾完整段: ' + s)
  assert.ok(s.length < long.length, '应比原路径短')
  assert.ok(s.length <= 44, '不应超过阈值: ' + s.length)
  assert.ok(!s.includes('//'), '不应出现残缺路径拼接: ' + s)
})
