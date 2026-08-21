// 工作区状态机组合层：useFmTree（文件树/轮询）+ useFmGit（git 状态/筛选/可见性）。
// 对外接口与拆分前完全一致（rootPath/tree/treeRef/gitInfo/diffOnly/...），
// 组件无需感知内部拆分；新功能按域落在对应 hook。
import { useFmTree } from './useFmTree.js'
import { useFmGit } from './useFmGit.js'

export function useFmWorkspace(opts) {
  const { open, onError, onBusy, pruneMissing } = opts || {}
  const tree = useFmTree({ open, onError, onBusy, pruneMissing })
  const git = useFmGit({
    open,
    onError,
    rootPath: tree.rootPath,
    tree: tree.tree,
    treeRef: tree.treeRef,
    loadDir: tree.loadDir,
    safePatch: tree.safePatch,
  })
  return Object.assign({}, tree, git)
}
