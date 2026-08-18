// git diff 文本解析（纯函数）
export const parseDiff = (raw) => {
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

// 未跟踪文件按「全部新增」渲染
export const allAddRows = (content) => String(content == null ? '' : content).split('\n').map((s) => ({ t: 'add', s }))
