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
  position: absolute;
  top: 108px; right: 12px;
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
.fm-files-btn {
  border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.18));
  min-width: 96px; height: 32px;
  color: var(--dsw-alias-label-primary, #1f2329);
  font-family: var(--dsw-font-family, system-ui, -apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif);
  cursor: pointer; background: transparent;
  border-radius: 18px;
  justify-content: center; align-items: center; gap: 6px;
  padding: 6px 12px; font-size: 13px; font-weight: 400; line-height: 20px;
  display: inline-flex;
  transition: background-color .1s ease;
}
.fm-files-btn:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,.06)); }
.fm-files-btn-on { background: var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,.08)); }
.fm-files-btn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #4c8dff); outline-offset: 2px; }
.fm-files-btn span { white-space: nowrap; }
`
