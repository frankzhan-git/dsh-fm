// 索引管理语义测试（架构根治）：已跟踪路径排除 = rm --cached + .gitignore；
// 加入索引 = 移除 ignore 条目 + 必要时 git add；read-only 策略拒绝写操作。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createFmCore } from '../lib/fm-core/index.js'

function makeFakeShell() {
  const calls = []
  const routes = []
  const shell = {
    calls,
    when: (match, out) => routes.push({ match, out }),
    resolve: (spec) => spec,
    run: async (spec) => {
      calls.push(spec.command)
      const hit = routes.find((r) => r.match.test(spec.command))
      if (!hit) return { exitCode: 0, stdout: { text: '' }, stderr: { text: '' } }
      return typeof hit.out === 'function' ? hit.out() : hit.out
    },
  }
  return shell
}

function makeFs(repoRoots, ignoreText) {
  const roots = (repoRoots || ['/ws']).map((r) => String(r).replace(/\/+$/, ''))
  let ignore = ignoreText || ''
  return {
    readIgnore: () => ignore,
    writeText: async (t, text) => { ignore = String(text) },
    getIgnore: () => ignore,
    resolve: async (p, opts) => {
      const abs = String(p)
      const full = abs.startsWith('/') ? abs : ((opts && opts.cwd || '/ws') + '/' + abs)
      return { displayPath: full, targetKey: full }
    },
    stat: async (t) => {
      const p = String((t && t.displayPath) || t || '')
      if (p.endsWith('/.gitignore')) return { type: 'file' }
      if (p.endsWith('/.git')) return { type: 'directory' }
      return { type: 'directory' } // 其余路径默认为目录（/ws/docs 等）
    },
    listDir: async () => [{ name: 'a.txt', type: 'file' }],
    readText: async () => ignore,
    readBytes: async () => new Uint8Array(0),
    contains: () => true,
  }
}

// git 命令端口路由：ls-files 默认空（未跟踪）；/rm|add/ 记录成功
function wireGit(shell, { tracked } = {}) {
  shell.when(/git --version$/, () => ({ exitCode: 0, stdout: { text: 'git version 2.47.0' }, stderr: { text: '' } }))
  shell.when(/ls-files -- /, () => ({ exitCode: 0, stdout: { text: tracked ? 'docs/a.md\n' : '' }, stderr: { text: '' } }))
  shell.when(/rm --cached/, () => ({ exitCode: 0, stdout: { text: '' }, stderr: { text: '' } }))
  shell.when(/add -A -- /, () => ({ exitCode: 0, stdout: { text: '' }, stderr: { text: '' } }))
}

function makeServices(shell, fs, sp) {
  return { fs, shell, sessions: undefined, sp: sp || { workspaceRoot: '/ws' } }
}

test('排除：已跟踪路径 → 先 rm --cached 再写 .gitignore（点击不再无作用）', async () => {
  const shell = makeFakeShell()
  wireGit(shell, { tracked: true })
  const fs = makeFs(['/ws'])
  const h = createFmCore(makeServices(shell, fs))
  const r = await h['fm-git-index-set']({ path: '/ws/docs', checked: false, recursive: false, anchor: '/ws' })
  assert.equal(r.ok, true)
  assert.equal(r.changed, true)
  const rmIdx = shell.calls.findIndex((c) => c.includes('rm --cached'))
  assert.ok(rmIdx !== -1, '已跟踪路径必须执行 git rm --cached: ' + shell.calls.join(' | '))
  assert.ok(shell.calls.some((c) => c.includes('ls-files --')), '先探测跟踪状态')
  assert.ok(fs.getIgnore().includes('/docs/'), '.gitignore 应写入 /docs/')
  assert.ok(!shell.calls.some((c) => c.includes('add -A --')), '排除方向不调用 add')
})

test('排除：未跟踪路径 → 不调用 rm，直接写 .gitignore', async () => {
  const shell = makeFakeShell()
  wireGit(shell, { tracked: false })
  const fs = makeFs(['/ws'])
  const h = createFmCore(makeServices(shell, fs))
  const r = await h['fm-git-index-set']({ path: '/ws/newdir', checked: false, recursive: false, anchor: '/ws' })
  assert.equal(r.ok, true)
  assert.equal(shell.calls.some((c) => c.includes('rm --cached')), false, '未跟踪路径不调用 rm')
  assert.ok(fs.getIgnore().includes('/newdir/'))
})

