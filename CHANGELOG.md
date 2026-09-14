# 变更日志

本文件记录所有值得注意的变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 新增

- **`ICEButton` 的提交态与图标**（2026-09-14，S2 第一批）：`loading` 期间把 `interactive` 关掉
  —— 不只是换个样子，而是**挡住重复提交**（命中检测与键盘激活都会跳过它）；退出时恢复到构造期声明的可命中性，
  与 `disabled` 正交（禁用不改 `interactive`：禁用的按钮仍要能悬停看提示）。
  `icon` 只参与绘制，`getText()` 与无障碍名始终保持纯文字，配套 `setIcon()` / `getIcon()` / `isLoading()`。

- **`ICETextField` 的附属物**（2026-09-14，S2 第一批）：`prefix` / `suffix` / `allowClear` / `showCount`。
  前后缀占用组件内部的内边距（文字不再压到它们上），清除按钮只在「有值且悬停/聚焦」时出现
  （点了清空并触发 `change`），字数随值更新且受 `maxLength` 截断；配 `clear()` / `getCountText()` /
  `isClearVisible()` / `getTextNodes()`。以前这些要在每个页面手工贴标签，贴出来的还不跟输入框一起变。

- **`ICETabs` 的形态**（2026-09-14，S2 第一批第三件）：`type: 'card'`（文件袋式：未选中页不画底色，
  留在背景里；选中页贴内容）、`closable + onClose`（页签带 ✕，`closeTab()` 走同一条路径）、
  `extra`（页签右侧的扩展区，按钮或说明文字都行）。默认仍是原来的 `line` 形态，老页面行为不变。

- **`ICEDateRangePicker` 区间日期选择 + `ICEDateRangeModel`**（2026-09-14，S2 第一批第四件）：
  后台筛选里最常被手写的那块。字段分成两半（起 / 止），只选了一头时另一半还留着占位，
  用户一眼能看出「还差一下」；浮层左边是快捷项列（今天 / 近 7 天 / 近 30 天 / 本月 / 上月），
  右边是单月网格，**两列各占各的横向空间**（`getPanelLayout()` 把版式暴露给测试与几何审计）。
  规则全部落在模型层：先点结束再点开始会**自动交换**、只点一头是「进行中」不算完整区间、
  时间部分归一化到当天零点、`matchPreset()` 认出「当前区间正好等于某个快捷项」供界面高亮；
  这些以前要在每个业务页里手写一遍，且十个页面能写出十种不一致的行为。
  `examples/admin.html` 的订单筛选区也从「两个单值选择器凑一个区间」换成了它，日期真正进了过滤条件。

- **`ICETable` 的「分析半边」：列筛选 + 行展开 + 汇总行**（2026-09-14，S2 第一批第五件）。
  以前表格只能「摆数据」，筛选要挪到表格外面的表单里、合计得自己算、想看一行明细只能弹窗；
  现在这三件事都在表格里：
  - **列筛选**：列上声明 `filters`，表头出现漏斗（未激活 ▾ / 已激活 ●），点开是一列候选。
    同列多值是**或**、跨列是**与**（和用户对「筛选」的直觉一致），筛选跑在排序与分页**之前**，
    条件一变就回第 1 页；`getFilterState()` / `setFilter()` / `clearFilters()` / `onFilterChange` 配套。
  - **行展开**：`expandable.render(row, ctx)` 的内容画在**行下面**（不是弹层），后面的行真的被推下去、
    表格高度跟着长；展开状态按 `rowKey` 记，翻页回来还在；`rowExpandable` 可以逐行决定能不能展开。
  - **汇总行**：`summary(rows, columns)` 拿**筛选后的全量行**算出一行文案（分页时翻页合计不会变），
    排在表尾、与数据行用同一套对齐规则（右对齐的金额列不会错位）。
  这三项都不动虚拟化内核：筛选只改「喂给渲染的行」，汇总只是表尾多一行，展开只在普通渲染路径生效
  （虚拟滚动按等高行算可视窗口，混入不等高的展开区要先改虚拟化，那是另一件事）。

