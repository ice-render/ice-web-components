# 基础组件

所有组件的最小构件：面板、按钮、文本、图标与分隔线。

## `ICEWidget`

所有 UI 组件的基类（继承引擎 ICEGroup）。  在引擎的绘制能力之上只加四件事：交互态（enabled / hovered / focused）、键盘焦点 （`focusable` / `activate()`）、表单校验态（`validateStatus`）、表单取值约定 （`getFormValue` / `setFormValue`）。

源码：[`src/core/ICEWidget.ts`](../../src/core/ICEWidget.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `t(key: string, vars?: Record<string, string \| number>)` | `string` | 取组件内置文案（i18n 边界见 `docs/architecture/17-i18n-boundary.md`）。 |
| `setLocale(locale?: string)` | `void` | 设置本实例的语言（语言未注册时 `tFor` 会回退到当前语言）。 |
| `getFocusRingMode()` | `'keyboard' \| 'always' \| 'never'` |  |
| `setFocusRingMode(mode: 'keyboard' \| 'always' \| 'never')` | `this` |  |
| `shouldShowFocusRing(origin: 'mouse' \| 'keyboard' \| 'api')` | `boolean` | 按聚焦来源判断要不要画焦点环（ICEFocusManager 调用）。 |
| `setEnabled(enabled: boolean)` | `this` |  |
| `setAriaLabel(label: string)` | `this` | 无障碍：可读名称。 |
| `getAriaLabel()` | `string` |  |
| `isEnabled()` | `boolean` |  |
| `isHovered()` | `boolean` |  |
| `isFocusable()` | `boolean` | 是否可聚焦：显式声明 + 启用 + 可交互 + 最终可见（祖先 display:false 时不可聚焦）。 |
| `setFocusable(focusable: boolean)` | `this` |  |
| `isFocused()` | `boolean` |  |
| `setFocused(focused: boolean)` | `this` | 由 ICEFocusManager 调用；默认只记录状态（视觉表现由焦点环负责，子类可覆盖）。 |
| `activate()` | `void` | 键盘激活（Enter / Space）。默认等价于一次 click； |
| `getValidateStatus()` | `'default' \| 'error' \| 'warning' \| 'success'` |  |
| `setValidateStatus(status: 'default' \| 'error' \| 'warning' \| 'success')` | `this` |  |
| `getFormValue()` | `any` | 表单取值约定：控件覆盖这两个方法即可被 ICEForm 直接读写。 |
| `setFormValue(value: any)` | `void` |  |
| `setHovered(hovered: boolean)` | `this` |  |
| `getPreferredSize()` | `[number, number]` | 组件**想要多大**（布局用）。 |
| `setPainter(painter: ICEPainter \| null)` | `this` |  |
| `getPainter()` | `ICEPainter \| null` |  |
| `paintDecoration()` | `void` | 让 painter 画一次内部装饰。`doRender()` 每帧自动调用；单测可以直接调它来断言画笔行为 |
| `addChild(child: any, markDirty: boolean)` | `void` | UI 组件内部的图元只负责外观，不参与画布级拖拽、变换、连线。 |
| `onMount()` | `void` | 挂进 ICE 场景后调用一次（引擎 `AFTER_ADD`，与 `afterAddHandler` 同源）。 |
| `onUnmount()` | `void` | 被移出场景前调用一次（引擎 `AFTER_REMOVE`；`removeChild()` 与 `ICE.remove()` 两条路都会触发）。 |
| `onShow()` | `void` | 自身 `state.display` 由假变真时调用（对齐 Swing 的 `componentShown`）。祖先隐藏不算。 |
| `onHide()` | `void` | 自身 `state.display` 由真变假时调用（对齐 Swing 的 `componentHidden`）。祖先隐藏不算。 |
| `onResize()` | `void` | 自身宽或高变化时调用，**包含父容器布局器摆位引起的尺寸变化**。 |
| `onThemeChange()` | `void` | 主题切换后调用（`iceUIManager.setTheme()` 应用完成时）。 |
| `initEvents()` | `void` | 注册默认事件：转发给引擎基类（鼠标 / 键盘），再补上生命周期钩子要的一次性监听。 |
| `theme()` |  |  |

## `ICEContainer`

容器型组件基类：**应用层对外的主要入口** —— 页面、面板、工作区的默认基类。

- **契约**：继承本类 = ① 我能持有子节点、也能被嵌套；② 我负责把子节点排到正确位置； ③ 子节点坐标相对本容器的内容区（已扣 `padding`），因此可以无限嵌套。
- **选哪条线**：要 `addChild` 并负责排布 → 本类；画不持有子节点、也不负责排布的叶子控件 （指针、状态灯…）→ `ICEWidget`。判定只需问一句：**我要不要给它 `addChild` 并负责排布？**
- **布局**：优先挂布局策略（`setLayout`）；不挂才由调用方给绝对坐标（等价 Swing 的 `setLayout(null)`）。库内新增容器必须「挂布局」或「写清豁免原因」二选一，棘轮测试管着。
- **不涉及页面 / 路由 / 激活**：谁挂载我、什么时候让我出现，是**宿主**的决定。宿主用 `setState({ display })` 切换可见性，容器收到 `onShow` / `onHide` / `onResize` / `onMount` / `onUnmount`（定义与分发点见 `ICEWidget`）。`onUpdate(deps)` 不是引擎回调， 是应用层自己的约定：页面自己声明关心哪些值、自己调用它。
- **嵌套是能力，不是义务**：具体工程选扁平挂载（页面节点直接挂根、一套绝对坐标）还是 逐层嵌套，属于挂载方的策略，两者不冲突。
- **不覆盖 `toJSON()`**：容器是结构，属于文档本身，应当被序列化。要排除内部零件，由组件 自己覆盖（`ICEMenu` / `ICETabs` / `ICEScrollPane` 是范例）。
- **应用页面怎么写**：一页一个 `ICEContainer` 子类、`onUpdate()` 由宿主在"数据换新之后" 调用、别在 `onShow()` 里自更新（那一刻数据还是上一轮的）、入口决策表与验收清单 —— 完整口径见 `docs/guides/app-pages.md`。
- 完整口径见 `docs/guides/layout.md`。

源码：[`src/core/ICEContainer.ts`](../../src/core/ICEContainer.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `setLayout(layout: ICELayoutManager)` | `this` | 设置布局策略（引擎 ICEGroup.setLayout 的链式版本）。 |

## `ICEPanel`

面板：带填充、描边、圆角与阴影的基础容器，业务页面的“卡片底座”。

源码：[`src/components/ICEPanel.ts`](../../src/components/ICEPanel.ts)

## `ICESpace`

间距容器：按固定间距排列一组子组件。

- `direction: 'horizontal'`（默认）横向排列，`'vertical'` 纵向排列；
- `size` 是子项间距（默认 8）；
- 交叉轴对齐 `align: 'start' | 'center' | 'end'`；
- `wrap: true` 时横向超出容器宽度换行；
- 不传 width / height 时按内容自适应，加了子项就自动重排。 排列本身交给**引擎的布局器**（2026-09-15 起）：
- 纵向、以及横向不换行 → `ICEBoxLayout`（交叉轴 `align` 就是它的 `align`）；
- 横向且 `wrap: true` → `ICEFlowLayout`（`crossAlign` 是引擎补的行内交叉轴对齐）。 本组件自己只保留一条策略：**没给宽/高的那一轴按内容自适应**（布局器不管这件事， 它只按容器当前的盒子排版）。做法是先问布局器「内容想要多大」，写回自身后再让它排。

源码：[`src/components/ICESpace.ts`](../../src/components/ICESpace.ts)

**构造参数** `ICESpaceOptions` — 间距容器：按固定间距排列一组子组件。

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `direction?` | `'horizontal' \| 'vertical'` |  |
| `size?` | `number` | 子项间距，默认 8 |
| `align?` | `'start' \| 'center' \| 'end'` |  |
| `wrap?` | `boolean` |  |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `height?` | `number` | 高度（不传用组件默认值） |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getItems()` | `any[]` | 子项列表（按加入顺序）。 |
| `setSize(size: number)` | `this` |  |
| `getSize()` | `number` |  |
| `setAlign(align: 'start' \| 'center' \| 'end')` | `this` |  |
| `addItem(child: any)` | `this` | 加入一个子项并立即重排。 |
| `addChild(child: any, markDirty: boolean)` | `void` | 直接 `addChild` 也当作子项处理（保持容器语义）。 |
| `removeItem(child: any)` | `this` |  |
| `doLayout()` | `void` | 排布 = 「按内容自适应自身尺寸」+ 引擎布局摆子项。 |

## `ICEGrid`

24 栅格列：`span` 占多少格、`offset` 左边空多少格，`content` 是列内容。  一般配合 `ICEGrid`（行）使用，由行统一算宽度与位置，不需要手动设 width。

源码：[`src/components/ICEGrid.ts`](../../src/components/ICEGrid.ts)

**构造参数** `ICEGridOptions` — 24 栅格行：把若干 `ICEGridCol` 排成一行，放不下自动换行。  规则：先按 `span + offset` 把列分行（每行不超过 24 格），再按 `unit = (width - gutter × (列数 - 1)) / 24` 算每格宽度； 行高取该行最高列，行间距离是 `gutterY`。

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `gutter?` | `number` | 列间距，默认 16 |
| `gutterY?` | `number` | 行间距，默认 16 |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `height?` | `number` | 高度（不传用组件默认值） |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getCols()` | `ICEGridCol[]` |  |
| `addCol(col: ICEGridCol)` | `this` |  |
| `setGutter(gutter: number, gutterY?: number)` | `this` |  |
| `getGutter()` | `number` |  |
| `getGutterY()` | `number` |  |
| `doLayout()` | `void` | 排布 = 自持策略摆列 + 组件自己的高度策略（`autoHeight` 时高度 = 内容高度）。 |

## `ICEGridCol`

24 栅格列：`span` 占多少格、`offset` 左边空多少格，`content` 是列内容。  一般配合 `ICEGrid`（行）使用，由行统一算宽度与位置，不需要手动设 width。

源码：[`src/components/ICEGrid.ts`](../../src/components/ICEGrid.ts)

**构造参数** `ICEGridColOptions` — 24 栅格列：`span` 占多少格、`offset` 左边空多少格，`content` 是列内容。  一般配合 `ICEGrid`（行）使用，由行统一算宽度与位置，不需要手动设 width。

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `span?` | `number` | 占多少格（1..24），默认 24 |
| `offset?` | `number` | 左侧空出多少格，默认 0 |
| `content?` | `any` | 列内容 |
| `height?` | `number` | 高度（不传用组件默认值） |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getContent()` | `any` |  |
| `applyLayout(left: number, top: number, width: number)` | `void` | 由 `ICEGrid` 调用：设置列宽并把内容撑满列宽。 |

## `ICEButton`

按钮：`primary` / `default` / `text` / `link` 变体，`danger` 与三种尺寸， 自带 hover / 焦点 / 禁用态，点击时触发 `click`。

源码：[`src/components/ICEButton.ts`](../../src/components/ICEButton.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `setAriaLabel(label: string)` | `this` | 覆盖可读名称（之后 setText 不会再把名字改回去）。 |
| `setText(text: string)` | `this` |  |
| `getText()` | `string` |  |
| `setIcon(icon: string)` | `this` | 换图标（空字符串 = 去掉图标）。 |
| `getIcon()` | `string` |  |
| `isLoading()` | `boolean` |  |
| `setLoading(loading: boolean)` | `this` | 提交态：**挡住重复提交**，不只是换个样子 —— |
| `activate()` | `void` | 键盘激活（Enter/Space）在提交态下同样无效。 |
| `initEvents()` | `void` |  |
| `setEnabled(enabled: boolean)` | `this` |  |

## `ICELabel`

文本标签：包装引擎 `ICEText`，支持水平（`align`）与垂直（`verticalAlign`）对齐； 未显式给尺寸时采用文字的实测尺寸，便于参与流式/盒式布局。

源码：[`src/components/ICELabel.ts`](../../src/components/ICELabel.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `setText(text: string)` | `this` |  |
| `getText()` | `string` |  |
| `setTextColor(color: string)` | `this` | 改文字颜色（动态强调 / 置灰用，比如 BIOS 自检行的灰→黄→绿、菜单选中态）。 |
| `getPreferredSize()` | `[number, number]` | @overwrite |

## `ICETypography`

排版文本：标题层级 / 正文 / 链接，自带省略与折行。

- `variant: 'title'` + `level: 1..5`：五级标题，字号递减；
- `variant: 'paragraph'`：正文，配合 `rows` 做多行折行（末行补 `…`）；
- `variant: 'link'`：主色 + 可点击（触发 `click` 与 `onClick`）且可聚焦；
- `type`：语义色（`secondary` / `success` / `warning` / `danger` / `primary`）；
- `ellipsis: true`（或给了 `rows`）时按宽度截断——画布不会自动换行，长文案必须显式处理。

源码：[`src/components/ICETypography.ts`](../../src/components/ICETypography.ts)

**构造参数** `ICETypographyOptions` — 排版文本：标题层级 / 正文 / 链接，自带省略与折行。

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `text` | `string` | 文案 |
| `variant?` | `ICETypographyVariant` | 外观变体 |
| `level?` | `number` | 标题层级，1 最大（默认 1） |
| `type?` | `ICETypographyType` |  |
| `ellipsis?` | `boolean` | 省略：true = 单行省略；配合 rows > 1 = 多行折行省略 |
| `rows?` | `number` | 行数 |
| `strong?` | `boolean` |  |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `height?` | `number` | 高度（不传用组件默认值） |
| `fontSize?` | `number` |  |
| `onClick?` | `() => void` | 点击回调 |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getText()` | `string` |  |
| `getLines()` | `string[]` | 当前渲染出来的行（省略/折行后的结果）。 |
| `getFontSize()` | `number` |  |
| `getTextColor()` | `string` |  |
| `getLabelNodes()` | `ICELabel[]` |  |
| `setText(text: string)` | `this` |  |
| `setType(type: ICETypographyType)` | `this` |  |

## `ICEIcon`

图标：一个居中的字形（★ ✓ ℹ …），字号与颜色可配。

源码：[`src/components/ICEIcon.ts`](../../src/components/ICEIcon.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `setIcon(icon: string)` | `this` |  |

## `ICESvgIcon`

SVG 路径图标：给一段 `d` 路径数据，按 `viewBox` 缩放到目标尺寸并描边。

源码：[`src/components/ICESvgIcon.ts`](../../src/components/ICESvgIcon.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `setColor(color: string)` | `this` |  |
| `setStrokeWidth(width: number)` | `this` |  |
| `setPath(d: string)` | `this` | 换一段路径数据（不重建组件，适合「图标随状态变」）。 |
| `getPath()` | `string` |  |
| `getPathNode()` | `any` |  |

## `ICEIconTile`

图标磁贴（桌面图标 / 应用宫格）：大图标字形 + 下方文字标签。

- 单击选中（标签变蓝底白字，XP 桌面的选择样式），再点一下取消；
- **双击打开**（`dblclick` → `open` 事件 + `onOpen`），Enter/Space 等价（键盘可达）；
- `selected` 为受控初始值，`setSelected()` 是程序式接口（取消全选时用）。

源码：[`src/components/ICEIconTile.ts`](../../src/components/ICEIconTile.ts)

**构造参数** `ICEIconTileOptions` — 图标磁贴（桌面图标 / 应用宫格）：大图标字形 + 下方文字标签。

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `icon` | `string` | 图标字形（emoji 或单个符号） |
| `iconNode?` | `any` | 自绘图标节点（给了它就代替 `icon` 字形）。 |
| `label` | `string` |  |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `height?` | `number` | 高度（不传用组件默认值） |
| `iconSize?` | `number` |  |
| `fontSize?` | `number` |  |
| `selected?` | `boolean` |  |
| `onSelect?` | `(selected: boolean) => void` | 选中回调 |
| `onOpen?` | `(label: string) => void` |  |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getLabel()` | `string` |  |
| `isSelected()` | `boolean` |  |
| `setSelected(selected: boolean)` | `this` |  |
| `toggle()` | `this` | 单击切换选中（桌面图标的标准行为）。 |
| `open()` | `this` | 打开（双击 / Enter / Space）。 |
| `activate()` | `void` | 键盘激活 = 打开（与双击同义）。 |
| `getLabelColor()` | `string` |  |
| `getLabelBackground()` | `string` |  |

## `ICESeparator`

分隔线：1px 的水平或垂直分隔。

源码：[`src/components/ICESeparator.ts`](../../src/components/ICESeparator.ts)
