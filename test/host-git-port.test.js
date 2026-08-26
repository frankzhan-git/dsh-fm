// host git 命令端口测试：fake shell 注入，验证命令串生成（双 shell 兼容）与状态解析
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createFmCore } from '../lib/fm-core/index.js'
import { quote } from '../lib/fm-core/shell.js'

// fake shell：记录全部命令与 workdir，按内容分支返回可控输出
function makeFakeShell() {
  const calls = []
  const dirs = []
  const routes = []
  const shell = {
    calls,
    dirs,
    when: (match, out) => routes.push({ match, out }),
    resolve: (spec) => spec,
    run: async (spec) => {
      calls.push(spec.command)
      dirs.push(spec.workdir)
      const hit = routes.find((r) => r.match.test(spec.command))
      if (!hit) return { exitCode: 0, stdout: { text: '' }, stderr: { text: '' } }
      return typeof hit.out === 'function' ? hit.out() : hit.out
    },
  }
  return shell
}

// fake fs：repoRoots 内的路径视为带 .git 的仓库根（供仓库上下文探测）；
// 其他路径一律视为不存在（stat → null），保持旧 fake 语义（git 候选二进制探测不命中）
function makeFs(repoRoots, opts) {
  const roots = (repoRoots || ['/root']).map((r) => String(r).replace(/\/+$/, ''))
  const extra = opts || {}
  const writes = []
  return {
    resolve: async (p) => ({ displayPath: String(p), targetKey: String(p) }),
    stat: async (t) => {
      const p = String((t && t.displayPath) || t || '')
      if (extra.files && extra.files[p]) return { type: 'file' }
      if (!p.endsWith('/.git')) return null
      const dir = p.slice(0, -5).replace(/\/+$/, '')
      return roots.indexOf(dir) !== -1 ? { type: 'directory' } : null
    },
    listDir: async () => [],
    readText: async () => '',
    writeText: async (t, text) => { writes.push({ path: String(t && t.displayPath || t), text: String(text) }) },
    readBytes: async () => new Uint8Array(0),
    contains: () => true,
    writes,
  }
}

function makeServices(shell, workspaceRoot, repoRoots) {
  return {
    fs: makeFs(repoRoots),
    shell,
    sessions: undefined,
    sp: { workspaceRoot: workspaceRoot === undefined ? '/root' : workspaceRoot },
  }
}

const okCmd = () => ({ exitCode: 0, stdout: { text: '' }, stderr: { text: '' } })

// 合并命令（单次 spawn）的 stdout：探测段 + 未暂存 numstat + 已暂存 numstat + porcelain，
// 段间以 __FM_DIFF_END__ 标记分隔（与 host 解析器一致）
const merged = (probe, unstaged, cached, porcelain) => ({
  exitCode: 0,
  stdout: { text: [probe, unstaged, cached, porcelain].join('\n__FM_DIFF_END__\n') },
  stderr: { text: '' },
})

test('quote 按平台转义：Windows → PowerShell 单引号，POSIX → 反斜杠', () => {
  if (process.platform === 'win32') {
    assert.equal(quote("a'b"), "'a''b'")
    assert.equal(quote('plain'), "'plain'")
  } else {
    assert.equal(quote("a'b"), "'a'\\''b'")
    assert.equal(quote('plain'), "'plain'")
  }
})

test('gitCmd 自动补 git 前缀，已带前缀则透传', async () => {
  const shell = makeFakeShell()
  shell.when(/git --version$/, () => ({ exitCode: 0, stdout: { text: 'git version 2.47.0' }, stderr: { text: '' } }))
  const handlers = createFmCore(makeServices(shell))
  const h = handlers['fm-git-init']
  const r = await h({})
  assert.equal(r.ok, true)
  assert.equal(shell.calls[0], 'git --version')
  assert.equal(shell.calls[1], 'git rev-parse --git-dir')
  assert.equal(shell.calls[2], 'git init -b main')
})

test('probeGit 结果缓存：重复调用不重复探测', async () => {
  const shell = makeFakeShell()
  let versionCalls = 0
  shell.when(/git --version$/, () => { versionCalls++; return { exitCode: 0, stdout: { text: 'git version 2.47.0' }, stderr: { text: '' } } })
  const handlers = createFmCore(makeServices(shell))
  await handlers['fm-git-init']({})
  await handlers['fm-git-init']({})
  assert.equal(versionCalls, 1, 'git --version 只应探测一次')
})