- **`ICETable` 可滚动路径不再被 `setData` 改高度**（2026-09-14）：虚拟行 / 固定列的表高度由调用方给，
  以前 `setData()` 会按行数把高度算回去（一万行就等于一万行的高），与「只渲染可视区」自相矛盾。

- **`examples/admin.html`**（2026-09-14）：订单筛选区用上区间日期（并真按日期过滤）；「最近订单」用上
  表头筛选与底部汇总；订单列表用上行展开（展开区里放这一单的摘要与「查看详情」）；切页时收起所有浮层
  —— 锚点所在的页面一藏，浮层就会孤零零地飘在画布上。

- **`ICEAffix` 吸顶**（2026-09-14，S2 第一批第六件）：长页面里「筛选条 / 表头 / 批量操作栏」跟着滚走
  是最常见的抱怨，DOM 一行 `position: sticky` 就解决，画布里没有这回事。现在补上：组件留在原位
  （**占位高度不变**，下面的内容不会跳），滚过「视口顶 + `offsetTop`」之后把自己贴回去并抬到最上层，
  滚回来两样都复原。贴着**最近的祖先滚动视口**（`ICEScrollPane`）算，`scrollTarget` 可显式指定；
  `isPinned()` / `getBaseTop()` / `setOffsetTop()` / `onPinChange` 配套。
  语义与 CSS sticky 一致：吸顶期间会盖住后面的内容，所以页面要按 `offsetTop` 留出空白。

- **`ICELayout` 布局骨架**（2026-09-14，同批）：顶栏 / 侧栏 / 内容 / 页脚四区域。四块都可选，
  **没给的不占空间**；侧栏可在左 / 在右、可收起（`setSiderVisible(false)` / `setSiderWidth(0)`）；
  容器尺寸变化自动重排；`getRegionBox(name)` 把版式暴露出来（测试与几何审计直接断言区域不交叠）。
  以前这套坐标计算在每个后台示例里都要手写一遍。

- **`ICESelect` 的 `tags` 模式与标签片**（2026-09-14，S2 第一批第七件）：
  `mode: 'tags'` = 多选 + 可以**创造**候选里没有的取值（输入后回车，或点候选列表顶部的「创建「xxx」」
  那一行）；输入与已有候选同名时选它、不重复造一个。字段区不再是一坨逗号串，而是画成一串**标签片**
  （片上有 ✕ 可删，空查询时按 Backspace 删最后一个），放不下或超过 `maxTagCount` 时折叠成 `+M`
  —— 折叠**只影响显示**，`getValue()` 永远给全量。单选/多选的既有语义（含 `getFieldLabel()`
  的文本口径）保持不变。

- **`ICESelect` 的大候选列表：滚动 + 虚拟窗口**（2026-09-14，S2 第一批第八件）。
  修的是一个**真缺口**：候选超过 6 条时下拉只画前 6 条，剩下的根本翻不到（只能靠搜索）。
  现在候选区自己就是滚动视口（`listHeight` 默认 6 行，内容高度按总条数算，滚动条比例才对）；
  条数到 `virtualThreshold`（默认 100）以上时只渲染可视窗口 + 上下 2 行缓冲 ——
  一万条候选的节点数和一个 8 条的下拉一样多。键盘上下移动会把窗口滚过去（`setListScroll` 也会），
  搜索过滤后重新判断要不要虚拟（过滤到几条就老实全画）。配套
  `isVirtual()` / `isListScrollable()` / `getListScroll()` / `setListScroll()` /
  `getListContentHeight()` / `getRenderedOptionValues()` / `getActiveIndex()`。

