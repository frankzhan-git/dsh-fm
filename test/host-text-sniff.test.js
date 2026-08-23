// 文本嗅探（lib/fm-core/text-sniff.js）测试：兜底预览的判定信号。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sniffText, TEXT_SNIFF_SAMPLE } from '../lib/fm-core/text-sniff.js'

const utf8 = (s) => new TextEncoder().encode(s)

test('UTF-8 文本（中文/英文/换行）→ 文本', () => {
  assert.equal(sniffText(utf8('machine=webzhan@example.com\n')), true)
  assert.equal(sniffText(utf8('你好，DSH 文件管理器\nconsole.log("ok")\n')), true)
  assert.equal(sniffText(utf8('a'.repeat(8192))), true)
})

test('空样本 / 短样本（<16B）→ 文本（短内容无二进制典型头）', () => {
  assert.equal(sniffText(new Uint8Array(0)), true)
  assert.equal(sniffText(new Uint8Array([0x4D, 0x5A])), true, 'MZ 头但过短 → 文本兜底（负向风险可接受）')
})

test('含 NUL → 二进制（.exe/.zip/png 头强信号）', () => {
  assert.equal(sniffText(new Uint8Array([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00])), false)
  assert.equal(sniffText(new Uint8Array([0x50, 0x4B, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00])), false)
  const png = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D])
  assert.equal(sniffText(png), false)
})

test('控制字符占比 >2% → 二进制（高熵数据）', () => {
  // 60 字节中 3 个 0x03（占 5%）+ 其余可打印
  const b = new Uint8Array(60).fill(0x41)
  b[1] = 0x03; b[20] = 0x03; b[40] = 0x03
  assert.equal(sniffText(b), false)
  // 2% 内（60 字节 1 个控制符）→ 文本
  const c = new Uint8Array(60).fill(0x41)
  c[1] = 0x03
  assert.equal(sniffText(c), true)
})

test('制表/换行/回车不视为控制字符', () => {
  assert.equal(sniffText(utf8('a\tb\nc\rd')), true)
})

test('采样字节数用于有限读取（8KB）', () => {
  assert.ok(TEXT_SNIFF_SAMPLE > 0)
  assert.ok(TEXT_SNIFF_SAMPLE <= 8192)
})
