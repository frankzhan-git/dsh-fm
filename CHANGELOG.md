# Changelog

## [0.6.0] — 入口迁移与稳定性修复

### 交互调整
- **入口迁移**：文件入口从侧边栏底部移到**会话输入框工具行**（`conversation.input.left`，与画布插件同区同形，26×26 图标按钮）；弹窗仍为全屏居中弹窗（`shell.overlay`）
- **去掉「上级」按钮**：双击**目录树根节点**回退上级（250ms 双击检测，与下钻一致）；提示文案同步更新
- **胶囊组上移**：git 工具条 / 初始化胶囊 / loading 占位与左上角「工作目录」同行、右对齐（原独立工具栏行移除）

### 稳定性修复（初次打开无限 loading）
- **fetch 超时**：RPC 请求加 AbortController 超时（git 类 15s / 其余 8s），挂起请求不再永久 pending
- **gitBusy 卡死防护**：轮询请求超过 20s 强制复位重试，杜绝「一次挂起 → 轮询永久跳过 → 无限 loading」
- **锚点就绪前跳过请求**：初次打开 `rootPath` 未设置时不再发出 null 锚点请求（消除双请求窗口）

### 测试
- 58 用例全部通过（本次为客户端时序/交互调整，既有用例无回归）

## [0.5.0] — Git 上下文跟随视图

### 新特性
- **Git 上下文跟随当前根目录**：git 判定以文件管理器打开的目录（视图锚点）为准——锚点自带 `.git` 用自身仓库，否则用最近上级仓库；进入嵌套的独立仓库后，徽标/提交/筛选/索引管理整体切换为该仓库的数据，返回即切回
- **独立仓库 git 标签**：目录自带 `.git` 的节点（无论作为子节点还是根视图）显示仓库标记；被上级仓库忽略的目录暗色显示 + 无 diff 数据，但保留标签提示"这里有独立仓库"
- **初始化胶囊跟随视图**：当前目录无仓库（或未被最近上级仓库索引）时显示「初始化仓库」胶囊，一键在**当前目录** `git init`
- **文件 diff 按所属仓库解析**：嵌套仓库内文件的 diff 以其自身仓库为基准（修复被上级仓库误判为未跟踪的问题）
- **索引管理作用于上下文仓库**：`.gitignore` 读写以视图锚点的仓库上下文为准
- **Git 状态加载占位**：进入目录、数据就绪前，胶囊区显示与胶囊同形的 loading 提示（不跳动、无空白）
- **路径行精简**：长路径只保留末尾完整段 + 单行省略，不再换行

### 性能
- **状态获取单次命令**：仓库探测 + 双段 numstat + porcelain 合并为一次 shell 调用（原为两次，spawn 延迟约减半）
- **1.5s 短 TTL 状态缓存**：按仓库根缓存，导航/轮询去抖；提交/初始化/.gitignore 写入时主动失效
- **导航即时反馈**：切换目录立即清空旧锚点数据并刷新，过期响应丢弃（防竞态覆盖）
- **hasGit 探测并行化**：目录列表 `.git` 探测改为 `Promise.all` 并行，条目超限（>200）跳过

### 测试
- 58 用例（+22）：仓库上下文解析（自带/上级/无仓库/被忽略/祖先被忽略）、锚点状态 cwd、嵌套仓库 diff、锚点提交/初始化、状态缓存命中、`fm-list` hasGit 标记与探测上限、`shortPath` 边界

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