- **`ICETreeSelect` 的搜索与多选**（2026-09-14，S2 第一批第九件）：组织架构选人这类场景以前只能
  单选、也不能搜，几十个部门的树只能一层层点开找。现在：
  - `mode: 'multiple'`：点一行切换（面板不关），值是 `string[]`，字段显示标签列表，
    `maxTagCount` 超出折叠成 `+N`（只影响显示）；配套 `clear()` / `removeValue()` / `getSelectedLabels()`；
  - `showSearch`：按 label **或 key** 过滤（大小写不敏感），**保留命中节点的祖先链**并把命中路径
    自动展开 —— 层级路径不能丢，否则用户不知道选的是哪一支；搜不到时树是空的，不留一棵
    「看着能点、其实没命中」的树；空查询恢复整棵树；空查询时按 Backspace 删最后一个已选。

- **`ICEFormList` 与表单防抖校验**（2026-09-14，S2 第一批第十件）：
  - **`ICEFormList`**：可增删的重复表单项（多联系人 / 多地址 / 明细行）。每行有**稳定 rowKey**，
    增删只动那一行 —— 用下标当 key 是重复行最经典的 bug（删掉第一行，第二行的控件就显示第一行的数据）。
    `minRows` / `maxRows` 到了按钮变成真禁用态；`addRow` / `removeRow` / `updateRow` / `setRows` /
    `getRows` / `getRowKeys` / `getContentHeight` 配套，`renderRow(row, { index, rowKey })` 生成行内容。
  - **`validateDebounce`**：改值后延迟校验 —— 值**立刻**写进模型（`getValues()` 是最新的），
    只有错误提示延后；连续输入只跑最后一次校验；`validate()` / `submit()` 不受影响，仍立刻出结果。
    每敲一个字符就弹「格式不正确」是最讨嫌的交互之一，这条把它按住了。

- **`ICEModal` 的形态与 `ICEDrawer` 的插槽**（2026-09-14，S2 第一批第十一件）：
  - Modal：`draggable`（按住标题栏拖，自动夹在可见区里；全屏时拖拽无意义，直接忽略）、
    `resizable`（右下角缩放手柄，有下限且不超出可见区，标题/正文/页脚按钮跟着重排）、
    `size: 'sm' | 'md' | 'lg' | 'fullscreen'` 与 `toggleFullscreen()`（退出全屏**还原到进入前的
    位置与尺寸**）；`getDialogRect()` / `setPosition()` / `setSize()` / `dragBy()` 可编程控制。
  - Drawer：`extra`（标题栏右侧扩展区，摆在关闭按钮左边）、`footer`（贴底操作区，
    内容区让出高度并可用 `getContentBox()` 拿到）；两者都支持工厂函数。

- **三个全局质量开关**（2026-09-14，S2 第一批第十二件）：
  - **密度**：`iceUIManager.setDensity('compact')` 把控件高度与间距压到 85%（颜色与字体不动），
    密集后台能多放几行；同一主题 + 同一密度返回**同一个主题对象**（组件会比对引用）。
  - **减少动效**：`setICEReducedMotion(true | false | 'auto')`，`'auto'` 跟随系统
    `prefers-reduced-motion`；生效点在 `tween()` —— 开了之后时长按 0 处理，
    所有过渡（淡入淡出/滑入/缩放）同步落到终点，而不是「动画变快」。
  - **高对比主题**：`ICE_HIGH_CONTRAST_THEME`（内置 `high-contrast`）：纯黑底 + 纯白正文
    （对比度 21:1，WCAG AAA 要求 7:1），语义色与描边一并换亮，投影加深以便分层。

- **修：滑块手柄探出组件盒子**（2026-09-14）：手柄原先按「轨道比例 × 整宽」定位，
  最小值时圆心落在轨道起点、手柄左半截探到盒子外 9px（几何审计在订单页抓到两处），
  邻居按声明宽度排版就会被压住。现在行程两端各让出半个手柄，任何取值下手柄都完整落在盒子里；
  区间模式的填充条同步改成「手柄圆心之间」那一段。

- **`ICESvgIcon` 补齐**（2026-09-14）：这个件以前既没单测也没进示例（明账债）。
  补了 6 条单测（缩放 / 左上原点 / 颜色 / 描边宽度 / 换路径 / 无 `Path2D` 的 polyfill）、
  `setPath()` / `setStrokeWidth()` / `getPath()` / `getPathNode()`，并在 gallery 里加了演示
  —— 矢量图标不依赖 emoji 字体，跨平台一致。

