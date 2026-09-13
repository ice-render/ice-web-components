# 基础组件

所有组件的最小构件：面板、按钮、文本、图标与分隔线。

## `ICEWidget`

所有 UI 组件的基类（继承引擎 ICEGroup）。  在引擎的绘制能力之上只加四件事：交互态（enabled / hovered / focused）、键盘焦点 （`focusable` / `activate()`）、表单校验态（`validateStatus`）、表单取值约定 （`getFormValue` / `setFormValue`）。

源码：[`src/core/ICEWidget.ts`](../../src/core/ICEWidget.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
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
| `setPreferredSize(width: number, height: number)` | `this` |  |
| `getPreferredSize()` | `[number, number]` |  |
| `setPainter(painter: ICEPainter \| null)` | `this` |  |
| `getPainter()` | `ICEPainter \| null` |  |
| `addChild(child: any, markDirty: boolean)` | `void` | UI 组件内部的图元只负责外观，不参与画布级拖拽、变换、连线。 |
| `theme()` |  |  |

## `ICEContainer`

容器基类：在此挂布局策略（`setLayout`，链式返回自身）。

源码：[`src/core/ICEContainer.ts`](../../src/core/ICEContainer.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `setLayout(layout: ICELayoutManager)` | `this` | 设置布局策略（引擎 ICEGroup.setLayout 的链式版本）。 |

## `ICEPanel`

面板：带填充、描边、圆角与阴影的基础容器，业务页面的“卡片底座”。

源码：[`src/components/ICEPanel.ts`](../../src/components/ICEPanel.ts)

## `ICESpace`

间距容器（业界组件库 Space / Flex 的最小版）：按固定间距排列一组子组件。

- `direction: 'horizontal'`（默认）横向排列，`'vertical'` 纵向排列；
- `size` 是子项间距（默认 8）；
- 交叉轴对齐 `align: 'start' | 'center' | 'end'`；
- `wrap: true` 时横向超出容器宽度换行；
- 不传 width / height 时按内容自适应，加了子项就自动重排。 注：布局本身由本组件完成（不是引擎的 `ICEFlowLayout`）——因为 Space 需要同时处理 交叉轴对齐与「按内容回写自身尺寸」，这两件事引擎布局器不管。

源码：[`src/components/ICESpace.ts`](../../src/components/ICESpace.ts)

**构造参数** `ICESpaceOptions` — 间距容器（业界组件库 Space / Flex 的最小版）：按固定间距排列一组子组件。

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

## `ICEGrid`

24 栅格列（业界组件库 `Col`）：`span` 占多少格、`offset` 左边空多少格，`content` 是列内容。  一般配合 `ICEGrid`（行）使用，由行统一算宽度与位置，不需要手动设 width。

源码：[`src/components/ICEGrid.ts`](../../src/components/ICEGrid.ts)

**构造参数** `ICEGridOptions` — 24 栅格行（业界组件库 `Row`）：把若干 `ICEGridCol` 排成一行，放不下自动换行。  规则：先按 `span + offset` 把列分行（每行不超过 24 格），再按 `unit = (width - gutter × (列数 - 1)) / 24` 算每格宽度； 行高取该行最高列，行间距离是 `gutterY`。

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

## `ICEGridCol`

24 栅格列（业界组件库 `Col`）：`span` 占多少格、`offset` 左边空多少格，`content` 是列内容。  一般配合 `ICEGrid`（行）使用，由行统一算宽度与位置，不需要手动设 width。

源码：[`src/components/ICEGrid.ts`](../../src/components/ICEGrid.ts)

**构造参数** `ICEGridColOptions` — 24 栅格列（业界组件库 `Col`）：`span` 占多少格、`offset` 左边空多少格，`content` 是列内容。  一般配合 `ICEGrid`（行）使用，由行统一算宽度与位置，不需要手动设 width。

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

排版文本（业界组件库 Typography）：标题层级 / 正文 / 链接，自带省略与折行。

- `variant: 'title'` + `level: 1..5`：五级标题，字号递减；
- `variant: 'paragraph'`：正文，配合 `rows` 做多行折行（末行补 `…`）；
- `variant: 'link'`：主色 + 可点击（触发 `click` 与 `onClick`）且可聚焦；
- `type`：语义色（`secondary` / `success` / `warning` / `danger` / `primary`）；
- `ellipsis: true`（或给了 `rows`）时按宽度截断——画布不会自动换行，长文案必须显式处理。

源码：[`src/components/ICETypography.ts`](../../src/components/ICETypography.ts)

**构造参数** `ICETypographyOptions` — 排版文本（业界组件库 Typography）：标题层级 / 正文 / 链接，自带省略与折行。

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
