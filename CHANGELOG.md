# 变更日志

本文件记录所有值得注意的变更，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

> 下一个版本发布前，改动在这里累积。

### 变更

- **容器家族的「手写坐标」清零（2026-09-15 收尾批）**：
  - `ICESplitter` → 自持 `ICESplitterLayout`（`JSplitPane` + `BasicSplitPaneUI` 位）：两栏 + 分隔条位置
    归策略，拖拽只改 `requestedSize`（夹取/回调整字搬移）；删掉手写 `__layout` 与重入标志。
  - `ICEWindow` → 自持 `ICEWindowLayout`（`JInternalFrame` 位）：底板 / 标题栏 / 标题带 / 图标与标题 /
    三个按钮 / 客户区 / 缩放角全归策略；客户区是调用方内容只跟随尺寸。
  - `ICEGrid` / `ICEGridCol` → 自持 24 栅格策略（等列宽 + 行高按内容 + 自动高度 + `offset` 列偏移，
    逐字保留原语义）；组件只留 `autoHeight` 高度策略。
  - `ICEMenu` → 自持 `ICEMenuLayout`（树形竖排带缩进 / 收起态竖排 / 顶栏横排）；为让它成立，
    **展开/收起动画从写 `top` 改成写 `transform.translate`**（动画-safe，布局重排不会再弹回动画），
    `getItemBox()` 改为汇报**视觉盒子**（含位移）以免断言语义变化。
  - 棘轮现状：容器家族 **13 个已迁移、0 个豁免**；复合叶子 7 个已迁移（`ICEImageView` 明确排除，它
    的 cover/contain 是自绘落墨矩形、不是子节点布局）。
- **（破坏性）`ICEList` 行改由 painter 画，点击改几何反查**：删除 `getRowNode(key)`
  （行不再是节点），新增 `clickRow(key)` 与 `getRowBox(key)`；真实点击按
  「事件坐标 → 世界坐标 → 列表世界盒 + 滚动偏移 → 行下标」反查；绘制走 `paintRows()`。
  行数不再影响节点数（内容盒永远是空的）。迁移：
  `list.getRowNode(key).trigger('click')` → `list.clickRow(key)`。
- **（破坏性）`ICEVirtualList.renderItem` 从"给节点"改成"给行矩形直接画"**（家族早期，趁早改）：
  签名 `(index, item, node) => void` → `(context: { ctx, index, item, x, y, width, height }) => void`。
  行不再建节点 —— 一万条数据也是 **0 个行节点**（旧实现是"可见区 + buffer"个节点），
  绘制走 `painter`（Swing 的 `ListCellRenderer` + UI delegate 位）。配套：
  - 删除 `getRenderedNodes()`（返回节点列表的 API 没有意义了）；`getRenderedCount()` 保留，
    语义变成"这一帧画几行"，值仍等于 `getRange().count`；
  - 新增 `paintItems(ctx, origin?)`：浏览器里由 painter 每帧自动调用，单测可直接调它断言
    "画了哪几行、画在哪个矩形"；
  - 迁移：`renderItem: (index, item, node) => { node.addChild(...) }` 改成
    `renderItem: ({ ctx, item, x, y, width, height }) => { ctx.fillRect(...); ctx.fillText(...) }`
    （示例页 `examples/gallery.html` 已按新写法改）。
- **按"内容与装饰混排 → 组件自持策略"把四个容器收口了**（Swing 对应实现写在括号里）：
  - `ICEScrollPane` → 自持 `ICEScrollPaneLayout`（`JScrollPane` + `ScrollPaneLayout`）：
    内容盒（负滚动偏移）+ 两条轨道 + 两个滑块的几何全归策略；删掉手写的
    `__syncScrollbar` / `__syncHorizontalScrollbar`，滚动/改内容尺寸一律走 `doLayout()`。
  - `ICETabs` → 自持 `ICETabsLayout`（`JTabbedPane` + `BasicTabbedPaneUI`）：
    上/下/左/右四方位 + overflow（两端箭头 + 可滚动条带）都在策略里；删掉
    `__applyVerticalLayout` / `__applyBottomLayout`，`__applyOverflowLayout` 拆成"只建结构"
    的 `__ensureOverflowStructure`（布局策略只摆位置、不重建树）。
  - `ICEPagination` → `ICEBoxLayout(axis x)`：顺手收敛了老实现里 **76px** 的文案占位魔数。
  - `ICEFormItem`（复合叶子）→ 自持 `ICEFormItemLayout`：水平/垂直两形态都在策略里，删掉 `__layoutChildren`。
- **棘轮清单同步收口**：`tests/layoutConvention.test.ts` 的"已迁移"从 7 个涨到 11 个；
  剩余豁免 3 个（`ICEGrid`/`ICEGridCol` 分数列宽栅格、`ICEMenu` 子菜单需先迁成浮层），
  每条都写清了原因与下一步。
- **布局约定变成可执行的棘轮**：`AGENTS.md` 新增「布局铁律」（容器排布走引擎布局器 / 装饰走 painter /
  内容与装饰混合时自持策略 / 布局要能序列化），并由 `tests/layoutConvention.test.ts` 守住 ——
  `src/components` 里每个容器类必须在「已迁移」或「豁免清单（带原因）」里，新增容器必须二选一，
  不能再默默抄一套手写坐标。当前豁免：`ICEGrid`/`ICEGridCol`（分数列宽栅格）、
  `ICETabs`（页签 + 箭头 + extra 混排）、`ICEScrollPane`（视口 + 滚动条）、
  `ICEPagination`（页码混排 + 魔数）、`ICEMenu`（菜单项 + 浮层）。
