# dsh-fm — DSH 工作目录文件管理器

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![verify](https://github.com/frankzhan-git/dsh-fm/actions/workflows/verify.yml/badge.svg)](https://github.com/frankzhan-git/dsh-fm/actions/workflows/verify.yml)

一个 [DeepSeek Harness (DSH)](https://www.npmjs.com/package/@deepseek-ai/dsh) Web 插件：在**会话输入框工具行**提供「文件」入口（与「界面草图」同区），树形浏览当前工作目录，只读预览代码/图片/Markdown/Mermaid，并以「看得懂」的方式可视化 Git 变更。完全开源。

![dsh-fm 产品预览](view.png)

## 设计哲学：让每个人都能看清 Agent 改了什么

dsh-fm 不是给研发人员准备的又一款 git 客户端。它服务的场景是：**当任务被交给 AI Agent 执行时，你需要统筹知道自己的项目目录被如何改动了**——而不是被迫去做专业的 git diff 工作。

- **核心是借助 git 的能力，而不是要求你学习 git**：新增/删除/修改的文件自动带 `+/−` 徽标，目录聚合变更统计，一眼看清本次执行对文档、AI 产物的影响范围
- **面板直接回答三个问题：改了什么、改了多少、改在哪里**——无需理解 staged、branch、diff 这些概念
- **文件管理与预览一体**：目录树浏览 + 代码/图片/Markdown/Mermaid 只读预览，让「核对 AI 的执行结果」变成点开看看，而不是敲命令行
- **多仓库目录自动感知**：工作区含嵌套独立仓库（monorepo 或插件目录集）时，git 上下文跟随当前打开的目录——进入哪个仓库，变更统计与提交就跟随哪个仓库；从根目录一眼看出哪些子项目被触碰过，哪些是被忽略的
- **确保执行结果在意料之内**：未提交的变更、被忽略的内容、独立仓库都各有明确的视觉语言（亮/暗/仓库标签），任何一步都能回看、核对、提交或排除

## 功能特性

- **全局弹窗**：与 DSH 设置面板同款居中弹窗（遮罩模糊 + 圆角面板，Esc / 遮罩点击 / 关闭按钮均可关闭）；右上角提供**全屏/窗口切换**按钮（关闭按钮左侧，DSH 内置全屏图标），全屏态铺满视口、Esc 优先退出全屏；左侧为文件目录树与全部相关功能，右侧为预览面板
- **树形浏览**：单击展开/收起，双击进入目录，**双击根目录返回上级**，标题可一键回到工作区根
- **预览面板**：默认常显（无打开文件时显示空态引导），多选项卡（上限 20），代码语法着色（30+ 语言）、图片、Markdown 渲染（含 Mermaid 图；`.md` 默认渲染预览，可一键切回源码）；**未知扩展名的兜底文本预览**——非图片/非已知文本类型时按内容嗅探（8KB 采样：NUL/控制字符信号），文本（如 `.git-credentials`、无扩展名文件）默认以纯文本预览（`detected` 标记），二进制仍提示暂不支持；选项卡右键菜单提供「关闭当前 / 右侧 / 左侧 / 其他 / 全部」五种关闭模式（无可关闭对象时禁用但保留显示）
- **Git 上下文跟随视图**：
  - git 判定以**当前打开的目录**为锚点：锚点自带 `.git` 用自身仓库，否则用最近上级仓库
  - 进入嵌套的独立仓库（如插件目录）后，徽标/提交/筛选/索引管理**整体切换**为该仓库的数据；返回上级即切回
  - 被上级仓库忽略的目录：暗色显示 + 无 diff 数据，但带**独立仓库 git 标签**（分支图标），一眼识别"这里有个仓库，进去才能看到它的状态"
  - 当前目录无仓库（或未被任何仓库索引）时显示**初始化胶囊**，一键在当前目录创建仓库
- **Git 可视化**：
  - 工具栏 `+/−` 总变更、提交按钮（↓ 图标）、「仅显示变更文件」筛选
  - 文件行 `+/−` 徽标；目录行聚合徽标（`N files +X −Y`，悬停看明细）
  - 未被 git 索引（未跟踪/被 .gitignore 忽略）的文件与文件夹整体暗色显示
  - 进入目录后数据就绪前，胶囊区显示与胶囊同形的 loading 占位（不跳动）
  - **胶囊四态状态机（架构根治）**：`boot/loading/ready/error` 显式建模 —— 失败不再伪装成 loading，错误态显示「git 状态获取失败：<原因> [重试]」；重开弹窗/跨仓库往返数据未变也不会被签名优化跳过（旧版永久 loading 的根因已消除）
- **Git 初始化 / 安装**：未建立仓库时，工具栏按环境自动显示胶囊按钮——已安装 git 显示「初始化仓库」（一键在**当前目录** `git init`）；未安装 git 显示「安装并初始化仓库」，按平台自动适配：Windows（先探测 winget，用户级安装免管理员；缺失/失败则下载 MinGit 便携版，按 CPU 架构 x64/arm64/32 位选择资产，解压后追加用户 PATH）、macOS（Homebrew → Xcode Command Line Tools）、Linux（root 用户直装或无密码 sudo，apt/dnf/yum/apk/pacman/zypper 按发行版级联），失败时给出可手动执行的命令提示
- **索引管理**：仓库模式下工具栏新增「索引管理」按钮，点击后树行文件/文件夹图标左侧出现复选框；**状态语义（v2）**：目录为三态——全部索引（选中）/ 部分索引（≥1 项索引且存在未索引内容，indeterminate 样式）/ 未索引（全部未跟踪或被忽略），文件为二态；**交互**：文件勾选/取消直通；空目录直通；**非空文件夹单次确认**「全部加入索引 / 全部取消索引」（唯一选项，含方向色影响条「· N 项」与「磁盘文件保留，不会被删除」说明）；勾选=全部加入索引（移除 .gitignore 条目及文件夹下锚定子项，曾被取消跟踪的路径 `git add` 恢复），取消=全部取消索引（已跟踪路径先 `git rm --cached -r`（工作区保留）再写 `.gitignore`）；位于已忽略目录内的路径禁用并提示先取消上级忽略；**索引调整后父级三态自动派生刷新**（如 `docs` 内仅部分内容加入索引 → 父级显示部分索引）
- **右键菜单**：复制路径（剪贴板）、删除（限工作目录内，二次确认）
- **性能**：git 状态一次 shell 调用获取（探测 + 双段 numstat + porcelain 合并），1.5s 短 TTL 缓存（导航/轮询去抖，提交/初始化/索引变更自动失效），导航即时刷新并丢弃过期响应，目录 `.git` 探测并行化；host 启动预热 git 探测（首个请求命中缓存）；端到端超时预算单一副本（`shared/contract/fm-limits.js`：probe 6s ≤ 单命令 8s ≤ status 12s < 客户端 20s < 官方信使 30s 兜底）
- **体验细节**：上下滚动渐变蒙层、未索引内容悬停恢复亮度、250ms 手动双击检测、路径行精简显示（长路径省略）、DSH 主题 token 自适应（深浅色跟随）；**树列表合并式刷新**——轮询/索引调整/提交后的重刷仅更新数据元信息，用户展开/加载状态永不重置（`core/tree-merge.js`）；索引/提交/初始化后统一走 `refreshAfterGitMutation()` 管线

## 快速安装（免构建）

> 推荐直接下载现成安装包：**[Releases 页面](https://github.com/frankzhan-git/dsh-fm/releases)** 下载 `dsh-fm-0.8.0.zip`，解压后运行其中的 `install.ps1` 一键安装（内置安装/使用文档）。

> 说明：`lib/client.js` 为构建产物（`npm run build` 生成），已移出 git 跟踪；Release 安装包内包含最新构建产物。

## 从源码安装

```powershell
git clone https://github.com/frankzhan-git/dsh-fm.git
cd dsh-fm
npm install
npm run build   # 生成 lib/client.js
dsh plugin --profile web add "file:<克隆目录绝对路径>"
```

然后创建中文显示名的目录联接（插件管理器显示「dsh文件管理器」；pnpm 不接受中文依赖键，中文名需通过联接解析）：

- **Windows**（PowerShell）：
  ```powershell
  cmd /c mklink /J "%USERPROFILE%\.dsh\profiles\node_modules\dsh文件管理器" "%USERPROFILE%\.dsh\profiles\web\node_modules\dsh-fm"
  ```
- **Linux / macOS**（bash）：
  ```bash
  ln -s ~/.dsh/profiles/web/node_modules/dsh-fm ~/.dsh/profiles/node_modules/dsh文件管理器
  ```

最后重启 DSH 并刷新页面。**如果不需要中文名**，把 `cordis.patch.yml` 中的 `name: dsh文件管理器` 改为 `name: dsh-fm` 即可跳过联接步骤（管理器将显示 "fm"）。

## 从源码构建

```bash
npm install
npm run build   # esbuild 打包 src/client.js → lib/client.js
npm test        # node:test 纯函数与 git 命令端口测试
```

- host 半（`lib/`）为纯 ESM，无需构建
- 客户端 bundle 的 banner id 必须与 `cordis.patch.yml` 中的 `name` 一致
- `lib/client.js` 为构建产物（git 忽略）；Release 安装包已包含最新构建产物，或执行 `npm run build` 生成
- 发布快照同步：`node scripts/sync-release.mjs`（复制源码与构建产物到 `dsh-fm-release/`）

## 项目结构

```
dsh-fm-plugin/
├── src/
│   ├── client.js              # 插件入口：样式注入 + 槽位注册 + 文案字典注册（仅装配）
│   ├── shared/                # host 与 client 共享（单一副本）
│   │   ├── contract/          #   ★ wire 定义唯一权威副本（信封/方法/错误码/限额/路由）
│   │   │   ├── index.js       #     聚合出口（唯一引用面）
│   │   │   ├── fm-methods.js  #     RPC 方法名常量/参数声明（禁止裸字符串）
│   │   │   ├── fm-envelope.js #     官方四相信封构造/解析（client-request/server-response）
│   │   │   ├── fm-errors.js   #     错误码枚举（kebab-case + details，对齐官方 rpcErrorSchema）
│   │   │   ├── fm-limits.js   #     端到端超时/缓存/轮询预算（唯一数字来源）
│   │   │   └── fm-route.js    #     路由路径常量
│   │   └── fm-contract.js     #   兼容再导出（deprecated，禁止新增定义）
│   ├── core/                  # 纯逻辑（零 React 依赖）
│   │   ├── constants.js       #   UI 常量（选项卡上限/轮询间隔/双击窗口/高亮上限）
│   │   ├── format.js  highlight.js  diff.js  # 工具（不变）
│   │   ├── git-machine.js     #   ★ git 状态机纯 reducer（T1–T6，boot/loading/ready/error）
│   │   ├── api.js             #   信封客户端（契约驱动 + 官方超时预算 + 永不抛错归一化）
│   │   └── store.js           #   会话状态（open 订阅 + RPC 请求上下文）
│   ├── hooks/                 # 状态机（业务逻辑）
│   │   ├── useFmTree.js  useFmPreviews.js  useFmWorkspace.js  # 不变职责
│   │   ├── useFmGit.js        #   git 组合层（三切片装配 + 派生面，对外接口不变）
│   │   └── git/               #   git 三切片（架构根治）
│   │       ├── useGitMachine.js    #   status 状态机接线（轮询 jitter 单飞行）
│   │       ├── useGitContext.js    #   锚点→仓库（零 shell，骨架先行）
│   │       └── useGitCapability.js #   是否安装 git（低频，安装成功后刷新）
│   ├── components/            # UI 组件（React.createElement）
│   │   ├── FmModal.js         #   弹窗控制器（编排 hooks/右键菜单/删除/复制；透传 t）
│   │   ├── TreePanel.js       #   左侧树列外壳（标题/错误条/路径/列表；胶囊委托 GitCapsule）
│   │   ├── GitCapsule.js      #   ★ git 胶囊四态渲染（loading/ready/init/error+重试）
│   │   ├── FileRow.js         #   树行渲染（递归/双击/右键/徽标/git 标签/索引复选框）
│   │   ├── CommitDialog.js  IndexAskDialog.js  PreviewPanel.js  TabBar.js  ContextMenu.js
│   │   └── Markdown.js  FileBadge.js  SidebarAction.js（不变）
│   ├── locale/                # ★ 官方 dsh-client-locale 文案字典（ns: fm）
│   │   ├── index.js  zh.js  en.js
│   └── css/
│       ├── base.js  tree.js  preview.js  menu.js  index.js
│       └── git.js             #   ★ 胶囊错误态样式
├── lib/
│   ├── index.js        # host 入口：服务获取 + 路由注册（信封）+ 启动预热 + disposer 挂 effect
│   ├── fm-core.js      # 兼容转发层（领域拆分的统一导出）
│   ├── fm-core/        # host 业务核心（领域拆分，依赖注入工厂）
│   │   ├── index.js    #   createFmCore 工厂（rootOf 官方解析链 + 契约守卫）
│   │   ├── route.js    #   ★ 信封编解码/归一化（线协议唯一实现，可单测）
│   │   ├── policy.js   #   ★ 沙箱政策按会话解析（官方 sandboxPolicy.resolve 包装）
│   │   ├── errors.js   #   ★ 错误映射（旧式返回 → 官方 error 分支，错误码语义表）
│   │   ├── capability.js  context.js  # 能力域/上下文域（git 探测 / 锚点→仓库）
│   │   ├── shell.js    #   基础设施：shell 封装/probeGit 缓存/统一命令端口
│   │   ├── fs.js  git.js  repo-context.js  git-cache.js  git-install.js  git-index.js  util.js
│   └── client.js       # 客户端预构建产物（npm run build 生成，git 忽略，内联 Mermaid）
├── test/               # node:test 用例（按域组织：机器/契约/路由/策略/能力/命令端口…）
├── scripts/            # build.mjs / sync-release.mjs
├── cordis.patch.yml    # profile bundle 补丁层（插件注册行）
└── package.json        # 包清单（dsh.bundle / dsh.client 声明）
```

> **架构约定**：`core/` 与 `contract/` 保持零 React/零 DOM、便于单测；`hooks/` 按域拆分、`hooks/git/` 三切片（能力/上下文/状态）各自独立错误语义；组件保持「渲染 + 回调」薄层（git 胶囊四态内聚于 GitCapsule）；host 侧 `fm-core/` 按领域拆包，RPC 层（route.js）只做信封与归一化，命令串与解析逻辑下沉为可注入端口；RPC 方法名/信封/错误码/限额一律引用 `src/shared/contract/`（**wire 定义单一副本**），`lib/client.js` 是 ModuleLoader 单 bundle 产物。

## 工作原理

- **host 半**注入 `fs / shell / sandboxPolicy / sessions / webServer`（可选 `workspaceRegistry`）服务，注册 `/api/fm` 路由分发全部 RPC（`fm-root / fm-list / fm-read / fm-git-status / fm-git-context / fm-git-capability / fm-git-diff / fm-git-commit / fm-git-init / fm-git-install-init / fm-git-index-set / fm-remove`）；**线协议为官方四相信封**（`client-request → server-response`，`{ok:true,value} | {ok:false,error:{code,message,details}}`，rpcId 由发起方铸造），信封/方法名/错误码/限额单一副本在 `src/shared/contract/`
- **client 半**通过 `dsh.client` 声明加载，渲染文件树、预览与 Git UI，经 `fetch('/api/fm')` 与 host 通信（`core/api.js` 构造信封并归一化为 `{ok:true,...}/{ok:false,code,message}`，永不抛错）
- **Git 三切片**：`fm-git-capability`（是否安装 git，探测成功后 host 永久缓存/失败 30s 重试）→ `fm-git-context`（锚点→仓库，零 shell、毫秒级，骨架先行）→ `fm-git-status`（变更数据 + `anchorIndexed`，shell 管线 + 1.5s TTL 缓存）；客户端胶囊按 `boot/loading/ready/error` 四态渲染，错误态独立可见可重试
- **Git 上下文**：每次请求携带视图锚点（当前根目录）；host 先探测锚点自带 `.git`（自身仓库），否则向上找最近上级仓库，git 命令一律在该仓库根执行（路径基准=仓库根），并返回锚点是否被该仓库索引（`context.anchorIndexed`）——客户端据此决定工具条 / 初始化胶囊 / 暗色与 diff 的呈现
- **工作区根解析链（官方优先）**：会话 `header.cwd` → `workspaceRegistry.host.sessionPath`（canonical+已验证）→ `sandboxPolicy.workspaceRoot`
- **沙箱政策（官方模型）**：每次 shell 执行前 `sandboxPolicy.resolve({session})` 解析会话策略；读命令（git status/diff/探测）任意模式放行，写命令（add/commit/init/安装/删除）在 `read-only` 会话下拒绝并返回 `sandbox-denied`；解析出的政策原样传给 `shell.resolve`（不再硬编码 danger-full-access）
- **性能**：git 状态为单次 shell 调用（探测 + 双段 numstat + porcelain 用标记分段，双段之和等价于 `diff HEAD` 且兼容无 HEAD 仓库）；结果按仓库根缓存 1.5s；目录与 git 状态每 3 秒轮询（目录轮询与 git 轮询解耦，git 命令慢不阻塞目录更新；git 轮询带 ±500ms 抖动避免锁步）；导航即清空旧数据并立即刷新，过期响应丢弃；host 启动预热 git 探测，首个客户端请求命中缓存；git 命令按「双 shell 兼容」约定编写（见下）

## 开发约定（重要）

- **Shell 兼容**：Windows 的 DSH shell 后端是 PowerShell，Linux/macOS 是 bash。所有 shell 命令必须两端兼容：只用普通命令串联 + `; echo 标记` 分段；禁止 `||`、`&&`、重定向、`if...fi`、`rm` 等单侧语法；确需分叉时用 `process.platform` 显式分支
- **wire 定义单一副本**：信封/方法名/参数/错误码/限额只允许存在于 `src/shared/contract/`（`src/shared/fm-contract.js` 仅为兼容再导出）；host、client、test 一律引用它，禁止裸字符串方法名/错误码/超时数字
- **host 插件必须声明 `inject`**：Loader 架构下 apply 会在依赖服务提供前执行，不声明 inject 时 `ctx.get(...)` 全为 undefined，路由不会注册
- **测试**：`npm test` 跑 node:test；状态机全迁移表、信封/错误码、路由归一化、策略分级、host 命令串（fake shell）必须有覆盖，新增逻辑优先下沉为可测纯函数
- **git 状态机可测**：所有状态迁移写在 `src/core/git-machine.js` 纯 reducer（T1–T6、`boot/loading/ready/error`）；组件层禁止手写 `gitInfo === null` 判断胶囊状态
- **新增失败路径必须带错误码**：在 `contract/fm-errors.js` 增加枚举 + `test/contract-envelope.test.js` 用例，禁止 `{ok:false,error:任意中文}` 裸返回
- **官方接口优先（不重复造轮子）**：`ctx.sandboxPolicy.resolve`（会话政策）、`ctx.workspaceRegistry`（canonical 会话路径）、`ctx.slots` 标准座席（useSessions/useStore/t）、`dsh-client-locale`（`register(ns,{zh,en})` + 条目 `locale: ns`）、`webServer.register`（disposer 挂 `ctx.effect`）；只对 DSH 未提供的能力（git 命令域、文件树、预览）自建，且线协议对齐官方四相信封
- **图标统一使用 DSH 内置图标库**（`@deepseek-ai/dsh-client-ui-primitives`），不自定义 SVG；新增图标时先查库内语义最接近的 glyph，并在 `dsh.client.inject` 中保持该依赖声明
- **宿主/客户端同步发布**：线协议升级（信封化）后 host 与 client 必须一起重启生效；`lib/client.js` 与 `dsh-fm-release/` 快照同步由 `npm run build` + `node scripts/sync-release.mjs` 管理
- 插件管理器显示名取自 patch 行的 `name`（模块说明符），banner id 必须与之保持一致

## 许可证

[MIT](./LICENSE) © 2026 FrankZhan
