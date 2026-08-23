// dsh-fm client half —— 正式插件入口（esbuild 构建为 ModuleLoader bundle）
// 模块化架构：src/client.js 仅做装配（样式注入 + 槽位注册 + 文案字典注册），
// 业务状态见 src/hooks/*，UI 组件见 src/components/*，纯逻辑见 src/core/*，样式见 src/css/*
// 官方接口：slots.inject/register（标准座席 useSessions/useStore/t/sessionId）；
//           dsh-client-locale register(ns,{zh,en})（条目声明 locale: 'fm' 获得 t 座席）。
// 入口位置：会话输入框工具行左端（conversation.input.left）+ 输入框浮层（shell.overlay）。
import React from 'react'
import { FM_CSS } from './css/index.js'
import { FM_LOCALE_NS, FM_DICTS } from './locale/index.js'
import { SidebarAction } from './components/SidebarAction.js'
import { FmModal } from './components/FmModal.js'

const el = React.createElement

export default {
  name: 'dsh-fm',
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return

    // 官方文案字典（ns: fm）；locale 服务缺失时静默降级（组件保留硬编码回退文案）
    const locale = ctx.get('locale')
    if (locale !== undefined && typeof locale.register === 'function') {
      const dispose = locale.register(FM_LOCALE_NS, FM_DICTS)
      ctx.effect(() => dispose)
    }

    const styleEl = document.createElement('style')
    styleEl.textContent = FM_CSS
    document.head.appendChild(styleEl)
    ctx.effect(() => () => { if (styleEl.parentNode) styleEl.parentNode.removeChild(styleEl) })

    // 输入框工具行左端（order 10：位于画布插件（5）之后、其它条目之前）
    slots.inject('conversation.input.left', () => slots.register(
      { name: 'conversation.input.left', id: 'fm-button', order: 10, label: '文件', locale: FM_LOCALE_NS },
      (props) => el(SidebarAction, props),
    ))

    // 全屏居中弹窗仍挂 shell.overlay（与 DSH 设置面板同级，不随输入框区域卸载）
    slots.inject('shell.overlay', () => slots.register(
      { name: 'shell.overlay', id: 'fm-panel', order: 10, locale: FM_LOCALE_NS },
      (props) => el(FmModal, props),
    ))
  },
}