- **`ICESegmented` 改用引擎布局器**：`block` 形态 → `ICEGridLayout({ cellSizing: 'equal' })`
  （等宽铺满，就是 Swing `GridLayout` 的口径；内缩 2 改由容器 `padding` 承担），
  非 block → `ICEBoxLayout({ axis: 'x', gap: 2 })`。几何与老实现逐像素一致（宽度 97.33、起点 2/101.33/200.67），
  组件不再手算分段坐标。
- **容器型组件现在也参与快照往返**：引擎这轮把布局策略序列化补齐（`layout: { type, props }`），
  `ICELayout` / `ICEForm` / `ICESpace` / `ICESegmented` / `ICEPanel` 等的版式存盘再打开不会散。
- **painter（Swing 的 UI delegate 位）真正可用，并开始承接内部装饰**：
  - 引擎管线的缺口补上：`ICEWidget.doRender()` 现在会把画笔交给 `painter.paint({ ctx, theme, component, origin })`
    （在 `super.doRender()` 之后取回组件本地 CTM，与 `ICETileMap` 自绘同一套口径），`origin` 是本地原点
    （默认盒子中心），单测可直接调 `paintDecoration()`。此前 `setPainter` 只影响 `getPreferredSize()`，
    **`paint()` 从来没有被调用过** —— 挂上去的 painter 画不出任何东西。
  - `ICEAvatar`：圆底 + 首字的两个子节点迁到 painter，`childNodes` 从 2 → 0；
    文本改成组件自己的状态（`setText` 不再同步子节点）。
  - `ICESkeleton`：占位条全部迁到 painter（N 个 `ICEWidget` 子节点 → 0），颜色改为每帧读主题
    （原来构造期写死，换主题不跟着变）。
  - 圆角矩形路径提取成公共工具 `roundRectPath`（`util/ICEStyle`），painter 与 `ICETileMap` 共用。
  - 回归：`tests/ICEPainter.test.ts`（8 例：paint 上下文/坐标、install-uninstall、首选尺寸协商、
    painter 自己挂事件、装饰不参与布局）+ 真机 `e2e/painter.spec.ts`（采样像素：圆内是主题主色、圆外透明）。
  - 文档：`docs/guides/custom-components.md`（装饰 vs 内容、painter 契约）、`docs/guides/layout.md`。

- **容器型组件改用引擎布局器**（2026-09-15，承接引擎「布局不继承 / 尺寸协商」改造）：
  - `ICELayout`：四区版式交给 `ICEBorderLayout`（顶栏 north / 侧栏 west|east / 内容 center / 页脚 south），
    本组件只声明「哪个节点是哪个区」和区高/区宽；**侧栏收起 = 把节点 `display` 关掉**，
    布局器按 Swing 口径跳过不可见子项，内容自动占满（不再手算剩余宽度）。`getRegionBox()` 改成
    直接读布局器摆好的盒子，公开 API 与几何口径不变。
  - `ICEForm`：纵向堆叠交给 `ICEBoxLayout({ axis: 'y', gap, align: 'stretch' })`（表单项自动拉满表单宽度），
    组件自己只保留「高度 = 内容高度」一条策略。
  - `ICESpace`：按形态选引擎布局器（横向/纵向 → `ICEBoxLayout`，换行 → `ICEFlowLayout`），
    组件自己只保留「没给宽/高的那一轴按内容自适应」。
  回归：`tests/engineLayout.integration.test.ts`（含「确实挂的是引擎布局器」的断言）。
  这三个组件的既有单测（ICELayout 9 例 / ICEForm 39 例 / ICESpace 5 例）全部原样通过。
- **引擎布局不再继承父层策略（对齐 Java Swing）**：引擎侧删掉了「子容器默认继承父层布局」的
  传播逻辑，`setLayout()` 只影响容器自己怎么摆子项。本库因此不再需要「用 `setLayout(null)` 退出
  继承」这类规避手段，`ICETabs` 里那处 `null` 现在只剩「清掉自己的策略」一个语义（注释已更新）。
  推论：**子容器要自动排布就自己 `setLayout()`**；给面板挂布局不会再重排它内部组件的零件。
- **`docs/guides/layout.md` 补「引擎布局不继承」、尺寸协商口径与「哪些容器在用引擎布局器」对照表**
  （`getPreferredSize()` / `setPreferredSize()`；构造期 `width/height` 只算边界）。
  `ICEGrid`（需要分数列宽跨列）与 `ICESplitter`（尺寸由拖拽驱动）继续自己算坐标。

### 修复

- **给容器挂引擎布局会破坏子组件内部几何**：引擎 2.7 及以前会把布局策略递归灌给所有后代容器，
  而本库每个组件都是 `ICEGroup` 子类、内部零件（按钮文字、输入框前后缀 / 清除按钮）都在同一个
  `childNodes` 里，于是一次 `setLayout()` 等于把整个界面的内部零件按同一策略重摆一遍
  （实测 `ICETextField(prefix, allowClear)` 的文本 `12 → 0`、清除按钮 `(170,6) → (316,0)`）。
  引擎修掉继承后不再发生，本库加回归用例守住：`tests/engineLayout.integration.test.ts`。

### 说明（"格子类"重构的收尾判定）

- 逐组件核实后确认：**真正"节点随数据无界"的只有 `ICEList`**（已改成 painter + 几何反查）。
  `ICETree`/`ICETable` 早已虚拟化（`ICETable` 在 `virtual: true` 下 `getRenderedRowCount() <= 12`），
  `ICECarousel`/`ICEMenu` 的节点数由调用方给的规模决定（幻灯片是内容、菜单项是个位数~几十）。
  因此**不为了自绘而做破坏性改造**；结论与判定表见
  [`docs/guides/row-painter-migration.md`](./docs/guides/row-painter-migration.md) 的「最终结论」。

