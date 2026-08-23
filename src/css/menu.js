// 菜单 / 浮窗（右键菜单、提交与二次确认浮窗、会话标题栏入口按钮）
export const MENU_CSS = `
.fm-menu-backdrop { position: fixed; inset: 0; z-index: 2147483001; pointer-events: auto; }
.fm-menu {
  position: fixed; z-index: 2147483002; pointer-events: auto;
  min-width: 150px;
  background: var(--fm-bg-raised);
  color: var(--fm-text);
  border: 1px solid var(--fm-border-strong);
  border-radius: 8px;
  box-shadow: var(--fm-shadow);
  padding: 4px;
  font-size: 12px;
}
.fm-pop2 {
  /* 二次确认/提交浮窗：相对屏幕居中（fixed 叠加层），不再锚定插件弹窗内（旧 absolute 会被面板边缘截断） */
  position: fixed;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  max-width: min(420px, calc(100vw - 48px));
  box-sizing: border-box;
}
.fm-pop2 .fm-menu-title {
  /* 长文案（如批量确认说明）允许换行，防止弹窗横向溢出 */
  white-space: normal;
  width: 100%;
}
/* ---------- 索引二次确认决策卡（.fm-ask）：
   单一选项确认 + 方向色 impact 条（签名元素） ---------- */
.fm-ask {
  position: fixed; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  z-index: 2147483002; pointer-events: auto;
  width: min(380px, calc(100vw - 48px));
  box-sizing: border-box;
  background: var(--fm-bg-raised);
  color: var(--fm-text);
  border: 1px solid var(--fm-border-strong);
  border-radius: 10px;
  box-shadow: var(--fm-shadow);
  padding: 14px 14px 12px;
  font-size: 12px;
  animation: fm-ask-in .12s ease-out;
}
@keyframes fm-ask-in { from { opacity: 0; transform: translate(-50%, -48%); } to { opacity: 1; transform: translate(-50%, -50%); } }
.fm-ask-title {
  display: flex; align-items: baseline;
  font-size: 14px; font-weight: 600; color: var(--fm-text);
  line-height: 1.4;
}
/* 文件夹名：等宽装置语言（与 +/- 统计同族），过长截断 */
.fm-ask-name {
  font-family: Consolas, 'Cascadia Code', Menlo, monospace;
  overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; max-width: 250px;
}
.fm-ask-desc { margin-top: 4px; color: var(--fm-text-2); line-height: 1.55; }
/* 签名元素：方向色 impact 条（台账行） */
.fm-ask-impact {
  display: flex; align-items: center; gap: 6px;
  margin-top: 10px; padding: 6px 10px;
  border: 1px solid var(--fm-border); border-radius: 6px;
  font-family: Consolas, 'Cascadia Code', Menlo, monospace;
  font-size: 11px; font-variant-numeric: tabular-nums;
}
.fm-ask-impact-include {
  color: var(--fm-git-add);
  background: color-mix(in srgb, var(--fm-git-add) 8%, transparent);
  border-color: color-mix(in srgb, var(--fm-git-add) 30%, transparent);
}
.fm-ask-impact-exclude {
  color: var(--fm-danger);
  background: color-mix(in srgb, var(--fm-danger) 8%, transparent);
  border-color: color-mix(in srgb, var(--fm-danger) 30%, transparent);
}
.fm-ask-impact-sep { opacity: .55; }
/* 底部动作 */
.fm-ask-actions { display: flex; justify-content: flex-end; gap: 6px; margin-top: 12px; }
.fm-ask-primary {
  color: var(--fm-accent);
  border-color: color-mix(in srgb, var(--fm-accent) 45%, transparent);
  font-weight: 500;
}
.fm-ask-primary:hover { background: color-mix(in srgb, var(--fm-accent) 12%, transparent); color: var(--fm-accent); }
@media (prefers-reduced-motion: reduce) {
  .fm-ask { animation: none; }
}
.fm-menu-item { display: flex; align-items: center; gap: 8px; padding: 4px 8px; border-radius: 6px; cursor: pointer; color: var(--fm-text); white-space: nowrap; transition: background-color .1s ease; }
.fm-menu-item:hover { background: var(--fm-hover); }
.fm-menu-item:focus-visible { outline: 2px solid var(--fm-accent); outline-offset: -2px; }
/* 禁用态：保留显示，降低不透明度并取消交互 */
.fm-menu-item.fm-menu-disabled { opacity: .45; cursor: default; }
.fm-menu-item.fm-menu-disabled:hover { background: transparent; }
.fm-menu-danger { color: var(--fm-danger); }
.fm-menu-danger:hover { background: color-mix(in srgb, var(--fm-danger) 14%, transparent); }
.fm-menu-sep { height: 1px; background: var(--fm-border); margin: 4px 8px; }
.fm-menu-title { padding: 4px 8px 8px; color: var(--fm-text-2); white-space: nowrap; word-break: break-all; }
.fm-menu-actions { display: flex; gap: 4px; padding: 4px; }
.fm-commit-input {
  display: block; width: 280px; box-sizing: border-box;
  margin: 4px; padding: 6px 8px;
  background: var(--fm-bg-sunken); color: var(--fm-text);
  border: 1px solid var(--fm-border); border-radius: 6px;
  font-size: 12px;
}
.fm-commit-input:focus { outline: 2px solid var(--fm-accent); outline-offset: -1px; }
/* 侧边栏底部入口（与知识库同位置同形式，略紧凑以适配多入口并排）：
   wide = 图标+文字行，rail = 圆形图标 */
.fm-sidebar-btn {
  box-sizing: border-box; cursor: pointer;
  width: calc(100% + 8px); height: 32px;
  color: var(--dsw-alias-label-primary, #1f2329);
  background: transparent; border: none; border-radius: 12px;
  flex: none; align-items: center; gap: 8px;
  margin: 2px -4px; padding: 4px 2px 4px 10px;
  font-family: inherit; font-size: 14px; line-height: 22px;
  display: flex; overflow: hidden;
  transition: background-color .1s ease;
}
.fm-sidebar-btn:hover { background: var(--dsw-alias-interactive-bg-hover); }
.fm-sidebar-btn-on { background: var(--dsw-alias-interactive-bg-hover); }
.fm-sidebar-btn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #4c8dff); outline-offset: -2px; }
.fm-sidebar-btn-rail {
  border-radius: 50%; justify-content: center; gap: 0;
  width: 36px; height: 36px; margin: 8px 0 10px; padding: 0;
}
.fm-sidebar-label { white-space: nowrap; overflow: hidden; }
/* 与知识库横向均分同一行 —— 遵循容器原生布局（hHd-Xa_footerActions 为 display:flex 横向行，
   各按钮原本 flex:none + 100% 宽，多按钮时必然横向溢出被裁出侧边栏）：
   · 容器仅追加 flex-wrap，让 100% 宽条目独占一行、半宽条目换行均分；
   · cordis 等其余条目 flex-basis 100% 独占一行（外观不变）；
   · 文件/知识库 flex: 1 1 0% 各占半行，边缘齐平无内缩；
   · rail（收起）模式按钮带 fm-sidebar-btn-rail，仅套用换行，圆形按钮纵向堆叠保持官方样式 */
div:has(> .fm-sidebar-btn) {
  flex-wrap: wrap;
  column-gap: 4px;
}
div:has(> .fm-sidebar-btn:not(.fm-sidebar-btn-rail)) > :not(.fm-sidebar-btn):not(.kb-sidebar-btn) {
  flex: 0 0 100%;
}
div:has(> .fm-sidebar-btn:not(.fm-sidebar-btn-rail)) > .fm-sidebar-btn,
div:has(> .fm-sidebar-btn:not(.fm-sidebar-btn-rail)) > .kb-sidebar-btn {
  flex: 1 1 0%;
  width: auto;
  min-width: 0;
  margin: 4px 0;
}
`
