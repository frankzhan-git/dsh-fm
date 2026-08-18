// Markdown 渲染（轻量自定义渲染器）与 Mermaid 图渲染
// 注意：本文件是 mermaid 的唯一引用点，构建时 mermaid 会被内联进 bundle
import React from 'react'
import mermaid from 'mermaid'

const el = React.createElement

let mermaidReady = false
function ensureMermaid() {
  if (mermaidReady) return
  mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict', fontFamily: 'Consolas, "Cascadia Code", Menlo, monospace' })
  mermaidReady = true
}

// 行内格式：`code` / **bold** / *italic* / [text](url)
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

// 块级渲染：标题 / 代码块（mermaid 特殊处理）/ 引用 / 列表 / 表格 / 段落
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

// Mermaid 图：异步渲染为内联 SVG
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

export { mdInline, mdRender, MermaidView }