test('fm-git-status 解析（有 HEAD）：numstat 聚合 + 未跟踪 + 忽略（路径基准=仓库根）', async () => {
  const shell = makeFakeShell()
  shell.when(/git --version$/, () => ({ exitCode: 0, stdout: { text: 'git version 2.47.0' }, stderr: { text: '' } }))
  shell.when(/rev-parse --is-inside-work-tree/, () => merged('true\nC:/repo\n' + 'a'.repeat(40), '3\t1\tsrc/a.js', '', '?? new.txt\n!! ignored.log\n M src/a.js'))
  const handlers = createFmCore(makeServices(shell))
  const r = await handlers['fm-git-status']({})
  assert.equal(r.ok, true)
  assert.equal(r.hasRepo, true)
  assert.equal(r.gitInstalled, true)
  assert.equal(r.totalAdded, 3)
  assert.equal(r.totalDeleted, 1)
  const a = r.files.find((f) => f.rel === 'src/a.js')
  assert.deepEqual({ added: a.added, deleted: a.deleted, untracked: a.untracked }, { added: 3, deleted: 1, untracked: false })
  // 路径必须按仓库根（C:/repo）拼接，与树节点绝对路径匹配
  assert.equal(a.path, 'C:/repo/src/a.js')
  const unt = r.files.find((f) => f.rel === 'new.txt')
  assert.deepEqual({ added: unt.added, untracked: unt.untracked }, { added: null, untracked: true })
  assert.deepEqual(r.ignored, ['C:/repo/ignored.log'])
  // 锚点回退会话根（/root 为仓库根）：被索引 → 工具条模式
  assert.deepEqual(r.context, { root: '/root', hasOwnRepo: true, anchorIndexed: true })
})

test('fm-git-status 解析（无 HEAD）：diff + cached 双段聚合', async () => {
  const shell = makeFakeShell()
  shell.when(/git --version$/, () => ({ exitCode: 0, stdout: { text: 'git version 2.47.0' }, stderr: { text: '' } }))
  shell.when(/rev-parse --is-inside-work-tree/, () => merged('true\nC:/repo', '1\t0\tb.js', '2\t2\tc.js', ''))
  const handlers = createFmCore(makeServices(shell))
  const r = await handlers['fm-git-status']({})
  assert.equal(r.totalAdded, 3)
  assert.equal(r.totalDeleted, 2)
  assert.equal(r.files.length, 2)
})

test('fm-git-status：未安装 git 返回 gitInstalled:false', async () => {
  const shell = makeFakeShell()
  shell.when(/git --version$/, () => ({ exitCode: 1, stdout: { text: '' }, stderr: { text: '' } }))
  const handlers = createFmCore(makeServices(shell))
  const r = await handlers['fm-git-status']({})
  assert.deepEqual({ hasRepo: r.hasRepo, gitInstalled: r.gitInstalled, gitVersion: r.gitVersion }, { hasRepo: false, gitInstalled: false, gitVersion: null })
})

test('fm-git-status：git 已安装但非仓库', async () => {
  const shell = makeFakeShell()
  shell.when(/git --version$/, () => ({ exitCode: 0, stdout: { text: 'git version 2.47.0' }, stderr: { text: '' } }))
  shell.when(/rev-parse --is-inside-work-tree/, () => ({ exitCode: 128, stdout: { text: 'false' }, stderr: { text: 'not a repo' } }))
  const handlers = createFmCore(makeServices(shell))
  const r = await handlers['fm-git-status']({})
  assert.deepEqual({ hasRepo: r.hasRepo, gitInstalled: r.gitInstalled }, { hasRepo: false, gitInstalled: true })
})

test('fm-git-diff 命令串含引号路径（绝对路径 → 相对仓库根）', async () => {
  const shell = makeFakeShell()
  shell.when(/git --version$/, () => ({ exitCode: 0, stdout: { text: 'git version 2.47.0' }, stderr: { text: '' } }))
  shell.when(/rev-parse --show-toplevel/, () => ({ exitCode: 0, stdout: { text: 'C:/repo\n' + 'a'.repeat(40) }, stderr: { text: '' } }))
  shell.when(/diff HEAD -- /, () => ({ exitCode: 0, stdout: { text: 'diff --git a/x b/x\n@@ -1 +1 @@\n-a\n+b' }, stderr: { text: '' } }))
  const handlers = createFmCore(makeServices(shell))
  const r = await handlers['fm-git-diff']({ path: 'C:/repo/src/my file.txt' })
  assert.equal(r.ok, true)
  assert.equal(r.untracked, false)
  assert.ok(r.raw.includes('@@'))
  const diffCmd = shell.calls.find((c) => c.includes('diff HEAD --'))
  assert.ok(diffCmd.includes("'src/my file.txt'"), '路径应相对仓库根并被单引号包裹: ' + diffCmd)
})