test('排除：已存在于 .gitignore（无 rm 需求）→ changed:false 且不改文件', async () => {
  const shell = makeFakeShell()
  wireGit(shell, { tracked: false })
  const fs = makeFs(['/ws'], '/existing/\n')
  const h = createFmCore(makeServices(shell, fs))
  const r = await h['fm-git-index-set']({ path: '/ws/existing', checked: false, recursive: false, anchor: '/ws' })
  assert.equal(r.ok, true)
  assert.equal(r.changed, false)
  assert.equal(fs.getIgnore(), '/existing/\n', '无变化时不得重写 .gitignore')
})

test('加入：曾被取消跟踪（ls-files 空）→ 移除 ignore 条目并 git add', async () => {
  const shell = makeFakeShell()
  wireGit(shell, { tracked: false })
  const fs = makeFs(['/ws'], '/docs/\n')
  const h = createFmCore(makeServices(shell, fs))
  const r = await h['fm-git-index-set']({ path: '/ws/docs', checked: true, recursive: false, anchor: '/ws' })
  assert.equal(r.ok, true)
  assert.equal(r.changed, true)
  assert.ok(!fs.getIgnore().includes('/docs/'), '应移除 /docs/ 条目: ' + fs.getIgnore())
  assert.ok(shell.calls.some((c) => c.includes('add -A --')), '取消跟踪过的路径需 git add 恢复跟踪')
})

test('加入：已跟踪路径 → 仅移除条目不调用 add', async () => {
  const shell = makeFakeShell()
  wireGit(shell, { tracked: true })
  const fs = makeFs(['/ws'], '/docs/\n')
  const h = createFmCore(makeServices(shell, fs))
  const r = await h['fm-git-index-set']({ path: '/ws/docs', checked: true, recursive: false, anchor: '/ws' })
  assert.equal(r.ok, true)
  assert.equal(shell.calls.some((c) => c.includes('add -A --')), false, '已跟踪路径无需 add')
})

test('批量加入（recursive=true）：移除文件夹自身 + 锚定子项条目（产品语义 v2：目录下全部内容）', async () => {
  const shell = makeFakeShell()
  wireGit(shell, { tracked: false })
  const fs = makeFs(['/ws'], '/docs/\n/docs/tmp/\n')
  const h = createFmCore(makeServices(shell, fs))
  const r = await h['fm-git-index-set']({ path: '/ws/docs', checked: true, recursive: true, anchor: '/ws' })
  assert.equal(r.ok, true)
  assert.equal(r.changed, true)
  assert.ok(!fs.getIgnore().includes('/docs/'), '应移除文件夹条目: ' + fs.getIgnore())
  assert.ok(!fs.getIgnore().includes('/docs/tmp/'), '应移除锚定子项条目: ' + fs.getIgnore())
  assert.ok(shell.calls.some((c) => c.includes('add -A --')), '取消跟踪过的目录需 git add 恢复')
})

test('批量加入（recursive=true）：非锚定子项条目保留（可能匹配他处，不擅自移除）', async () => {
  const shell = makeFakeShell()
  wireGit(shell, { tracked: true })
  const fs = makeFs(['/ws'], '/docs/\ndocs/tmp/\n')
  const h = createFmCore(makeServices(shell, fs))
  const r = await h['fm-git-index-set']({ path: '/ws/docs', checked: true, recursive: true, anchor: '/ws' })
  assert.equal(r.ok, true)
  assert.equal(fs.getIgnore().includes('docs/tmp/'), true, '非锚定子项保留')
  assert.equal(fs.getIgnore().includes('/docs/'), false, '文件夹条目移除')
})

test('read-only 会话 → sandbox-denied（写操作被拒）', async () => {
  const shell = makeFakeShell()
  wireGit(shell, { tracked: false })
  const fs = makeFs(['/ws'])
  const sp = {
    workspaceRoot: '/ws',
    resolve: () => ({ mode: 'read-only', workspaceRoot: '/ws' }),
  }
  const h = createFmCore(makeServices(shell, fs, sp))
  const r = await h['fm-git-index-set']({ path: '/ws/docs', checked: false, recursive: false, anchor: '/ws' })
  assert.equal(r.ok, false)
  assert.equal(r.code, 'sandbox-denied')
  assert.equal(shell.calls.some((c) => c.includes('rm')), false, '拒绝时不得执行任何 git 命令')
})

test('目录非空 probe → dirNonEmpty 语义保留', async () => {
  const shell = makeFakeShell()
  wireGit(shell, { tracked: false })
  const fs = makeFs(['/ws'])
  const h = createFmCore(makeServices(shell, fs))
  const r = await h['fm-git-index-set']({ path: '/ws/docs', checked: false, probe: true, anchor: '/ws' })
  assert.equal(r.ok, true)
  assert.equal(r.dirNonEmpty, true)
  assert.equal(r.isDir, true)
  assert.equal(r.entryCount, 1, 'probe 应返回条目数（影响条展示）')
})