> 其余待发布的改动在这里累积。

## [1.5.4] - 2026-09-14

修的是「**真实交互之后才暴露**」的一类问题：文案变了、盒子和邻居没跟着变。

### 修复

- **自动宽标签的包装盒跟随内层文字实测尺寸**（2026-09-14）：构造期还没有 canvas ctx，
  `ICEText` 走 DOM 兜底测量，长中文串会量得偏大（admin 实测 418，真字体量出来只有 228）。
  引擎后来用真字体重量时只更新了内层文字，**包装盒仍停在旧数字**上 ——
  于是点在盒子右边的空白会命中这个标签，按盒子宽度留位的邻居也全错位。
  现在渲染前对一次账（`__syncTextSize`）：实测尺寸变了就更新盒子、置脏、并请父容器重排；
  显式给过 `width/height` 的标签不受影响。
- **`examples/admin.html`：动态文案后重排**（2026-09-14）：订单页批量操作行的提示文字被
  「批量发货」按钮切掉一截（重叠 58×32，占按钮 56%）。根因是页面布局是**一次性**的 ——
  文案变了没人重排，按钮还停在「按旧文字宽度」算出的位置。现在 `flow()` 给容器登记
  `__relayout` 并把容器的 `requestLayout` 接到它上面（组件主动要求重排时会真的重算），
  新增 `setDynamicText()` 让 14 处动态文案（选中数量 / 金额区间 / 履约进度 / 密码强度…）
  改完从内到外重排（卡片 → 页面 → 滚动内容尺寸）。
- **面包屑宽度 420 → 220**（2026-09-14）：它以前伸到搜索框底下（盒子重叠 176×12）。
  搜索框 z 更高、点得到，但这是颗地雷 —— 任何 z 顺序调整都会让搜索框左边 176px 点不动。

### 测试

- 单测 **840 条 / 108 套件**（新增 `ICELabel` 尺寸同步 3 条）。
- 浏览器 QA **281 项 / 八套**（`qa:admin` 48 → 52：提示盒 = 文字实测宽度、提示与按钮不重叠、
  按钮左缘可点、清空选择换长文案后仍不重叠、搜索框左下角可聚焦）。

## [1.5.3] - 2026-09-13

### 测试

- **示例页冒烟回归**（2026-09-13）：新增 `e2e/examples-smoke.spec.ts`，用真实浏览器逐页走
  9 个合成示例页（admin / gallery / workbench / windows-xp / arcade / pixel-editor /
  algorithm-sandbox / dos-terminal / custom-component），逐张 canvas 断言
  **内容像素占比 > 0.5%**（不是"有任意不透明像素"——只刷一层底色的空页会骗过旧判据），
  同时断言 `window.ICE` / `window.ICEWEB` 已加载、无 pageerror / console error。
  新增 `npm run test:e2e` 与 `npm run verify:full`（verify + test:e2e）。
  反向验证过：移走 `node_modules/ice-render/dist/index.umd.js` 时 gallery 如期失败。

> 本版本**没有运行时改动**：包内代码与 1.5.2 完全一致（`dist` 逐字节相同），
> 只补上示例页的自动化回归与依赖（`@playwright/test`、`http-server`，均为 devDependencies）。

## [1.5.2] - 2026-09-13

### 修复

- **`ICELabel` 不再拿默认值 `10` 当「未设置」哨兵**（2026-09-13）：`__adoptTextSize()` 原先用
  `props.width === 10` 判断「调用方没给尺寸」，于是显式写 `width: 10` 的标签被当成未设置。
  现在按**构造时是否显式传了 width/height** 判定（与引擎 2.2 起 `ICEText` 的自动尺寸口径一致，
  见 ice-render AGENTS.md）。回归用例 `tests/ICELabel.size.test.ts`。