### 注意（依赖）

- 上述修复依赖 **ice-render 当前 `dev` 分支**（`feat/layout-swing-alignment`，见该仓 CHANGELOG
  `[Unreleased]`），尚未发版；本仓 `devDependencies`/`peerDependencies` 的 `ice-render` 范围
  待引擎发版后再对齐（本地验证是把引擎构建产物同步进 `node_modules/ice-render` 跑的）。
- 本轮还依赖引擎新增的 `ICEBoxLayout.align`（含 `stretch`）与 `ICEFlowLayout.crossAlign`
  —— 旧引擎上这些选项会被静默忽略（表现为表单项不拉满宽度、Space 的 align 只在非换行时生效）。

## [1.6.0] - 2026-09-14

### 新增

- **主题桥：UI token 同步到引擎**（引擎 2.4.0 起）。引擎把「引擎自己画的那层」收成了主题 token
  （`semantic.chrome`：选中框 / 变换手柄 / 连接插槽 / 对齐引导线 / 连线标签 / 文本选区 / 阴影色 / 调试框），
  本库一直有自己的一套 UI token，缺的就是两者之间的一条桥 —— 以前换深色主题会出现
  「面板是暗的、手柄还是亮红亮绿」，因为那些外壳是写死在引擎里的。
  - `toEngineThemePatch(tokens)`：按**同名语义**映射（primary / success / warning / error→danger /
    text / border / background；选中框取 primaryBorder + primaryBg，手柄取 primary + primaryText，
    插槽取 success（悬停高亮 warning），引导线取 focusRing，连线标签取 surface + text，
    阴影色取 `shadows.*.shadowColor`），不新造颜色；缺字段有兜底，不会产出 undefined。
  - `applyThemeToEngine(ice, tokens?)`：把当前（或指定）主题一次性应用 —— 语义色 + 外壳一起对齐。
  - `iceUIManager.setTheme(name, ice)` 支持可选第二参：传了 ICE 实例就顺带同步引擎，
    不传维持既有行为（只改本库 token）。
  - 示例 `windows-xp.html` / `arcade.html` 改用 `.setTheme('xp', ice)`，自绘主题连外壳一起生效。

### 变更

- **peer / dev 依赖对齐 ice-render `^2.4.0`**：主题桥依赖 2.4 的 chrome token 与 `setChrome`，
  声明低了会**静默无效**（外壳还是旧色），所以把范围据实提到 2.4。

### 注意（实现细节，避免重复踩）

- 主题桥**不能用 `require()` 做延迟加载**：UMD 产物在浏览器里没有 `require`，
  两个示例页会直接白屏（e2e 冒烟第一时间抓到）。改成静态 import —— 两边都只在函数内用对方，模块循环安全。

### 验证

- 单测 +7（映射原则 / 三套主题都变 / 缺字段兜底 / `setTheme(name, ice)` 带动引擎 / 非 ICE 实例报错）。
- `npm run verify` 全绿（types + 1226 单测 + build + 文档生成与链接检查 + QA 计数）；
  `npm run test:e2e` 全绿：9 个示例页无报错且画布有输出。

## [1.7.0] - 2026-09-14

### 新增

- **拟物窗口的外观进主题**：`ICEThemeTokens` 新增 `window` 组（激活 / 非激活标题栏渐变、标题文字、
  窗体底色、外框、标题栏按钮的底与字形）。`ICEWindow` 的默认外观改为**从主题取**，
  `props.appearance` 仍可逐项覆盖。
  - 背景：这套配色以前**写死在组件里**（注释还写着"与组件库主题无关"），于是换主题时窗口是唯一不跟着变的东西；
  - 内置四套主题都给了对应值：浅色 =「白体 + 主色标题栏」、深色 =「暗蓝标题 + elevated 窗体」、
    高对比 =「黑体 + 亮黄标题 + 白框」、**怀旧 XP = 原来的 Luna 配色（从组件里搬过来，观感不变）**；
    街机主题继承深色主题的窗口外观。
  - 标题栏按钮的常态 / 悬停底色与字形色也一起进 `window`（`captionFace` / `captionFaceHover` / `captionGlyph`）。

### 修复

- **`ICETree` 的选中高亮底色**从写死的 `rgba(13,110,253,0.14)` 改为主题的 `colors.primaryBg`
  —— 深色 / 高对比主题下它以前一直是浅色主题的那层蓝。
- 文档锚点：`docs/guides/examples.md` 指向 `layout.md` 的两条链接与标题实际生成的锚点对不上
  （`docs:check` 一直报，这次修掉）。

### 说明：哪些颜色**不进**主题（有意保留）

- `ICEStyle` 的 `onSolid`（在实色上的可读文字色，按底色算黑/白）；
- `ICEColorPicker` 的色板（它提供的正是那些颜色）；
- `ICEPixelModel` 的像素调色板与各拟物组件的"高光/玻璃"层 —— 属于图形身份；需要换的时候走主题里对应组。

### 验证

- 单测 1289 → **1293**（新增 4 条：默认取主题 / 切主题跟着换 / XP 保留 Luna / props 覆盖仍优先）。
- `npm run verify` 全绿（types + 单测 + build + 文档生成与锚点检查 + QA 计数）；
  `npm run test:e2e` 9 个示例页全绿。

## [1.8.0] - 2026-09-14

### 修复

