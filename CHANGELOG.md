# Changelog

## [0.8.3] — 修复：git init 默认分支/main + 默认 .gitignore + 安装初始化状态缓存失效

- **现象**：双击进入无仓库目录点「初始化」后，`git status`/提交等操作仍可能按旧仓库响应；初始化产物缺默认分支名与忽略规则
- **修复一**（`lib/fm-core/git.js` `gitInitWithDefaults`，`fm-git-init` 改用）：`git init -b main` 走默认分支；旧版 git 回退裸 `git init` + `symbolic-ref HEAD refs/heads/main`（**仅新仓库**改 HEAD，不打扰已有仓库分支名）；先 `rev-parse --git-dir` 探测是否已有仓库，已是仓库则不重复 init；缺失时写入默认 `.gitignore`（node_modules/ 等，已存在绝不覆盖，顺带兜底历史未忽略仓库）
- **修复二**（`lib/fm-core/git-install.js` `fm-git-install-init`）：初始化成功后 `statusCache.invalidate(anchor)`，避免旧缓存条目（无仓库/旧分支）污染后续状态
- **测试**：更新 init 命令序列断言（`rev-parse --git-dir` → `git init -b main`），新增「新仓库写入默认 .gitignore，已存在则不覆盖」用例，137 例全通过

## [0.8.2] — 修复：未索引目录（未跟踪 ??）胶囊误显示上层仓库工具条

- **现象**：双击进入无独立仓库且未被上层仓库索引的目录（如 `dsh-mermaid-plugin` —— 未跟踪 `??` 且无 `.git`）时，胶囊显示的是上层仓库的 `+/−` 工具条（dsh-mermaid-plugin 场景）
- **根因**：`fm-git-status` 的 `anchorIndexed` 只按 porcelain `ignored`（`!!`）判定「锚点是否被仓库索引」，漏掉了另一半——未跟踪（`??`）。整目录未跟踪时 porcelain 折叠为顶层 `?? dir/` 条目，锚点恰好就是该条目，但被误判为已索引 → 渲染工具条而非初始化胶囊；与既有的索引语义 v2（未索引 = 未跟踪 ∪ 已忽略）不一致
- **修复**（`lib/fm-core/git.js`）：`anchorIndexedOf(ignored, untracked)` 同时覆盖 `!!` 与 `??` 两类条目（锚点自身或任一祖先命中即未索引）；`untrackedOf` 从 status 的 `files`（`untracked:true` 条目路径）提取候选；缓存命中分支同样生效。混合目录（`?? dir/file`）中锚点为条目祖先 → 不命中 → 保持工具条（锚点已被索引）
- **测试**：新增 4 例（整目录未跟踪 `??` → 未索引；祖先未跟踪 → 未索引；锚点被索引但其下未跟踪文件 → 工具条回归防线；缓存命中同样判定未索引），136 例全通过

## [0.8.1] — 修复：未跟踪文件/目录勾选「加入索引」无作用

- **根因**：「加入索引」分支用 `changed`（仅代表"移除了 .gitignore 条目"）短路——对**未跟踪且无忽略条目**的文件（如新文件 `docs/dsh-insight-plugin-design.md`）与整目录未跟踪场景，没有条目可移除 → 提前返回，`git add`（纳入索引的核心动作）永不执行 → 勾选无效
- **修复**（`lib/fm-core/git-index.js` `checked` 分支重构）：移除 `.gitignore` 条目（A）与确保进入索引——未跟踪即 `git add -A`（B）两动作解耦，任一发生即 `changed:true`；已跟踪且无条目 → 正确 no-op
- **测试**：新增 3 例关键回归（未跟踪文件无条目 → 执行 add；未跟踪目录 → add 整目录；已跟踪无条目 → no-op），132 例全通过

## [0.8.0] — Git 域架构根治（状态机 / 官方协议 / 三切片）