test('fm-git-diff 兼容旧客户端 rel 参数', async () => {
  const shell = makeFakeShell()
  shell.when(/git --version$/, () => ({ exitCode: 0, stdout: { text: 'git version 2.47.0' }, stderr: { text: '' } }))
  shell.when(/rev-parse --show-toplevel/, () => ({ exitCode: 0, stdout: { text: 'C:/repo\n' + 'a'.repeat(40) }, stderr: { text: '' } }))
  shell.when(/diff HEAD -- /, () => ({ exitCode: 0, stdout: { text: 'diff --git a/x b/x\n@@ -1 +1 @@\n-a\n+b' }, stderr: { text: '' } }))
  const handlers = createFmCore(makeServices(shell))
  const r = await handlers['fm-git-diff']({ rel: 'src/old.txt' })
  assert.equal(r.ok, true)
  const diffCmd = shell.calls.find((c) => c.includes('diff HEAD --'))
  assert.ok(diffCmd.includes("'src/old.txt'"), 'rel 兼容分支应透传: ' + diffCmd)
})

test('fm-git-commit 串联 add 与 commit', async () => {
  const shell = makeFakeShell()
  shell.when(/git --version$/, () => ({ exitCode: 0, stdout: { text: 'git version 2.47.0' }, stderr: { text: '' } }))
  shell.when(/add -A/, okCmd)
  shell.when(/commit -m /, okCmd)
  const handlers = createFmCore(makeServices(shell))
  const r = await handlers['fm-git-commit']({ msg: 'fix: 修复问题' })
  assert.equal(r.ok, true)
  assert.equal(shell.calls[1], 'git add -A')
  assert.equal(shell.calls[2], "git commit -m 'fix: 修复问题'")
})

test('fm-git-commit 空消息拒绝', async () => {
  const shell = makeFakeShell()
  const handlers = createFmCore(makeServices(shell))
  const r = await handlers['fm-git-commit']({ msg: '   ' })
  assert.equal(r.ok, false)
  assert.ok(r.error.includes('提交信息不能为空'))
})

test('fm-root 回退到 sandbox workspaceRoot', async () => {
  const shell = makeFakeShell()
  const handlers = createFmCore(makeServices(shell, '/ws/root'))
  const r = await handlers['fm-root']({})
  assert.deepEqual(r, { root: '/ws/root' })
})

test('fm-list 拒绝无法确定工作目录', async () => {
  const shell = makeFakeShell()
  const handlers = createFmCore(makeServices(shell, null))
  const r = await handlers['fm-list']({})
  assert.equal(r.ok, false)
  assert.ok(r.error.includes('无法确定工作目录'))
})

// ---------- 仓库上下文：锚点跟随当前根目录 ----------

test('fm-git-status：锚点自带 .git → 以自身仓库为基准（进入子仓库场景）', async () => {
  const shell = makeFakeShell()
  shell.when(/git --version$/, () => ({ exitCode: 0, stdout: { text: 'git version 2.47.0' }, stderr: { text: '' } }))
  shell.when(/rev-parse --is-inside-work-tree/, () => merged('true\nC:/ws/plugin\n' + 'a'.repeat(40), '2\t0\tsrc/x.js', '', ''))
  const handlers = createFmCore(makeServices(shell, '/ws', ['C:/ws/plugin']))
  const r = await handlers['fm-git-status']({ anchor: 'C:/ws/plugin' })
  assert.equal(r.ok, true)
  assert.equal(r.hasRepo, true)
  // git 合并命令（单次 spawn）应以锚点自身仓库根为 cwd；dirs[0] 为版本探测
  assert.equal(shell.dirs[1], 'C:/ws/plugin', 'status 应在锚点仓库根执行')
  assert.deepEqual(r.context, { root: 'C:/ws/plugin', hasOwnRepo: true, anchorIndexed: true })
  const f = r.files.find((x) => x.rel === 'src/x.js')
  assert.equal(f.path, 'C:/ws/plugin/src/x.js')
})

