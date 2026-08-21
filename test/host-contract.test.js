// 契约完整性测试：fm-contract.js 方法名唯一、ARGS 覆盖全部方法、命名规范
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FM_METHODS, FM_ARGS, FM_ROUTE } from '../src/shared/fm-contract.js'

test('FM_METHODS 值唯一且符合 fm- 前缀', () => {
  const values = Object.values(FM_METHODS)
  assert.equal(new Set(values).size, values.length, '方法名不得重复')
  for (const v of values) assert.ok(/^fm-[a-z-]+$/.test(v), '方法名格式: ' + v)
})

test('FM_ARGS 覆盖 FM_METHODS 全部方法', () => {
  for (const k of Object.keys(FM_METHODS)) {
    assert.ok(Array.isArray(FM_ARGS[FM_METHODS[k]]), '缺少参数声明: ' + FM_METHODS[k])
  }
})

test('FM_ARGS 参数键均含 root 或 sessionId（可解析工作目录）', () => {
  for (const k of Object.keys(FM_METHODS)) {
    const args = FM_ARGS[FM_METHODS[k]]
    assert.ok(args.includes('root') || args.includes('sessionId'), FM_METHODS[k] + ' 无法解析工作目录')
  }
})

test('FM_ROUTE 为 /api/fm', () => {
  assert.equal(FM_ROUTE, '/api/fm')
})