- **顶部 Message 的长文本被压扁**（2026-09-14，观感事故）：气泡宽度以前用 `text.length * 7 + 48` 粗估 ——
  中文一个字约 13px，估出来只有实际的一半，于是文字被挤到盒子外；而引擎当时是把宽度当
  `fillText(..., maxWidth)` 传下去的，canvas 会**把字形横向压扁**（不是截断），
  结果「报警：生化池溶解氧偏低…」被挤成一团，界面看着像字体坏了。
  现在：
  - `ICEMessage.show()` 的宽度改为**实测文字**（借 `ICELabel` 量，量不出来时按「一字 = 一个字号」兜底），
    再夹到 `[160, 480]` 且不超过画布宽度（两边各留 16）；
  - 单条消息的**上限从 320 放宽到 480**：320 对中文太窄，13px 一行只放得下约 24 字，
    正常长度的告警都会被截掉；
  - 「放不下就显示省略号」由引擎的文本溢出规则负责（`ice-render` 已把压字形改成截断），
    本库这一层只负责把盒子给对。

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

- **`ICETree` 虚拟滚动**（2026-09-14，S2 第二批第一件）：组织架构 / 文件树动辄几千个节点，
  以前一次全画出来。现在可见节点达到 `virtualThreshold`（默认 200）就只建「可视窗口 + 上下 2 行缓冲」
  （与表格虚拟行同一套算法），一万节点的树和一个 10 节点的树节点数一样多；滚动只换窗口，
  展开 / 收起之后窗口重算。配套 `isVirtual()` / `getRenderedRowKeys()` / `getScrollTop()` /
  `setScrollTop()`；节点少时仍是老行为（全部渲染）。

- **`ICEMenu` 的横向与收起态**（2026-09-14，同批）：
  - `mode: 'horizontal'`：顶层项横排（高度 = 单行高），带子菜单的项点开是**浮层**（走
    `ICEOverlayManager`：点外关闭、贴着触发项），不会把菜单撑高；子项点击后自动收起。
  - `collapsed`：侧栏收起态，宽度缩到 `collapsedWidth`（默认 56），只画图标、不内联展开子菜单；
    `setCollapsed()` 可来回切。配套 `getMode()` / `getItemBoxes()` / `getSubmenuKey()` /
    `openSubmenu()` / `closeSubmenu()`。

- **一批「做满」的形态**（2026-09-14，同批）：
  - `ICEAlert`：`banner`（通栏、直角、无描边，贴页面顶部当提示条）+ `action`（右侧操作区，
    可传 `{ text, onClick }`，摆在关闭按钮左边）。
  - `ICESkeleton`：`variant: 'text' | 'card' | 'table' | 'list'` —— 卡片骨架（封面 + 两行）、
    表格骨架（表头 + 按高度算行数 + 按宽度算列数）、列表骨架（头像 + 两行文字重复）。
  - `ICESegmented`：`block: false` 时按文字宽度排（默认仍是老行为「等宽铺满」）。
  - `ICEDrawer`：`size: 'default' | 'large'`（left/right 管宽度 360/560，top/bottom 管高度 240/360），
    显式 `width` / `height` 仍然优先。

- **修：段控默认值差点变成回归**（2026-09-14）：上面那条一开始把 `block` 的默认写成了
  「按文字宽度排」，admin 订单页的状态段控立刻有两段探出容器 —— 几何审计当场抓到
  （orders 待排查线索 0 → 2）。默认值改回「等宽铺满」（老行为），按文字宽度排改成显式
  `block: false`，orders 回到 0。

- **`ICEMenu` 键盘导航**（2026-09-14，S2 第三批第一件）：侧栏菜单不能只能用鼠标点。
  现在 ↓/↑ 移动激活项（**跳过 `disabled` 项**、到头回绕、还没激活时 ↓ 落第一项 / ↑ 落最后一项）、
  → 展开父项（再按一次落到第一个子项）、← 收起（已收起则回到父项）、Enter / Space 激活、
  Home / End 跳首尾、Esc 收起子菜单浮层；横向模式用 ← / → 在顶层项之间走。
  `ICEMenuItem` 补上 `disabled`（键盘与鼠标一起挡）；配 `getActiveKey()` / `setActiveKey()`。
  约定与树一致：**只在获得焦点时响应全局 keydown**。

- **`ICETabs` 溢出滚动**（2026-09-14，同批）：页签多到装不下时，以前只能被挤成一条条窄按钮
  （文字全糊）。现在会自动切到滚动形态：页签按自然宽度排、超出部分被裁剪，两端出现 ‹ › 箭头；
  `scrollBy()` / `scrollIntoView(index)` / `getScrollOffset()` / `getMaxScroll()` / `getTabBoxes()` 配套，
  点到被裁掉的页签会自己滚进视野。**只有当「等宽排也会挤到小于 `minTabWidth`（默认 64）」时才切**，
  几个页签的小组件保持老行为（这一条也是被 `components.test.ts` 的旧断言逼出来的）。

- **`ICEUpload` 的文件列表与进度**（2026-09-14，同批）：选完文件能看见「传了什么、传到哪了」。
  每行是「文件名 + 人类可读大小（512 B / 2.0 KB / 5.0 MB）+ 状态 + ✕」，
  `setFileProgress(uid, 0-100)` 之后行内出现细进度条（100 变「已完成」、进度条消失），
  删除走 `onRemove` 并照常触发 `onChange`；`showFileList: false` 可以只要拖拽区。
  配 `getFileRows()` / `getFileRowText()` / `getFileRemoveButton()` / `getFileProgressNode()`。

- **Modal 尺寸下限可配 + Drawer 数字尺寸**（2026-09-14，同批）：`ICEModal` 的 `minWidth` /
  `minHeight`（默认 240×140），复杂表单可以要求更大的缩放下限；`ICEDrawer` 的 `size` 现在也接受数字
  （比如「这一单要 480 宽」），`default` / `large` 预设不变。