test('fm-git-status：锚点在仓库内非根 → 以最近上级仓库为基准（dsh/docs 场景）', async () => {
  const shell = makeFakeShell()
  shell.when(/git --version$/, () => ({ exitCode: 0, stdout: { text: 'git version 2.47.0' }, stderr: { text: '' } }))
  shell.when(/rev-parse --is-inside-work-tree/, () => merged('true\n/ws\n' + 'a'.repeat(40), '1\t1\tdocs/a.md', '', ''))
  const handlers = createFmCore(makeServices(shell, '/ws', ['/ws']))
  const r = await handlers['fm-git-status']({ anchor: '/ws/docs' })
  assert.equal(r.ok, true)
  assert.equal(shell.dirs[1], '/ws', '应以上级仓库根为 cwd')
  assert.deepEqual(r.context, { root: '/ws', hasOwnRepo: false, anchorIndexed: true })
  assert.equal(r.files[0].path, '/ws/docs/a.md')
})

test('fm-git-status：锚点无任何仓库 → hasRepo:false + context:null（初始化胶囊场景）', async () => {
  const shell = makeFakeShell()
  shell.when(/git --version$/, () => ({ exitCode: 0, stdout: { text: 'git version 2.47.0' }, stderr: { text: '' } }))
  const handlers = createFmCore(makeServices(shell, '/ws', []))
  const r = await handlers['fm-git-status']({ anchor: '/plain' })
  assert.equal(r.ok, true)
  assert.equal(r.hasRepo, false)
  assert.equal(r.gitInstalled, true)
  assert.equal(r.context, null)
})

test('fm-git-status：锚点被仓库忽略 → anchorIndexed:false（dsh-fm-release 场景）', async () => {
  const shell = makeFakeShell()
  shell.when(/git --version$/, () => ({ exitCode: 0, stdout: { text: 'git version 2.47.0' }, stderr: { text: '' } }))
  shell.when(/rev-parse --is-inside-work-tree/, () => merged('true\n/ws\n' + 'a'.repeat(40), '', '', '!! release'))
  const handlers = createFmCore(makeServices(shell, '/ws', ['/ws']))
  const r = await handlers['fm-git-status']({ anchor: '/ws/release' })
  assert.equal(r.ok, true)
  assert.equal(r.context.anchorIndexed, false)
  assert.deepEqual(r.ignored, ['/ws/release'])
})

test('fm-git-status：锚点祖先被忽略 → anchorIndexed:false', async () => {
  const shell = makeFakeShell()
  shell.when(/git --version$/, () => ({ exitCode: 0, stdout: { text: 'git version 2.47.0' }, stderr: { text: '' } }))
  shell.when(/rev-parse --is-inside-work-tree/, () => merged('true\n/ws\n' + 'a'.repeat(40), '', '', '!! release'))
  const handlers = createFmCore(makeServices(shell, '/ws', ['/ws']))
  const r = await handlers['fm-git-status']({ anchor: '/ws/release/sub' })
  assert.equal(r.ok, true)
  assert.equal(r.context.anchorIndexed, false, '锚点祖先被忽略 → 未索引')
})

test('fm-git-status：锚点被索引但仓库内有其他忽略项 → anchorIndexed:true', async () => {
  const shell = makeFakeShell()
  shell.when(/git --version$/, () => ({ exitCode: 0, stdout: { text: 'git version 2.47.0' }, stderr: { text: '' } }))
  shell.when(/rev-parse --is-inside-work-tree/, () => merged('true\n/ws\n' + 'a'.repeat(40), '', '', '!! release'))
  const handlers = createFmCore(makeServices(shell, '/ws', ['/ws']))
  const r = await handlers['fm-git-status']({ anchor: '/ws/docs' })
  assert.equal(r.ok, true)
  assert.equal(r.context.anchorIndexed, true)
})

