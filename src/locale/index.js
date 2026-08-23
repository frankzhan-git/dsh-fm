// dsh-fm 文案字典注册（官方 @deepseek-ai/dsh-client-locale 的 register(ns, {zh, en})）。
// client.js 在 apply 时经 ctx.get('locale') 注册（服务缺失时静默降级为硬编码文案）。
import { zh } from './zh.js'
import { en } from './en.js'

export const FM_LOCALE_NS = 'fm'
export const FM_DICTS = { zh, en }
