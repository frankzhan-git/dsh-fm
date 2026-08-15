// dsh-fm client half —— 正式插件源码（esbuild 构建为 ModuleLoader bundle）
// 与动态版的差异：host.call → fetch('/api/fm')；styles.insert → DOM 注入；
// timer → 原生 setInterval；mermaid → 官方 mermaid.js（构建时内联）。
import React from 'react'
import mermaid from 'mermaid'

const FM_CSS = `
.fm-container {
  /* 主题变量定义在容器级：右键菜单/确认浮窗渲染在面板外，也需解析这些变量 */
  --fm-bg: var(--dsw-alias-bg-base, #1e222a);
  --fm-bg-raised: var(--dsw-alias-bg-layer-1, #232833);
  --fm-bg-nested: var(--dsw-alias-bg-layer-2, #2a2f3a);
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

  position: fixed; top: 64px; right: 16px;
  display: flex; flex-direction: row-reverse; gap: 12px;
  align-items: flex-start;
  pointer-events: none;
  z-index: 2147483000;
}
.fm-container .fm-panel {
  position: relative; top: auto; right: auto;
  pointer-events: auto;
}
.fm-panel {
  width: min(440px, calc(100vw - 32px));
  max-height: calc(100vh - 80px);
  display: flex; flex-direction: column;
  background: var(--fm-bg);
  border: 1px solid var(--fm-border);
  border-radius: 10px;
  box-shadow: var(--fm-shadow);
  color: var(--fm-text);
  font-size: 13px; line-height: 1.5;
  overflow: hidden;
  font-family: var(--dsw-font-family, system-ui, -apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif);
  animation: fm-in .14s ease;
}
@keyframes fm-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
.fm-preview { width: min(880px, calc(100vw - 32px)); min-height: 200px; }
.fm-head {
  flex: none;
  display: flex; align-items: center; gap: 8px;
  height: var(--fm-bar-h); padding: 0 12px; box-sizing: border-box;
  border-bottom: 1px solid var(--fm-border);
}
.fm-title { font-weight: 600; }
.fm-title-click { cursor: pointer; border-radius: 6px; padding: 0 4px; }
.fm-title-click:hover { color: var(--fm-accent); background: var(--fm-hover); }
.fm-eye-btn {
  flex: none; width: 28px; height: 28px; padding: 0;
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--fm-text);
  border-radius: 6px;
  transition: background-color .1s ease, color .1s ease;
}
.fm-eye-btn:hover { background: var(--fm-hover); color: var(--fm-accent); }
.fm-eye-btn-hidden { color: var(--fm-text-2); }
.fm-eye-btn-hidden:hover { background: var(--fm-hover); color: var(--fm-text-2); }
.fm-eye-btn-on {
  background: color-mix(in srgb, var(--fm-accent) 16%, transparent);
  color: var(--fm-accent);
}
.fm-eye-btn-on:hover { background: color-mix(in srgb, var(--fm-accent) 22%, transparent); color: var(--fm-accent); }
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
.fm-hint { flex: none; padding: 0 12px 4px; font-size: 11px; color: var(--fm-text-2); }
.fm-path { flex: none; padding: 2px 12px 8px; font-size: 12px; color: var(--fm-text-2); word-break: break-all; user-select: text; }
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
.fm-tabbar {
  flex: none;
  display: flex; align-items: center; gap: 4px;
  height: var(--fm-bar-h); padding: 0 12px; box-sizing: border-box;
  border-bottom: 1px solid var(--fm-border);
}
.fm-tabs-wrap {
  position: relative;
  flex: 1 1 0%; min-width: 0;
  overflow: hidden;
  height: 100%;
  display: flex; align-items: flex-end;
}
.fm-tabs {
  display: flex; align-items: flex-end;
  overflow-x: auto;
  gap: 4px;
  height: 100%;
  scrollbar-width: none;
}
.fm-tabs::-webkit-scrollbar { display: none; }
.fm-tab-fade {
  position: absolute; top: 0; bottom: 0; width: 24px;
  pointer-events: none;
}
.fm-tab-fade-left { left: 0; background: linear-gradient(to right, var(--fm-bg), transparent); }
.fm-tab-fade-right { right: 0; background: linear-gradient(to left, var(--fm-bg), transparent); }
.fm-tab {
  flex: none;
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 8px;
  border-radius: 6px 6px 0 0;
  cursor: pointer; color: var(--fm-text-2); font-size: 12px;
  white-space: nowrap; max-width: 190px;
  border-bottom: 2px solid transparent;
  transition: background-color .1s ease, color .1s ease;
}
.fm-tab:hover { background: var(--fm-hover); color: var(--fm-text); }
.fm-tab:focus-visible { outline: 2px solid var(--fm-accent); outline-offset: -2px; }
.fm-tab-on { background: var(--fm-bg-raised); color: var(--fm-text); border-bottom-color: var(--fm-accent); }
.fm-tab-name { overflow: hidden; text-overflow: ellipsis; }
.fm-tab-close {
  display: inline-flex; align-items: center; justify-content: center;
  background: transparent; border: none; color: var(--fm-text-2); cursor: pointer;
  padding: 2px; border-radius: 4px; line-height: 1;
  transition: background-color .1s ease, color .1s ease;
}
.fm-tab-close:hover { background: color-mix(in srgb, var(--fm-danger) 18%, transparent); color: var(--fm-danger); }
.fm-tab-close:focus-visible { outline: 2px solid var(--fm-accent); outline-offset: -2px; }
.fm-tab-closeall { flex: none; padding: 4px; }
.fm-tab-body {
  flex: 1 1 0%; min-height: 0; overflow: hidden;
  display: flex; flex-direction: column;
}
.fm-text-body {
  flex: 1 1 0%; min-height: 0; overflow: hidden;
  display: flex; flex-direction: column;
}
.fm-code-wrap {
  position: relative;
  flex: 1 1 0%; min-height: 0;
  margin: 12px;
  display: flex; flex-direction: column;
}
.fm-code {
  flex: 1 1 0%; min-height: 0;
  margin: 0; padding: 10px 12px;
  background: var(--fm-bg-sunken); color: var(--fm-text);
  border: 1px solid var(--fm-border); border-radius: 8px;
  overflow: auto; user-select: text;
  font-family: Consolas, 'Cascadia Code', Menlo, monospace;
  font-size: 12px; line-height: 1.6;
  white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word;
  scrollbar-width: thin;
  scrollbar-color: var(--fm-border-strong) transparent;
}
.fm-code::-webkit-scrollbar { width: 10px; height: 10px; }
.fm-code::-webkit-scrollbar-thumb {
  background: var(--fm-border-strong); border-radius: 5px;
  border: 2px solid transparent; background-clip: content-box;
}
.fm-code::-webkit-scrollbar-thumb:hover { background: var(--fm-text-2); border: 2px solid transparent; background-clip: content-box; }
.fm-code::-webkit-scrollbar-track { background: transparent; }
.fm-diff {
  flex: 1 1 0%; min-height: 0;
  margin: 0; padding: 6px 0;
  background: var(--fm-bg-sunken); color: var(--fm-text);
  border: 1px solid var(--fm-border); border-radius: 8px;
  overflow: auto; user-select: text;
  font-family: Consolas, 'Cascadia Code', Menlo, monospace;
  font-size: 12px; line-height: 1.6;
  scrollbar-width: thin;
  scrollbar-color: var(--fm-border-strong) transparent;
}
.fm-diff::-webkit-scrollbar { width: 10px; height: 10px; }
.fm-diff::-webkit-scrollbar-thumb {
  background: var(--fm-border-strong); border-radius: 5px;
  border: 2px solid transparent; background-clip: content-box;
}
.fm-diff::-webkit-scrollbar-thumb:hover { background: var(--fm-text-2); border: 2px solid transparent; background-clip: content-box; }
.fm-diff::-webkit-scrollbar-track { background: transparent; }
.fm-diff-row { display: flex; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
.fm-diff-gutter {
  flex: none; width: 20px; text-align: center;
  user-select: none; color: var(--fm-text-2);
}
.fm-diff-text { flex: 1; min-width: 0; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
.fm-diff-add { background: color-mix(in srgb, var(--fm-git-add) 14%, transparent); }
.fm-diff-add .fm-diff-gutter { color: var(--fm-git-add); }
.fm-diff-del { background: color-mix(in srgb, var(--fm-git-del) 14%, transparent); }
.fm-diff-del .fm-diff-gutter { color: var(--fm-git-del); }
.fm-diff-hunk { background: color-mix(in srgb, var(--fm-accent) 10%, transparent); }
.fm-diff-hunk .fm-diff-gutter { color: var(--fm-accent); }
.fm-diff-hunk .fm-diff-text { color: var(--fm-accent); }
.fm-diff-meta { color: var(--fm-text-2); }
.fm-diff-empty { padding: 24px 12px; text-align: center; color: var(--fm-text-2); }
.fm-md {
  flex: 1 1 0%; min-height: 0;
  margin: 0; padding: 12px 16px;
  background: var(--fm-bg-sunken); color: var(--fm-text);
  border: 1px solid var(--fm-border); border-radius: 8px;
  overflow: auto; user-select: text;
  font-size: 13px; line-height: 1.7;
  scrollbar-width: thin;
  scrollbar-color: var(--fm-border-strong) transparent;
}
.fm-md::-webkit-scrollbar { width: 10px; }
.fm-md::-webkit-scrollbar-thumb {
  background: var(--fm-border-strong); border-radius: 5px;
  border: 2px solid transparent; background-clip: content-box;
}
.fm-md::-webkit-scrollbar-thumb:hover { background: var(--fm-text-2); border: 2px solid transparent; background-clip: content-box; }
.fm-md::-webkit-scrollbar-track { background: transparent; }
.fm-md h1 { font-size: 20px; margin: 12px 0 8px; border-bottom: 1px solid var(--fm-border); padding-bottom: 6px; }
.fm-md h2 { font-size: 17px; margin: 12px 0 6px; }
.fm-md h3 { font-size: 15px; margin: 10px 0 6px; }
.fm-md h4, .fm-md h5, .fm-md h6 { font-size: 14px; margin: 8px 0 4px; }
.fm-md h1:first-child { margin-top: 0; }
.fm-md p { margin: 6px 0; }
.fm-md-code {
  background: var(--fm-bg-nested); border-radius: 4px; padding: 1px 5px;
  font-family: Consolas, 'Cascadia Code', Menlo, monospace;
  font-size: 12px;
}
.fm-md-pre {
  background: var(--fm-bg-nested); border-radius: 6px; padding: 10px 12px;
  margin: 8px 0; overflow-x: auto;
}
.fm-md-pre code {
  background: none; padding: 0;
  font-family: Consolas, 'Cascadia Code', Menlo, monospace;
  font-size: 12px; white-space: pre;
}
.fm-md-link { color: var(--fm-accent); text-decoration: none; }
.fm-md-link:hover { text-decoration: underline; }
.fm-md-quote {
  border-left: 3px solid var(--fm-border-strong);
  margin: 8px 0; padding: 2px 12px;
  color: var(--fm-text-2);
}
.fm-md-quote p { margin: 4px 0; }
.fm-md-ul, .fm-md-ol { margin: 6px 0; padding-left: 24px; }
.fm-md-ul li, .fm-md-ol li { margin: 2px 0; }
.fm-md-hr { border: none; border-top: 1px solid var(--fm-border-strong); margin: 10px 0; }
.fm-md-table { border-collapse: collapse; margin: 8px 0; font-size: 12px; }
.fm-md-table th, .fm-md-table td { border: 1px solid var(--fm-border); padding: 4px 10px; }
.fm-md-table th { background: var(--fm-bg-raised); }
.fm-md-mermaid { margin: 8px 0; text-align: center; }
.fm-md-mermaid svg { max-width: 100%; height: auto; }
.fm-md-mermaid-loading { color: var(--fm-text-2); font-size: 12px; padding: 12px; text-align: center; }
.fm-diff-btn,
.fm-md-btn {
  position: absolute; top: 8px; right: 8px; z-index: 1;
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; padding: 0;
  background: var(--fm-bg-raised); border: 1px solid var(--fm-border); border-radius: 6px;
  color: var(--fm-text-2); cursor: pointer;
  transition: background-color .1s ease, color .1s ease;
}
.fm-diff-btn:hover, .fm-md-btn:hover { background: var(--fm-hover); color: var(--fm-text); }
.fm-diff-btn-on, .fm-md-btn-on {
  color: var(--fm-accent);
  border-color: color-mix(in srgb, var(--fm-accent) 50%, transparent);
  background: color-mix(in srgb, var(--fm-accent) 12%, transparent);
}
.fm-md-btn { right: 40px; }
.hl-cm { color: #6a9955; }
.hl-st { color: #ce9178; }
.hl-kw { color: #c586c0; }
.hl-nm { color: #b5cea8; }
.hl-fn { color: #dcdcaa; }
.hl-tg { color: #569cd6; }
.hl-at { color: #9cdcfe; }
.fm-image-wrap {
  flex: 1 1 0%; min-height: 0; overflow: auto;
  margin: 12px; display: flex; align-items: center; justify-content: center;
}
.fm-image { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; }
.fm-unsupported {
  flex: 1 1 0%; min-height: 0; overflow: auto;
  margin: 12px; padding: 24px 12px; text-align: center;
  color: var(--fm-text-2);
  border: 1px dashed var(--fm-border-strong); border-radius: 8px;
}
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
.fm-pop {
  position: absolute;
  top: 44px; right: 12px;
}
.fm-pop2 {
  position: absolute;
  top: 46px; right: 12px;
}
.fm-menu-item { display: flex; align-items: center; gap: 8px; padding: 4px 8px; border-radius: 6px; cursor: pointer; color: var(--fm-text); white-space: nowrap; transition: background-color .1s ease; }
.fm-menu-item:hover { background: var(--fm-hover); }
.fm-menu-item:focus-visible { outline: 2px solid var(--fm-accent); outline-offset: -2px; }
.fm-menu-danger { color: var(--fm-danger); }
.fm-menu-danger:hover { background: color-mix(in srgb, var(--fm-danger) 14%, transparent); }
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
@media (prefers-reduced-motion: reduce) {
  .fm-panel { animation: none; }
  .fm-chev, .fm-btn, .fm-row, .fm-tab, .fm-tab-close, .fm-eye-btn, .fm-menu-item, .fm-git-btn, .fm-diff-btn, .fm-md-btn, .fm-files-btn { transition: none; }
}
`

