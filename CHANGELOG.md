# 变更日志

本文件记录所有值得注意的变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

> 暂无（下一个版本发布前在这里累积）。

## [1.3.0] - 2026-09-13

第 3 批：**掌机的 BIOS**（开机自检 + 启动菜单）。掌机不再「一上来就是卡带」，
而是先跑一段老式控制台引导 —— 而且引导层自己也是一个可单测的纯逻辑模型。

### 新增 · BIOS

- **`ICEBiosModel`**（纯逻辑）：自检项按时序推进（`tick(dt)`，每项自带耗时，
  状态 `pending / running / ok`）、`getPostProgress()`、菜单光标循环、
  `confirm()` 只返回动作（`boot / settings / menu`）、相位机
  `post → menu|boot`、设置（快速启动 / 默认卡带）持久化 —— 坏存档与写盘失败都降级不抛。
- **`examples/arcade.html`**：开机自检屏（5 行「项目 + 详情 + 结果」，灰 → 黄 → 绿，每过一项
  响一声）、BIOS 启动菜单（卡带列表 + 设置 + 退出并启动，光标高亮）、设置页
  （快速启动开关 / 默认卡带 / 返回）、F2 与「BIOS (F2)」按钮随时回菜单（游戏页上就是复位键）、
  自检中按任意键跳过。出厂默认「快速启动」开着，开箱即玩；改过之后以存储为准。
- **`ICELabel.setTextColor()`**：动态改文字颜色（自检行的灰/黄/绿、菜单选中态）。
  构造期的 `style` 已经下沉到内层 `ICEText`，事后 `setState({ style })` 只改得到外壳容器。

### 变更

- 掌机底部一排改成 4 颗按钮 + 音效开关（`暂停 / 重开 / 排行榜 / BIOS`），按 20px 缝铺满。
- 游戏里的 `F2` 被 BIOS 占用（回到菜单）；卡带键盘与 `P / R / L` 的行为不变。

### 测试

- 单测 **769 条 / 103 套件**（新增 `ICEBiosModel` 17 条、`ICELabel.setTextColor` 3 条）。
- 浏览器 QA **246 项 / 六套**（`qa:arcade` 56 → 70：自检时序、F2 菜单、光标循环、
  菜单启动卡带、设置页开关、**刷新后设置还在**、快速启动两种走向）。

## [1.2.0] - 2026-09-12

第 2 批：**像素画板**（`examples/pixel-editor.html`）。这一版把「撤销/重做」和「导出」
做成了可复用的纯逻辑，顺手补掉 `ICETileMap` 换尺寸的一个真坑。

### 新增 · 像素编辑器

- **`ICEPixelModel`**（像素画布，纯逻辑）：行优先的调色板索引画布、`setPixel` /
  `drawLine`（Bresenham）/ `drawRect` / `fill`（四邻域迭代灌色）/ `clear` / `resize`、
  `getLineCells` / `getRectCells`（给拖动预览用，与落笔共用同一套坐标）、
  `undo` / `redo` / `commit`、`toSVG`（run-length 合并）/ `toRGBA(scale)`（喂 ImageData）/
  `toJSON` / `fromJSON`。
- **`ICEHistoryModel`**（通用撤销栈，纯逻辑）：push 清空 redo、超限丢最旧、
  `getDepth()`、变更通知带 `reason`（push / undo / redo / clear）—— 不只给画板用。
- **`examples/pixel-editor.html`**：铅笔 / 橡皮 / 直线 / 矩形 / 油漆桶、12 色调色板、
  撤销重做（按钮 + Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z）、1-5 切工具、尺寸 16/32/48、
  PNG 与 SVG 导出、状态栏（光标 / 历史深度 / 改动态）。画布与色板各是一个 `ICETileMap` 节点。
- **`qa:pixel`**：24 项浏览器断言，全程真实鼠标（按下 → 拖动 → 松开）：一次拖动只占一次撤销、
  直线/矩形拖动时先高亮预览且画布不变、油漆桶框内灌满框外不动、PNG 解 IHDR 得到 512×512。

### 修复

