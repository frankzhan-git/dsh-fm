// 左侧文件树列：工具栏 / git / 路径 / 列表（含上下渐变蒙层）与行样式
export const TREE_CSS = `
.fm-toolbar { flex: none; display: flex; align-items: center; gap: 4px; padding: 8px 12px; }
.fm-git {
  flex: none;
  display: inline-flex; align-items: stretch;
  border: 1px solid var(--fm-border);
  border-radius: 6px;
  overflow: hidden;
}
.fm-git-stat {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 0 8px;
  font-size: 11px;
  font-family: Consolas, 'Cascadia Code', Menlo, monospace;
  font-variant-numeric: tabular-nums;
  color: var(--fm-text-2);
}
.fm-git-add { color: var(--fm-git-add); }
.fm-git-del { color: var(--fm-git-del); }
.fm-git-btn {
  display: inline-flex; align-items: center; justify-content: center;
  background: transparent; border: none; border-left: 1px solid var(--fm-border);
  color: var(--fm-text-2); padding: 0 8px; cursor: pointer;
  transition: background-color .1s ease, color .1s ease;
}
.fm-git-btn:hover { background: var(--fm-hover); color: var(--fm-text); }
.fm-git-btn-on {
  background: color-mix(in srgb, var(--fm-accent) 16%, transparent);
  color: var(--fm-accent);
}
.fm-git-btn-on:hover { background: color-mix(in srgb, var(--fm-accent) 22%, transparent); color: var(--fm-accent); }
.fm-git-btn:focus-visible { outline: 2px solid var(--fm-accent); outline-offset: -2px; }
/* 未建立仓库时的胶囊按钮（初始化仓库 / 安装并初始化仓库） */
.fm-capsule {
  display: inline-flex; align-items: center; gap: 6px;
  border: 1px solid var(--fm-border-strong); border-radius: 999px;
  background: transparent; color: var(--fm-text-2);
  padding: 3px 12px; font-size: 12px; line-height: 1.4;
  cursor: pointer; white-space: nowrap;
  transition: background-color .1s ease, color .1s ease;
}
.fm-capsule:hover { background: var(--fm-hover); color: var(--fm-text); }
.fm-capsule:disabled { opacity: .55; cursor: default; }
.fm-capsule:focus-visible { outline: 2px solid var(--fm-accent); outline-offset: -2px; }
/* git 状态未初始化（进入目录/初始加载）的 loading 占位：与胶囊同形同高，防布局跳动 */
.fm-git-loading {
  display: inline-flex; align-items: center; gap: 7px;
  border: 1px solid var(--fm-border-strong); border-radius: 999px;
  padding: 3px 12px; font-size: 12px; line-height: 1.4;
  color: var(--fm-text-2); white-space: nowrap;
}
.fm-git-loading-spin {
  flex: none; width: 11px; height: 11px; border-radius: 50%;
  border: 2px solid var(--fm-border-strong);
  border-top-color: var(--fm-accent);
  animation: fm-spin .8s linear infinite;
}
@keyframes fm-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .fm-git-loading-spin { animation: none; border-top-color: var(--fm-text-2); }
}
/* 索引管理复选框 */
.fm-index-cb {
  flex: none; width: 14px; height: 14px; margin: 0; padding: 0;
  cursor: pointer; accent-color: var(--fm-accent);
}
.fm-index-cb:disabled { cursor: default; opacity: .45; }
.fm-hint { flex: none; padding: 0 12px 4px; font-size: 11px; color: var(--fm-text-2); }
.fm-path { flex: none; padding: 2px 12px 8px; font-size: 12px; color: var(--fm-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; user-select: text; }
.fm-list-wrap {
  position: relative;
  flex: 1 1 0%; min-height: 0;
  display: flex; flex-direction: column;
}
.fm-list {
  flex: 1 1 0%; min-height: 0;
  overflow-y: auto; padding: 4px 8px 12px;
  scrollbar-width: thin;
  scrollbar-color: var(--fm-border-strong) transparent;
}
.fm-list::-webkit-scrollbar { width: 10px; }
.fm-list::-webkit-scrollbar-thumb {
  background: var(--fm-border-strong); border-radius: 5px;
  border: 2px solid transparent; background-clip: content-box;
}
.fm-list::-webkit-scrollbar-thumb:hover { background: var(--fm-text-2); border: 2px solid transparent; background-clip: content-box; }
.fm-list::-webkit-scrollbar-track { background: transparent; }
.fm-list-wrap::before,
.fm-list-wrap::after {
  content: '';
  position: absolute;
  left: 0; right: 0;
  height: 28px;
  pointer-events: none;
  z-index: 2;
  opacity: 0;
  transition: opacity .15s ease;
}
.fm-list-wrap::before { top: 0; background: linear-gradient(to bottom, var(--fm-bg) 0%, color-mix(in srgb, var(--fm-bg) 70%, transparent) 55%, transparent 100%); }
.fm-list-wrap::after { bottom: 0; background: linear-gradient(to top, var(--fm-bg) 0%, color-mix(in srgb, var(--fm-bg) 70%, transparent) 55%, transparent 100%); }
.fm-list-mask-top::before { opacity: 1; }
.fm-list-mask-bot::after { opacity: 1; }
.fm-row {
  display: flex; align-items: center; gap: 8px; padding: 4px 8px; border-radius: 6px;
  cursor: pointer; user-select: none; -webkit-user-select: none;
  transition: background-color .1s ease;
}
.fm-row:hover { background: var(--fm-hover); }
.fm-row:focus-visible { outline: 2px solid var(--fm-accent); outline-offset: -2px; }
.fm-icon { flex: none; display: inline-flex; align-items: center; gap: 2px; }
.fm-chev { display: inline-flex; transition: transform .12s ease; }
.fm-chev-open { transform: rotate(90deg); }
.fm-chev-gap { flex: none; width: 12px; }
.fm-ficon {
  flex: none;
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 14px; padding: 0 2px;
  border-radius: 4px;
  font-family: Consolas, 'Cascadia Code', Menlo, monospace;
  font-size: 8px; font-weight: 700; line-height: 1;
  letter-spacing: -0.3px;
}
.fm-ficon-other { background: var(--fm-bg-nested); color: var(--fm-text-2); }
.fm-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* 独立 git 仓库标签（规则四：目录自带 .git，无论亮暗/是否索引一律显示） */
.fm-git-tag {
  flex: none;
  display: inline-flex; align-items: center;
  margin-left: 4px; padding: 1px 4px;
  border: 1px solid var(--fm-border-strong);
  border-radius: 4px;
  color: var(--fm-text-2);
  line-height: 1.2;
}
.fm-untracked .fm-git-tag { opacity: .8; }
.fm-untracked { opacity: .7; }
.fm-untracked:hover, .fm-untracked:focus-visible { opacity: 1; }
.fm-untracked .fm-name { color: var(--fm-text-2); }
.fm-git-diff {
  flex: none;
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px;
  font-family: Consolas, 'Cascadia Code', Menlo, monospace;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.fm-git-count { color: var(--fm-text-2); }
.fm-size { flex: none; font-size: 11px; color: var(--fm-text-2); font-variant-numeric: tabular-nums; }
.fm-empty { padding: 24px 8px; text-align: center; color: var(--fm-text-2); }
.fm-busy { flex: none; padding: 2px 12px; color: var(--fm-text-2); font-size: 12px; }
.fm-loading { flex: 1 1 0%; min-height: 0; padding: 24px 12px; text-align: center; color: var(--fm-text-2); }
`