- **Tree 虚拟滚动 × 拖拽的交叉验证**（2026-09-14，同批）：虚拟化之后只有窗口内的行有节点、
  滚动位置还会影响命中计算，两件事叠在一起最容易出错。新增 `getRowIndexAt(localY)`（把滚动偏移
  加回来）并补 4 条用例：滚动后命中到正确的全局行、真实鼠标路径按下/移动/落下按全局行号算、
  窗口外的行没有节点也拖不动（不会静默拖错行）、`moveNode` 之后窗口按新顺序渲染。

- **`ICETabs` 方位与拖动排序**（2026-09-14，S2 第四批第一件）：
  - `placement: 'top' | 'bottom' | 'left' | 'right'` —— 上下是横向条（贴顶 / 贴底），左右是竖排
    （组件高度自动变成「页签数 × 行高」）。非顶部方位不交流式布局管，由组件自己摆
    （流式布局会把贴底/竖排的位置重算一遍，等于白摆）。
  - `draggable`：按住页签拖到别的槽位松手就换位置，`onReorder(from, to, tabs)` 回调，
    而且**选中的那个页签跟着它自己走**（不是停在旧下标 —— 这是拖动排序最容易错的一处）。
    横向按横坐标、竖向按纵坐标算落点。

- **`ICEUpload` 自定义上传**（2026-09-14，同批）：`customRequest(file, { onProgress, onSuccess, onError })`
  给了它，加入文件就**自动开始上传**；实现里回报进度 / 成功 / 失败即可（也可以直接返回 Promise，
  resolve 成功、reject 失败）。状态与失败原因都画在行上（「· 42%」「· 已完成」「· 失败：网络超时」），
  失败行可以 `retryFile(uid)` 重传；没传 `customRequest` 时行为不变（文件只是加进列表）。

- **`ICEScrollPane` 横向滚动条 + 平滑滚动**（2026-09-14，同批）：内容比视口宽时底部出现横向滚动条
  （滑块比例、拖拽换算与竖向同一套），不宽就不出现；新增
  `smoothScrollTo(x, y, { duration })` —— 时长走 `resolveICEAnimationDuration`，
  所以 `duration: 0` 或开了**减少动效**时立即到位（两个特性天然打通）。

- **`ICEAlert` 关闭动画**（2026-09-14，同批）：`animation: true` 时点 ✕ 先淡出再隐藏
  （`display: false` 与 `onClose` 都在动画结束后才发生）；**默认仍是立即关闭**（老行为），
  开了减少动效也会立即关。

- **`ICETable` 单元格编辑**（2026-09-14，S2 第五批第一件）：列上声明 `editable: true` 就能点格子改内容。
  编辑态是**一个输入框盖在那一格上**（表格本身仍是原来那套渲染，不整体切成另一种模式）：
  Enter / 失焦提交（写回行数据 + `onCellEdit(row, key, value, previous)`）、Esc 取消，
  值没变就只是退出编辑态、不回调。配套 `startEdit()` / `commitEdit()` / `cancelEdit()` /
  `getEditingCell()` / `getEditNode()`；不可编辑的列与越界的行列都进不去。

- **`ICEUpload` 桌面拖放**（2026-09-14，同批）：把文件从桌面直接拖进画布。挂上场景后在画布元素上注册
  `dragover` / `dragleave` / `drop`：悬在拖拽区上方时区域**高亮**（`isDragOver()`），
  落下逐个走 `addFile`（accept / maxSize / maxCount 校验照旧生效，被拒的记 `lastRejectReason`）；
  落在区域外、组件被禁用、没有画布元素（老引擎 / node 环境）都安全跳过。

- **`ICEScrollPane` 滚动条可以拖了**（2026-09-14，同批）：以前滑块只是「指示器」，只有滚轮能滚。
  现在按住竖向 / 横向滑块拖动都行，换算按「轨道行程 ↔ 滚动行程」比例；按下时记住指针在滑块内的偏移，
  滑块不会跳一下；拖到两端就是滚到顶 / 底，越界自动夹取。配 `isThumbDragging()` /
  `getVerticalTrackHeight()`。

- **性能门禁：gallery 预算按实测重新钉住**（2026-09-14）：这一批跑 `qa:perf` 时 gallery 量到 66.6ms
  （预算 60ms）。**没有直接调预算蒙过去** —— 先把本批改动 `git stash` 掉、只跑上一版的 dist，
  结果同样量到 66.7ms，证明是**环境基线漂移**而非本批回归；据此把预算改成 90ms，并在脚本里写清
  来龙去脉与「引擎侧脏矩形修好后收回 20ms」的 TODO。

- **`ICETable` 树形数据**（2026-09-14，S2 第六批第一件）：行里有 `children` 数组的就是父行，
  默认只显示顶层，展开后按「父 → 子」深度优先显示；首列按深度缩进（每层 16px），父行有 ▸/▾ 三角
  （点子行不触发展开）。配套 `toggleRowExpanded()` / `setTreeExpandedKeys()` /
  `getTreeExpandedKeys()` / `isTreeRowExpanded()` / `isTreeParent()` / `getRowDepth()` /
  `getRowIndent()` / `getRowTreeToggle()`；`treeChildrenKey` 可换字段名、`defaultExpandedKeys` 开局就展开。
  管线是「**先按展开口径拍平，再筛、再排、再分页**」，所以筛选/排序/分页三件事不用各自改造；
  与虚拟化也天然兼容（拍平后就是普通行，虚拟窗口照旧只渲染可视区 —— 2000 个分组 + 展开的子行只画 20 来行）。
  筛选口径说明：对**拍平后的行逐条筛**，不做「父行被筛掉就藏起子行」那套隐式规则（简单、可预期）。

