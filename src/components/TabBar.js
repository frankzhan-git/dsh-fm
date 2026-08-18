// 预览选项卡栏：横向滚动 + 两侧渐隐蒙层 + 激活项滚动入视；
// 选项卡右键菜单：关闭当前 / 右侧 / 左侧 / 其他 / 全部（无可关闭对象时禁用但保留显示）
import React from 'react'
import {
  IconChevronLeftOutline14,
  IconChevronRightOutline14,
  IconCloseFill14,
  IconEllipsisOutline16,
  IconTrashOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { ContextMenu, MenuItem } from './ContextMenu.js'

const el = React.createElement

export function TabBar(props) {
  const { previews, activeKey, onSelect, onCloseTab, onCloseRange, onCloseOthers, onCloseAllTabs } = props
  const [tabLeftFade, setTabLeftFade] = React.useState(false)
  const [tabRightFade, setTabRightFade] = React.useState(false)
  const [tabMenu, setTabMenu] = React.useState(null) // { x, y, key }

  let tabsEl = null
  // 注意：所有 hooks 必须在提前 return 之前声明，否则选项卡数量 0↔非 0 切换时
  // hook 数量不一致，React 会报错导致面板打不开
  React.useEffect(() => {
    if (previews.length === 0) return
    const el0 = tabsEl
    if (!el0) return
    const updateFades = () => {
      setTabLeftFade(el0.scrollLeft > 2)
      setTabRightFade(el0.scrollLeft < el0.scrollWidth - el0.clientWidth - 2)
    }
    const onWheel = (ev) => {
      if (el0.scrollWidth > el0.clientWidth) {
        ev.preventDefault()
        el0.scrollLeft += ev.deltaY
      }
    }
    el0.addEventListener('wheel', onWheel, { passive: false })
    el0.addEventListener('scroll', updateFades, { passive: true })
    const on = el0.querySelector('.fm-tab-on')
    if (on) {
      const r = on.getBoundingClientRect()
      const c = el0.getBoundingClientRect()
      if (r.left < c.left) el0.scrollLeft += r.left - c.left - 8
      else if (r.right > c.right) el0.scrollLeft += r.right - c.right + 8
    }
    updateFades()
    return () => {
      el0.removeEventListener('wheel', onWheel)
      el0.removeEventListener('scroll', updateFades)
    }
  }, [previews.length, activeKey])

  const menuTab = tabMenu ? previews.find((p) => p.key === tabMenu.key) : null
  const menuIdx = menuTab ? previews.findIndex((p) => p.key === menuTab.key) : -1
  const canCloseRight = menuIdx >= 0 && menuIdx < previews.length - 1
  const canCloseLeft = menuIdx > 0
  const canCloseOthers = previews.length > 1

  const actCloseCurrent = () => { if (menuTab) onCloseTab(menuTab.key); setTabMenu(null) }
  const actCloseRight = () => { if (canCloseRight) onCloseRange(menuIdx + 1, previews.length - 1); setTabMenu(null) }
  const actCloseLeft = () => { if (canCloseLeft) onCloseRange(0, menuIdx - 1); setTabMenu(null) }
  const actCloseOthers = () => { if (menuTab && canCloseOthers) onCloseOthers(menuTab.key); setTabMenu(null) }
  const actCloseAll = () => { onCloseAllTabs(); setTabMenu(null) }

  return el('div', { className: 'fm-tabbar' },
    el('div', { className: 'fm-tabs-wrap' },
      el('div', { className: 'fm-tabs', ref: (n) => { tabsEl = n } },
        previews.map((tab) => el('div', {
          className: 'fm-tab' + (tab.key === activeKey ? ' fm-tab-on' : ''),
          key: tab.key,
          title: tab.path,
          tabIndex: 0,
          onClick: () => onSelect(tab.key),
          onKeyDown: (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(tab.key) }
          },
          onContextMenu: (e) => {
            e.preventDefault()
            e.stopPropagation()
            setTabMenu({ x: e.clientX, y: e.clientY, key: tab.key })
          },
        },
          el('span', { className: 'fm-tab-name' }, tab.name),
          el('button', {
            className: 'fm-tab-close',
            title: '关闭',
            onClick: (e) => { e.stopPropagation(); onCloseTab(tab.key) },
          }, el(IconCloseFill14, { size: 11 })),
        )),
      ),
      tabLeftFade ? el('div', { className: 'fm-tab-fade fm-tab-fade-left' }) : null,
      tabRightFade ? el('div', { className: 'fm-tab-fade fm-tab-fade-right' }) : null,
    ),
    menuTab ? el(ContextMenu, { x: tabMenu.x, y: tabMenu.y, onClose: () => setTabMenu(null) },
      el(MenuItem, { icon: IconCloseFill14, onClick: actCloseCurrent }, '关闭当前标签'),
      el(MenuItem, { icon: IconChevronRightOutline14, disabled: !canCloseRight, onClick: actCloseRight }, '关闭右侧标签'),
      el(MenuItem, { icon: IconChevronLeftOutline14, disabled: !canCloseLeft, onClick: actCloseLeft }, '关闭左侧标签'),
      el(MenuItem, { icon: IconEllipsisOutline16, disabled: !canCloseOthers, onClick: actCloseOthers }, '关闭其他标签'),
      el('div', { className: 'fm-menu-sep' }),
      el(MenuItem, { icon: IconTrashOutline16, danger: true, onClick: actCloseAll }, '关闭全部标签'),
    ) : null,
  )
}
