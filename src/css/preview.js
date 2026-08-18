// 右侧预览列：选项卡栏（含关闭全部按钮）、正文（代码/diff/markdown/图片/不支持）
export const PREVIEW_CSS = `
.fm-tabbar {
  flex: none;
  display: flex; align-items: center; gap: 8px;
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
`
