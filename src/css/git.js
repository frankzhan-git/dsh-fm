// git 胶囊扩展样式（架构根治新增）：错误油丸与重试按钮（tree.js 中的胶囊/工具条样式保持不变）
export const GIT_CSS = `
/* T5 失败态：与 loading 占位同形（胶囊高度/圆角一致），但语义为终态 —— 可重试、可读错误 */
.fm-git-error {
  display: inline-flex; align-items: center; gap: 6px;
  border: 1px solid color-mix(in srgb, var(--fm-git-del) 55%, var(--fm-border-strong));
  border-radius: 999px;
  padding: 3px 6px 3px 12px;
  font-size: 12px; line-height: 1.4;
  color: var(--fm-git-del);
  white-space: nowrap; max-width: 100%;
}
.fm-git-error-msg {
  overflow: hidden; text-overflow: ellipsis;
}
.fm-git-retry {
  flex: none;
  display: inline-flex; align-items: center; justify-content: center;
  border: none; border-left: 1px solid color-mix(in srgb, var(--fm-git-del) 35%, var(--fm-border-strong));
  border-radius: 999px 0 0 999px;
  background: transparent; color: var(--fm-git-del);
  padding: 1px 10px; font-size: 11px; line-height: 1.4;
  cursor: pointer; white-space: nowrap;
  transition: background-color .1s ease, color .1s ease;
}
.fm-git-retry:hover { background: color-mix(in srgb, var(--fm-git-del) 10%, transparent); color: var(--fm-text); }
.fm-git-retry:focus-visible { outline: 2px solid var(--fm-accent); outline-offset: -2px; }
`
