// dsh-fm client half —— 正式插件入口（esbuild 构建为 ModuleLoader bundle）
// 模块化架构：src/client.js 仅做装配（样式注入 + 槽位注册），
// 业务状态见 src/hooks/*，UI 组件见 src/components/*，纯逻辑见 src/core/*，样式见 src/css/*
// 入口位置：侧边栏底部（sidebar.footer.action，与知识库同区同形式）；
// 与动态版的差异：host.call → fetch('/api/fm')；styles.insert → DOM 注入；
// timer → 原生 setInterval；mermaid → 官方 mermaid.js（构建时内联，唯一引用点在 components/Markdown.js）。
import React from 'react'
import { FM_CSS } from './css/index.js'
import { SidebarAction } from './components/SidebarAction.js'
import { FmModal } from './components/FmModal.js'

const el = React.createElement

export default {
  name: 'dsh-fm',
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return

    const styleEl = document.createElement('style')
    styleEl.textContent = FM_CSS
    document.head.appendChild(styleEl)
    ctx.effect(() => () => { if (styleEl.parentNode) styleEl.parentNode.removeChild(styleEl) })

    slots.inject('sidebar.footer.action', () => slots.register(
      // order 5：排在知识库（order 10）之前——底部空间不足时 KB/设置先被裁剪，文件入口保持可见
      { name: 'sidebar.footer.action', id: 'fm-action', order: 5, label: '文件' },
      (props) => el(SidebarAction, props),
    ))

    slots.inject('shell.overlay', () => slots.register(
      { name: 'shell.overlay', id: 'fm-panel', order: 10 },
      () => el(FmModal, null),
    ))
  },
}