### 根治问题
- **修复「git 胶囊始终 loading」**：旧签名优化在「重置后同数据响应」时跳过状态更新（重开弹窗/跨仓库往返数据未变 → 永久 loading）；旧 `null` 值同时承担 loading/error 两种语义，错误无出口
- **新状态机**（`src/core/git-machine.js`，纯 reducer）：`boot/loading/ready/error` 四态；数据签名跳过仅在 `ready` 态允许（T3），`loading→ready`/`error→ready` 永不跳过（T4/T6）；过期锚点响应在 reducer 内丢弃（T2）；错误态保留上次数据、独立可见可重试（T5）
- **git 胶囊四态渲染**（`GitCapsule.js`）：失败态显示「git 状态获取失败：<原因> [重试]」，不再伪装成 loading
- **修复「索引管理点击后无作用」**：旧实现对**已跟踪路径**的排除只写 `.gitignore`——git 对已跟踪内容忽略该文件，状态无变化；`fm-git-index-set` 现先 `git ls-files` 判定跟踪状态，已跟踪 → `git rm --cached -r --ignore-unmatch`（工作区保留）再写 `.gitignore`（porcelain 归一为 `!!`，复选框正确翻转）；加入索引对曾任 rm --cached 的路径补 `git add` 恢复跟踪；重复条目去重、历史残留不重复追加
- **复选框语义修正**：选中=正在索引（已被 git 跟踪），未跟踪（`??`）/已忽略（`!!`）显示未选中（旧版未跟踪项错误显示为已选中）
- **二次确认/提交浮窗屏幕居中**：`.fm-pop2` 由弹窗内 `absolute` 定位改为 `fixed + translate(-50%,-50%)`（旧版被插件弹窗边缘截断），长文案允许换行
- **索引二次确认决策卡（语义 v2：单一选项 + 目录三态）**（`IndexAskDialog` + `.fm-ask*` + `core/index-state.js`）：
  - 非空文件夹只有**一个选择**：「全部加入索引 / 全部取消索引」（旧版「仅本文件夹 / 批量设置」二选一移除——两个选项在排除方向本就等价，且新语义按需求统一为全量处理；默认焦点在「取消」防误触 Enter）
  - **目录三态勾选**：全部索引（选中）/ 部分索引（≥1 项索引且存在未索引内容，indeterminate）/ 未索引；文件二态；索引调整后父级三态随状态刷新自动派生
  - 派生下沉为纯函数 `src/core/index-state.js`（porcelain 折叠规则保证按集合前缀判定可靠：整目录未跟踪/忽略 → 集合含目录标记 → 未索引；混合目录 → 逐条目列出 → 部分索引）
  - 方向色 impact 条（等宽台账行）保留：「全部加入/取消索引 · <文件夹> 内 N 项」（probe 返回 `entryCount`）；文案明示「磁盘文件保留，不会被删除」；`role=alertdialog` + Esc 关闭 + reduced-motion 无动画
- **修复「索引调整后子目录展开状态被收起」**：旧 `loadDir` 重刷目录列表时对**每个条目重建节点**（`expanded:false, loaded:false`）并覆盖——索引操作改写仓库根 `.gitignore`（尺寸变化）→ 文件树轮询判定根列表签名失效 → 重刷根目录 → 用户展开的全部子目录瞬间收起。修复：
  - 合并式刷新下沉为纯函数 `src/core/tree-merge.js`（`mergeListing`）：已存在节点仅更新数据元信息（name/type/size/hasGit），**保留 UI 状态（loaded/expanded/childPaths）**；新条目才创建 fresh 节点；消失条目移除
  - **统一刷新管线** `TreePanel.refreshAfterGitMutation()`：索引/提交/初始化后 git 状态 + 树列表合并式刷新（唯一入口），替代散落的 `refreshGit(); loadDir()` 组合
