// 预览列：头部（关闭按钮）+ 选项卡栏 + 正文 / 空态
// 正文按选项卡记忆化（轮询触发的重渲染不重算 Markdown/diff/高亮）
import React from 'react'
import { IconBrowseOutline16, IconCloseOutline16, IconCodeOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import { TabBar } from './TabBar.js'
import { mdRender } from './Markdown.js'
import { parseDiff, allAddRows } from '../core/diff.js'
import { langFor, tokenize } from '../core/highlight.js'
import { extOf } from '../core/format.js'
import { HL_LIMIT } from '../core/constants.js'

const el = React.createElement

export function PreviewPanel(props) {
  const { pv, gitMap, closeBtnRef, onCloseModal } = props
  const { previews, activeKey, setActiveKey, activePreview, toggleDiff, toggleMd, closeTab, closeRange, closeOthers, closeAllTabs } = pv

  const isChanged = !!(activePreview && gitMap[activePreview.path])
  const previewBody = React.useMemo(() => {
    const pv0 = activePreview
    if (!pv0) return null
    if (pv0.loading) return el('div', { className: 'fm-loading' }, '加载中…')
    if (pv0.kind === 'text') {
      return el('div', { className: 'fm-text-body' },
        pv0.truncated ? el('div', { className: 'fm-warn' }, '文件较大，仅显示前 512 KB') : null,
        el('div', { className: 'fm-code-wrap' },
          pv0.diff
            ? (pv0.diffUntracked
                ? el('div', { className: 'fm-diff' },
                    allAddRows(pv0.diffUntrackedContent).length === 0
                      ? el('div', { className: 'fm-diff-empty' }, '（无内容）')
                      : allAddRows(pv0.diffUntrackedContent).map((r, i) => el('div', { className: 'fm-diff-row fm-diff-add', key: i },
                          el('span', { className: 'fm-diff-gutter' }, '+'),
                          el('span', { className: 'fm-diff-text' }, r.s || ' '),
                        )),
                  )
                : pv0.diffData != null
                  ? el('div', { className: 'fm-diff' }, parseDiff(pv0.diffData).map((r, i) => el('div', { className: 'fm-diff-row fm-diff-' + r.t, key: i },
                      el('span', { className: 'fm-diff-gutter' }, r.t === 'add' ? '+' : r.t === 'del' ? '-' : r.t === 'hunk' ? '@' : ' '),
                      el('span', { className: 'fm-diff-text' }, r.s || ' '),
                    )))
                  : el('div', { className: 'fm-loading' }, '加载 diff 中…')
              )
            : pv0.md
              ? el('div', { className: 'fm-md' }, mdRender(pv0.content))
              : (pv0.tokens
                  ? el('pre', { className: 'fm-code' }, pv0.tokens.map((tok, i) => tok.c ? el('span', { className: 'hl-' + tok.c, key: i }, tok.t) : tok.t))
                  : el('pre', { className: 'fm-code' }, pv0.content)),
          isChanged ? el('button', {
            className: 'fm-diff-btn' + (pv0.diff ? ' fm-diff-btn-on' : ''),
            title: pv0.diff ? '退出 Diff 查看' : 'Diff 查看',
            onClick: () => toggleDiff(pv0),
          }, el(IconCodeOutline16, { size: 14 })) : null,
          (extOf(pv0.name) === 'md' || extOf(pv0.name) === 'markdown') ? el('button', {
            className: 'fm-md-btn' + (pv0.md ? ' fm-md-btn-on' : ''),
            title: pv0.md ? '文本视图' : '预览渲染',
            onClick: () => toggleMd(pv0),
          }, el(IconBrowseOutline16, { size: 14 })) : null,
        ),
      )
    }
    if (pv0.kind === 'image') {
      return el('div', { className: 'fm-image-wrap' },
        el('img', { className: 'fm-image', src: pv0.dataUrl, alt: pv0.name }),
      )
    }
    return el('div', { className: 'fm-unsupported' },
      pv0.message || ('暂不支持预览该文件类型' + (pv0.ext ? '（.' + pv0.ext + '）' : '')),
    )
  }, [activePreview, isChanged])

  return el('div', { className: 'fm-col-preview' },
    el('div', { className: 'fm-preview-head' },
      el('span', { className: 'fm-spacer' }),
      el('button', {
        className: 'fm-modal-close',
        title: '关闭',
        ref: closeBtnRef,
        onClick: onCloseModal,
      }, el(IconCloseOutline16, { size: 14 })),
    ),
    el(TabBar, {
      previews, activeKey,
      onSelect: setActiveKey,
      onCloseTab: closeTab,
      onCloseRange: closeRange,
      onCloseOthers: closeOthers,
      onCloseAllTabs: closeAllTabs,
    }),
    activePreview ? el('div', { className: 'fm-tab-body' }, previewBody)
      : el('div', { className: 'fm-empty-preview' },
          el('span', { className: 'fm-empty-preview-icon' }, el(IconBrowseOutline16, { size: 24 })),
          el('div', { className: 'fm-empty-preview-title' }, '未打开文件'),
          el('div', { className: 'fm-empty-preview-sub' }, '在左侧文件树中单击文件即可预览'),
        ),
  )
}