- **`ICETileMap.setSize()`**：`rows/cols/cellSize` 在构造期被缓存进实例字段，
  只 `setState({ rows, cols })` 会让内部字段与 state 不一致，下一次 `setTiles` 按旧尺寸
  抛错（「需要 1024 个格子，实际 256」）。新方法同时更新内部字段 / state / 默认宽高
  （显式给过 width/height 的保持不变），并清空旧格子数据。
- `qa:arcade` 里两条时间敏感的断言改成轮询（并行跑多套 QA 时不再偶发假红）。

### 测试

- 单测 **749 条 / 101 套件**（新增 `ICEHistoryModel` 6 条、`ICEPixelModel` 18 条、
  `ICETileMap` 换尺寸 2 条）。
- 浏览器 QA **232 项 / 六套**（新增 `qa:pixel` 24 项）。

## [1.1.0] - 2026-09-12

掌机的**第四块卡带**：一台真的 CHIP-8 虚拟机。这一版还带出一个**引擎级**渲染修复
（淡入面板里的文字会消失），需要 `ice-render` 的同批修复。

### 新增 · CHIP-8 虚拟机与掌机第四块卡带

- **`ICEChip8Model`**：4KB 内存、`V0`–`VF`、16 位 `I`、64×32 单色显存、两个 60Hz 定时器、
  16 键键盘，35 条指令（`00E0` / `1NNN` / `2NNN` / `DXYN` / `EX9E` / `FX0A` / `FX29` / `FX33` /
  `FX55` / `FX65` …）。`DXYN` 按位异或并把 `VF` 置碰撞位，`FX0A` 阻塞等按键。
  同时补齐与其它三块卡带一致的运行时契约：`pause()` / `resume()` / `isPaused()` /
  `isGameOver()` / `addChangeListener()`（暂停与复位也广播变更）。
- **自写 demo ROM**（`ICE_CHIP8_DEMO_ROM`）：清屏 → 画 8×8 笑脸 → 走一步 → 撞边取反速度 → 循环，
  顺带演条件跳过与补码减法；不依赖任何外部 ROM。
- **`examples/arcade.html` 第四块卡带**：64×32 显存与 4×4 机器键盘各是一个 `ICETileMap` 节点；
  按键点亮键盘格，`keydown` / `keyup` 链路肉眼可见；失焦清按键（否则 `FX0A` 永远在等）。
- **卡带键位契约**：卡带可用 `keys` 声明自己占用的键，外壳的 `P/R/L` 快捷键让路
  （CHIP-8 的 `R` 是机器键 7，不再是「重开」）。
- **单色屏配色 token**：`chip8On` / `chip8Off`（棋盘那种「暗格 + 描边」在 2048 格上会糊成摩尔纹）。

### 修复

- **淡入面板里的文字整条不见（引擎侧根因）**：离屏缓存把**祖先的不透明度**烤进了位图，
  而贴图路径不叠 alpha —— 淡入起点 `opacity=0` 的面板，文字被烤成空位图后再也画不出来
  （掌机的「已暂停」提示、模态 / 抽屉 / 消息的标题都中招）。引擎已改为「有效不透明度 ≠ 1
  不进离屏缓存」，并在不可缓存时丢掉旧位图；组件库这边的 QA 断言提示层**底板与文字都在**。
- **卡带的「重开」不再是唯一出路**：`R` 被机器键盘占用后，重开走按钮，且暂停按钮的文案跟着状态变。

### 测试

- 单测 **723 条 / 99 套件**（CHIP-8 19 条：指令级行为、暂停 / 结束态 / 变更通知、demo ROM 反弹不裂边）。
- 浏览器 QA **208 项 / 五套**（`qa:arcade` 46 → 56：显存与键盘单节点、ROM 真的在跑、
  键盘按下与松开、`R` 让给机器键盘、暂停冻住指令流、卡带行 5 格等缝不越界）。

## [1.0.0] - 2026-09-12

第一个正式打标签并**发布到 npm**（`npm install ice-web-components`）的版本。从「能画控件」走到「能承载业务」：**86 个组件类 / 98 个测试套件 /
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