- **依赖 ice-render 提到 `^2.2.0`**（2026-09-13）：`ICELabel` 的新尺寸口径需要引擎 2.2 起的行为
  （`ICEText` 按「调用方是否显式给尺寸」判定自动尺寸），因此 peer/dev 依赖从 `^2.0.0` 收紧到 `^2.2.0`，
  锁文件同步到 `2.2.0`（此前锁在 `1.4.11`，与 `^2.0.0` 冲突、`npm ls` 报 invalid）。

## [1.5.1] - 2026-09-13

### 变更

- **依赖 ice-render `^2.0.0`**：引擎把类型标识统一成 `namespace:Type` 并让重复注册明确抛错。
  本包不注册自定义图元（只消费引擎的图元与主题），代码无需改动。
- **文档同步**（`docs/guides/custom-components.md`）：自定义组件的 `registerType` 示例改成
  `ice.registerType('my-app:ICEMetric', ICEMetric)`，并说明冲突策略与旧名不再兼容。

## [1.4.0] - 2026-09-13

第 4 批（1-4 的最后一批）：**算法沙盒 + DOS 终端**。两个新页面共用一条思路 ——
「把过程录成轨迹再回放」与「把规则放进纯模型」，页面只负责画和收键盘。

### 新增 · 算法沙盒（`examples/algorithm-sandbox.html`）

- **`ICETracePlayerModel`**（通用轨迹播放器）：`load / play / pause / stepForward /
  stepBackward / seek / reset / setSpeed / tick(dt)`，速度 1..60 步/秒、到头自动停、
  变更通知 —— 排序 / 寻路 / 以后任何「过程可视化」都能用。
- **`ICESortModel`**：冒泡 / 插入 / 选择 / 归并 / 快速五种排序，`run()` 产出轨迹
  （每帧带 values / compare / swap / sortedFrom 与比较交换计数）。
- **`ICEMazeModel`**：网格 + 墙 + 起点终点，`solve()` 产出 BFS / DFS / Dijkstra / A* 的轨迹
  （每帧带网格快照 / 当前格 / 边界 / 已访问 / 最终路径），另有随机撒墙与 `setStart` / `setGoal`。
- 页面：排序柱子用 `max × n` 的 `ICETileMap`（蓝=普通 / 黄=比较 / 红=交换 / 绿=已就位），
  迷宫用格子状态网格；播放 / 单步 / 变速 / 切算法 / 切模式 / 拖动画墙，空格与 ←→ 走键盘。

### 新增 · DOS 终端（`examples/dos-terminal.html`）

- **`ICEDosModel`**（虚拟文件系统 + 命令解释器，纯逻辑）：`DIR / CD / MD / RD / TYPE /
  ECHO（含 > 与 >> 重定向）/ COPY / REN / DEL / TREE / CLS / VER / DATE / TIME / HELP / EXIT`，
  路径支持 `\` `/` `.` `..` 与绝对路径、命令与文件名大小写不敏感、`run()` 永不抛；
  历史（空命令不入栈、相邻重复只记一条）与 Tab 补全都在模型里。
- 页面：`ICEScrollPane` 输出区 + 自动滚到底 + 闪烁光标 + 提示栏，`exit` 之后任意键重新开机。

### 修复

- **Tab 补全补的是当前目录里的名字**：在 `C:\GAMES` 里敲 `type TET` + TAB 曾补成
  `GAMES\TETRIS.EXE`（会被当成再进一层目录）；现在目录部分原样保留、名字部分在当前目录里补，
  `..\REA` 也能补成 `..\README.TXT`。
- `qa:algo` 里两条依赖随机迷宫的断言改成确定性场景（拖动从空地上开始、比较用固定墙型），
  不再偶发假红。

### 测试

- 单测 **825 条 / 107 套件**（新增 `ICETracePlayerModel` 9、`ICESortModel` 15、
  `ICEMazeModel` 13、`ICEDosModel` 19）。
- 浏览器 QA **277 项 / 八套**（新增 `qa:algo` 14、`qa:dos` 17）。

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
