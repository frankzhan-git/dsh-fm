// host 文件域测试：fm-read 分层预览（全文 / 流式截断 / 图片上限 / 类型处理）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createFsHandlers } from '../lib/fm-core/fs.js'
import { quote } from '../lib/fm-core/shell.js'

const TEXT_LIMIT = 2 * 1024 * 1024
const IMAGE_LIMIT = 30 * 1024 * 1024

function makeFs(overrides) {
  return Object.assign({
    resolve: async (p) => ({ displayPath: '/root/' + p, targetKey: '/root/' + p }),
    stat: async () => ({ type: 'file', size: 100 }),
    listDir: async () => [],
    readText: async () => 'hello',
    readBytes: async () => new Uint8Array([72, 101, 108, 108, 111]), // 'Hello'
    streamText: async () => (async function* () { yield 'chunk1'; yield 'chunk2' })(),
    contains: () => true,
    writeText: async () => ({}),
  }, overrides)
}

function handlers(fs) {
  return createFsHandlers({
    fs,
    rootOf: async () => '/root',
    sh: async () => ({ exitCode: 0 }),
    quote,
  })
}

const args = (path, name) => ({ path, name: name || path })

test('fm-read 文本 ≤ 上限：readText 全文预览', async () => {
  const calls = { readText: 0 }
  const fs = makeFs({
    stat: async () => ({ type: 'file', size: 1000 }),
    readText: async () => { calls.readText++; return 'hello world' },
  })
  const r = await handlers(fs)['fm-read'](args('a.txt'))
  assert.equal(r.ok, true)
  assert.equal(r.kind, 'text')
  assert.equal(r.content, 'hello world')
  assert.equal(r.truncated, false)
  assert.equal(r.limit, TEXT_LIMIT)
  assert.equal(calls.readText, 1)
})

test('fm-read 文本 > 上限：streamText 流式截断预览（不拒绝）', async () => {
  const bigChunk = 'x'.repeat(1024 * 1024) // 1 MB
  const streamed = []
  const fs = makeFs({
    stat: async () => ({ type: 'file', size: 10 * 1024 * 1024 }),
    streamText: async () => (async function* () {
      yield bigChunk
      yield bigChunk
      yield bigChunk
    })(),
    readText: async () => { throw new Error('不应走 readText') },
  })
  const r = await handlers(fs)['fm-read'](args('big.log'))
  assert.equal(r.ok, true)
  assert.equal(r.kind, 'text')
  assert.equal(r.truncated, true, '超限应截断而非拒绝')
  assert.ok(r.content.length >= TEXT_LIMIT, '应读到约 2 MB')
  assert.equal(r.limit, TEXT_LIMIT)
  assert.equal(r.size, 10 * 1024 * 1024)
})

test('fm-read 文本 size 未知：流式读取（安全，不读大文件全文）', async () => {
  const fs = makeFs({ stat: async () => ({ type: 'file', size: null }) })
  const r = await handlers(fs)['fm-read'](args('a.md'))
  assert.equal(r.ok, true)
  assert.equal(r.kind, 'text')
  assert.equal(r.content, 'chunk1chunk2')
  assert.equal(r.truncated, false)
})

test('fm-read 图片正常：readBytes + base64', async () => {
  const r = await handlers(makeFs({ stat: async () => ({ type: 'file', size: 1024 }) }))['fm-read'](args('pic.png'))
  assert.equal(r.ok, true)
  assert.equal(r.kind, 'image')
  assert.equal(r.mime, 'image/png')
  assert.equal(r.base64, 'SGVsbG8=') // 'Hello'
})

test('fm-read 图片 > 上限：明确提示而非报错', async () => {
  const r = await handlers(makeFs({ stat: async () => ({ type: 'file', size: IMAGE_LIMIT + 1 }) }))['fm-read'](args('big.png'))
  assert.equal(r.ok, true)
  assert.equal(r.kind, 'tooLarge')
  assert.equal(r.limit, IMAGE_LIMIT)
  assert.ok(r.message.includes('30 MB'))
})

