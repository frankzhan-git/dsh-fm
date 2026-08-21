// host 纯函数测试：.gitignore 解析与转义（import 自 fm-core.js）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { escIgnorePattern, parseIgnoreLine } from '../lib/fm-core.js'

test('escIgnorePattern 转义 # ! 通配符与尾随空格', () => {
  assert.equal(escIgnorePattern('#secret'), '\\#secret')
  assert.equal(escIgnorePattern('!important'), '\\!important')
  assert.equal(escIgnorePattern('a*b?c[d]'), 'a\\*b\\?c\\[d\\]')
  assert.equal(escIgnorePattern('dir '), 'dir\\ ')
  assert.equal(escIgnorePattern('plain/dir'), 'plain/dir')
})

test('parseIgnoreLine 解析简单路径字面量', () => {
  assert.deepEqual(parseIgnoreLine('dist'), { rel: 'dist', isDir: false, neg: false, anchored: false })
  assert.deepEqual(parseIgnoreLine('/dist/'), { rel: 'dist', isDir: true, neg: false, anchored: true })
  assert.deepEqual(parseIgnoreLine('!keep.txt'), { rel: 'keep.txt', isDir: false, neg: true, anchored: false })
  assert.deepEqual(parseIgnoreLine('/a/b/c.txt'), { rel: 'a/b/c.txt', isDir: false, neg: false, anchored: true })
  assert.equal(parseIgnoreLine(''), null)
  assert.equal(parseIgnoreLine('# 注释'), null)
  assert.equal(parseIgnoreLine('*.log'), null)
  assert.equal(parseIgnoreLine('a/**/b'), null)
  assert.equal(parseIgnoreLine('a[b]'), null)
})

test('parseIgnoreLine 处理转义字符', () => {
  // 转义后的通配符视为字面量，应被解析为简单路径
  const r = parseIgnoreLine('\\*.log')
  assert.ok(r)
  assert.equal(r.rel, '*.log')
  assert.equal(r.neg, false)
})

test('parseIgnoreLine 处理 isDir 尾斜杠', () => {
  const r = parseIgnoreLine('node_modules/')
  assert.ok(r)
  assert.equal(r.isDir, true)
  assert.equal(r.rel, 'node_modules')
})
