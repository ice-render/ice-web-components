# 变更日志

本文件记录所有值得注意的变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

> 暂无（下一个版本发布前在这里累积）。

## [1.0.0] - 2026-09-12

第一个正式打标签的版本。从「能画控件」走到「能承载业务」：**86 个组件类 / 98 个测试套件 /
705 条单测 / 198 项浏览器断言（真实鼠标、键盘、滚轮）/ 6 个示例页**。

### 新增 · 组件与能力

- **命名与主题**：全库导出统一 `ICE` 前缀、与引擎 `ice-render` 运行时零重名（有回归测试守着）；
  主题换成 Bootstrap 5 语义色 + `*-text-emphasis` + `focusRing`，并支持 `registerTheme()` 自定义
  （内置 `ICE_XP_THEME` / `ICE_ARCADE_THEME`）。
- **自绘与大数据**：`ICETileMap`（整块棋盘 **1 个节点**，含标签层与 tween 脉冲）、
  `ICEVirtualList`（一万行只渲染 12~15 个节点）、`ICETable` 的**可滚动模式**（虚拟行 + 横向滚动
  + 固定列 + 拖表头缩列）。
- **拖拽编辑**：表格行拖拽排序、树节点跨层级拖拽（三分法 before/inside/after）、
  看板 `ICEKanban` 卡片跨列拖拽；落点计算与数据搬运都抽成纯函数（`ICEDragReorder`）。
- **文本输入**：`ICENativeInput` 原生输入替身 —— 聚焦挂透明 `<input>`，**中文输入法终于能打进去**
  （IME 组字、粘贴、真实光标），无 `document` 时降级回 keydown。
- **无障碍**：控件自带可读名称（按钮文字 / 占位符 / 勾选标签），
  `mountICEAccessibilityMirror()` 把引擎的 a11y 快照渲染成透明但真实的 DOM，
  点镜像元素 = 激活画布组件、focus 双向映射。
- **国际化**：`ICEI18n`（内置 `zh-CN` / `en-US`，`registerICELocale()` 可扩展，`t()` 三级兜底 +
  `{name}` 插值），组件内置文案全部走语言包。
- **游戏与场景**：`ICETetrisModel` / `ICESnakeModel` / `ICE2048Model` / `ICEMinesweeperModel` /
  `ICEHighScoreModel` 等纯逻辑模型；`examples/arcade.html` 掌机（三块卡带、音效、排行榜）、
  `examples/windows-xp.html`（开机 → 登录 → 桌面 → 注销/关机全流程、真能上网的 IE）。

### 修复（值得单独记的坑）

- 表格改宽度不重排、`ICESplitter` 构造期夹取丢尺寸、多行文本行距导致中文叠字等一批布局/渲染问题。
- 自绘组件 `super.doRender()` 之后必须 `applyActiveTransform()`，否则内容画到画布左上角。
- `ICETileMap` 内部重绘只置组件 `dirty` 不够，还要置 `ice.dirty`（否则脉冲动画卡住不动）。
- **拖拽目标必须是可交互节点**：`interactive: false` 的元素上，引擎指针捕获后的 `mousemove`
  坐标不会逐帧更新（看板卡片拖拽踩到，详见引擎 `15-app-driven-review.md` §3.0）。
- 分页表格拖行要按「当前页内下标」换算成绝对下标；换卡带/重开时重力计时器要归零。

### 文档

- README（英文）+ `docs/` 全套（架构、组件速查、API 参考、主题/表单/浮层/布局/测试/自定义组件/迁移）；
- `ROADMAP.md` 记录阶段 E 的评估结论与逐项验收标准；引擎侧 `15-app-driven-review.md`
  补了「游戏场景对照组」与「拖拽坐标语义」两节。
