// git 能力切片：本机是否安装 git + 版本（低频；host 侧 probe 成功后永久缓存，失败 30s 重试）。
// 打开时拉取一次；「安装并初始化仓库」成功后刷新（host setGitBin 后立即生效）。
import React from 'react'
import { api } from '../../core/api.js'
import { store } from '../../core/store.js'
import { FM_METHODS } from '../../shared/contract/index.js'

export function useGitCapability({ open, anchor }) {
  const [cap, setCap] = React.useState(null) // { gitInstalled, gitVersion } | null
  const [capError, setCapError] = React.useState(null)
  const anchorRef = React.useRef(anchor)
  anchorRef.current = anchor
  // 关闭后到达的响应不得污染下一个打开会话（取消标记）
  const cancelledRef = React.useRef(false)

  const load = React.useCallback(async () => {
    const a = anchorRef.current || store.root || null
    if (!a) return
    try {
      const r = await api(FM_METHODS.GIT_CAPABILITY, { sessionId: store.sessionId, root: store.root })
      if (cancelledRef.current) return
      if (r && r.ok) {
        setCap({ gitInstalled: !!r.gitInstalled, gitVersion: r.gitVersion || null })
        setCapError(null)
      } else {
        setCapError((r && (r.message || r.error)) || 'git 探测失败')
      }
    } catch (e) {
      if (!cancelledRef.current) setCapError(e && e.message ? e.message : String(e))
    }
  }, [])

  React.useEffect(() => {
    if (!open) {
      cancelledRef.current = true
      setCap(null)
      setCapError(null)
      return
    }
    cancelledRef.current = false
    load()
  }, [open, load])

  const refreshCapability = React.useCallback(() => {
    setCap(null)
    load()
  }, [load])

  return { gitCap: cap, gitCapError: capError, refreshCapability }
}
