// host 能力域/上下文域测试：fm-git-capability 与 fm-git-context（零 shell 上下文切片）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createFmCore } from '../lib/fm-core/index.js'

function makeFakeShell(gitOk) {
  return {
    resolve: (spec) => spec,
    run: async (spec) => spec.command === 'git --version'
      ? (gitOk ? { exitCode: 0, stdout: { text: 'git version 2.47.0' }, stderr: { text: '' } } : { exitCode: 1, stdout: { text: '' }, stderr: { text: '' } })
      : { exitCode: 0, stdout: { text: '' }, stderr: { text: '' } },
  }
}

function makeFs(repoRoots) {
  const roots = (repoRoots || []).map((r) => String(r).replace(/\/+$/, ''))
  return {
    resolve: async (p) => ({ displayPath: String(p), targetKey: String(p) }),
    stat: async (t) => {
      const p = String((t && t.displayPath) || t || '')
      if (!p.endsWith('/.git')) return null
      const dir = p.slice(0, -5).replace(/\/+$/, '')
      return roots.indexOf(dir) !== -1 ? { type: 'directory' } : null
    },
    listDir: async () => [],
    readText: async () => '',
    writeText: async () => ({}),
    readBytes: async () => new Uint8Array(0),
    contains: () => true,
  }
}

const services = ({ gitOk = true, roots = ['/ws'] } = {}) => ({
  fs: makeFs(roots),
  shell: makeFakeShell(gitOk),
  sessions: undefined,
  sp: { workspaceRoot: '/ws' },
})

test('fm-git-capability：已安装 → gitInstalled:true + 版本', async () => {
  const h = createFmCore(services())
  const r = await h['fm-git-capability']({})
  assert.equal(r.ok, true)
  assert.equal(r.gitInstalled, true)
  assert.equal(r.gitVersion, 'git version 2.47.0')
})

test('fm-git-capability：未安装 → gitInstalled:false', async () => {
  const h = createFmCore(services({ gitOk: false }))
  const r = await h['fm-git-capability']({})
  assert.equal(r.ok, true)
  assert.equal(r.gitInstalled, false)
})

test('fm-git-context：锚点自带仓库 → hasRepo:true + repoRoot', async () => {
  const h = createFmCore(services({ roots: ['/ws'] }))
  const r = await h['fm-git-context']({ anchor: '/ws' })
  assert.equal(r.ok, true)
  assert.deepEqual({ hasRepo: r.hasRepo, repoRoot: r.repoRoot, hasOwnRepo: r.hasOwnRepo }, { hasRepo: true, repoRoot: '/ws', hasOwnRepo: true })
})

test('fm-git-context：无仓库 → hasRepo:false（初始化胶囊骨架）', async () => {
  const h = createFmCore(services({ roots: [] }))
  const r = await h['fm-git-context']({ anchor: '/plain' })
  assert.equal(r.ok, true)
  assert.deepEqual({ hasRepo: r.hasRepo, repoRoot: r.repoRoot }, { hasRepo: false, repoRoot: null })
})

test('fm-git-context：无法确定工作目录 → context-unavailable', async () => {
  const h = createFmCore({ fs: makeFs([]), shell: makeFakeShell(true), sessions: undefined, sp: { workspaceRoot: null } })
  const r = await h['fm-git-context']({})
  assert.equal(r.ok, false)
  assert.equal(r.code, 'context-unavailable')
})