- **修复「取消勾选文件夹后子项仍显示勾选」**：`index-state.js` 派生增加**祖先继承**——整目录未索引标记（`!! folder/` / `?? folder/`）向下传播，任意祖先（或自身）在未索引集合 ⇒ 该节点为未选中（off），子文件/子文件夹随文件夹一并未选中；OFF 态文案区分「未跟踪」与「已排除」祖先
- **修复「初次勾选/取消勾选后文件树状态未更新」**：根因是 `useGitMachine` 的布尔 busy 单飞行——轮询 tick 在途时，索引/提交后的显式 `refreshGit()` 被**静默吞掉**（索引其实已更新，UI 数据不落地）。修复：
  - 新增合并式单飞行刷新器 `src/core/refresh-coalescer.js`（纯函数）：在途期间的新刷新**只记录最新锚点、绝不丢弃**，当前请求完成后立即以最新锚点补跑；同批并发仅保留最新（同键收敛）
  - `useGitMachine` 全面接入 —— 轮询与显式刷新共享合并器，`refreshAfterGitMutation` 的刷新**必达**
- **预览兜底：未知扩展名默认文本预览**（`.git-credentials` 等点开头/无扩展名文件）：`fm-read` 对非图片/非已知文本类型做**内容采样嗅探**（纯函数 `lib/fm-core/text-sniff.js`，8KB 头：NUL 强信号 → 二进制；非打印控制字符占比 ≤2% → 文本）；文本 → 默认纯文本预览（`detected:true`，客户端沿用既有 text 渲染与无高亮回退），二进制 → 仍显示暂不支持；已知局限：UTF-16 文本（含 NUL）会判为二进制

### 官方接口对齐（不重复造轮子）
- **线协议信封化**：`/api/fm` 升级为官方四相信封（`client-request → server-response`，`{ok:true,value} | {ok:false,error:{code,message,details}}`，rpcId 发起方铸造，对齐 `dsh-host-apiproxy` rpcErrorSchema 风格）；信封/方法/错误码/限额单一副本 `src/shared/contract/`
- **沙箱政策**：每次 git 执行经官方 `sandboxPolicy.resolve({session})` 按会话解析（读操作任意模式、写操作 read-only 会话拒绝 `sandbox-denied`），不再硬编码 `danger-full-access`
- **工作区根解析链**：会话 `header.cwd` → 官方 `workspaceRegistry.host.sessionPath`（canonical+已验证）→ `sandboxPolicy.workspaceRoot`
- **文案字典**：经官方 `dsh-client-locale` 注册 ns `fm`（zh/en），槽位条目声明 `locale: 'fm'` 获得框架 `t` 座席
- **路由治理**：`webServer.register` 返回的 disposer 挂 `ctx.effect`；host 启动预热 git 探测（首个请求命中缓存）

### Git 三切片（架构层）
- 新增 `fm-git-context`（锚点→仓库，零 shell、毫秒级，骨架先行）与 `fm-git-capability`（探测低频缓存）；胶囊可在 status（shell 管线）就绪前按能力/上下文渲染正确形态

### 治理
- 端到端超时预算单一副本（`contract/fm-limits.js`：probe 6s ≤ 单命令 8s ≤ status 12s < 客户端 20s < 官方信使 30s）
- 错误码枚举化（`contract/fm-errors.js`，kebab-case + details）；旧式返回由 `fm-core/errors.js` 语义表映射
- 路由线协议语义下沉 `fm-core/route.js`（可单测）；状态机/信封/策略/能力域测试新增 39 例（97 通过）
- **注意**：线协议升级，host 与 client 需**一起重启** DSH 生效

## [0.7.0] — 弹窗全屏/窗口切换

### 新特性
- **弹窗全屏/窗口切换**：预览面板头部新增全屏切换按钮（紧邻关闭按钮左侧，`IconFullscreenOutline16`，DSH 内置图标库中唯一的全屏 glyph），点击在居中弹窗与铺满视口之间切换；全屏态下 Esc 优先退出全屏（再次 Esc 关闭弹窗）

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
