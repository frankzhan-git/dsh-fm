// dsh-fm RPC 契约：方法名常量与参数声明（单一副本，host/client/test 仅经此引用）。
// 2026-09 架构根治新增：fm-git-context（锚点→仓库，零 shell）与 fm-git-capability（探测，低频）。
export const FM_METHODS = {
  ROOT: 'fm-root',
  LIST: 'fm-list',
  READ: 'fm-read',
  REMOVE: 'fm-remove',
  GIT_STATUS: 'fm-git-status',
  GIT_CONTEXT: 'fm-git-context',
  GIT_CAPABILITY: 'fm-git-capability',
  GIT_DIFF: 'fm-git-diff',
  GIT_COMMIT: 'fm-git-commit',
  GIT_INIT: 'fm-git-init',
  GIT_INSTALL_INIT: 'fm-git-install-init',
  GIT_INDEX_SET: 'fm-git-index-set',
}

// 每个方法允许的入参键（供校验与文档参考）。
// 约定：root 可省略（回退到会话 cwd / workspaceRegistry / sandbox workspaceRoot）；
// path 为工作区内路径；anchor 为文件管理器当前根目录（视图锚点）。
export const FM_ARGS = {
  [FM_METHODS.ROOT]: ['root', 'sessionId'],
  [FM_METHODS.LIST]: ['path', 'root', 'sessionId'],
  [FM_METHODS.READ]: ['path', 'name', 'root', 'sessionId'],
  [FM_METHODS.REMOVE]: ['path', 'root', 'sessionId'],
  [FM_METHODS.GIT_STATUS]: ['root', 'sessionId', 'anchor'],
  [FM_METHODS.GIT_CONTEXT]: ['root', 'sessionId', 'anchor'],
  [FM_METHODS.GIT_CAPABILITY]: ['root', 'sessionId'],
  [FM_METHODS.GIT_DIFF]: ['rel', 'path', 'root', 'sessionId'],
  [FM_METHODS.GIT_COMMIT]: ['msg', 'root', 'sessionId', 'anchor'],
  [FM_METHODS.GIT_INIT]: ['root', 'sessionId', 'anchor'],
  [FM_METHODS.GIT_INSTALL_INIT]: ['root', 'sessionId', 'anchor'],
  [FM_METHODS.GIT_INDEX_SET]: ['path', 'checked', 'recursive', 'probe', 'root', 'sessionId', 'anchor'],
}
