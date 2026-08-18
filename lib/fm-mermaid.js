// dsh-fm mermaid 子集渲染器：flowchart / sequenceDiagram / pie → SVG 字符串
// 纯函数模块，无任何服务依赖；与入口解耦以便独立维护与测试。
// （前端 client bundle 已内联官方 mermaid.js，此模块仅作为后备渲染通道保留）

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function parseStmts(code) {
  const out = []
  for (let raw of String(code).split('\n')) {
    raw = raw.trim()
    if (!raw || raw[0] === '%') continue
    raw = raw.replace(/\s*%%.*$/, '')
    const parts = raw.split(';')
    for (const p of parts) { const s = p.trim(); if (s) out.push(s) }
  }
  return out
}
function parseNode(s) {
  let m = s.match(/^([A-Za-z0-9_]+)\s*\[\s*([^\]]*)\s*\]\s*$/)
  if (m) return { id: m[1], text: m[2].trim(), shape: 'rect' }
  m = s.match(/^([A-Za-z0-9_]+)\s*\{\s*([^}]*)\s*\}\s*$/)
  if (m) return { id: m[1], text: m[2].trim(), shape: 'diamond' }
  m = s.match(/^([A-Za-z0-9_]+)\s*\(\s*\(\s*([^)]*)\s*\)\s*\)\s*$/)
  if (m) return { id: m[1], text: m[2].trim(), shape: 'circle' }
  m = s.match(/^([A-Za-z0-9_]+)\s*\(\s*([^)]*)\s*\)\s*$/)
  if (m) return { id: m[1], text: m[2].trim(), shape: 'round' }
  m = s.match(/^([A-Za-z0-9_]+)\s*>\s*([^\]]*)\]\s*$/)
  if (m) return { id: m[1], text: m[2].trim(), shape: 'asym' }
  m = s.match(/^([A-Za-z0-9_]+)\s*$/)
  if (m) return { id: m[1], text: m[1], shape: 'rect' }
  return null
}
function parseLink(s) {
  const m = s.match(/^([A-Za-z0-9_]+)\s+(.*?)\s+([A-Za-z0-9_]+)$/)
  if (!m) return null
  const from = m[1]
  const to = m[3]
  const mid = m[2]
  let label = null
  let kind = null
  const lm = mid.match(/^\|\s*([^|]*)\s*\|\s*(.*)$/)
  if (lm) {
    label = lm[1].trim()
    kind = lm[2].trim()
  } else {
    const lm2 = mid.match(/^(--|==|-\.-)\s+(.+?)\s+(-->|==>|->)$/)
    if (lm2) {
      label = lm2[2].trim()
      const pair = lm2[1] + '|' + lm2[3]
      kind = pair === '--|-->' ? 'arrow' : pair === '==|==>' ? 'tarrow' : pair === '-.-|->' ? 'darrow' : null
    } else {
      kind = mid
    }
  }
  if (kind === '-->') kind = 'arrow'
  else if (kind === '---') kind = 'line'
  else if (kind === '==>') kind = 'tarrow'
  else if (kind === '===') kind = 'tline'
  else if (kind === '-.->') kind = 'darrow'
  else if (kind === '-.-') kind = 'dline'
  if (!kind) return null
  return { from, to, kind, label }
}
function nodeSize(n) {
  const tw = n.text ? n.text.length * 8 : 8
  const w = Math.max(64, tw + 24)
  switch (n.shape) {
    case 'diamond': return { w: Math.max(w, 80), h: 48 }
    case 'circle': return { w: Math.max(56, tw + 20), h: Math.max(56, tw + 20) }
    case 'round': return { w, h: 40 }
    case 'asym': return { w, h: 40 }
    default: return { w, h: 40 }
  }
}
function layoutFlow(nodes, links) {
  const layer = {}
  const indeg = {}
  for (const l of links) indeg[l.to] = (indeg[l.to] || 0) + 1
  const visited = new Set()
  const queue = []
  for (const n of nodes) if (!indeg[n.id]) { layer[n.id] = 0; queue.push(n.id); visited.add(n.id) }
  for (const n of nodes) if (!visited.has(n.id)) { layer[n.id] = 0; queue.push(n.id); visited.add(n.id) }
  while (queue.length) {
    const cur = queue.shift()
    const lv = (layer[cur] || 0) + 1
    for (const l of links) if (l.from === cur && !visited.has(l.to)) { layer[l.to] = lv; queue.push(l.to); visited.add(l.to) }
  }
  const groups = []
  for (const n of nodes) {
    const lv = layer[n.id] || 0
    ;(groups[lv] = groups[lv] || []).push(n)
  }
  return groups
}
function flowchartSvg(stmts, dir) {
  const nodes = []
  const links = []
  const byId = {}
  const addN = (id) => { if (!byId[id]) { const n = { id, text: id, shape: 'rect' }; byId[id] = n; nodes.push(n) } }
  for (const s of stmts) {
    const l = parseLink(s)
    if (l) { links.push(l); addN(l.from); addN(l.to); continue }
    const n = parseNode(s)
    if (n && !byId[n.id]) { byId[n.id] = n; nodes.push(n) }
  }
  if (!nodes.length) throw new Error('没有可渲染的节点')
  const groups = layoutFlow(nodes, links)
  const horizontal = dir === 'LR'
  const gapX = 40
  const gapY = 90
  const sizes = {}
  for (const n of nodes) sizes[n.id] = nodeSize(n)
  const pos = {}
  const layerExtent = []
  for (let g = 0; g < groups.length; g++) {
    let acc = 0
    let maxH = 0
    for (const n of groups[g]) { maxH = Math.max(maxH, sizes[n.id].h) }
    for (const n of groups[g]) {
      pos[n.id] = { a: acc, b: maxH }
      acc += sizes[n.id].w + gapX
    }
    layerExtent.push({ w: acc - gapX, h: maxH })
  }
  let totalW = 0
  let totalH = 0
  for (const e of layerExtent) { totalW = Math.max(totalW, e.w); totalH += e.h + gapY }
  totalH -= gapY
  const PAD = 40
  const W = totalW + PAD * 2
  const H = totalH + PAD * 2
  const cx = {}
  const cy = {}
  let yAcc = PAD
  for (let g = 0; g < groups.length; g++) {
    const e = layerExtent[g]
    let xAcc = PAD + (totalW - e.w) / 2
    for (const n of groups[g]) {
      const s = sizes[n.id]
      if (horizontal) {
        cx[n.id] = yAcc + s.h / 2
        cy[n.id] = xAcc + s.w / 2
      } else {
        cx[n.id] = xAcc + s.w / 2
        cy[n.id] = yAcc + s.h / 2
      }
      xAcc += s.w + gapX
    }
    yAcc += e.h + gapY
  }
  const parts = []
  parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" font-family="Consolas,\'Cascadia Code\',Menlo,monospace" font-size="12">')
  parts.push('<defs><marker id="fm-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#8b95a7"/></marker></defs>')
  for (const l of links) {
    const a = byId[l.from]
    const b = byId[l.to]
    if (!a || !b) continue
    const sa = sizes[l.from]
    const sb = sizes[l.to]
    let x1, y1, x2, y2
    if (horizontal) {
      x1 = cx[l.from] + sa.w / 2; y1 = cy[l.from]
      x2 = cx[l.to] - sb.w / 2; y2 = cy[l.to]
    } else {
      x1 = cx[l.from]; y1 = cy[l.from] + sa.h / 2
      x2 = cx[l.to]; y2 = cy[l.to] - sb.h / 2
    }
    const dx = x2 - x1
    const dy = y2 - y1
    const dash = (l.kind === 'darrow' || l.kind === 'dline') ? ' stroke-dasharray="6,4"' : ''
    const thick = (l.kind === 'tarrow' || l.kind === 'tline') ? ' stroke-width="3"' : ''
    const marker = (l.kind === 'arrow' || l.kind === 'darrow' || l.kind === 'tarrow') ? ' marker-end="url(#fm-arr)"' : ''
    const stroke = '#8b95a7'
    if (Math.abs(dy) < 1 || Math.abs(dx) < 1) {
      parts.push('<path d="M' + x1 + ',' + y1 + ' L' + x2 + ',' + y2 + '" fill="none" stroke="' + stroke + '"' + dash + thick + marker + '/>')
    } else {
      const mx = x1 + dx * 0.5
      const my = y1 + dy * 0.5
      parts.push('<path d="M' + x1 + ',' + y1 + ' C' + mx + ',' + y1 + ' ' + mx + ',' + y2 + ' ' + x2 + ',' + y2 + '" fill="none" stroke="' + stroke + '"' + dash + thick + marker + '/>')
    }
    if (l.label) {
      const lx = x1 + dx * 0.5
      const ly = y1 + dy * 0.5
      const lw = l.label.length * 7 + 12
      parts.push('<rect x="' + (lx - lw / 2) + '" y="' + (ly - 12) + '" width="' + lw + '" height="17" rx="4" fill="#1a1e26" stroke="none"/>')
      parts.push('<text x="' + lx + '" y="' + (ly - 3) + '" text-anchor="middle" fill="#8b95a7">' + esc(l.label) + '</text>')
    }
  }
  for (const n of nodes) {
    const s = sizes[n.id]
    const x = cx[n.id] - s.w / 2
    const y = cy[n.id] - s.h / 2
    const tx = cx[n.id]
    const ty = cy[n.id]
    const fill = '#232833'
    const stroke = '#4a5160'
    switch (n.shape) {
      case 'diamond':
        parts.push('<polygon points="' + tx + ',' + y + ' ' + (x + s.w) + ',' + ty + ' ' + tx + ',' + (y + s.h) + ' ' + x + ',' + ty + '" fill="' + fill + '" stroke="' + stroke + '"/>')
        break
      case 'circle':
        parts.push('<circle cx="' + tx + '" cy="' + ty + '" r="' + (s.w / 2) + '" fill="' + fill + '" stroke="' + stroke + '"/>')
        break
      case 'round':
        parts.push('<rect x="' + x + '" y="' + y + '" width="' + s.w + '" height="' + s.h + '" rx="14" fill="' + fill + '" stroke="' + stroke + '"/>')
        break
      case 'asym':
        parts.push('<polygon points="' + x + ',' + y + ' ' + (x + s.w - 12) + ',' + y + ' ' + (x + s.w) + ',' + ty + ' ' + (x + s.w - 12) + ',' + (y + s.h) + ' ' + x + ',' + (y + s.h) + '" fill="' + fill + '" stroke="' + stroke + '"/>')
        break
      default:
        parts.push('<rect x="' + x + '" y="' + y + '" width="' + s.w + '" height="' + s.h + '" rx="6" fill="' + fill + '" stroke="' + stroke + '"/>')
    }
    if (n.text) {
      const lines = String(n.text).split(/<br\/>|\\n/i)
      const lh = 16
      const startY = ty - ((lines.length - 1) * lh) / 2
      lines.forEach((ln, idx) => {
        parts.push('<text x="' + tx + '" y="' + (startY + idx * lh + 4) + '" text-anchor="middle" fill="#e2e8f0">' + esc(ln) + '</text>')
      })
    }
  }
  parts.push('</svg>')
  return parts.join('')
}
function sequenceSvg(stmts) {
  const order = []
  const aliases = {}
  const rows = []
  let title = null
  const addP = (id, label) => { if (order.indexOf(id) === -1) order.push(id); if (label) aliases[id] = label }
  for (const s of stmts) {
    let m = s.match(/^(?:participant|actor)\s+([A-Za-z0-9_]+)(?:\s+as\s+(.+))?$/i)
    if (m) { addP(m[1], m[2] ? m[2].trim() : null); continue }
    m = s.match(/^title\s+(.+)$/i)
    if (m) { title = m[1].trim(); continue }
    m = s.match(/^([A-Za-z0-9_]+)\s*(->>|-->>|->|-->)\s*([A-Za-z0-9_]+)\s*:\s*(.*)$/)
    if (m) { addP(m[1]); addP(m[3]); rows.push({ t: 'msg', from: m[1], to: m[3], arrow: m[2], text: m[4].trim() }); continue }
    m = s.match(/^Note\s+(right of|left of|over)\s+([A-Za-z0-9_]+)(?:,\s*([A-Za-z0-9_]+))?\s*:\s*(.*)$/i)
    if (m) { if (m[2]) addP(m[2]); if (m[3]) addP(m[3]); rows.push({ t: 'note', pos: m[1].toLowerCase(), a: m[2], b: m[3], text: m[4].trim() }); continue }
    if (/^(alt|loop|opt|par|else)\b/i.test(s)) {
      const kw = s.split(/\s+/)[0]
      const rest = s.slice(kw.length).trim()
      rows.push({ t: 'open', kw: kw.toLowerCase(), text: rest })
      continue
    }
    if (/^end\s*$/i.test(s)) { rows.push({ t: 'close' }); continue }
  }
  if (!order.length) throw new Error('没有参与者')
  const W = Math.max(640, order.length * 140 + 80)
  const headH = 70
  const rowH = 30
  const H = headH + rows.length * rowH + 34
  const xs = {}
  const span = W - 60
  order.forEach((id, i) => { xs[id] = 30 + (span * (i + 0.5)) / order.length })
  const parts = []
  parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" font-family="Consolas,\'Cascadia Code\',Menlo,monospace" font-size="12">')
  if (title) parts.push('<text x="' + (W / 2) + '" y="18" text-anchor="middle" fill="#e2e8f0" font-size="14" font-weight="600">' + esc(title) + '</text>')
  const lifeTop = headH
  const lifeBot = H - 10
  for (const id of order) parts.push('<line x1="' + xs[id] + '" y1="' + lifeTop + '" x2="' + xs[id] + '" y2="' + lifeBot + '" stroke="#3a4150" stroke-width="1"/>')
  order.forEach((id) => {
    const label = aliases[id] || id
    const bx = xs[id] - 50
    parts.push('<rect x="' + bx + '" y="26" width="100" height="30" rx="6" fill="#232833" stroke="#4a5160"/>')
    parts.push('<text x="' + xs[id] + '" y="46" text-anchor="middle" fill="#e2e8f0">' + esc(label) + '</text>')
  })
  let y = headH
  let indent = 0
  for (const r of rows) {
    if (r.t === 'open') {
      y += rowH
      const txt = (r.kw === 'else' ? 'else ' : r.kw + ' ') + r.text
      parts.push('<text x="' + (30 + indent * 14) + '" y="' + (y - 8) + '" fill="#8b95a7" font-size="12" font-style="italic">' + esc(txt) + '</text>')
      indent++
      continue
    }
    if (r.t === 'close') { indent = Math.max(0, indent - 1); y += rowH; continue }
    if (r.t === 'note') {
      y += rowH
      const x1 = xs[r.a]
      const x2 = r.b ? xs[r.b] : x1
      const nx = Math.min(x1, x2) - 60
      const nw = Math.abs(x2 - x1) + 120
      parts.push('<rect x="' + nx + '" y="' + (y - 30) + '" width="' + nw + '" height="26" rx="5" fill="#232833" stroke="#4a5160"/>')
      parts.push('<text x="' + (nx + nw / 2) + '" y="' + (y - 11) + '" text-anchor="middle" fill="#e2e8f0" font-size="11">' + esc(r.text) + '</text>')
      y += 4
      continue
    }
    y += rowH
    const x1 = xs[r.from]
    const x2 = xs[r.to]
    const dashed = r.arrow.indexOf('--') === 0 ? ' stroke-dasharray="6,4"' : ''
    const arrowed = r.arrow.indexOf('>>') !== -1
    const stroke = '#8b95a7'
    parts.push('<line x1="' + x1 + '" y1="' + (y - 6) + '" x2="' + x2 + '" y2="' + (y - 6) + '" stroke="' + stroke + '"' + dashed + '/>')
    if (arrowed) {
      const dir = x2 >= x1 ? 1 : -1
      parts.push('<polygon points="' + x2 + ',' + (y - 6) + ' ' + (x2 - dir * 7) + ',' + (y - 10) + ' ' + (x2 - dir * 7) + ',' + (y - 2) + '" fill="' + stroke + '"/>')
    }
    parts.push('<text x="' + ((x1 + x2) / 2) + '" y="' + (y - 16) + '" text-anchor="middle" fill="#e2e8f0" font-size="11">' + esc(r.text) + '</text>')
  }
  parts.push('</svg>')
  return parts.join('')
}
function pieSvg(stmts) {
  let title = null
  const items = []
  for (const s of stmts) {
    const tm = s.match(/^title\s+(.+)$/i)
    if (tm) { title = tm[1].trim(); continue }
    const m = s.match(/^"([^"]+)"\s*:\s*([\d.]+)\s*$/)
    if (m) items.push({ label: m[1], value: parseFloat(m[2]) })
  }
  if (!items.length) throw new Error('没有数据')
  const total = items.reduce((a, b) => a + b.value, 0)
  if (!total) throw new Error('数据总和为零')
  const cx = 150
  const cy = 150
  const r = 90
  const COLORS = ['#6ea8ff', '#3fb950', '#f85149', '#fbbf24', '#c586c0', '#dcdcaa', '#569cd6', '#9cdcfe', '#ffb13b', '#7f52ff']
  const parts = []
  const W = 340
  const H = 320 + items.length * 20
  parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" font-family="Consolas,\'Cascadia Code\',Menlo,monospace" font-size="12">')
  if (title) parts.push('<text x="' + (W / 2) + '" y="24" text-anchor="middle" fill="#e2e8f0" font-size="14" font-weight="600">' + esc(title) + '</text>')
  let ang = -Math.PI / 2
  items.forEach((it, i) => {
    const frac = it.value / total
    const a2 = ang + frac * Math.PI * 2
    const large = frac > 0.5 ? 1 : 0
    const x1 = cx + r * Math.cos(ang)
    const y1 = cy + r * Math.sin(ang)
    const x2 = cx + r * Math.cos(a2)
    const y2 = cy + r * Math.sin(a2)
    parts.push('<path d="M' + cx + ',' + cy + ' L' + x1 + ',' + y1 + ' A' + r + ',' + r + ' 0 ' + large + ' 1 ' + x2 + ',' + y2 + ' Z" fill="' + COLORS[i % COLORS.length] + '" stroke="#1a1e26" stroke-width="2"/>')
    const mid = (ang + a2) / 2
    const lx = cx + r * 0.65 * Math.cos(mid)
    const ly = cy + r * 0.65 * Math.sin(mid)
    parts.push('<text x="' + lx + '" y="' + (ly + 4) + '" text-anchor="middle" fill="#1a1e26" font-size="11" font-weight="600">' + Math.round(frac * 100) + '%</text>')
    ang = a2
  })
  let ly = 320
  items.forEach((it, i) => {
    parts.push('<rect x="40" y="' + ly + '" width="10" height="10" rx="2" fill="' + COLORS[i % COLORS.length] + '"/>')
    parts.push('<text x="58" y="' + (ly + 9) + '" fill="#e2e8f0" font-size="11">' + esc(it.label) + ' — ' + Math.round((it.value / total) * 100) + '%</text>')
    ly += 20
  })
  parts.push('</svg>')
  return parts.join('')
}

// 入口：mermaid 代码 → SVG 字符串（flowchart / sequenceDiagram / pie）
export function mermaidSvg(code) {
  const stmts = parseStmts(code)
  if (!stmts.length) throw new Error('空的 mermaid 代码')
  const first = stmts[0]
  let m = first.match(/^(flowchart|graph)\s+(TD|LR|RL|BT)\s*$/i)
  if (m) return flowchartSvg(stmts.slice(1), m[2].toUpperCase())
  m = first.match(/^(flowchart|graph)\s*$/i)
  if (m) return flowchartSvg(stmts.slice(1), 'TD')
  if (/^sequenceDiagram\s*$/i.test(first)) return sequenceSvg(stmts.slice(1))
  if (/^pie\s*$/i.test(first)) return pieSvg(stmts.slice(1))
  if (/^pie\s+/i.test(first)) return pieSvg(stmts)
  throw new Error('暂不支持该 mermaid 类型：' + first)
}
