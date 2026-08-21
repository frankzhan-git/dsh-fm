# Changelog

## [0.4.0] — 架构重构版

### 架构重构
- **host 领域拆分**：`lib/fm-core.js` 单体 → `lib/fm-core/` 目录（shell 命令端口 / fs 文件域 / git 域 / git-install 安装域 / git-index 索引域 / index 工厂组装），保留兼容转发层
- **共享 RPC 契约**：新增 `src/shared/fm-contract.js`，host 与 client 单一副本（方法名常量 + 参数说明 + 路由），业务代码禁止裸字符串方法名；`api.js` 运行时校验
- **客户端状态重构**：`useFmWorkspace` 拆为 `useFmTree`（树/轮询）+ `useFmGit`（git/筛选/可见性），组合层对外接口不变；`store.js` 收敛（删除无设置者的 `draft`/`inputActions` 残留）
- **组件瘦身**：`TreePanel` 拆出 `FileRow` / `CommitDialog` / `IndexAskDialog`
- **死代码清理**：删除 host 侧 `fm-mermaid.js` 与 `fm-mermaid-render` RPC（client 官方 mermaid 已全覆盖）

### 工程化
- **测试地基**：`node:test` 36 用例——.gitignore 解析、包管理器表、MinGit 架构、format/diff/highlight 纯函数、契约完整性、git 命令端口（fake shell 注入，验证双 shell 兼容命令串）
- **构建产物移出 git 跟踪**：`lib/client.js` 由 `npm run build` 生成；安装包从 Releases 下载或自行构建
- **发布快照脚本化**：`scripts/sync-release.mjs` 一键同步源码 → `dsh-fm-release/`（含最新构建产物）
- **父仓库解除跟踪**：`dsh-fm-plugin/` 与 `dsh-fm-release/` 由独立仓库（github.com/frankzhan-git/dsh-fm）维护