let mermaidReady = false
function ensureMermaid() {
  if (mermaidReady) return
  mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict', fontFamily: 'Consolas, "Cascadia Code", Menlo, monospace' })
  mermaidReady = true
}

export default {
  name: 'dsh-fm',
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return

    const styleEl = document.createElement('style')
    styleEl.textContent = FM_CSS
    document.head.appendChild(styleEl)
    ctx.effect(() => () => { if (styleEl.parentNode) styleEl.parentNode.removeChild(styleEl) })

    const api = async (method, args) => {
      const res = await fetch('/api/fm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ method, args: args || {} }),
      })
      if (!res.ok) {
        let detail = ''
        try { detail = String(await res.text()).trim().slice(0, 200) } catch (e) { /* ignore */ }
        throw new Error('文件管理器接口不可用（HTTP ' + res.status + '）' + (detail ? ' ' + detail : ''))
      }
      return res.json()
    }

    const el = React.createElement
    const store = { open: false, sessionId: null, root: null, lastRoot: null, draft: '', inputActions: null }
    const listeners = new Set()
    const subscribe = (fn) => { listeners.add(fn); return () => { listeners.delete(fn) } }
    const setOpen = (open) => {
      store.open = open
      listeners.forEach((fn) => fn(open))
    }

    const norm = (p) => String(p).replace(/\\/g, '/')
    const fmtSize = (n) => {
      if (n == null) return ''
      if (n < 1024) return n + ' B'
      if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'
      return (n / 1048576).toFixed(1) + ' MB'
    }

    const RE_LINE_SLASH = /\/\/[^\n]*/
    const RE_LINE_HASH = /#[^\n]*/
    const RE_LINE_DASH = /--[^\n]*/
    const RE_BLOCK_C = /\/\*[\s\S]*?\*\//
    const RE_BLOCK_HTML = /<!--[\s\S]*?-->/
    const RE_STR = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/
    const RE_NUM = /\b(?:\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?(?:px|%|em|rem|vh|vw|vmin|vmax|s|ms|deg|rad|fr|pt|ex|ch)?)\b/
    const RE_FN = /[A-Za-z_$][\w$]*(?=\s*\()/
    const RE_TAG = /<\/?[a-zA-Z][\w-]*/
    const RE_ATTR = /[\w:-]+(?==)/

    const JS_KW = ['const','let','var','function','return','if','else','for','while','do','switch','case','default','break','continue','new','class','extends','super','this','typeof','instanceof','in','of','async','await','yield','import','export','from','try','catch','finally','throw','delete','void','null','undefined','true','false','static','get','set','interface','type','enum','implements','private','public','protected','readonly','abstract','namespace','declare','as','keyof','never','unknown','any','number','string','boolean','symbol','bigint','object','using','globalThis','NaN','Infinity']
    const TS_EXTRA = ['as','type','interface','enum','implements','private','public','protected','readonly','abstract','namespace','declare','keyof','never','unknown','any','number','string','boolean','symbol','bigint','object','is','satisfies']
    const C_KW = ['public','private','protected','static','final','class','interface','extends','implements','return','if','else','for','while','do','switch','case','default','break','continue','new','try','catch','finally','throw','throws','void','int','long','double','float','boolean','char','byte','short','this','super','package','import','abstract','native','synchronized','volatile','transient','instanceof','enum','const','sizeof','struct','union','typedef','extern','register','auto','true','false','null','namespace','using','template','typename','operator','virtual','override','constexpr','string','bool','unsigned','signed','goto','inline','restrict']
    const GO_KW = ['func','package','import','var','const','type','struct','interface','map','chan','go','defer','return','if','else','for','range','switch','case','default','break','continue','fallthrough','select','new','make','len','cap','append','true','false','nil','error','panic','recover','goto','uint','int','int8','int16','int32','int64','uint8','uint16','uint32','uint64','float32','float64','string','bool','byte','rune','complex64','complex128']
    const RS_KW = ['fn','let','mut','const','struct','enum','impl','trait','mod','use','pub','crate','self','Self','match','if','else','for','while','loop','return','break','continue','async','await','move','ref','type','where','dyn','static','unsafe','true','false','None','Some','Ok','Err','in','as','Box','Vec','String','Option','Result','i32','i64','u32','u64','f32','f64','usize','isize','bool','char','str']
    const PY_KW = ['def','return','if','elif','else','for','while','import','from','class','try','except','finally','with','as','lambda','pass','break','continue','global','nonlocal','yield','assert','raise','in','is','not','and','or','None','True','False','async','await','del','self','print','len','range','dict','list','set','tuple','str','int','float','bool','object','type','super','match','case']
    const RB_KW = ['def','end','if','elsif','else','unless','while','until','for','do','return','class','module','require','include','extend','begin','rescue','ensure','yield','true','false','nil','self','lambda','proc','case','when','then','new','super','break','next','redo','retry']
    const PHP_KW = ['function','return','if','else','elseif','for','foreach','while','do','switch','case','default','break','continue','class','interface','extends','implements','namespace','use','public','private','protected','static','new','try','catch','finally','throw','echo','print','true','false','null','array','string','int','float','bool','isset','empty','require','include','abstract','final','global','const','var','list','unset']
    const SH_KW = ['if','then','else','elif','fi','for','while','until','do','done','case','esac','function','return','local','export','source','alias','read','echo','exit','shift','test','true','false','set','unset','trap','exec','eval','select','in']
    const SQL_KW = ['select','from','where','insert','into','values','update','set','delete','create','table','database','index','view','drop','alter','add','column','primary','key','foreign','references','join','inner','left','right','full','outer','on','group','by','order','having','limit','offset','union','all','distinct','as','and','or','not','null','is','in','like','between','exists','count','sum','avg','min','max','asc','desc','with','case','when','then','else','end','begin','commit','rollback','grant','revoke','procedure','function','trigger','constraint','default','unique','check','int','varchar','char','text','date','time','timestamp','boolean','bigint','smallint','decimal','float','double','numeric','coalesce','cast']
    const PS_KW = ['function','param','return','if','else','elseif','foreach','for','while','switch','case','default','break','continue','try','catch','finally','throw','class','new','import','export','using','namespace','filter','begin','process','end','where','null','true','false','Get-Item','Get-ChildItem','Write-Host','Write-Output','Set-Content','Get-Content','Remove-Item','New-Item','Test-Path','Select-Object','Where-Object','ForEach-Object','Sort-Object','Get-Process','Start-Process','Stop-Process','Invoke-Command','Invoke-WebRequest','ConvertTo-Json','ConvertFrom-Json','Join-Path','Split-Path','Resolve-Path','Push-Location','Pop-Location','Set-Location','Get-Location','Out-File','Export-Csv','Import-Csv']

    const LANG = {
      js: { cm: [RE_LINE_SLASH, RE_BLOCK_C], kw: JS_KW },
      ts: { cm: [RE_LINE_SLASH, RE_BLOCK_C], kw: JS_KW.concat(TS_EXTRA) },
      py: { cm: [RE_LINE_HASH], kw: PY_KW },
      c: { cm: [RE_LINE_SLASH, RE_BLOCK_C], kw: C_KW },
      cs: { cm: [RE_LINE_SLASH, RE_BLOCK_C], kw: C_KW.concat(['namespace','using','class','this','base','string','bool','int','double','float','decimal','var','as','is','null','true','false','new','return','if','else','foreach','in','public','private','protected','internal','static','void','readonly','sealed','abstract','override','virtual','async','await','event','delegate','interface','enum','struct','get','set','value','out','ref','params','lock','checked','unsafe','fixed']) },
      go: { cm: [RE_LINE_SLASH, RE_BLOCK_C], kw: GO_KW },
      rs: { cm: [RE_LINE_SLASH, RE_BLOCK_C], kw: RS_KW },
      rb: { cm: [RE_LINE_HASH], kw: RB_KW },
      php: { cm: [RE_LINE_SLASH, RE_BLOCK_C], kw: PHP_KW },
      sh: { cm: [RE_LINE_HASH], kw: SH_KW },
      ps1: { cm: [RE_LINE_HASH], kw: PS_KW },
      sql: { cm: [RE_LINE_DASH], kw: SQL_KW },
      lua: { cm: [RE_LINE_DASH], kw: [] },
      r: { cm: [RE_LINE_HASH], kw: [] },
      html: { cm: [RE_BLOCK_HTML], kw: [], tags: true },
      css: { cm: [RE_BLOCK_C], kw: [] },
      json: { cm: [], kw: ['true','false','null'] },
      yaml: { cm: [RE_LINE_HASH], kw: ['true','false','null','yes','no','on','off'] },
      toml: { cm: [RE_LINE_HASH], kw: ['true','false'] },
      ini: { cm: [RE_LINE_HASH], kw: [] },
      gql: { cm: [], kw: ['query','mutation','subscription','fragment','on','type','interface','enum','scalar','input','implements','directive','schema','true','false','null','int','float','string','boolean','ID'] },
      text: { cm: [], kw: [] },
    }
    const EXT_LANG = {
      js: 'js', mjs: 'js', cjs: 'js', jsx: 'js', ts: 'ts', tsx: 'ts',
      py: 'py', java: 'c', c: 'c', h: 'c', cpp: 'c', cc: 'c', cxx: 'c', hpp: 'c', cs: 'cs',
      go: 'go', rs: 'rs', rb: 'rb', php: 'php', sh: 'sh', bash: 'sh', zsh: 'sh', ps1: 'ps1',
      bat: 'text', cmd: 'text',
      html: 'html', htm: 'html', xml: 'html', vue: 'html', svelte: 'html',
      css: 'css', scss: 'css', less: 'css',
      json: 'json', jsonl: 'json', ndjson: 'json',
      yml: 'yaml', yaml: 'yaml', toml: 'toml', ini: 'ini', cfg: 'ini', conf: 'ini', env: 'ini', properties: 'ini',
      sql: 'sql', graphql: 'gql',
      swift: 'c', kt: 'c', kts: 'c', kotlin: 'c', dart: 'c', zig: 'c', nim: 'c',
      scala: 'c', groovy: 'js', gradle: 'js', proto: 'c', cmake: 'r', ninja: 'r',
      lua: 'lua', r: 'r', pl: 'r', pm: 'r', ex: 'r', exs: 'r', clj: 'lua', hs: 'lua', erl: 'r',
      md: 'text', markdown: 'text', txt: 'text', log: 'text', lock: 'text', gitignore: 'text',
      csv: 'text', tsv: 'text', diff: 'text', patch: 'text', wasm: 'text',
      tex: 'text', rst: 'text', adoc: 'text', org: 'text',
    }
    const HL_LIMIT = 200000
    const reCache = {}
    const kwRe = (list) => '\\b(?:' + list.join('|') + ')\\b'
    function buildRe(conf) {
      const alts = []
      for (const r of conf.cm || []) alts.push('(?<cm>' + r.source + ')')
      alts.push('(?<st>' + RE_STR.source + ')')
      if (conf.kw && conf.kw.length) alts.push('(?<kw>' + kwRe(conf.kw) + ')')
      alts.push('(?<nm>' + RE_NUM.source + ')')
      alts.push('(?<fn>' + RE_FN.source + ')')
      if (conf.tags) {
        alts.push('(?<tg>' + RE_TAG.source + ')')
        alts.push('(?<at>' + RE_ATTR.source + ')')
      }
      return new RegExp(alts.join('|'), 'g')
    }
    function langFor(ext) { return LANG[EXT_LANG[ext] || 'text'] || LANG.text }
    function tokenize(code, conf) {
      let re = reCache[conf]
      if (!re) { re = buildRe(conf); reCache[conf] = re }
      const out = []
      re.lastIndex = 0
      let last = 0
      let m
      while ((m = re.exec(code))) {
        if (m.index > last) out.push({ t: code.slice(last, m.index), c: '' })
        const g = m.groups || {}
        const cls = g.cm ? 'cm' : g.st ? 'st' : g.kw ? 'kw' : g.nm ? 'nm' : g.fn ? 'fn' : g.tg ? 'tg' : g.at ? 'at' : ''
        out.push({ t: m[0], c: cls })
        last = m.index + m[0].length
        if (m[0].length === 0) re.lastIndex++
      }
      if (last < code.length) out.push({ t: code.slice(last), c: '' })
      return out
    }

    const extOf = (name) => {
      const dot = name.lastIndexOf('.')
      return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
    }
    const sortKids = (list) => list.slice().sort((a, b) => {
      const ad = a.type === 'directory' ? 0 : 1
      const bd = b.type === 'directory' ? 0 : 1
      if (ad !== bd) return ad - bd
      if (ad === 0) return a.name.localeCompare(b.name, 'zh', { numeric: true })
      const ec = extOf(a.name).localeCompare(extOf(b.name))
      if (ec !== 0) return ec
      return a.name.localeCompare(b.name, 'zh', { numeric: true })
    })

    const ICONS = {
      chevron: { p: ['M6 3.5 11.5 8 6 12.5'] },
      folder: { p: ['M1.5 4A1.5 1.5 0 0 1 3 2.5h3l1.5 2H13A1.5 1.5 0 0 1 14.5 6v6A1.5 1.5 0 0 1 13 13.5H3A1.5 1.5 0 0 1 1.5 12z'] },
      close: { p: ['M4 4l8 8', 'M12 4l-8 8'] },
      more: { p: [], c: [[8, 3.2, 1.1], [8, 8, 1.1], [8, 12.8, 1.1]] },
      'arrow-up': { p: ['M8 2.5v11', 'M3.5 7 8 2.5 12.5 7'] },
      refresh: { p: ['M13.5 8A5.5 5.5 0 1 1 8 2.5c2 0 3.8 1.1 4.8 2.7', 'M13.5 1.8v3.4h-3.4'] },
      link: { p: ['M6.7 8.7a3.3 3.3 0 0 1 4.7 0l2-2a3.3 3.3 0 1 0-4.7-4.7l-1.1 1.1', 'M9.3 7.3a3.3 3.3 0 0 1-4.7 0l-2-2a3.3 3.3 0 1 1 4.7-4.7l1.1 1.1'] },
      trash: { p: ['M3 4.5h10', 'M6.5 2.5h3', 'M4.8 4.5l.7 8.6a1 1 0 0 0 1 .9h3a1 1 0 0 0 1-.9l.7-8.6', 'M6.6 7v4.5', 'M9.4 7v4.5'] },
      check: { p: ['M3.5 8.5 6.5 11.5 12.5 5'] },
      commit: { p: ['M8 2.5v4.4', 'M5.2 4.8 8 7.6 10.8 4.8'], c: [[8, 10.6, 1.7]] },
      filter: { p: ['M2.5 3.5h11', 'M5.5 8h5', 'M7.5 12.5h1'] },
      diff: { p: ['M4 2.5h5L13 6.5v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1z', 'M9 2.5V6.5H13', 'M6.5 8.5v3', 'M5 10h3'] },
      md: { p: ['M2.5 3.5h11v9h-11z', 'M5 6.5l1.8 2.5L8.6 6.5l1.8 2.5L12 6.5'] },
      'file-view': { p: ['M4 2.5h5.5L13 6v7.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1z', 'M9.5 2.5V6H13', 'M5.9 9.2c.8-1.3 2-2 2.7-2s1.9.7 2.7 2c-.8 1.3-2 2-2.7 2s-1.9-.7-2.7-2z'], c: [[8.6, 9.2, 0.7]] },
    }
    const iconEl = (name, size, cls) => {
      const conf = ICONS[name] || ICONS.folder
      const s = size || 16
      const kids = []
      for (const d of conf.p || []) kids.push(el('path', { d }))
      for (const c of conf.c || []) kids.push(el('circle', { cx: c[0], cy: c[1], r: c[2], fill: 'currentColor', stroke: 'none' }))
      return el('svg', {
        viewBox: '0 0 16 16',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.5,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        style: { width: s, height: s, display: 'block' },
        className: cls || undefined,
        'aria-hidden': true,
      }, kids)
    }

    const FILE_STYLE = {
      js: { label: 'JS', bg: '#f0db4f', fg: '#1f2329' },
      mjs: { label: 'JS', bg: '#f0db4f', fg: '#1f2329' },
      cjs: { label: 'JS', bg: '#f0db4f', fg: '#1f2329' },
      ts: { label: 'TS', bg: '#3178c6', fg: '#ffffff' },
      tsx: { label: 'TSX', bg: '#3178c6', fg: '#ffffff' },
      jsx: { label: 'JSX', bg: '#61dafb', fg: '#1f2329' },
      json: { label: '{}', bg: '#c9a227', fg: '#ffffff' },
      jsonl: { label: '{}', bg: '#c9a227', fg: '#ffffff' },
      ndjson: { label: '{}', bg: '#c9a227', fg: '#ffffff' },
      html: { label: 'HTML', bg: '#e34c26', fg: '#ffffff' },
      htm: { label: 'HTML', bg: '#e34c26', fg: '#ffffff' },
      css: { label: 'CSS', bg: '#264de4', fg: '#ffffff' },
      scss: { label: 'SCSS', bg: '#cd6799', fg: '#ffffff' },
      less: { label: 'LESS', bg: '#1d365d', fg: '#ffffff' },
      md: { label: 'MD', bg: '#0aa0b5', fg: '#ffffff' },
      markdown: { label: 'MD', bg: '#0aa0b5', fg: '#ffffff' },
      txt: { label: 'TXT', bg: '#519aba', fg: '#ffffff' },
      log: { label: 'LOG', bg: '#5f6b7a', fg: '#ffffff' },
      py: { label: 'PY', bg: '#3776ab', fg: '#ffffff' },
      java: { label: 'JAVA', bg: '#e76f00', fg: '#ffffff' },
      c: { label: 'C', bg: '#5c6370', fg: '#ffffff' },
      h: { label: 'H', bg: '#a074c4', fg: '#ffffff' },
      cpp: { label: 'CPP', bg: '#00599c', fg: '#ffffff' },
      cc: { label: 'CPP', bg: '#00599c', fg: '#ffffff' },
      cxx: { label: 'CPP', bg: '#00599c', fg: '#ffffff' },
      hpp: { label: 'HPP', bg: '#00599c', fg: '#ffffff' },
      cs: { label: 'C#', bg: '#68217a', fg: '#ffffff' },
      go: { label: 'GO', bg: '#00add8', fg: '#ffffff' },
      rs: { label: 'RS', bg: '#dea584', fg: '#1f2329' },
      rb: { label: 'RB', bg: '#cc342d', fg: '#ffffff' },
      php: { label: 'PHP', bg: '#777bb3', fg: '#ffffff' },
      sh: { label: 'SH', bg: '#4eaa25', fg: '#ffffff' },
      bash: { label: 'SH', bg: '#4eaa25', fg: '#ffffff' },
      zsh: { label: 'SH', bg: '#4eaa25', fg: '#ffffff' },
      bat: { label: 'BAT', bg: '#c1f12e', fg: '#1f2329' },
      cmd: { label: 'CMD', bg: '#5c5c5c', fg: '#ffffff' },
      ps1: { label: 'PS1', bg: '#012456', fg: '#ffffff' },
      yml: { label: 'YML', bg: '#2e7d32', fg: '#ffffff' },
      yaml: { label: 'YAML', bg: '#2e7d32', fg: '#ffffff' },
      toml: { label: 'TOML', bg: '#9c4221', fg: '#ffffff' },
      ini: { label: 'INI', bg: '#607d8b', fg: '#ffffff' },
      cfg: { label: 'CFG', bg: '#607d8b', fg: '#ffffff' },
      conf: { label: 'CFG', bg: '#607d8b', fg: '#ffffff' },
      env: { label: 'ENV', bg: '#607d8b', fg: '#ffffff' },
      properties: { label: 'CFG', bg: '#607d8b', fg: '#ffffff' },
      xml: { label: 'XML', bg: '#0060ac', fg: '#ffffff' },
      sql: { label: 'SQL', bg: '#e38c00', fg: '#ffffff' },
      graphql: { label: 'GQL', bg: '#e10098', fg: '#ffffff' },
      vue: { label: 'VUE', bg: '#42b883', fg: '#ffffff' },
      svelte: { label: 'SVL', bg: '#ff3e00', fg: '#ffffff' },
      swift: { label: 'SWIFT', bg: '#f05138', fg: '#ffffff' },
      kt: { label: 'KT', bg: '#7f52ff', fg: '#ffffff' },
      kts: { label: 'KTS', bg: '#7f52ff', fg: '#ffffff' },
      kotlin: { label: 'KT', bg: '#7f52ff', fg: '#ffffff' },
      dart: { label: 'DART', bg: '#0175c2', fg: '#ffffff' },
      lua: { label: 'LUA', bg: '#000080', fg: '#ffffff' },
      r: { label: 'R', bg: '#276dc3', fg: '#ffffff' },
      scala: { label: 'SCALA', bg: '#dc322f', fg: '#ffffff' },
      clj: { label: 'CLJ', bg: '#5881d8', fg: '#ffffff' },
      hs: { label: 'HS', bg: '#5e5086', fg: '#ffffff' },
      ex: { label: 'EX', bg: '#7b53a0', fg: '#ffffff' },
      exs: { label: 'EXS', bg: '#7b53a0', fg: '#ffffff' },
      erl: { label: 'ERL', bg: '#b83998', fg: '#ffffff' },
      pl: { label: 'PL', bg: '#0298c3', fg: '#ffffff' },
      pm: { label: 'PM', bg: '#0298c3', fg: '#ffffff' },
      groovy: { label: 'GROVY', bg: '#4298b8', fg: '#ffffff' },
      gradle: { label: 'GRDLE', bg: '#02303a', fg: '#ffffff' },
      cmake: { label: 'CMAKE', bg: '#064f8c', fg: '#ffffff' },
      ninja: { label: 'NINJA', bg: '#7d88a4', fg: '#ffffff' },
      proto: { label: 'PROTO', bg: '#a5a5a5', fg: '#1f2329' },
      zig: { label: 'ZIG', bg: '#f7a41d', fg: '#1f2329' },
      nim: { label: 'NIM', bg: '#ffc200', fg: '#1f2329' },
      tex: { label: 'TEX', bg: '#3d6117', fg: '#ffffff' },
      rst: { label: 'RST', bg: '#4a4a4a', fg: '#ffffff' },
      adoc: { label: 'ADOC', bg: '#e40046', fg: '#ffffff' },
      org: { label: 'ORG', bg: '#77aa99', fg: '#1f2329' },
      csv: { label: 'CSV', bg: '#217346', fg: '#ffffff' },
      tsv: { label: 'TSV', bg: '#217346', fg: '#ffffff' },
      diff: { label: 'DIFF', bg: '#6f42c1', fg: '#ffffff' },
      patch: { label: 'PATCH', bg: '#6f42c1', fg: '#ffffff' },
      lock: { label: 'LOCK', bg: '#7a8290', fg: '#ffffff' },
      gitignore: { label: 'GIT', bg: '#e44c29', fg: '#ffffff' },
      wasm: { label: 'WASM', bg: '#654ff0', fg: '#ffffff' },
      png: { label: 'PNG', bg: '#9b59b6', fg: '#ffffff' },
      jpg: { label: 'JPG', bg: '#9b59b6', fg: '#ffffff' },
      jpeg: { label: 'JPG', bg: '#9b59b6', fg: '#ffffff' },
      gif: { label: 'GIF', bg: '#9b59b6', fg: '#ffffff' },
      webp: { label: 'WEBP', bg: '#9b59b6', fg: '#ffffff' },
      bmp: { label: 'BMP', bg: '#9b59b6', fg: '#ffffff' },
      svg: { label: 'SVG', bg: '#ffb13b', fg: '#1f2329' },
      ico: { label: 'ICO', bg: '#9b59b6', fg: '#ffffff' },
      avif: { label: 'AVIF', bg: '#9b59b6', fg: '#ffffff' },
    }

    const fileBadge = (name) => {
      const ext = extOf(name)
      const st = FILE_STYLE[ext]
      if (st) return el('span', { className: 'fm-ficon', style: { backgroundColor: st.bg, color: st.fg } }, st.label)
      const label = ext ? ext.slice(0, 4).toUpperCase() : 'FILE'
      return el('span', { className: 'fm-ficon fm-ficon-other' }, label)
    }

    const mdInline = (text, keyBase) => {
      const nodes = []
      const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g
      let last = 0
      let m
      let i = 0
      while ((m = re.exec(text))) {
        if (m.index > last) nodes.push(text.slice(last, m.index))
        if (m[1]) nodes.push(el('code', { className: 'fm-md-code', key: keyBase + '-' + i++ }, m[1].slice(1, -1)))
        else if (m[2]) nodes.push(el('strong', { key: keyBase + '-' + i++ }, m[2].slice(2, -2)))
        else if (m[3]) nodes.push(el('em', { key: keyBase + '-' + i++ }, m[3].slice(1, -1)))
        else if (m[4]) {
          const mm = m[4].match(/^\[([^\]]+)\]\(([^)]+)\)$/)
          nodes.push(el('a', { key: keyBase + '-' + i++, className: 'fm-md-link', href: mm[2], target: '_blank', rel: 'noreferrer' }, mm[1]))
        }
        last = m.index + m[0].length
      }
      if (last < text.length) nodes.push(text.slice(last))
      return nodes
    }
    const mdRender = (content) => {
      const lines = String(content == null ? '' : content).split('\n')
      const out = []
      let i = 0
      let seq = 0
      while (i < lines.length) {
        const ln = lines[i]
        const t = ln.trim()
        const key = 'k' + seq
        if (t === '') { i++; continue }
        const f = t.match(/^```(\w*)\s*$/)
        if (f) {
          const buf = []
          i++
          while (i < lines.length && !/^```\s*$/.test(lines[i].trim())) { buf.push(lines[i]); i++ }
          i++
          const lang = f[1].toLowerCase()
          out.push(lang === 'mermaid'
            ? el(MermaidView, { code: buf.join('\n'), key: key })
            : el('pre', { className: 'fm-md-pre', key: key }, el('code', null, buf.join('\n'))))
          seq++
          continue
        }
        const h = t.match(/^(#{1,6})\s+(.*)$/)
        if (h) {
          const lv = h[1].length
          out.push(el('h' + lv, { className: 'fm-md-h', key: key }, mdInline(h[2], 'm' + seq)))
          i++; seq++
          continue
        }
        if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(t)) { out.push(el('hr', { className: 'fm-md-hr', key: key })); i++; seq++; continue }
        if (t.indexOf('>') === 0) {
          const buf = []
          while (i < lines.length && lines[i].trim().indexOf('>') === 0) { buf.push(lines[i].trim().slice(1).trim()); i++ }
          out.push(el('blockquote', { className: 'fm-md-quote', key: key }, buf.map((b, j) => el('p', { key: 'q' + j }, mdInline(b, 'q' + seq + '-' + j)))))
          seq++
          continue
        }
        const ul = t.match(/^[-*+]\s+(.*)$/)
        if (ul) {
          const items = []
          while (i < lines.length) {
            const mi = lines[i].trim().match(/^[-*+]\s+(.*)$/)
            if (!mi) break
            items.push(mi[1]); i++
          }
          out.push(el('ul', { className: 'fm-md-ul', key: key }, items.map((it, j) => el('li', { key: 'l' + j }, mdInline(it, 'u' + seq + '-' + j)))))
          seq++
          continue
        }
        const ol = t.match(/^\d+\.\s+(.*)$/)
        if (ol) {
          const items = []
          while (i < lines.length) {
            const mi = lines[i].trim().match(/^\d+\.\s+(.*)$/)
            if (!mi) break
            items.push(mi[1]); i++
          }
          out.push(el('ol', { className: 'fm-md-ol', key: key }, items.map((it, j) => el('li', { key: 'l' + j }, mdInline(it, 'o' + seq + '-' + j)))))
          seq++
          continue
        }
        if (t.indexOf('|') === 0 && i + 1 < lines.length && lines[i + 1].indexOf('-') !== -1 && /^\|?[\s:|-]+\|?$/.test(lines[i + 1].trim())) {
          const rows = []
          while (i < lines.length && lines[i].trim().indexOf('|') === 0) { rows.push(lines[i].trim()); i++ }
          const parseRow = (r) => r.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
          const head = parseRow(rows[0])
          const body = rows.slice(2).map(parseRow)
          out.push(el('table', { className: 'fm-md-table', key: key },
            el('thead', null, el('tr', null, head.map((c, j) => el('th', { key: 'h' + j }, mdInline(c, 't' + seq + '-h' + j))))),
            el('tbody', null, body.map((r, j) => el('tr', { key: 'b' + j }, r.map((c, k) => el('td', { key: 'c' + k }, mdInline(c, 't' + seq + '-b' + j + '-' + k)))))),
          ))
          seq++
          continue
        }
        const buf = [ln]
        i++
        while (i < lines.length) {
          const nt = lines[i].trim()
          if (nt === '' || /^(#{1,6}\s|```|[-*+]\s|\d+\.\s|>\s)/.test(nt) || nt.indexOf('|') === 0) break
          buf.push(lines[i]); i++
        }
        out.push(el('p', { className: 'fm-md-p', key: key }, mdInline(buf.join(' '), 'p' + seq)))
        seq++
      }
      return out
    }

    function MermaidView(props) {
      const [svg, setSvg] = React.useState(null)
      const [err, setErr] = React.useState(false)
      React.useEffect(() => {
        let cancelled = false
        ;(async () => {
          try {
            ensureMermaid()
            const id = 'fm-mmd-' + Math.random().toString(36).slice(2, 10)
            const rendered = await mermaid.render(id, props.code)
            if (!cancelled) setSvg(rendered.svg)
          } catch (e) {
            if (!cancelled) setErr(true)
          }
        })()
        return () => { cancelled = true }
      }, [props.code])
      if (err) return el('pre', { className: 'fm-md-pre' }, el('code', null, props.code))
      if (svg == null) return el('div', { className: 'fm-md-mermaid-loading' }, '渲染中…')
      return el('div', { className: 'fm-md-mermaid', dangerouslySetInnerHTML: { __html: svg } })
    }

    const parseDiff = (raw) => {
      const rows = []
      const lines = String(raw == null ? '' : raw).split('\n')
      for (const ln of lines) {
        if (ln.indexOf('@@') === 0) rows.push({ t: 'hunk', s: ln })
        else if (ln.indexOf('+++') === 0 || ln.indexOf('---') === 0) rows.push({ t: 'meta', s: ln })
        else if (ln.indexOf('+') === 0) rows.push({ t: 'add', s: ln.slice(1) })
        else if (ln.indexOf('-') === 0) rows.push({ t: 'del', s: ln.slice(1) })
        else if (ln.indexOf('\\') === 0) rows.push({ t: 'meta', s: ln })
        else rows.push({ t: 'ctx', s: ln })
      }
      return rows
    }
    const allAddRows = (content) => String(content == null ? '' : content).split('\n').map((s) => ({ t: 'add', s }))
    const relOf = (p) => {
      const r = store.root || ''
      if (r && p.indexOf(r + '/') === 0) return p.slice(r.length + 1)
      return p
    }

    let previewSeq = 0
    const MAX_TABS = 20
    const POLL_MS = 3000
    const DBL_CLICK_MS = 250

    function useOpen() {
      const [open, set] = React.useState(store.open)
      React.useEffect(() => subscribe(set), [])
      return open
    }

    function FmPanel() {
      const open = useOpen()
      const [rootPath, setRootPath] = React.useState(null)
      const [tree, setTree] = React.useState({})
      const [error, setError] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      const [previews, setPreviews] = React.useState([])
      const [activeKey, setActiveKey] = React.useState(null)
      const [menu, setMenu] = React.useState(null)
      const [tabLeftFade, setTabLeftFade] = React.useState(false)
      const [tabRightFade, setTabRightFade] = React.useState(false)
      const [listTopFade, setListTopFade] = React.useState(false)
      const [listBotFade, setListBotFade] = React.useState(false)
      const [previewVisible, setPreviewVisible] = React.useState(true)
      const [closeAllConfirm, setCloseAllConfirm] = React.useState(false)
      const [gitInfo, setGitInfo] = React.useState(null)
      const [diffOnly, setDiffOnly] = React.useState(false)
      const [commitOpen, setCommitOpen] = React.useState(false)
      const [commitMsg, setCommitMsg] = React.useState('')
      const [commitBusy, setCommitBusy] = React.useState(false)

      const treeRef = React.useRef(tree)
      treeRef.current = tree
      const previewsRef = React.useRef(previews)
      previewsRef.current = previews
      const activeKeyRef = React.useRef(activeKey)
      activeKeyRef.current = activeKey
      const pollBusy = React.useRef(false)
      const gitBusy = React.useRef(false)
      const lastDirClick = React.useRef(null)

      // 仅已跟踪的修改/删除文件参与 git 徽标与筛选（未跟踪/忽略内容不关心其新增状态）
      const gitMap = {}
      if (gitInfo && gitInfo.files) for (const f of gitInfo.files) if (!f.untracked) gitMap[f.path] = f
      const changedSet = new Set(Object.keys(gitMap))

      // 按目录聚合 git 变更：每个目录 → 其下（含更深层）变更文件数、加/减行数
      const dirGit = React.useMemo(() => {
        const map = {}
        if (!gitInfo || !gitInfo.files) return map
        const rootNorm = rootPath ? norm(rootPath) : null
        for (const f of gitInfo.files) {
          if (f.untracked) continue
          let p = norm(f.path)
          if (p.endsWith('/')) p = p.slice(0, -1)
          let idx = p.lastIndexOf('/')
          while (idx > 0) {
            const dir = p.slice(0, idx)
            if (rootNorm && dir !== rootNorm && dir.indexOf(rootNorm + '/') !== 0) break
            let e = map[dir]
            if (!e) e = map[dir] = { count: 0, added: 0, deleted: 0 }
            e.count++
            if (typeof f.added === 'number') e.added += f.added
            if (typeof f.deleted === 'number') e.deleted += f.deleted
            idx = dir.lastIndexOf('/')
          }
        }
        return map
      }, [gitInfo, rootPath])

      // 未被 git 索引的路径集合：未跟踪（??）与被忽略（!!）的文件/目录，用于暗色显示
      const untrackedSet = React.useMemo(() => {
        const s = new Set()
        if (gitInfo && gitInfo.files) for (const f of gitInfo.files) {
          if (!f.untracked) continue
          let p = norm(f.path)
          if (p.endsWith('/')) p = p.slice(0, -1)
          s.add(p)
        }
        return s
      }, [gitInfo])
      const ignoredSet = React.useMemo(() => {
        const s = new Set()
        if (gitInfo && gitInfo.ignored) for (const p0 of gitInfo.ignored) {
          let p = norm(p0)
          if (p.endsWith('/')) p = p.slice(0, -1)
          s.add(p)
        }
        return s
      }, [gitInfo])

      const visible = React.useMemo(() => {
        if (!diffOnly) return null
        const vis = new Set()
        const walk = (n) => {
          let v = changedSet.has(n.path)
          for (const cp of n.childPaths) {
            const c = tree[cp]
            if (c && walk(c)) v = true
          }
          if (v) vis.add(n.path)
          return v
        }
        if (rootPath && tree[rootPath]) walk(tree[rootPath])
        return vis
      }, [diffOnly, gitInfo, tree, rootPath])

      const base = (p) => {
        const i = p.lastIndexOf('/')
        return i === -1 ? p : p.slice(i + 1)
      }

      const safePatch = (path, patch) => setTree((t) => (t[path] ? Object.assign({}, t, { [path]: Object.assign({}, t[path], patch) }) : t))

      const loadDir = async (dirPath, expand) => {
        setError(null)
        try {
          const r = await api('fm-list', { path: dirPath, sessionId: store.sessionId, root: store.root })
          if (!r || !r.ok) {
            setError((r && r.error) || '加载失败')
            return
          }
          const childPaths = []
          const additions = {}
          for (const e of r.entries) {
            const p = norm(e.path)
            childPaths.push(p)
            additions[p] = { path: p, name: e.name, type: e.type, size: e.size == null ? null : e.size, loaded: false, expanded: false, loading: false, childPaths: [] }
          }
          setTree((t) => {
            const cur = t[dirPath]
            const name = (cur && cur.name) || base(dirPath) || dirPath
            const next = {}
            for (const k of Object.keys(t)) {
              if (cur && cur.childPaths && cur.childPaths.indexOf(k) !== -1 && childPaths.indexOf(k) === -1) continue
              next[k] = t[k]
            }
            return Object.assign(next, additions, {
              [dirPath]: { path: dirPath, name, type: 'directory', size: null, loaded: true, expanded: expand ? true : (cur ? !!cur.expanded : true), loading: false, childPaths },
            })
          })
        } catch (e) {
          setError(e && e.message ? e.message : String(e))
        }
      }

      // 「仅显示变更文件」模式下，树是懒加载的：变更文件所在目录若未加载，
      // 树里就没有对应行。开启筛选（或变更列表刷新）时自动加载并展开所有
      // 变更文件的祖先目录，保证筛选结果完整。
      React.useEffect(() => {
        if (!diffOnly || !gitInfo || !gitInfo.files) return
        const rootNorm = rootPath ? norm(rootPath) : null
        const dirs = new Set()
        for (const f of gitInfo.files) {
          if (f.untracked) continue
          let p = norm(f.path)
          if (p.endsWith('/')) p = p.slice(0, -1)
          let idx = p.lastIndexOf('/')
          while (idx > 0) {
            const dir = p.slice(0, idx)
            if (rootNorm && dir !== rootNorm && dir.indexOf(rootNorm + '/') !== 0) break
            dirs.add(dir)
            idx = dir.lastIndexOf('/')
          }
        }
        ;(async () => {
          for (const d of dirs) {
            const node = treeRef.current[d]
            if (node && node.loaded) {
              if (!node.expanded) safePatch(d, { expanded: true })
              continue
            }
            await loadDir(d, true)
          }
        })()
      }, [diffOnly, gitInfo, rootPath])

      const gitSigRef = React.useRef('')
      const refreshGit = async () => {
        try {
          const r = await api('fm-git-status', { sessionId: store.sessionId, root: store.root })
          if (r && r.ok) {
            // 数据签名一致时跳过 setState，避免每轮轮询都触发整组件重渲染
            const sig = JSON.stringify({ hr: !!r.hasRepo, f: r.files || [], ig: r.ignored || [], ta: r.totalAdded || 0, td: r.totalDeleted || 0 })
            if (gitSigRef.current !== sig) {
              gitSigRef.current = sig
              setGitInfo({ hasRepo: !!r.hasRepo, files: r.files || [], ignored: r.ignored || [], totalAdded: r.totalAdded || 0, totalDeleted: r.totalDeleted || 0 })
            }
          } else {
            if (gitSigRef.current !== 'none') {
              gitSigRef.current = 'none'
              setGitInfo({ hasRepo: false, files: [], ignored: [], totalAdded: 0, totalDeleted: 0 })
            }
          }
        } catch (e) {
          if (gitSigRef.current !== 'err') {
            gitSigRef.current = 'err'
            setGitInfo(null)
          }
        }
      }

      const toggleDir = async (dirPath) => {
        const node = tree[dirPath]
        if (!node) return
        if (!node.loaded) await loadDir(dirPath, true)
        else safePatch(dirPath, { expanded: !node.expanded })
      }

      const navigate = async (dirPath) => {
        store.lastRoot = dirPath
        setRootPath(dirPath)
        await loadDir(dirPath, true)
      }

      const goWorkspaceRoot = async () => {
        store.lastRoot = null
        const target = store.root
        if (target) {
          setRootPath(target)
          await loadDir(target, true)
        }
      }

      React.useEffect(() => {
        if (!open) return
        let cancelled = false
        setBusy(true)
        setError(null)
        ;(async () => {
          try {
            const raw = store.lastRoot || store.root
            const target = raw ? norm(raw) : null
            if (target) {
              setRootPath(target)
              await loadDir(target, true)
            } else {
              const r = await api('fm-root', { root: store.root, sessionId: store.sessionId })
              if (cancelled) return
              const rootPath0 = r && r.root ? norm(r.root) : null
              if (rootPath0) { setRootPath(rootPath0); await loadDir(rootPath0, true) }
              else setError('无法获取工作目录')
            }
            await refreshGit()
          } catch (e) {
            if (!cancelled) setError(e && e.message ? e.message : String(e))
          } finally {
            if (!cancelled) setBusy(false)
          }
        })()
        return () => { cancelled = true }
      }, [open])

      const sigOf = (dirPath, t) => {
        const node = t[dirPath]
        if (!node) return ''
        return node.childPaths.map((p) => {
          const n = t[p]
          return n ? n.name + '|' + n.type + '|' + (n.size == null ? '' : n.size) : p
        }).join(',')
      }

      // 目录轮询与 git 刷新解耦：git 命令慢（如扫描大量未跟踪文件）不再阻塞目录更新
      React.useEffect(() => {
        if (!open || !rootPath) return
        const timer = setInterval(async () => {
          if (pollBusy.current) return
          pollBusy.current = true
          try {
            const t = treeRef.current
            // 只轮询当前视图内（根目录下已展开分支）的已加载目录，且并行请求
            const dirs = []
            const collect = (p) => {
              const n = t[p]
              if (!n || n.type !== 'directory') return
              dirs.push(p)
              if (n.expanded) for (const cp of n.childPaths) collect(cp)
            }
            if (t[rootPath]) collect(rootPath)
            const loaded = dirs.filter((p) => t[p].loaded)
            const stale = (await Promise.all(loaded.map(async (d) => {
              try {
                const r = await api('fm-list', { path: d, sessionId: store.sessionId, root: store.root })
                if (!r || !r.ok) return null
                const fresh = r.entries.map((e) => e.name + '|' + e.type + '|' + (e.size == null ? '' : e.size)).join(',')
                return sigOf(d, treeRef.current) !== fresh ? d : null
              } catch (e) { return null }
            }))).filter(Boolean)
            if (stale.length > 0) {
              await Promise.all(stale.map((d) => loadDir(d)))
              const t2 = treeRef.current
              const prevs = previewsRef.current
              const keep = prevs.filter((p) => t2[p.path])
              if (keep.length !== prevs.length) {
                setPreviews(keep)
                setActiveKey((cur) => (keep.some((p) => p.key === cur) ? cur : (keep.length ? keep[0].key : null)))
              }
            }
          } finally {
            pollBusy.current = false
          }
        }, POLL_MS)
        const gitTimer = setInterval(async () => {
          if (gitBusy.current) return
          gitBusy.current = true
          try {
            await refreshGit()
          } finally {
            gitBusy.current = false
          }
        }, POLL_MS)
        return () => { clearInterval(timer); clearInterval(gitTimer) }
      }, [open, rootPath])

      const listRef = React.useRef(null)
      const updateListFades = () => {
        const el0 = listRef.current
        if (!el0) return
        setListTopFade(el0.scrollTop > 2)
        setListBotFade(el0.scrollTop + el0.clientHeight < el0.scrollHeight - 2)
      }
      React.useEffect(() => {
        if (!open) return
        updateListFades()
      }, [open, tree, rootPath, diffOnly])

      let tabsEl = null
      const hasTabs = previews.length > 0
      React.useEffect(() => {
        if (!hasTabs) return
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
      }, [hasTabs, previews.length, activeKey])

      const openFile = async (entry) => {
        setPreviewVisible(true)
        if (previews.some((p) => p.path === entry.path)) {
          const hit = previews.find((p) => p.path === entry.path)
          setActiveKey(hit.key)
          return
        }
        const key = ++previewSeq
        const isMd = extOf(entry.name) === 'md' || extOf(entry.name) === 'markdown'
        setPreviews((prev) => {
          const next = prev.concat([{ key, path: entry.path, name: entry.name, loading: true, size: null, diff: false, diffData: null, diffUntracked: false, diffUntrackedContent: null, md: isMd }])
          return next.length > MAX_TABS ? next.slice(next.length - MAX_TABS) : next
        })
        setActiveKey(key)
        try {
          const r = await api('fm-read', { path: entry.path, sessionId: store.sessionId, root: store.root })
          if (r && r.ok) {
            let data
            if (r.kind === 'image') {
              data = { kind: 'image', dataUrl: 'data:' + r.mime + ';base64,' + r.base64, size: r.size }
            } else if (r.kind === 'text') {
              const conf = langFor(extOf(entry.name))
              const tokens = r.content && r.content.length <= HL_LIMIT ? tokenize(r.content, conf) : null
              data = { kind: 'text', content: r.content || '', tokens, truncated: !!r.truncated, size: r.size }
            } else if (r.kind === 'tooLarge') {
              data = { kind: 'unsupported', size: r.size, ext: null, message: '文件过大（' + fmtSize(r.size) + '），仅支持预览 512 KB 以内的文本' }
            } else {
              data = { kind: 'unsupported', size: r.size, ext: r.ext, message: null }
            }
            setPreviews((prev) => prev.map((p) => p.key === key ? Object.assign({}, p, data, { loading: false }) : p))
          } else {
            setError((r && r.error) || '读取失败')
            setPreviews((prev) => prev.filter((p) => p.key !== key))
            setActiveKey((cur) => (cur === key ? null : cur))
          }
        } catch (e) {
          setError(e && e.message ? e.message : String(e))
          setPreviews((prev) => prev.filter((p) => p.key !== key))
          setActiveKey((cur) => (cur === key ? null : cur))
        }
      }

      const toggleDiff = async (pv) => {
        const next = !pv.diff
        setPreviews((prev) => prev.map((p) => p.key === pv.key ? Object.assign({}, p, { diff: next }) : p))
        if (next && pv.diffData == null && !pv.diffUntracked) {
          try {
            const r = await api('fm-git-diff', { rel: relOf(pv.path), sessionId: store.sessionId, root: store.root })
            if (r && r.ok) {
              setPreviews((prev) => prev.map((p) => p.key === pv.key ? Object.assign({}, p, { diffData: r.raw, diffUntracked: !!r.untracked, diffUntrackedContent: r.untrackedContent || null }) : p))
            } else {
              setError((r && r.error) || '获取 diff 失败')
            }
          } catch (e) {
            setError(e && e.message ? e.message : String(e))
          }
        }
      }

      const toggleMd = (pv) => {
        setPreviews((prev) => prev.map((p) => p.key === pv.key ? Object.assign({}, p, { md: !p.md }) : p))
      }

      const closeTab = (key) => {
        const idx = previews.findIndex((p) => p.key === key)
        const next = previews.filter((p) => p.key !== key)
        setPreviews(next)
        if (next.length === 0) { setActiveKey(null); setCloseAllConfirm(false) }
        else if (activeKey === key) setActiveKey(next[Math.min(idx, next.length - 1)].key)
      }

      const closeAll = () => { setOpen(false); setPreviews([]); setActiveKey(null); setCloseAllConfirm(false) }

      const doReference = () => {
        if (!menu) return
        const ref = '`' + menu.path + '`'
        const prev = store.draft || ''
        const next = (prev ? prev + '\n' : '') + ref + ' '
        if (store.inputActions) store.inputActions.setDraft(next)
        setMenu(null)
      }

      const doDelete = async () => {
        if (!menu) return
        setBusy(true)
        setError(null)
        try {
          const r = await api('fm-remove', { path: menu.path, sessionId: store.sessionId, root: store.root })
          if (r && r.ok) {
            const deleted = menu.path
            const wasDir = menu.isDir
            setMenu(null)
            const after = previews.filter((p) => p.path !== deleted && !(wasDir && p.path.indexOf(deleted + '/') === 0))
            setPreviews(after)
            const activeTab = previews.find((p) => p.key === activeKey)
            if (activeTab && (activeTab.path === deleted || (wasDir && activeTab.path.indexOf(deleted + '/') === 0))) {
              setActiveKey(after.length ? after[0].key : null)
            }
            if (deleted === rootPath) {
              const i = rootPath.lastIndexOf('/')
              const parent = i > 0 ? rootPath.slice(0, i) : null
              if (parent) navigate(parent)
              else goWorkspaceRoot()
            } else {
              loadDir(rootPath)
            }
          } else setError((r && r.error) || '删除失败')
        } catch (e) { setError(e && e.message ? e.message : String(e)) }
        finally { setBusy(false) }
      }

      const doCommit = async () => {
        const msg = commitMsg.trim()
        if (!msg || commitBusy) return
        setCommitBusy(true)
        setError(null)
        try {
          const r = await api('fm-git-commit', { msg, sessionId: store.sessionId, root: store.root })
          if (r && r.ok) {
            setCommitOpen(false)
            setCommitMsg('')
            await refreshGit()
            loadDir(rootPath)
          } else {
            setError((r && r.error) || '提交失败')
          }
        } catch (e) {
          setError(e && e.message ? e.message : String(e))
        } finally {
          setCommitBusy(false)
        }
      }

      // 注意：activePreview 与 previewBody（useMemo）必须放在 `if (!open) return null` 之前，
      // 否则 open 切换时钩子数量不一致，React 会崩溃导致面板打不开。
      const activePreview = previews.find((p) => p.key === activeKey) || previews[0] || null
      // 性能：预览正文按选项卡记忆化——目录/git 轮询触发的重渲染不再重算
      // Markdown 渲染、diff 解析与大文件语法高亮 span 树（渲染的主要开销）。
      // isChanged 用布尔值作依赖，git 状态无实质变化时不会使记忆失效。
      const isChanged = !!(activePreview && gitMap[activePreview.path])
      const previewBody = React.useMemo(() => {
        const pv = activePreview
        if (!pv) return null
        if (pv.loading) return el('div', { className: 'fm-loading' }, '加载中…')
        if (pv.kind === 'text') {
          return el('div', { className: 'fm-text-body' },
            pv.truncated ? el('div', { className: 'fm-warn' }, '文件较大，仅显示前 512 KB') : null,
            el('div', { className: 'fm-code-wrap' },
              pv.diff
                ? (pv.diffUntracked
                    ? el('div', { className: 'fm-diff' },
                        allAddRows(pv.diffUntrackedContent).length === 0
                          ? el('div', { className: 'fm-diff-empty' }, '（无内容）')
                          : allAddRows(pv.diffUntrackedContent).map((r, i) => el('div', { className: 'fm-diff-row fm-diff-add', key: i },
                              el('span', { className: 'fm-diff-gutter' }, '+'),
                              el('span', { className: 'fm-diff-text' }, r.s || ' '),
                            )),
                      )
                    : pv.diffData != null
                      ? el('div', { className: 'fm-diff' }, parseDiff(pv.diffData).map((r, i) => el('div', { className: 'fm-diff-row fm-diff-' + r.t, key: i },
                          el('span', { className: 'fm-diff-gutter' }, r.t === 'add' ? '+' : r.t === 'del' ? '-' : r.t === 'hunk' ? '@' : ' '),
                          el('span', { className: 'fm-diff-text' }, r.s || ' '),
                        )))
                      : el('div', { className: 'fm-loading' }, '加载 diff 中…')
                  )
                : pv.md
                  ? el('div', { className: 'fm-md' }, mdRender(pv.content))
                  : (pv.tokens
                      ? el('pre', { className: 'fm-code' }, pv.tokens.map((tok, i) => tok.c ? el('span', { className: 'hl-' + tok.c, key: i }, tok.t) : tok.t))
                      : el('pre', { className: 'fm-code' }, pv.content)),
              isChanged ? el('button', {
                className: 'fm-diff-btn' + (pv.diff ? ' fm-diff-btn-on' : ''),
                title: pv.diff ? '退出 Diff 查看' : 'Diff 查看',
                onClick: () => toggleDiff(pv),
              }, iconEl('diff', 14)) : null,
              (extOf(pv.name) === 'md' || extOf(pv.name) === 'markdown') ? el('button', {
                className: 'fm-md-btn' + (pv.md ? ' fm-md-btn-on' : ''),
                title: pv.md ? '文本视图' : '预览渲染',
                onClick: () => toggleMd(pv),
              }, iconEl('md', 14)) : null,
            ),
          )
        }
        if (pv.kind === 'image') {
          return el('div', { className: 'fm-image-wrap' },
            el('img', { className: 'fm-image', src: pv.dataUrl, alt: pv.name }),
          )
        }
        return el('div', { className: 'fm-unsupported' },
          pv.message || ('暂不支持预览该文件类型' + (pv.ext ? '（.' + pv.ext + '）' : '')),
        )
      }, [activePreview, isChanged])

      if (!open) return null

      const goParent = () => {
        if (!rootPath) return
        const i = rootPath.lastIndexOf('/')
        if (i <= 0) return
        navigate(rootPath.slice(0, i))
      }

      const renderNode = (node, depth, parentDim) => {
        const isDir = node.type === 'directory'
        const dim = parentDim || untrackedSet.has(node.path) || ignoredSet.has(node.path)
        if (diffOnly) {
          if (isDir && !visible.has(node.path)) return null
          if (!isDir && !changedSet.has(node.path)) return null
        }
        const kids = sortKids(isDir ? node.childPaths.map((cp) => tree[cp]).filter(Boolean) : [])
        const rowProps = {
          className: 'fm-row' + (dim ? ' fm-untracked' : ''),
          key: node.path,
          style: { paddingLeft: 8 + depth * 20 },
          tabIndex: 0,
          onKeyDown: (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              if (isDir) {
                if (e.ctrlKey || e.metaKey) { if (node.path !== rootPath) navigate(node.path) }
                else toggleDir(node.path)
              } else {
                openFile(node)
              }
            }
          },
          onContextMenu: (e) => {
            e.preventDefault()
            e.stopPropagation()
            setMenu({ x: e.clientX, y: e.clientY, path: node.path, name: node.name, isDir, confirm: false })
          },
        }
        if (isDir) {
          // 手动双击检测：两次单击间隔 ≤ DBL_CLICK_MS 视为双击进入目录。
          // 不用浏览器原生 dblclick（跟随系统设置约 500ms，慢速连续单击会被误判），
          // 缩短到 250ms：故意连续展开/收起两次不会触发，快速双击仍然有效。
          rowProps.onClick = () => {
            const now = Date.now()
            const last = lastDirClick.current
            if (last && last.path === node.path && now - last.time <= DBL_CLICK_MS) {
              lastDirClick.current = null
              if (node.path !== rootPath) navigate(node.path)
              return
            }
            lastDirClick.current = { path: node.path, time: now }
            toggleDir(node.path)
          }
        } else {
          rowProps.onClick = () => openFile(node)
        }
        const g = gitMap[node.path]
        const dg = isDir ? dirGit[node.path] : null
        const row = el('div', rowProps,
          el('span', { className: 'fm-icon' },
            isDir ? el('span', { className: 'fm-chev' + (node.expanded ? ' fm-chev-open' : '') }, iconEl('chevron', 12)) : el('span', { className: 'fm-chev-gap' }),
            isDir ? iconEl('folder', 16) : fileBadge(node.name),
          ),
          el('span', { className: 'fm-name' }, node.name),
          g && !isDir && (g.added > 0 || g.deleted > 0) ? el('span', { className: 'fm-git-diff' },
            g.added > 0 ? el('span', { className: 'fm-git-add' }, '+' + g.added) : null,
            g.deleted > 0 ? el('span', { className: 'fm-git-del' }, '-' + g.deleted) : null,
          ) : null,
          dg ? el('span', { className: 'fm-git-diff', title: dg.count + ' files changed' + (dg.added > 0 ? ', +' + dg.added : '') + (dg.deleted > 0 ? ', -' + dg.deleted : '') },
            el('span', { className: 'fm-git-count' }, dg.count + ' files'),
            dg.added > 0 ? el('span', { className: 'fm-git-add' }, '+' + dg.added) : null,
            dg.deleted > 0 ? el('span', { className: 'fm-git-del' }, '-' + dg.deleted) : null,
          ) : null,
          el('span', { className: 'fm-size' }, fmtSize(node.size)),
        )
        if (!isDir) return row
        return el(React.Fragment, { key: node.path },
          row,
          node.expanded ? kids.map((k) => renderNode(k, depth + 1, dim)) : null,
        )
      }

      const rootNode = rootPath ? tree[rootPath] : undefined
      const head = el('div', { className: 'fm-head' },
        previews.length > 0 ? el('button', {
          className: 'fm-btn fm-eye-btn' + (previewVisible ? ' fm-eye-btn-on' : ' fm-eye-btn-hidden'),
          title: previewVisible ? '隐藏预览窗口' : '显示预览窗口',
          onClick: () => setPreviewVisible(!previewVisible),
        }, iconEl('file-view', 16)) : null,
        el('span', { className: 'fm-title fm-title-click', title: '回到工作目录', onClick: goWorkspaceRoot }, '工作目录'),
        el('span', { className: 'fm-spacer' }),
        el('button', { className: 'fm-btn', title: '关闭', onClick: closeAll }, iconEl('close', 14)),
      )

      const hasChanges = gitInfo && gitInfo.hasRepo && gitInfo.files.length > 0
      const mainPanel = el('div', { className: 'fm-panel' },
        head,
        error ? el('div', { className: 'fm-error' }, error) : null,
        el('div', { className: 'fm-toolbar' },
          el('button', { className: 'fm-btn', title: '上级目录', disabled: !rootPath, onClick: goParent }, iconEl('arrow-up', 14), '上级'),
          el('button', { className: 'fm-btn', title: '刷新', disabled: !rootPath, onClick: () => loadDir(rootPath) }, iconEl('refresh', 14), '刷新'),
          el('span', { className: 'fm-spacer' }),
          gitInfo && gitInfo.hasRepo ? el('div', { className: 'fm-git' },
            el('span', { className: 'fm-git-stat', title: '未提交变更统计' },
              el('span', { className: 'fm-git-add' }, '+' + gitInfo.totalAdded),
              el('span', { className: 'fm-git-del' }, '-' + gitInfo.totalDeleted),
            ),
            hasChanges ? el('button', {
              className: 'fm-git-btn',
              title: '提交变更',
              onClick: () => setCommitOpen(true),
            }, iconEl('commit', 14)) : null,
            el('button', {
              className: 'fm-git-btn' + (diffOnly ? ' fm-git-btn-on' : ''),
              title: diffOnly ? '显示全部文件' : '仅显示变更文件',
              onClick: () => setDiffOnly(!diffOnly),
            }, iconEl('filter', 14)),
          ) : null,
        ),
        el('div', { className: 'fm-hint' }, '单击展开/预览，双击或 Ctrl+Enter 进入目录，右键更多操作'),
        el('div', { className: 'fm-path', title: rootPath }, rootPath || ''),
        busy ? el('div', { className: 'fm-busy' }, '…') : null,
        el('div', {
          className: 'fm-list-wrap' + (listTopFade ? ' fm-list-mask-top' : '') + (listBotFade ? ' fm-list-mask-bot' : ''),
        },
          el('div', {
            className: 'fm-list',
            ref: listRef,
            onScroll: updateListFades,
            onContextMenu: (e) => { e.preventDefault(); setMenu(null) },
          },
            !rootNode ? el('div', { className: 'fm-empty' }, '加载中…')
              : diffOnly && gitInfo === null ? el('div', { className: 'fm-empty' }, '正在统计变更…')
              : diffOnly && !rootNode.childPaths.some((cp) => {
                  const c = tree[cp]
                  if (!c) return false
                  return c.type === 'directory' ? !!visible.has(cp) : changedSet.has(cp)
                }) ? el('div', { className: 'fm-empty' }, '无变更文件')
              : rootNode.childPaths.length === 0 ? el('div', { className: 'fm-empty' }, '此目录为空')
              : renderNode(rootNode, 0),
          ),
        ),
        commitOpen ? el(React.Fragment, null,
          el('div', { className: 'fm-menu-backdrop', onClick: () => setCommitOpen(false) }),
          el('div', { className: 'fm-menu fm-pop2', onClick: (e) => e.stopPropagation() },
            el('div', { className: 'fm-menu-title' }, '提交变更'),
            el('input', {
              className: 'fm-commit-input',
              value: commitMsg,
              placeholder: '提交信息',
              onChange: (e) => setCommitMsg(e.target.value),
              onKeyDown: (e) => {
                if (e.key === 'Enter') { e.preventDefault(); doCommit() }
                if (e.key === 'Escape') setCommitOpen(false)
              },
            }),
            el('div', { className: 'fm-menu-actions' },
              el('button', { className: 'fm-btn fm-btn-danger', disabled: commitBusy || !commitMsg.trim(), onClick: doCommit }, '提交'),
              el('button', { className: 'fm-btn', onClick: () => setCommitOpen(false) }, '取消'),
            ),
          ),
        ) : null,
      )

      const previewPanel = hasTabs && previewVisible ? el('div', { className: 'fm-panel fm-preview' },
        el('div', { className: 'fm-tabbar' },
          el('div', { className: 'fm-tabs-wrap' },
            el('div', { className: 'fm-tabs', ref: (n) => { tabsEl = n } },
              previews.map((tab) => el('div', {
                className: 'fm-tab' + (tab.key === activeKey ? ' fm-tab-on' : ''),
                key: tab.key,
                title: tab.path,
                tabIndex: 0,
                onClick: () => setActiveKey(tab.key),
                onKeyDown: (e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveKey(tab.key) }
                },
              },
                el('span', { className: 'fm-tab-name' }, tab.name),
                el('button', {
                  className: 'fm-tab-close',
                  title: '关闭',
                  onClick: (e) => { e.stopPropagation(); closeTab(tab.key) },
                }, iconEl('close', 11)),
              )),
            ),
            tabLeftFade ? el('div', { className: 'fm-tab-fade fm-tab-fade-left' }) : null,
            tabRightFade ? el('div', { className: 'fm-tab-fade fm-tab-fade-right' }) : null,
          ),
          el('button', {
            className: 'fm-btn fm-tab-closeall',
            title: '关闭全部选项卡',
            onClick: () => setCloseAllConfirm(true),
          }, iconEl('close', 14)),
        ),
        closeAllConfirm ? el(React.Fragment, null,
          el('div', { className: 'fm-menu-backdrop', onClick: () => setCloseAllConfirm(false) }),
          el('div', { className: 'fm-menu fm-pop', onClick: (e) => e.stopPropagation() },
            el('div', { className: 'fm-menu-title' }, '确认关闭全部选项卡？'),
            el('div', { className: 'fm-menu-actions' },
              el('button', {
                className: 'fm-btn fm-btn-danger',
                onClick: () => { setPreviews([]); setActiveKey(null); setCloseAllConfirm(false) },
              }, '确认关闭'),
              el('button', { className: 'fm-btn', onClick: () => setCloseAllConfirm(false) }, '取消'),
            ),
          ),
        ) : null,
        activePreview ? el('div', { className: 'fm-tab-body' }, previewBody) : null,
      ) : null

      const menuEl = menu ? el('div', { className: 'fm-menu-backdrop', onClick: () => setMenu(null), onContextMenu: (e) => { e.preventDefault(); setMenu(null) } },
        el('div', { className: 'fm-menu', style: { left: menu.x, top: menu.y }, onClick: (e) => e.stopPropagation() },
          menu.confirm ? [
            el('div', { className: 'fm-menu-title', key: 't' }, '确认删除“' + menu.name + '”' + (menu.isDir ? '（目录及其内容）' : '') + '？'),
            el('div', { className: 'fm-menu-actions', key: 'a' },
              el('button', { className: 'fm-btn fm-btn-danger', onClick: doDelete }, menu.isDir ? '删除目录' : '删除文件'),
              el('button', { className: 'fm-btn', onClick: () => setMenu(null) }, '取消'),
            ),
          ] : [
            el('div', { className: 'fm-menu-item', key: 'r', tabIndex: 0, onClick: doReference, onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doReference() } } }, iconEl('link', 14), '引用到会话'),
            menu.path === rootPath ? null : el('div', { className: 'fm-menu-item fm-menu-danger', key: 'd', tabIndex: 0, onClick: () => setMenu(Object.assign({}, menu, { confirm: true })), onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMenu(Object.assign({}, menu, { confirm: true })) } } }, iconEl('trash', 14), '删除'),
          ],
        ),
      ) : null

      return el('div', { className: 'fm-container' },
        mainPanel,
        previewPanel,
        menuEl,
      )
    }

    function FilesButton(props) {
      const open = useOpen()
      const p = props || {}
      const sid = p.sessionId
      const cwd = (p.useSessions || (() => null))((state) => {
        const row = state && state.byId ? state.byId[String(sid)] : undefined
        return row && row.cwd ? row.cwd : null
      })
      const draft = (p.useInput || (() => null))((s) => (s && typeof s.draft === 'string' ? s.draft : ''))
      store.draft = draft
      store.inputActions = p.inputActions || null
      return el('button', {
        className: 'fm-files-btn' + (open ? ' fm-files-btn-on' : ''),
        title: '工作目录文件管理器',
        'aria-pressed': open,
        onClick: () => {
          store.sessionId = sid || null
          const rc = cwd ? norm(cwd) : null
          if (store.root !== rc) {
            store.root = rc
            store.lastRoot = null
          }
          setOpen(!store.open)
        },
      }, iconEl('folder', 16), el('span', null, '文件'))
    }

    slots.inject('conversation.session.header.utilities', () => slots.register(
      { name: 'conversation.session.header.utilities', id: 'fm-files', order: 10, label: '文件' },
      (props) => el(FilesButton, props),
    ))

    slots.inject('shell.overlay', () => slots.register(
      { name: 'shell.overlay', id: 'fm-panel', order: 10 },
      () => el(FmPanel, null),
    ))
  },
}
