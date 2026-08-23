// 树列表合并（src/core/tree-merge.js）测试：重刷不重置 UI 状态（体验修复的核心回归）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeListing } from '../src/core/tree-merge.js'

const node = (over) => Object.assign({ path: '', name: '', type: 'file', size: null, loaded: false, expanded: false, loading: false, childPaths: [], hasGit: false }, over || {})

test('关键回归：重刷已存在节点 → 保留 loaded/expanded/childPaths（子目录展开状态不丢失）', () => {
  // 用户已展开 docs/（loaded+expanded+已加载子项 a）
  const t = {
    '/ws/docs': node({ path: '/ws/docs', type: 'directory', loaded: true, expanded: true, childPaths: ['/ws/docs/a'] }),
    '/ws/docs/a': node({ path: '/ws/docs/a', name: 'a', loaded: true }),
    '/ws/docs/b': node({ path: '/ws/docs/b', name: 'b' }),
  }
  const r = mergeListing(t, '/ws', [
    { path: '/ws/docs', name: 'docs', type: 'directory', size: null, hasGit: false },
    { path: '/ws/docs/b', name: 'b', type: 'file', size: 5, hasGit: false },
  ])
  const docs = r.additions['/ws/docs']
  assert.equal(docs.loaded, true, 'loaded 保留')
  assert.equal(docs.expanded, true, 'expanded 保留（旧版会重置为 false → 子目录收起）')
  assert.deepEqual(docs.childPaths, ['/ws/docs/a'], 'childPaths 保留')
  assert.equal(docs.type, 'directory', '数据元信息跟随最新列表')
  // b 节点已存在 → 元信息更新、UI 状态保留
  const b = r.additions['/ws/docs/b']
  assert.equal(b.size, 5, 'size 更新')
  assert.equal(b.expanded, false) // 原本即收起
  // childPaths 正确（含新/旧条目）
  assert.deepEqual(r.childPaths, ['/ws/docs', '/ws/docs/b'])
})

test('新条目 → fresh 节点（未加载、未展开）', () => {
  const t = { '/ws': node({ path: '/ws', type: 'directory', childPaths: [] }) }
  const r = mergeListing(t, '/ws', [{ path: '/ws/new', name: 'new', type: 'file', size: null, hasGit: false }])
  const n = r.additions['/ws/new']
  assert.equal(n.loaded, false)
  assert.equal(n.expanded, false)
  assert.deepEqual(n.childPaths, [])
})

test('消失条目 → 从树中移除（removed 列表）', () => {
  const t = {
    '/ws': node({ path: '/ws', type: 'directory', childPaths: ['/ws/gone', '/ws/keep'] }),
    '/ws/gone': node({ path: '/ws/gone', name: 'gone' }),
    '/ws/gone/x': node({ path: '/ws/gone/x', name: 'x' }),
    '/ws/keep': node({ path: '/ws/keep', name: 'keep' }),
  }
  const r = mergeListing(t, '/ws', [{ path: '/ws/keep', name: 'keep', type: 'file' }])
  assert.deepEqual(r.removed, ['/ws/gone'], '仅直接子节点进入 removed（与旧语义一致）')
})

test('路径反斜杠归一（host displayPath）', () => {
  const r = mergeListing({}, '/ws', [{ path: 'C:\\ws\\a', name: 'a', type: 'file' }])
  assert.equal(r.childPaths[0], 'C:/ws/a')
})

test('空目录重刷：childPaths 为空且不产生残留条目', () => {
  const t = { '/ws': node({ path: '/ws', type: 'directory', childPaths: ['/ws/old'] }) }
  const r = mergeListing(t, '/ws', [])
  assert.deepEqual(r.childPaths, [])
  assert.deepEqual(r.additions, {})
  assert.deepEqual(r.removed, ['/ws/old'])
})
