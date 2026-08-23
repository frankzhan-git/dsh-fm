// dsh-fm 文案字典（中文）—— 经官方 @deepseek-ai/dsh-client-locale 注册（ns: fm）。
// 与 en.js 键集一致（官方约定：缺键回退 en，再回退 common，最后显示键本身）。
export const zh = {
  // —— git 胶囊（GitCapsule）——
  'git.loading': '读取 git 状态…',
  'git.retry': '重试',
  'git.retryTitle': '重新获取 git 状态',
  'git.errorPrefix': 'git 状态获取失败：',
  'git.errorUnknown': '未知错误',
  'git.statTitle': '未提交变更统计',
  'git.commitTitle': '提交变更',
  'git.showAll': '显示全部文件',
  'git.showChanged': '仅显示变更文件',
  'git.indexTitle': '索引管理：勾选=加入索引，取消=排除并同步 .gitignore',
  'git.init': '初始化仓库',
  'git.initTitle': '在当前目录创建本地仓库',
  'git.installInit': '安装并初始化仓库',
  'git.installInitTitle': '安装 git 并在当前目录创建本地仓库',
  'git.initBusy': '初始化中…',
  'git.installing': '安装中…',
  // —— 树工具条 / 弹窗（架构根治新增面）——
  'tree.title': '工作目录',
  'tree.titleTitle': '回到工作目录',
  'tree.hint': '单击展开/预览，双击进入目录，双击根目录返回上级，右键更多操作',
  'tree.indexHint': '勾选=加入索引，取消=排除并同步 .gitignore',
  'tree.busy': '…',
  'tree.emptyLoading': '加载中…',
  'tree.emptyCounting': '正在统计变更…',
  'tree.emptyNoChanges': '无变更文件',
  'tree.emptyDir': '此目录为空',
  // —— 侧边栏入口 ——
  'input.title': '工作目录文件管理器',
  'input.aria': '文件管理',
}
