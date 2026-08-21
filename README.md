# dsh-fm — DSH 工作目录文件管理器

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![npm test](https://img.shields.io/badge/tests-58%20passing-brightgreen.svg)](./test)

一个 [DeepSeek Harness (DSH)](https://www.npmjs.com/package/@deepseek-ai/dsh) Web 插件：在侧边栏底部提供「文件」入口（与「知识库」横向均分同一行），树形浏览当前工作目录，只读预览代码/图片/Markdown/Mermaid，并以「看得懂」的方式可视化 Git 变更。完全开源。

![dsh-fm 产品预览](view.png)

## 设计哲学：让每个人都能看清 Agent 改了什么

dsh-fm 不是给研发人员准备的又一款 git 客户端。它服务的场景是：**当任务被交给 AI Agent 执行时，你需要统筹知道自己的项目目录被如何改动了**——而不是被迫去做专业的 git diff 工作。

- **核心是借助 git 的能力，而不是要求你学习 git**：新增/删除/修改的文件自动带 `+/−` 徽标，目录聚合变更统计，一眼看清本次执行对文档、AI 产物的影响范围
- **面板直接回答三个问题：改了什么、改了多少、改在哪里**——无需理解 staged、branch、diff 这些概念
- **文件管理与预览一体**：目录树浏览 + 代码/图片/Markdown/Mermaid 只读预览，让「核对 AI 的执行结果」变成点开看看，而不是敲命令行
- **多仓库目录自动感知**：工作区含嵌套独立仓库（monorepo 或插件目录集）时，git 上下文跟随当前打开的目录——进入哪个仓库，变更统计与提交就跟随哪个仓库；从根目录一眼看出哪些子项目被触碰过，哪些是被忽略的
- **确保执行结果在意料之内**：未提交的变更、被忽略的内容、独立仓库都各有明确的视觉语言（亮/暗/仓库标签），任何一步都能回看、核对、提交或排除

## 功能特性

- **全局弹窗**：与 DSH 设置面板同款居中弹窗（遮罩模糊 + 圆角面板，Esc / 遮罩点击 / 关闭按钮均可关闭）；左侧为文件目录树与全部相关功能，右侧为预览面板
- **树形浏览**：单击展开/收起，双击进入目录，标题可一键回到工作区根
- **预览面板**：默认常显（无打开文件时显示空态引导），多选项卡（上限 20），代码语法着色（30+ 语言）、图片、Markdown 渲染（含 Mermaid 图；`.md` 默认渲染预览，可一键切回源码）；选项卡右键菜单提供「关闭当前 / 右侧 / 左侧 / 其他 / 全部」五种关闭模式（无可关闭对象时禁用但保留显示）
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
- **Git 初始化 / 安装**：未建立仓库时，工具栏按环境自动显示胶囊按钮——已安装 git 显示「初始化仓库」（一键在**当前目录** `git init`）；未安装 git 显示「安装并初始化仓库」，按平台自动适配：Windows（先探测 winget，用户级安装免管理员；缺失/失败则下载 MinGit 便携版，按 CPU 架构 x64/arm64/32 位选择资产，解压后追加用户 PATH）、macOS（Homebrew → Xcode Command Line Tools）、Linux（root 用户直装或无密码 sudo，apt/dnf/yum/apk/pacman/zypper 按发行版级联），失败时给出可手动执行的命令提示
- **索引管理**：仓库模式下工具栏新增「索引管理」按钮，点击后树行文件/文件夹图标左侧出现复选框；勾选=加入索引（移除 .gitignore 条目），取消=排除（写入 .gitignore），所有更改即时同步 `.gitignore`（作用于当前上下文仓库）；操作非空文件夹时弹窗询问「批量设置内部所有文件」或「仅本文件夹」；位于已忽略目录内的路径会提示先取消上级忽略
- **右键菜单**：复制路径（剪贴板）、删除（限工作目录内，二次确认）
- **性能**：git 状态一次 shell 调用获取（探测 + 双段 numstat + porcelain 合并），1.5s 短 TTL 缓存（导航/轮询去抖，提交/初始化/索引变更自动失效），导航即时刷新并丢弃过期响应，目录 `.git` 探测并行化
- **体验细节**：上下滚动渐变蒙层、未索引内容悬停恢复亮度、250ms 手动双击检测、路径行精简显示（长路径省略）、DSH 主题 token 自适应（深浅色跟随）

## 快速安装（免构建）

> 推荐直接下载现成安装包：**[Releases 页面](https://github.com/frankzhan-git/dsh-fm/releases)** 下载 `dsh-fm-0.5.0.zip`，解压后运行其中的 `install.ps1` 一键安装（内置安装/使用文档）。

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
│   ├── client.js              # 插件入口：样式注入 + 槽位注册（仅装配）
│   ├── shared/                # host 与 client 共享（单一副本）
│   │   └── fm-contract.js     #   RPC 契约：方法名常量/参数说明/路由（禁止裸字符串）
│   ├── core/                  # 纯逻辑（零 React 依赖）
│   │   ├── constants.js       #   全局常量（选项卡上限/轮询间隔/双击窗口/高亮上限）
│   │   ├── format.js          #   路径/大小/排序/精简路径工具
│   │   ├── highlight.js       #   语法高亮分词（30+ 语言关键字表）
│   │   ├── diff.js            #   git diff 文本解析
│   │   ├── api.js             #   /api/fm RPC 封装（契约驱动，运行时校验）
│   │   └── store.js           #   轻量会话状态（open 订阅 + RPC 请求上下文）
│   ├── hooks/                 # 状态机（业务逻辑）
│   │   ├── useFmTree.js       #   文件树（懒加载/轮询/导航）
│   │   ├── useFmGit.js        #   git 状态（锚点跟随/聚合徽标/筛选/竞态防护）
│   │   ├── useFmWorkspace.js  #   组合层（对外接口不变）
│   │   └── useFmPreviews.js   #   预览选项卡（打开/读取/区间关闭/删除联动清理）
│   ├── components/            # UI 组件（React.createElement）
│   │   ├── FmModal.js         #   弹窗控制器：编排两个 Hook + 行右键菜单/删除/复制
│   │   ├── TreePanel.js       #   左侧树列外壳（工具栏/git/loading/列表容器）
│   │   ├── FileRow.js         #   树行渲染（递归/双击/右键/徽标/git 标签/索引复选框）
│   │   ├── CommitDialog.js    #   提交变更浮窗
│   │   ├── IndexAskDialog.js  #   索引批量询问浮窗
│   │   ├── PreviewPanel.js    #   右侧预览列（头部/选项卡/正文/空态/二次确认）
│   │   ├── TabBar.js          #   选项卡栏（渐隐蒙层 + 右键关闭菜单）
│   │   ├── ContextMenu.js     #   通用右键菜单（含 disabled 项）
│   │   ├── Markdown.js        #   Markdown 渲染 + Mermaid（mermaid 唯一引用点）
│   │   ├── FileBadge.js       #   文件类型徽标
│   │   └── SidebarAction.js   #   侧边栏底部「文件」入口（与知识库同区同形式）
│   └── css/                   # 样式按区域拆分，构建时拼接
│       ├── base.js            #   弹窗壳/按钮/错误条/reduced-motion
│       ├── tree.js            #   树列样式（含 git 标签/loading 占位）
│       ├── preview.js         #   预览列样式
│       ├── menu.js            #   菜单/浮窗样式
│       └── index.js           #   FM_CSS 聚合
├── lib/
│   ├── index.js        # host 入口：服务获取 + /api/fm 路由注册（薄入口，同 dsh-kb 模式）
│   ├── fm-core.js      # 兼容转发层（领域拆分的统一导出）
│   ├── fm-core/        # host 业务核心（领域拆分，依赖注入工厂）
│   │   ├── index.js    #   createFmCore 工厂：组装各域 + 契约守卫
│   │   ├── shell.js    #   基础设施：shell 封装/git 探测缓存/统一命令端口
│   │   ├── fs.js       #   文件域：浏览/读取/删除（含 .git 探测）
│   │   ├── git.js      #   git 域：状态/差异/提交/初始化（上下文锚点）
│   │   ├── repo-context.js # 仓库上下文解析：锚点自身 .git / 最近上级仓库
│   │   ├── git-cache.js    # 状态缓存：1.5s TTL + 提交/索引变更失效
│   │   ├── git-install.js # git 安装域：winget/MinGit/Homebrew/包管理器级联
│   │   ├── git-index.js   # 索引域：.gitignore 解析/写入/同步
│   │   └── util.js     #   共享小工具
│   └── client.js       # 客户端预构建产物（npm run build 生成，git 忽略，内联 Mermaid）
├── test/               # node:test 用例（纯函数 + git 命令端口 fake shell）
├── scripts/
│   ├── build.mjs       # esbuild 构建脚本（入口 src/client.js）
│   └── sync-release.mjs# 发布快照同步（源码 + 构建产物 → dsh-fm-release/）
├── cordis.patch.yml    # profile bundle 补丁层（插件注册行）
└── package.json        # 包清单（dsh.bundle / dsh.client 声明）
```

> **架构约定**：`core/` 保持零 React 依赖、便于单测；`hooks/` 按域拆分（树 / git / 预览），组件保持「渲染 + 回调」薄层；host 侧 `fm-core/` 按领域拆包，RPC 层（handlers）只做参数校验与编排，命令串与解析逻辑下沉为可注入端口（fake shell 可测）；RPC 方法名一律引用 `src/shared/fm-contract.js`。`lib/client.js` 是 ModuleLoader 单 bundle 产物（加载器要求一个插件一个模块），源码层面已彻底模块化。

## 工作原理

- **host 半**注入 `fs / shell / sandboxPolicy / sessions / webServer` 服务，注册 `/api/fm` HTTP 路由分发全部 RPC（`fm-root / fm-list / fm-read / fm-git-status / fm-git-diff / fm-git-commit / fm-git-init / fm-git-install-init / fm-git-index-set / fm-remove`）；方法名与参数见 `src/shared/fm-contract.js`（契约守卫运行时校验实现完整性）
- **client 半**通过 `dsh.client` 声明加载，渲染文件树、预览与 Git UI，经 `fetch('/api/fm')` 与 host 通信
- **Git 上下文**：每次请求携带视图锚点（当前根目录）；host 先探测锚点自带 `.git`（自身仓库），否则向上找最近上级仓库，git 命令一律在该仓库根执行（路径基准=仓库根），并返回锚点是否被该仓库索引（`context.anchorIndexed`）——客户端据此决定工具条 / 初始化胶囊 / 暗色与 diff 的呈现
- **性能**：git 状态为单次 shell 调用（探测 + 双段 numstat + porcelain 用标记分段，双段之和等价于 `diff HEAD` 且兼容无 HEAD 仓库）；结果按仓库根缓存 1.5s；目录与 git 状态每 3 秒轮询（目录轮询与 git 轮询解耦，git 命令慢不阻塞目录更新）；导航即清空旧数据并立即刷新，过期响应丢弃；git 命令按「双 shell 兼容」约定编写（见下）

## 开发约定（重要）

- **Shell 兼容**：Windows 的 DSH shell 后端是 PowerShell，Linux/macOS 是 bash。所有 shell 命令必须两端兼容：只用普通命令串联 + `; echo 标记` 分段；禁止 `||`、`&&`、重定向、`if...fi`、`rm` 等单侧语法；确需分叉时用 `process.platform` 显式分支
- **RPC 契约单一副本**：新增/修改 RPC 时同步 `src/shared/fm-contract.js`（方法名常量 + FM_ARGS），client 一律经 `api(FM_METHODS.xxx)` 调用，禁止裸字符串方法名
- **host 插件必须声明 `inject`**：Loader 架构下 apply 会在依赖服务提供前执行，不声明 inject 时 `ctx.get(...)` 全为 undefined，路由不会注册
- **测试**：`npm test` 跑 node:test；host 纯函数与 git 命令串（fake shell）必须有覆盖，新增逻辑优先下沉为可测纯函数
- **图标统一使用 DSH 内置图标库**（`@deepseek-ai/dsh-client-ui-primitives`），不自定义 SVG；新增图标时先查库内语义最接近的 glyph，并在 `dsh.client.inject` 中保持该依赖声明
- 插件管理器显示名取自 patch 行的 `name`（模块说明符），banner id 必须与之保持一致

## 许可证

[MIT](./LICENSE) © 2026 FrankZhan
