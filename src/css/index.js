// 样式聚合：按区域拆分，构建时拼接为单个 <style> 注入
import { BASE_CSS } from './base.js'
import { TREE_CSS } from './tree.js'
import { PREVIEW_CSS } from './preview.js'
import { MENU_CSS } from './menu.js'

export const FM_CSS = [BASE_CSS, TREE_CSS, PREVIEW_CSS, MENU_CSS].join('\n')
