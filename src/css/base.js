// 弹窗壳与通用控件样式（主题变量在 .fm-modal-overlay 定义，全插件共享）
export const BASE_CSS = `
.fm-modal-overlay {
  /* 主题变量定义在弹窗容器级：右键菜单/确认浮窗渲染在其内部，也需解析这些变量 */
  --fm-bg: var(--dsw-alias-bg-layer-2, #232833);
  --fm-bg-raised: var(--dsw-alias-bg-layer-1, #2a2f3a);
  --fm-bg-nested: var(--dsw-alias-bg-layer-3, #2f3542);
  --fm-bg-sunken: var(--dsw-alias-bg-layer-1, #1c2028);
  --fm-border: var(--dsw-alias-border-l1, rgba(148,163,184,.22));
  --fm-border-strong: var(--dsw-alias-border-l2, rgba(148,163,184,.4));
  --fm-text: var(--dsw-alias-label-primary, #e2e8f0);
  --fm-text-2: var(--dsw-alias-label-secondary, #8b95a7);
  --fm-accent: var(--dsw-alias-brand-primary, #6ea8ff);
  --fm-danger: var(--dsw-alias-state-error-primary, #f87171);
  --fm-warn: var(--dsw-alias-state-warn-primary, #fbbf24);
  --fm-hover: var(--dsw-alias-interactive-bg-hover, rgba(148,163,184,.12));
  --fm-shadow: 0 8px 24px rgba(0,0,0,.18);
  --fm-bar-h: 40px;
  --fm-git-add: var(--dsw-alias-state-success-primary, #3fb950);
  --fm-git-del: var(--dsw-alias-state-error-primary, #f85149);

  position: fixed; inset: 0;
  display: flex; align-items: center; justify-content: center;
  pointer-events: auto;
  z-index: 2147483000;
  font-family: var(--dsw-font-family, system-ui, -apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif);
}
.fm-modal-mask {
  position: absolute; inset: 0;
  background: var(--dsw-alias-bg-mask-1, rgba(0,0,0,.45));
  backdrop-filter: var(--dsw-mask-blur, blur(3px));
}
.fm-modal-panel {
  position: relative; z-index: 1;
  display: flex;
  width: min(1080px, calc(100vw - 48px));
  height: min(720px, calc(100vh - 48px));
  background: var(--fm-bg);
  border-radius: 24px;
  box-shadow: var(--dsw-shadow-lv3, 0 16px 48px rgba(0,0,0,.35));
  color: var(--fm-text);
  font-size: 13px; line-height: 1.5;
  overflow: hidden;
  animation: fm-in .14s ease;
}
@keyframes fm-in { from { opacity: 0; transform: translateY(4px) scale(.995); } to { opacity: 1; transform: none; } }
.fm-col-tree {
  flex: none; width: 320px; min-width: 0;
  display: flex; flex-direction: column; min-height: 0;
  border-right: 1px solid var(--fm-border);
  position: relative; /* 提交确认浮窗锚点 */
}
.fm-tree-title {
  flex: none;
  display: flex; align-items: center; gap: 8px;
  padding: 22px 16px 10px;
  font-size: 16px; font-weight: 500; line-height: 24px;
  color: var(--fm-text);
}
/* 「工作目录」为紧凑按钮：hover 只作用于按钮本身，不铺满整行 */
.fm-tree-title-btn {
  display: inline-flex; align-items: center;
  padding: 4px 10px;
  background: transparent; border: none; border-radius: 6px;
  font: inherit; color: inherit; cursor: pointer;
  transition: background-color .1s ease;
}
.fm-tree-title-btn:hover { background: var(--fm-hover); }
.fm-tree-title-btn:focus-visible { outline: 2px solid var(--fm-accent); outline-offset: -2px; }
.fm-col-preview {
  flex: 1 1 0%; min-width: 0; min-height: 0;
  display: flex; flex-direction: column;
}
.fm-preview-head {
  flex: none;
  display: flex; align-items: center; justify-content: flex-end; gap: 8px;
  height: 54px; padding: 20px 14px 8px 10px; box-sizing: border-box;
}
.fm-modal-close {
  cursor: pointer; width: 28px; height: 28px;
  color: var(--fm-text);
  background: transparent; border: none; border-radius: 28px;
  display: inline-flex; align-items: center; justify-content: center; padding: 0;
  transition: background-color .1s ease, color .1s ease;
}
.fm-modal-close:hover { background: var(--fm-hover); }
.fm-modal-close:focus-visible { outline: 2px solid var(--fm-accent); outline-offset: -2px; }
.fm-empty-preview {
  flex: 1 1 0%; min-height: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
  padding: 24px;
  text-align: center;
}
.fm-empty-preview-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 56px; height: 56px;
  border-radius: 16px;
  background: var(--fm-bg-raised);
  color: var(--fm-text-2);
}
.fm-empty-preview-title { font-size: 14px; font-weight: 500; color: var(--fm-text); }
.fm-empty-preview-sub { font-size: 12px; color: var(--fm-text-2); }
@media (max-width: 760px) {
  .fm-col-tree { width: 260px; }
}
.fm-spacer { flex: 1; }
.fm-btn {
  display: inline-flex; align-items: center; gap: 4px;
  background: transparent; border: 1px solid transparent; border-radius: 6px;
  color: var(--fm-text-2); padding: 4px 8px;
  font-size: 12px; cursor: pointer; white-space: nowrap;
  transition: background-color .1s ease, color .1s ease;
}
.fm-btn:hover { background: var(--fm-hover); color: var(--fm-text); }
.fm-btn:disabled { opacity: .5; cursor: default; }
.fm-btn:focus-visible { outline: 2px solid var(--fm-accent); outline-offset: -2px; }
.fm-btn-danger { color: var(--fm-danger); border-color: color-mix(in srgb, var(--fm-danger) 40%, transparent); }
.fm-btn-danger:hover { background: color-mix(in srgb, var(--fm-danger) 14%, transparent); color: var(--fm-danger); }
.fm-error {
  flex: none;
  padding: 6px 12px; font-size: 12px;
  background: color-mix(in srgb, var(--fm-danger) 12%, transparent);
  color: var(--fm-danger);
  border-bottom: 1px solid var(--fm-border);
}
.fm-warn {
  flex: none;
  padding: 6px 12px; font-size: 12px;
  background: color-mix(in srgb, var(--fm-warn) 12%, transparent);
  color: var(--fm-warn);
}
@media (prefers-reduced-motion: reduce) {
  .fm-modal-panel { animation: none; }
  .fm-chev, .fm-btn, .fm-row, .fm-tab, .fm-tab-close, .fm-modal-close, .fm-menu-item, .fm-git-btn, .fm-diff-btn, .fm-md-btn, .fm-sidebar-btn { transition: none; }
}
`