test('fm-read 兜底：未知扩展名文本（.git-credentials 场景）→ 默认文本预览', async () => {
  const r1 = await handlers(makeFs())['fm-read'](args('/r/.git-credentials', '.git-credentials'))
  assert.equal(r1.ok, true)
  assert.equal(r1.kind, 'text')
  assert.equal(r1.content, 'hello') // 默认 fake readText
  assert.equal(r1.detected, true, '嗅探兜底应带 detected 标记')
  // 无点文件（扩展名为空）走原文本分支且不带 detected
  const r2 = await handlers(makeFs())['fm-read'](args('/r/README', 'README'))
  assert.equal(r2.ok, true)
  assert.equal(r2.kind, 'text')
  assert.equal(r2.detected, false)
})

test('fm-read 不支持的类型：采样含 NUL → 仍为 unsupported', async () => {
  const fs = makeFs({
    readBytes: async () => new Uint8Array([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]),
  })
  const r = await handlers(fs)['fm-read'](args('app.exe'))
  assert.equal(r.ok, true)
  assert.equal(r.kind, 'unsupported')
  assert.equal(r.ext, 'exe')
})

test('fm-read 目录与不存在：错误响应', async () => {
  const dir = await handlers(makeFs({ stat: async () => ({ type: 'directory' }) }))['fm-read'](args('folder'))
  assert.equal(dir.ok, false)
  assert.ok(dir.error.includes('不是普通文件'))
  const missing = await handlers(makeFs({ stat: async () => undefined }))['fm-read'](args('nope.txt'))
  assert.equal(missing.ok, false)
  assert.ok(missing.error.includes('文件不存在'))
})

test('fm-list 目录条目带 .git → hasGit 标记（规则四 git 标签数据源）', async () => {
  const fs = makeFs({
    resolve: async (p, o) => {
      const s = String(p)
      const base = (o && o.cwd) || ''
      return { displayPath: s.startsWith('/') ? s : (base + '/' + s), targetKey: s }
    },
    listDir: async () => [
      { name: 'repo-a', type: 'directory', target: { displayPath: '/root/repo-a' } },
      { name: 'plain', type: 'directory', target: { displayPath: '/root/plain' } },
      { name: 'f.js', type: 'file', target: { displayPath: '/root/f.js' } },
    ],
    stat: async (t) => {
      const p = t && t.displayPath
      if (p === '/root/repo-a/.git') return { type: 'directory' }
      if (p === '/root/plain/.git') return null
      return { type: 'file', size: 1 }
    },
  })
  const r = await handlers(fs)['fm-list']({ path: '.' })
  assert.equal(r.ok, true)
  const byName = {}
  for (const e of r.entries) byName[e.name] = e
  assert.equal(byName['repo-a'].hasGit, true, '带 .git 的目录应标记 hasGit')
  assert.equal(byName['plain'].hasGit, false, '无 .git 的目录不应标记')
  assert.equal(byName['f.js'].hasGit, false, '文件条目不标记')
})

test('fm-list 条目过多时跳过 .git 探测（性能保护）', async () => {
  const many = []
  for (let i = 0; i < 250; i++) many.push({ name: 'd' + i, type: 'directory', target: { displayPath: '/root/d' + i } })
  let statCalls = 0
  const fs = makeFs({
    resolve: async (p, o) => ({ displayPath: p.startsWith('/') ? p : ((o && o.cwd) || '') + '/' + p, targetKey: p }),
    listDir: async () => many,
    stat: async () => { statCalls++; return { type: 'directory' } },
  })
  const r = await handlers(fs)['fm-list']({ path: '.' })
  assert.equal(r.ok, true)
  assert.equal(r.entries.length, 250)
  assert.ok(r.entries.every((e) => e.hasGit === false))
  assert.equal(statCalls, 0, '条目超限不应执行 .git 探测')
})
