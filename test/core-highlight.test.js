// client core 纯函数测试：highlight.js（语法高亮分词）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { langFor, tokenize } from '../src/core/highlight.js'

test('langFor 按扩展名映射语言配置', () => {
  assert.equal(langFor('js').kw.length > 0, true)
  assert.equal(langFor('ts').kw.includes('interface'), true)
  assert.equal(langFor('py').kw.includes('def'), true)
  // 未知扩展名回退到 text（无关键字）
  assert.equal(langFor('xyzabc').kw.length, 0)
})

test('tokenize 识别行注释与字符串', () => {
  const toks = tokenize('// hello\nconst s = "x"', langFor('js'))
  const classes = toks.filter((t) => t.c !== '').map((t) => t.c)
  assert.ok(classes.includes('cm'), '应识别 // 行注释')
  assert.ok(classes.includes('st'), '应识别字符串')
})

test('tokenize 关键字识别', () => {
  const toks = tokenize('const a = 1', langFor('js'))
  const kw = toks.filter((t) => t.c === 'kw').map((t) => t.t)
  assert.ok(kw.includes('const'))
})

test('tokenize 数字与函数名', () => {
  const toks = tokenize('foo(42)', langFor('js'))
  const cls = toks.filter((t) => t.c !== '').map((t) => t.c)
  assert.ok(cls.includes('fn'), '应识别函数调用')
  assert.ok(cls.includes('nm'), '应识别数字')
})

test('tokenize 文本拼接完整（无丢失）', () => {
  const code = 'let a = "x"; // note\nb(1,2)'
  const toks = tokenize(code, langFor('js'))
  assert.equal(toks.map((t) => t.t).join(''), code)
})