- **`ICEMenu` 折叠动画**（2026-09-14，同批）：`expandAnimation: 毫秒` 时子行从父行位置滑到自己的位置
  （`isAnimating(key)` / `getItemBox(key)` 可观察中间态）；**默认 0 = 立即展开**（老行为），
  开了「减少动效」也直接到位（时长统一走 `resolveICEAnimationDuration`）。

- **`ICETable` 编辑态失焦提交**（2026-09-14，同批）：正在编辑时点到编辑框以外（别的格子 / 行 / 表格外），
  先把这一格提交，再走原来的点击逻辑；点在编辑框里不提交。少了这条，用户点别处时改的内容就白填了。

- **`ICETable` 树形选择级联**（2026-09-14，S2 第七批第一件）：勾父行 → 整棵子树都选上
  （**含没展开、看不见的后代**）；取消父行 → 整棵子树取消；勾满一个父行的所有子行 → 父行自动选上，
  取走任一子行 → 父行跟着取消。选择记在 key 上（`getSelectedRowKeys()` / `isTreeRowSelected()` /
  `setTreeRowSelected()`），与「展开到第几层」「当前在第几页」都无关 —— 翻页回来还在。
  实现上的关键：**另建一份「全树索引」**（key → 父、key → 直接子行）。级联必须在没展开的子树上也成立，
  只靠「拍平可见行」那条路会漏掉折叠起来的后代（这是第一版踩到的坑）。

- **`ICETable` 编辑提交前校验**（2026-09-14，同批）：列上可以给 `validate(value, row)`，
  返回字符串就是不通过（那句话就是错误文案）。不通过时**留在编辑态**、输入框标红、
  `getEditError()` 给文案，而且**不写回数据、不回调**；改对了再提交照常通过，取消会清掉错误态。

- **`ICEMenu` 的收起动画**（2026-09-14，同批）：`expandAnimation` 现在对**收起**也生效 ——
  子行向上滑向父行并淡出、下方行同步上移，动画演完再真正重排（所以视觉上没有跳变）。
  时长为 0 或开了「减少动效」时仍然立即收起（老行为）。

- **`ICEUpload` 文件列表拖拽排序**（2026-09-14，同批）：`draggable: true` 时按住文件行上下拖即可换顺序，
  `onReorder(files, from, to)` 回调（顺序变了才触发，拖回原地不算）；落点越界自动夹取；
  不传 `draggable` 时拖不动（老行为）。

- **`ICETable` 树形级联接上多选列的勾选**（2026-09-14，S2 第八批第一件）：上一批级联只做在 API 上，
  多选列的复选框还走「只勾这一行」，点父行的框不会带上子行。现在两条路并成一条：
  勾父行的复选框 → 整棵子树选中（含未展开的）；级联选中的子行展开后也是勾上的（行底色一起高亮）；
  表头全选 = 所有可见行都选上（父行的级联自然带上未展开的后代）。
  实现上踩了两个坑，都值得记：① 内部同步复选框会**再次抛 change**，老路径靠 `selected === has` 挡住、
  新分支没有 → 递归成「勾上又取消」（加了 `syncingSelection` 护栏）；② 「是不是树形表」不能看
  `treeChildKeys` 有没有内容（普通表格每行也会登记一条空数组）→ 改成 `hasTreeData`（真的有子行才算），
  否则会把所有多选表格都带进树形语义（这一条是被既有 4 条多选用例当场抓到的）。

- **`ICETable` 汇总行按叶子聚合**（2026-09-14，同批）：`summaryRowsMode: 'leaves'` 时只把**叶子行**
  喂给 summary —— 树形数据里父行的数字本来就是子行合计，全算一遍等于重复计数。
  叶子口径是「**摊平整棵树**再取叶子（受筛选影响、不受展开状态影响）」，所以折叠起来看总额也不会变。
  默认仍是 `'all'`（老行为）。

- **`ICEUpload` 上传中禁止排序**（2026-09-14，同批）：`status: 'uploading'` 的行拖不起来；
  已经拖起来之后该行转入上传中，落下也不重排（否则用户拖到一半上传完成，行会自己跳走）。
  完成 / 失败的行照常能拖。

- **`ICEMenu` 横向子菜单的开合表现**（2026-09-14，同批）：点父项开、**再点同一个收起**（开关语义）；
  点另一个父项前一个自动收起；父项上的指示符跟着状态走（收起 ⌄ / 展开 ⌃）；Esc 收起。

- **`ICETable` 树形父行拖拽带整棵子树**（2026-09-14，S2 第九批第一件）：`moveTreeRow(dragKey, targetKey, position)`
  把父行连同后代一起挪走（子行相对顺序不变）；**拖进自己的后代会被拒绝**（否则整棵子树凭空消失，
  这条规则与 `ICETree` 共用同一个 util）；展开状态按 key 记，挪完还展开着；非树形表格仍走 `moveRow`。
  顺带修了 util 的一个硬编码：`moveTreeNode` 原先只认节点上的 `key` 字段，表格用的是 `rowKey`
  （默认 `id`），于是「移动成功」被误判成没动 —— 现在 `keyField` 可传（默认仍是 `key`，老调用不受影响）。

- **`ICETable` 汇总口径可选「整表 / 当前页」**（2026-09-14，同批）：`summaryScope: 'page'` 时只算当前页，
  翻页合计跟着变；默认 `'all'`（老行为）。与 `summaryRowsMode: 'leaves'` 组合时，页口径只算
  「当前页里在全树中是叶子的行」—— 父行的子行翻到下一页时不重复计（总额因此可能小于整表口径，
  这是口径本身的取舍，已写进这里而不是留给下一个人猜）。