test('fm-git-status：锚点整目录未跟踪（??）→ anchorIndexed:false（dsh-mermaid-plugin 场景）', async () => {
  const shell = makeFakeShell()
  shell.when(/git --version$/, () => ({ exitCode: 0, stdout: { text: 'git version 2.47.0' }, stderr: { text: '' } }))
  shell.when(/rev-parse --is-inside-work-tree/, () => merged('true\n/ws\n' + 'a'.repeat(40), '', '', '?? dsh-mermaid-plugin/\n!! dsh-mermaid-plugin/node_modules/'))
  const handlers = createFmCore(makeServices(shell, '/ws', ['/ws']))
  const r = await handlers['fm-git-status']({ anchor: '/ws/dsh-mermaid-plugin' })
  assert.equal(r.ok, true)
  assert.equal(r.context.anchorIndexed, false, '锚点整目录未跟踪 → 未索引（初始化胶囊）')
})

test('fm-git-status：锚点祖先未跟踪（??）→ anchorIndexed:false', async () => {
  const shell = makeFakeShell()
  shell.when(/git --version$/, () => ({ exitCode: 0, stdout: { text: 'git version 2.47.0' }, stderr: { text: '' } }))
  shell.when(/rev-parse --is-inside-work-tree/, () => merged('true\n/ws\n' + 'a'.repeat(40), '', '', '?? dsh-mermaid-plugin/'))
  const handlers = createFmCore(makeServices(shell, '/ws', ['/ws']))
  const r = await handlers['fm-git-status']({ anchor: '/ws/dsh-mermaid-plugin/src' })
  assert.equal(r.ok, true)
  assert.equal(r.context.anchorIndexed, false, '锚点祖先未跟踪 → 未索引')
})

test('fm-git-status：锚点被索引但其下有未跟踪文件 → anchorIndexed:true（回归防线）', async () => {
  const shell = makeFakeShell()
  shell.when(/git --version$/, () => ({ exitCode: 0, stdout: { text: 'git version 2.47.0' }, stderr: { text: '' } }))
  shell.when(/rev-parse --is-inside-work-tree/, () => merged('true\n/ws\n' + 'a'.repeat(40), '', '', '?? docs/new.md'))
  const handlers = createFmCore(makeServices(shell, '/ws', ['/ws']))
  const r = await handlers['fm-git-status']({ anchor: '/ws/docs' })
  assert.equal(r.ok, true)
  assert.equal(r.context.anchorIndexed, true, '锚点自身被索引 → 工具条（其下未跟踪文件不影响）')
})

test('fm-git-status 缓存命中：未跟踪锚点同样判定 anchorIndexed:false', async () => {
  const shell = makeFakeShell()
  let statusRuns = 0
  shell.when(/git --version$/, () => ({ exitCode: 0, stdout: { text: 'git version 2.47.0' }, stderr: { text: '' } }))
  shell.when(/rev-parse --is-inside-work-tree/, () => { statusRuns++; return merged('true\n/ws\n' + 'a'.repeat(40), '', '', '?? newp/') })
  const handlers = createFmCore(makeServices(shell, '/ws', ['/ws']))
  const r1 = await handlers['fm-git-status']({ anchor: '/ws' })
  const r2 = await handlers['fm-git-status']({ anchor: '/ws/newp' })
  assert.equal(r1.context.anchorIndexed, true, '仓库根被索引')
  assert.equal(r2.context.anchorIndexed, false, '缓存命中也应判定未索引锚点')
  assert.equal(statusRuns, 1, '同仓库 1.5s 内重复请求应命中缓存')
})

test('fm-git-status 结果缓存：同仓库短时间重复请求不重复 spawn', async () => {
  const shell = makeFakeShell()
  let statusRuns = 0
  shell.when(/git --version$/, () => ({ exitCode: 0, stdout: { text: 'git version 2.47.0' }, stderr: { text: '' } }))
  shell.when(/rev-parse --is-inside-work-tree/, () => { statusRuns++; return merged('true\n/ws\n' + 'a'.repeat(40), '1\t0\ta.js', '', '') })
  const handlers = createFmCore(makeServices(shell, '/ws', ['/ws']))
  const r1 = await handlers['fm-git-status']({ anchor: '/ws' })
  const r2 = await handlers['fm-git-status']({ anchor: '/ws/docs' })
  assert.equal(r1.ok, true)
  assert.equal(r2.ok, true)
  assert.equal(statusRuns, 1, '同仓库 1.5s 内重复请求应命中缓存（不重复 spawn）')
  assert.equal(r2.context.anchorIndexed, true)
})

