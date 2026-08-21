// host git 命令端口测试：fake shell 注入，验证命令串生成（双 shell 兼容）与状态解析
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createFmCore } from '../lib/fm-core/index.js'
import { quote } from '../lib/fm-core/shell.js'

// fake shell：记录全部命令，按内容分支返回可控输出
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

function makeServices(shell, workspaceRoot) {
  return {
    fs: { resolve: async () => ({}), stat: async () => null, listDir: async () => [], readText: async () => '', writeText: async () => {}, readBytes: async () => new Uint8Array(0), contains: () => true },
    shell,
    sessions: undefined,
    sp: { workspaceRoot: workspaceRoot === undefined ? '/root' : workspaceRoot },
  }
}

const okCmd = () => ({ exitCode: 0, stdout: { text: '' }, stderr: { text: '' } })

test('quote 在 Windows（当前平台）使用 PowerShell 单引号转义', () => {
  assert.equal(quote("a'b"), "'a''b'")
  assert.equal(quote('plain'), "'plain'")
})

test('gitCmd 自动补 git 前缀，已带前缀则透传', async () => {
  const shell = makeFakeShell()
  shell.when(/git --version$/, () => ({ exitCode: 0, stdout: { text: 'git version 2.47.0' }, stderr: { text: '' } }))
  const handlers = createFmCore(makeServices(shell))
  const h = handlers['fm-git-init']
  const r = await h({})
  assert.equal(r.ok, true)
  assert.equal(shell.calls[0], 'git --version')
  assert.equal(shell.calls[1], 'git init')
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
  shell.when(/rev-parse --is-inside-work-tree/, () => ({ exitCode: 0, stdout: { text: 'true\nC:/repo\n' + 'a'.repeat(40) }, stderr: { text: '' } }))
  shell.when(/diff HEAD --numstat/, () => ({
    exitCode: 0,
    stdout: { text: '3\t1\tsrc/a.js\n__FM_DIFF_END__\n?? new.txt\n!! ignored.log\n M src/a.js' },
    stderr: { text: '' },
  }))
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
})

test('fm-git-status 解析（无 HEAD）：diff + cached 双段聚合', async () => {
  const shell = makeFakeShell()
  shell.when(/git --version$/, () => ({ exitCode: 0, stdout: { text: 'git version 2.47.0' }, stderr: { text: '' } }))
  shell.when(/rev-parse --is-inside-work-tree/, () => ({ exitCode: 0, stdout: { text: 'true\nC:/repo' }, stderr: { text: '' } }))
  shell.when(/diff --cached --numstat/, () => ({
    exitCode: 0,
    stdout: { text: '1\t0\tb.js\n__FM_DIFF_END__\n2\t2\tc.js\n__FM_DIFF_END__\n' },
    stderr: { text: '' },
  }))
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