- **`ICETable` 表头「已选 N 行」提示**（2026-09-14，同批）：`selectionSummary: true` 时表头右侧显示
  「已选 N 行」，**N 含级联出来的子行**（树形表勾一个父行会带上好几个子行，用户得看得见）；
  没选行时不显示，选择变化立刻更新；默认关闭（老行为）。

- **`ICETable` 的选中行集合覆盖级联与跨页**（2026-09-14，S2 第十批第一件）：`getSelectedRows()`
  在树形数据下改成**按 key 收集**（树的前序），所以级联选中的后代、翻页走的行都拿得到 ——
  批量操作（导出 / 发货）拿的就是它，漏一行是真会出事的。表头「已选 N 行」同样跨页累计。

- **`ICETable` 树形筛选口径可选**（2026-09-14，同批）：`treeFilterMode: 'ancestors'` 时**保留命中行的
  祖先链**（子行命中就把它的父行一起带出来，命中行藏在折叠的父行里时路径也会摊开）——
  与 `ICETreeSelect` 的搜索口径一致，否则用户看到一行「上海」不知道它在哪个大区下面。
  默认 `'flat'`（老行为：逐条筛，子行命中就单独露出来）。

- **`ICETable` 单元格自定义编辑器**（2026-09-14，同批）：列上给 `editor(value, row, meta)` 返回任意组件
  （下拉、日历、数字框…）替代默认文本输入框；位置与尺寸仍由表格按格子算；提交优先读 `getFormValue()`
  （下拉的值在那儿），没有就退回 `getValue()`；校验与回调照旧。返回 `null` 表示这一格用默认输入框。

- **`ICETable` 表头全选范围可选**（2026-09-14，同批）：`selectAllScope: 'all'` 时连**折叠起来没显示**的
  后代也一起选；默认 `'visible'`（眼前这些行，也是老行为）。
  注意「全选」**不走级联**：级联是「用户主动勾某一行」时的语义，全选要的就是它声明的那个范围。

- **`ICETable` 列版式导出 / 还原**（2026-09-14，S2 第十一批第一件）：`getColumnState()` 给「每列宽度 +
  列顺序」，`setColumnState()` 按它还原 —— 用户把「客户」列拖宽了，下次进来还是宽的。
  组件不负责存（塞 localStorage 或后端是业务的事），但保证 **JSON 往返可用**、未知 key 忽略、
  缺的列保持原样、宽度按 `minWidth` 夹取（脏数据压不没列）、新增的列接在后面不会丢。

- **`ICETable` 编辑器的 Tab 流转**（2026-09-14，同批）：改完一格按 **Tab** 提交并进同行下一个可编辑列
  （自动跳过不可编辑的列），行末落到下一行的第一列；**Shift + Tab** 反向；到头就提交并退出编辑态。
  校验不通过时**停在原地**，不会把用户送走。键盘用户填表终于不用摸鼠标了。
  实现细节：Tab 要挡掉浏览器默认行为，但合成事件没有原生事件可挡 —— 只在真有 `preventDefault` 时调。

- **复核虚拟滚动 + 筛选下的行命中**（2026-09-14，同批）：两种「第几行」很容易混淆
  （**数据的行号**：筛完拍平后的顺序；**屏幕上的行号**：可视窗口里第几行），拖拽/点选都吃这条映射，
  错一位就会「拖 A 结果动了 B」。补 3 条用例钉住：筛选后按筛完的顺序算、滚动量要加回来、
  到底部再点不越界（`__rowIndexAt` 现在有回归护栏）。

- **`ICETable` 列头拖拽换序**（2026-09-14，S2 第十二批第一件）：`columnDraggable: true` 时按住表头左右拖
  就能换列序（换完表头与数据列一起走），`onColumnReorder(order, from, to)` 回调；
  配套 `getColumnOrder()` / `setColumnOrder()` / `moveColumn()`，与上一批的
  「列版式导出 / 还原」正好组成一对（能改、能存、能还原）。
  判定放在 **mouseup**：位置没变就仍然算「点表头排序」（不然开了拖拽就没法排序了）。

- **编辑态 Tab 到视口外的行自动滚动**（2026-09-14，同批）：Tab 跨行时如果目标行在视口外，
  自动滚过去 —— 否则用户看不见自己在改什么。同时修了一处坐标口径：可滚动模式里编辑框现在挂在
  **bodyContent** 上（与行同层），top 用内容坐标（不含表头、不含滚动量），因此它会跟着行一起滚；
  普通模式仍是挂在表格上、top 加上表头高度。摘除编辑框时按**实际父亲**摘（两种模式都成立）。

- **门禁加固：`qa:arcade` 的旋转断言不再被重力坑**（2026-09-14，同批）：这条断言原先直接比
  「旋转前后的原始坐标」，而俄罗斯方块每帧都在下落 —— 旋转恰好跨过落地那一格时，坐标整体 +1，
  形状明明没变却判失败（本批真红过一次，单独复跑两次都过）。现在比较**归一化后的形状**
  （每块减去自身最小行列），把「时序抖动」从门禁里剔除。门禁偶发红比没有门禁更糟。

- **`ICETable` 列头拖拽的落点指示线**（2026-09-14，S2 第十三批第一件）：拖列头时画一条竖线标出落点
  （往右拖落在目标列的**右边界**、往左拖落在**左边界**），拖回原列就隐藏，松手消失 ——
  没有反馈的拖拽，用户不知道松手会落到哪。配 `getColumnDropIndicatorBox()`。