test('fm-git-diff：嵌套仓库内文件 → 以文件所属仓库为 cwd 与路径基准', async () => {
  const shell = makeFakeShell()
  shell.when(/git --version$/, () => ({ exitCode: 0, stdout: { text: 'git version 2.47.0' }, stderr: { text: '' } }))
  shell.when(/rev-parse --show-toplevel/, () => ({ exitCode: 0, stdout: { text: 'C:/ws/plugin\n' + 'a'.repeat(40) }, stderr: { text: '' } }))
  shell.when(/diff HEAD -- /, () => ({ exitCode: 0, stdout: { text: 'diff --git a/src/a.js b/src/a.js\n@@ -1 +1 @@\n-a\n+b' }, stderr: { text: '' } }))
  const handlers = createFmCore(makeServices(shell, '/ws', ['C:/ws/plugin']))
  const r = await handlers['fm-git-diff']({ path: 'C:/ws/plugin/src/a.js' })
  assert.equal(r.ok, true)
  assert.equal(shell.dirs[1], 'C:/ws/plugin', '嵌套仓库文件 diff 应以文件所属仓库为 cwd')
  const diffCmd = shell.calls.find((c) => c.includes('diff HEAD --'))
  assert.ok(diffCmd.includes("'src/a.js'"), '路径应相对文件所属仓库根: ' + diffCmd)
})

test('fm-git-commit：提交锚点的上下文仓库（非会话根）', async () => {
  const shell = makeFakeShell()
  shell.when(/git --version$/, () => ({ exitCode: 0, stdout: { text: 'git version 2.47.0' }, stderr: { text: '' } }))
  shell.when(/add -A/, okCmd)
  shell.when(/commit -m /, okCmd)
  const handlers = createFmCore(makeServices(shell, '/ws', ['/ws/plugin']))
  const r = await handlers['fm-git-commit']({ msg: 'feat: x', anchor: '/ws/plugin' })
  assert.equal(r.ok, true)
  assert.equal(shell.dirs[1], '/ws/plugin', 'add 应在上下文仓库根执行')
  assert.equal(shell.dirs[2], '/ws/plugin', 'commit 应在上下文仓库根执行')
})

test('fm-git-commit：锚点无仓库 → 拒绝提交', async () => {
  const shell = makeFakeShell()
  const handlers = createFmCore(makeServices(shell, '/ws', []))
  const r = await handlers['fm-git-commit']({ msg: 'm', anchor: '/plain' })
  assert.equal(r.ok, false)
  assert.ok(r.error.includes('不在任何 git 仓库'))
})

test('fm-git-init：在锚点目录初始化（非会话根）', async () => {
  const shell = makeFakeShell()
  shell.when(/git --version$/, () => ({ exitCode: 0, stdout: { text: 'git version 2.47.0' }, stderr: { text: '' } }))
  const handlers = createFmCore(makeServices(shell, '/ws'))
  const r = await handlers['fm-git-init']({ anchor: '/tmp/x' })
  assert.equal(r.ok, true)
  const initIdx = shell.calls.indexOf('git init -b main')
  assert.ok(initIdx !== -1, '应执行 git init -b main（默认分支 main）')
  assert.equal(shell.dirs[initIdx], '/tmp/x', 'git init 应在锚点目录执行')
})

test('fm-git-init：新仓库写入默认 .gitignore（node_modules/ 等），已存在则不覆盖', async () => {
  const mkShell = () => {
    const s = makeFakeShell()
    s.when(/git --version$/, () => ({ exitCode: 0, stdout: { text: 'git version 2.47.0' }, stderr: { text: '' } }))
    return s
  }
  // 新仓库（无 .gitignore）→ 写入默认忽略规则
  const fsA = makeFs(['/root'])
  const handlersA = createFmCore({ fs: fsA, shell: mkShell(), sessions: undefined, sp: { workspaceRoot: '/root' } })
  await handlersA['fm-git-init']({ anchor: '/root' })
  assert.ok(fsA.writes.some((w) => w.path === '.gitignore'), '应写入默认 .gitignore')
  assert.ok(fsA.writes.some((w) => w.text.includes('node_modules/')), '.gitignore 含 node_modules/')
  // 已存在 .gitignore → 绝不覆盖
  const fsB = makeFs(['/root'], { files: { '.gitignore': true } })
  const handlersB = createFmCore({ fs: fsB, shell: mkShell(), sessions: undefined, sp: { workspaceRoot: '/root' } })
  await handlersB['fm-git-init']({ anchor: '/root' })
  assert.equal(fsB.writes.length, 0, '已存在 .gitignore 时不写入')
})
