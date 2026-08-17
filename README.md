# dsh-fm — DSH 工作目录文件管理器

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

一个 [DeepSeek Harness (DSH)](https://www.npmjs.com/package/@deepseek-ai/dsh) Web 插件：在会话标题栏提供「文件」入口，树形浏览当前工作目录，只读预览代码/图片/Markdown/Mermaid，并可视化 Git 变更状态。完全开源。

![dsh-fm 产品预览](view.png)

## 功能特性

- **树形浏览**：单击展开/收起，双击进入目录，标题可一键回到工作区根
- **预览窗口**：多选项卡（上限 20），代码语法着色（30+ 语言）、图片、Markdown 渲染（含 Mermaid 图；`.md` 默认渲染预览，可一键切回源码）
- **Git 可视化**：
  - 工具栏 +/− 总变更、提交按钮（↓ 图标）、「仅显示变更文件」筛选
  - 文件行 +/− 徽标；目录行聚合徽标（`N files +X −Y`，悬停看明细）
  - 未被 git 索引（未跟踪/被 .gitignore 忽略）的文件与文件夹整体暗色显示
- **右键菜单**：引用路径到会话输入框、删除（限工作目录内，二次确认）
- **体验细节**：上下滚动渐变蒙层、未索引内容悬停恢复亮度、250ms 手动双击检测、DSH 主题 token 自适应（深浅色跟随）

## 快速安装（免构建）

> 也可以直接下载现成安装包：**[Releases 页面](https://github.com/frankzhan-git/dsh-fm/releases)** 下载 `dsh-fm-0.1.0.zip`，解压后运行其中的 `install.ps1` 一键安装（内置安装/使用文档）。

直接安装本仓库（`lib/` 已包含预构建产物）：

```powershell
dsh plugin --profile web add "dsh-fm@github:frankzhan-git/dsh-fm"
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
```

- host 半（`lib/index.js`）为纯 ESM，无需构建
- 客户端 bundle 的 banner id 必须与 `cordis.patch.yml` 中的 `name` 一致
- 本仓库已提交 `lib/client.js`，克隆后不构建也可直接安装

## 项目结构

```
dsh-fm-plugin/
├── src/client.js       # 客户端源码（React.createElement，DSH 主题 token）
├── lib/
│   ├── index.js        # host 半：文件读写、git 命令、/api/fm 路由
│   └── client.js       # 客户端预构建产物（esbuild 打包，内联 Mermaid）
├── scripts/build.mjs   # esbuild 构建脚本
├── cordis.patch.yml    # profile bundle 补丁层（插件注册行）
└── package.json        # 包清单（dsh.bundle / dsh.client 声明）
```

## 工作原理

- **host 半**注入 `fs / shell / sandboxPolicy / sessions / webServer` 服务，注册 `/api/fm` HTTP 路由分发全部 RPC（`fm-list / fm-read / fm-git-status / fm-git-diff / fm-git-commit / fm-remove / fm-mermaid-render`）
- **client 半**通过 `dsh.client` 声明加载，渲染文件树、预览与 Git UI，经 `fetch('/api/fm')` 与 host 通信
- 目录与 git 状态每 3 秒轮询一次；git 命令按「双 shell 兼容」约定编写（见下）

## 开发约定（重要）

- **Shell 兼容**：Windows 的 DSH shell 后端是 PowerShell，Linux/macOS 是 bash。所有 shell 命令必须两端兼容：只用普通命令串联 + `; echo 标记` 分段；禁止 `||`、`&&`、重定向、`if...fi`、`rm` 等单侧语法；确需分叉时用 `process.platform` 显式分支
- **host 插件必须声明 `inject`**：Loader 架构下 apply 会在依赖服务提供前执行，不声明 inject 时 `ctx.get(...)` 全为 undefined，路由不会注册
- **图标统一使用 DSH 内置图标库**（`@deepseek-ai/dsh-client-ui-primitives`），不自定义 SVG；新增图标时先查库内语义最接近的 glyph，并在 `dsh.client.inject` 中保持该依赖声明
- 插件管理器显示名取自 patch 行的 `name`（模块说明符），banner id 必须与之保持一致

## 许可证

[MIT](./LICENSE) © 2026 FrankZhan