- **宽表里编辑 Tab 的横向滚动**（2026-09-14，同批）：上一批解决了「Tab 到视口外的行自动纵向滚」，
  这一批补横向那一半 —— 十几列的宽表里 Tab 到远处的列同样要滚进视野；已经在视野内就不乱滚。
  配 `__ensureCellVisible(rowIndex, key)`（纵向 `scrollToRow` + 横向 `setScrollLeft`）。

- **树形行跨父级拖动**（2026-09-14，同批）：`moveTreeRow` 现在支持把子行挪进另一个父行、或挪回根级
  （A 的 children 真的少一个、B 的多一个），自己的子树跟着走，**总行数一条不多一条不少**；
  挪进目标后目标自动展开（否则用户以为没生效）。

- **编辑校验的可见错误提示**（2026-09-14，同批）：`validate` 不通过时，除了标红与 `getEditError()`，
  还在那一格下面画出错误文案（`getEditErrorNode()`）—— 标红只说「有问题」，文案才说「有什么问题」；
  改对再提交或取消编辑后提示消失。

- **`ICEUpload` 上传队列**（2026-09-14，S2 第十四批第一件）：以前 `customRequest` 是「加一个立刻传一个」
  的散兵游勇 —— 选 20 个文件就是 20 个并发，浏览器和服务器都吃不消；现在 `uploadConcurrency`
  （默认 1）控制同时在跑的数量，其余标成 `pending` **排队**，有人完成/失败就按**当前列表顺序**
  启动下一个。因为是按当前顺序取，**用户拖拽换序之后，下一个启动的就是新顺序里的那个**；
  删掉排队中的文件它也不会被启动。配 `getQueuedCount()`，状态类型补上 `pending`。

- **单元格编辑的回车行为可配**（2026-09-14，同批）：`editEnterBehavior: 'next'` 时像表格软件那样
  「提交并往下走同一列」（最后一行则提交退出），默认 `'commit'`（提交退出，老行为）；
  校验不通过时停在原地，Tab 流转不受这个开关影响。

- **回归护栏：树形 × 列宽**（2026-09-14，同批）：列宽是全表共享的，父子行必须对齐 ——
  拖宽某列后父子行同列一起变、收展不改变列宽、换序后列宽按 key 跟着走（不是按位置）。

- **`ICETree` 跨父级移动的组件层用例**（2026-09-14，同批）：纯逻辑早就测过，但组件层要确认
  数据真的换了父级、`nodedrop` 抛了、可见行按新结构来；顺带补了 `getNodes()`
  （移动之后业务要拿最新结构）。

- **`ICEUpload` 的并发可运行中调整**（2026-09-14，S2 第十五批第一件）：`setUploadConcurrency(n)` 调大
  **立刻**把排队的灌进空位；调小只是不再补新的，**已经在跑的不打断**（半途掐断会留下脏数据）；
  `getConcurrency()`；并发至少 1（传 0 / 负数按 1 处理）。用户不用为了改并发刷新页面重选文件。

- **`ICEUpload` 的暂停 / 继续**（2026-09-14，同批）：`pauseUploads()` 之后不再派发新任务
  （在跑的让它跑完），`resumeUploads()` 按当前列表顺序把队列灌满；暂停期间加的文件进队列等着；
  配 `isUploadsPaused()`。以前发现选错文件只能全删了重来。

- **单元格编辑的空值策略**（2026-09-14，同批）：`emptyEditBehavior: 'keep'` 时**空值（含全空白）不算编辑**
  —— 既不改数据也不回调，直接退出编辑态，也轮不到 `validate` 报错；默认 `'clear'`（清空即写空，老行为）。
  有的列清空是合法操作（备注），有的列清空等于误触（编码、单号）。

- **定死「筛选 × 树形选择」的口径**（2026-09-14，同批）：`treeFilterMode: 'ancestors'` 带出来的祖先行
  **可以正常勾选**（它就是那一行，不再区分「为什么出现」）；级联照旧作用于整棵子树（含被筛掉、
  看不见的后代）—— **选择是数据层的**，所以切筛选口径、清空筛选都不会丢；已选提示与
  `getSelectedRows()` 同样与筛选无关。表头全选选的是「当前可见行」（带出来的祖先也在内）。

> 其余待发布的改动在这里累积。

### 依赖

- **`ice-render` 2.5.1 → 2.6.0**（2026-09-14，随 1.8.0 发布）：2.6.0 修掉了「文本放不下就被
  canvas 压扁字形」的老问题（改成按宽度截断 + 省略号）。**本库的 Message 观感修复依赖它** ——
  2.6.0 之前，即使气泡宽度算对了，超长文案仍会被压扁（引擎那时还在传 `fillText(..., maxWidth)`）。
  peer 范围 `^2.4.0` 本就覆盖 2.6.x，因此只是把 devDependency 提到最新。
- **`ice-render` 2.3.0 → 2.3.2**（2026-09-14）：引擎侧的最新版。升级后在真实浏览器里把九个示例
  全部重跑了一遍（9 页 e2e + 八套 QA 303 项 + 性能门禁），并人工操作了后台五个页面、
  gallery、工作台、Windows XP（登录 → 桌面 → 开两个窗口）、掌机（换卡带 + 真的按键玩）、
  像素画板 / 算法沙盒 / DOS 终端 / 自定义组件示例：**外观与功能均正常，零 console 错误**。
  升级前后行为一致（含 XP 桌面那处焦点环 —— 用 2.3.0 对照过，不是这次引入的）。
  生产依赖 `npm audit --omit=dev` 0 漏洞；4 条告警都在构建工具链（rollup 3 / babel / terser），
  修它们要跨大版本，属于既有的 devDeps 债务，不在这次升级范围内。

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
