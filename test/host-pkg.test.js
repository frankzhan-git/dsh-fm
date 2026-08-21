// host 纯函数测试：包管理器表与 MinGit 架构模式（import 自 fm-core.js）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { POSIX_PKG_MANAGERS, mingitArchPattern } from '../lib/fm-core.js'

test('POSIX_PKG_MANAGERS 覆盖主流发行版且结构完整', () => {
  const ids = POSIX_PKG_MANAGERS.map((p) => p.id)
  assert.ok(ids.includes('apt'))
  assert.ok(ids.includes('dnf'))
  assert.ok(ids.includes('yum'))
  assert.ok(ids.includes('apk'))
  assert.ok(ids.includes('pacman'))
  assert.ok(ids.includes('zypper'))
  for (const p of POSIX_PKG_MANAGERS) {
    assert.equal(typeof p.bin, 'string')
    assert.equal(typeof p.install, 'function')
    assert.equal(typeof p.manual, 'string')
    assert.ok(p.install('').length > 0)
    assert.ok(p.install('sudo -n ').startsWith('sudo -n '))
  }
})

test('mingitArchPattern 按架构返回资产名模式', () => {
  assert.equal(mingitArchPattern('arm64'), 'MinGit-.*-arm64\\.zip')
  assert.equal(mingitArchPattern('x64'), 'MinGit-.*-64-bit\\.zip')
  assert.equal(mingitArchPattern('ia32'), 'MinGit-.*-32-bit\\.zip')
})
