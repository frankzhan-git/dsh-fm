// 路径 / 大小 / 排序等纯工具函数（零依赖）
export const norm = (p) => String(p).replace(/\\/g, '/')

export const fmtSize = (n) => {
  if (n == null) return ''
  if (n < 1024) return n + ' B'
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1048576).toFixed(1) + ' MB'
}

export const base = (p) => {
  const i = p.lastIndexOf('/')
  return i === -1 ? p : p.slice(i + 1)
}

export const extOf = (name) => {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

// 树排序：目录优先，名称数字感知；文件按扩展名分组后按名称
export const sortKids = (list) => list.slice().sort((a, b) => {
  const ad = a.type === 'directory' ? 0 : 1
  const bd = b.type === 'directory' ? 0 : 1
  if (ad !== bd) return ad - bd
  if (ad === 0) return a.name.localeCompare(b.name, 'zh', { numeric: true })
  const ec = extOf(a.name).localeCompare(extOf(b.name))
  if (ec !== 0) return ec
  return a.name.localeCompare(b.name, 'zh', { numeric: true })
})

// 相对工作区根的路径（供 git diff 等接口使用）
export const relOf = (root, p) => {
  const r = root || ''
  if (r && p.indexOf(r + '/') === 0) return p.slice(r.length + 1)
  return p
}

// 精简路径显示：超过阈值只保留末尾的完整段（防长路径换行），
// 完整路径由调用方放入 title；null/空/短路径原样返回
export const shortPath = (p, max = 44) => {
  if (!p || p.length <= max) return p
  let tail = p.slice(-(max - 2))
  const i = tail.indexOf('/')
  if (i > 0) tail = tail.slice(i + 1)
  else if (i === 0) tail = tail.slice(1)
  return '…/' + tail
}
