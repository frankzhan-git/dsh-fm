// 共享 RPC 契约：host（lib/）与 client（src/）共用的方法名常量与参数说明。
// 单一副本：host 经 Node ESM 直接 import，client 经 esbuild 打包进 bundle；
// 业务代码中禁止再出现 'fm-xxx' 裸字符串方法名（引用 FM_METHODS 常量）。
export const FM_METHODS = {
  ROOT: 'fm-root',
  LIST: 'fm-list',
  READ: 'fm-read',
  REMOVE: 'fm-remove',
  GIT_STATUS: 'fm-git-status',
  GIT_DIFF: 'fm-git-diff',
  GIT_COMMIT: 'fm-git-commit',
  GIT_INIT: 'fm-git-init',
  GIT_INSTALL_INIT: 'fm-git-install-init',
  GIT_INDEX_SET: 'fm-git-index-set',
}

// 每个方法允许的入参键（供校验与文档参考）。
// 约定：root 可省略（回退到会话 cwd / sandbox workspaceRoot）；path 为工作区内路径。
export const FM_ARGS = {
  [FM_METHODS.ROOT]: ['root', 'sessionId'],
  [FM_METHODS.LIST]: ['path', 'root', 'sessionId'],
  [FM_METHODS.READ]: ['path', 'name', 'root', 'sessionId'],
  [FM_METHODS.REMOVE]: ['path', 'root', 'sessionId'],
  [FM_METHODS.GIT_STATUS]: ['root', 'sessionId'],
  [FM_METHODS.GIT_DIFF]: ['rel', 'root', 'sessionId'],
  [FM_METHODS.GIT_COMMIT]: ['msg', 'root', 'sessionId'],
  [FM_METHODS.GIT_INIT]: ['root', 'sessionId'],
  [FM_METHODS.GIT_INSTALL_INIT]: ['root', 'sessionId'],
  [FM_METHODS.GIT_INDEX_SET]: ['path', 'checked', 'recursive', 'probe', 'root', 'sessionId'],
}

// webServer 路由路径（client fetch 与 host 注册共用）
export const FM_ROUTE = '/api/fm'
