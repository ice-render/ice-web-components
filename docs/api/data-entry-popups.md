# 数据录入（浮层类）

字段 + 浮层的组合。浮层统一走 `ICEOverlayManager`：工具层渲染、点外/Esc 关闭、空间不足自动翻转并夹进可见区。

## `ICESelect`

选择器：输入框外观 + 下拉选项（单选 / 多选 / 搜索过滤）。

- 字段区自绘（选中标签或 placeholder + 下拉箭头），错误态边框标红；
- 下拉走 `ICEOverlayManager`（工具层、点外关闭、Esc、入场动画），并声明 `keyboardCaptured`， 打开期间方向键/Enter/字符输入由本组件处理（搜索过滤）；
- 可聚焦（Tab 可达），`activate()`（Enter/Space）打开下拉开；
- 表单集成：`getFormValue` / `setFormValue` 与 ICETextField 同语义。

源码：[`src/components/ICESelect.ts`](../../src/components/ICESelect.ts)

**构造参数** `ICESelectOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `options` | `ICESelectOption[]` | 候选项 |
| `value?` | `string \| string[]` | 当前值 |
| `mode?` | `'single' \| 'multiple'` |  |
| `showSearch?` | `boolean` |  |
| `placeholder?` | `string` | 占位文案 |
| `disabled?` | `boolean` | 是否禁用（禁用后不响应交互、不可聚焦） |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `height?` | `number` | 高度（不传用组件默认值） |
| `optionHeight?` | `number` |  |
| `onChange?` | `(value: any, option: any) => void` | 值变化回调 |
| `focusable?` | `boolean` | 是否参与键盘焦点轮转（默认 true，禁用时自动不可聚焦） |
| `manager?` | `ICEOverlayManager` | 浮层管理器（一般不用传，组件会取共享实例） |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `setOverlayManager(manager: ICEOverlayManager)` | `this` | 供测试/外部注入浮层管理器 |
| `getValue()` | `any` |  |
| `setValue(value: any)` | `this` |  |
| `getFormValue()` | `any` |  |
| `setFormValue(value: any)` | `void` |  |
| `isOpen()` | `boolean` |  |
| `getFieldLabel()` | `string` |  |
| `getQuery()` | `string` |  |
| `getVisibleOptions()` | `ICESelectOption[]` |  |
| `getOptionNode(value: string)` | `ICEWidget \| null` |  |
| `setOptions(options: ICESelectOption[])` | `this` |  |
| `activate()` | `void` |  |
| `toggle()` | `this` |  |
| `open()` | `this` |  |
| `close()` | `this` |  |

## `ICEAutoComplete`

自动完成（业界组件库 AutoComplete）：文本输入 + 候选下拉。

- 组合 `ICETextField`（输入与取值/表单语义）与浮层里的候选列表；
- 输入即过滤（label/value 包含匹配，忽略大小写），无候选时下拉收起；
- 点击候选写入输入框并回调 onSelect；键盘 ↑/↓ 移动高亮、Enter 选中、Esc 关闭。

源码：[`src/components/ICEAutoComplete.ts`](../../src/components/ICEAutoComplete.ts)

**构造参数** `ICEAutoCompleteOptions` — 自动完成（业界组件库 AutoComplete）：文本输入 + 候选下拉。

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `options` | `string[]` | 候选项 |
| `value?` | `string` | 当前值 |
| `placeholder?` | `string` | 占位文案 |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `height?` | `number` | 高度（不传用组件默认值） |
| `optionHeight?` | `number` |  |
| `onSelect?` | `(value: string) => void` | 选中回调 |
| `onChange?` | `(text: string) => void` | 值变化回调 |
| `manager?` | `ICEOverlayManager` | 复用外部浮层管理器（测试注入） |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getValue()` | `string` |  |
| `setValue(value: string)` | `this` |  |
| `getFormValue()` | `any` |  |
| `setFormValue(value: any)` | `void` |  |
| `getFieldText()` | `string` |  |
| `setValidateStatus(status: any)` | `this` |  |
| `getValidateStatus()` | `any` |  |
| `isOpen()` | `boolean` |  |
| `getVisibleOptions()` | `string[]` |  |
| `getActiveIndex()` | `number` |  |
| `getOptionNode(value: string)` | `ICEWidget \| null` |  |
| `getPanel()` | `ICEPanel \| null` | 当前候选浮层（未打开时为 null）。 |
| `activate()` | `void` |  |
| `close()` | `this` |  |

## `ICECascader`

级联选择（业界组件库 Cascader 的最小版）。

- 字段显示已选路径（`separator` 可定制），未选显示 placeholder，错误态边框标红；
- 浮层按层级横向排列：点父节点展开下一列（不关闭），点叶子定值并关闭；
- 值统一是最深一层的 `value`，路径可由 `getPath()` 取回（便于回显上级）；
- 关闭策略与 Select 系列一致：浮层 closeOnOutsideClick:false，由组件自己判断点外 + Esc。

源码：[`src/components/ICECascader.ts`](../../src/components/ICECascader.ts)

**构造参数** `ICECascaderOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `options` | `ICECascaderOption[]` | 候选项 |
| `value?` | `string` | 当前值 |
| `placeholder?` | `string` | 占位文案 |
| `disabled?` | `boolean` | 是否禁用（禁用后不响应交互、不可聚焦） |
| `separator?` | `string` |  |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `height?` | `number` | 高度（不传用组件默认值） |
| `placement?` | `ICECascaderPlacement` |  |
| `onChange?` | `(value: string, path: ICECascaderOption[]) => void` | 值变化回调 |
| `manager?` | `ICEOverlayManager` | 浮层管理器（一般不用传，组件会取共享实例） |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getValue()` | `string \| undefined` |  |
| `setValue(value: string \| null \| undefined)` | `this` |  |
| `getFormValue()` | `any` |  |
| `setFormValue(value: any)` | `void` |  |
| `getPath()` | `ICECascaderOption[]` | 已选路径（根 → 叶子）；未选时为空数组。 |
| `getFieldLabel()` | `string` |  |
| `isOpen()` | `boolean` |  |
| `getPanel()` | `ICEPanel \| null` |  |
| `getColumnNodes()` | `ICEScrollPane[]` |  |
| `getColumnNode(level: number)` | `ICEScrollPane \| null` |  |
| `getOptionNode(level: number, value: string)` | `ICEWidget \| null` |  |
| `activate()` | `void` |  |
| `toggle()` | `this` |  |
| `open()` | `this` |  |
| `close()` | `this` |  |

## `ICETreeSelect`

树选择器（业界组件库 TreeSelect）：下拉里放一棵 ICETree，选中节点后回写值。

- 字段区与 ICESelect 同构（选中标签 / placeholder + ▾），错误态边框标红；
- 下拉内容直接复用 `ICETree`（层级展开、缩进、箭头命中区、选择模型都在那边）；
- 浮层自己管关闭（`closeOnOutsideClick: false` + 自身命中盒）—— 浮层的命中盒判定会在 click 派发前关掉浮层，树节点就收不到点击（Select/AutoComplete 都踩过这个坑）；
- 值就是节点 key，表单语义同 ICETextField（getFormValue / setFormValue）。

源码：[`src/components/ICETreeSelect.ts`](../../src/components/ICETreeSelect.ts)

**构造参数** `ICETreeSelectOptions` — 树选择器（业界组件库 TreeSelect）：下拉里放一棵 ICETree，选中节点后回写值。

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `nodes` | `ICETreeNode[]` | 树节点 |
| `value?` | `string` | 当前值 |
| `placeholder?` | `string` | 占位文案 |
| `disabled?` | `boolean` | 是否禁用（禁用后不响应交互、不可聚焦） |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `height?` | `number` | 高度（不传用组件默认值） |
| `treeHeight?` | `number` |  |
| `defaultExpandAll?` | `boolean` |  |
| `onChange?` | `(key: string, node: ICETreeNode) => void` | 值变化回调 |
| `manager?` | `ICEOverlayManager` | 浮层管理器（一般不用传，组件会取共享实例） |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getValue()` | `string \| null` |  |
| `setValue(key: string \| null)` | `this` |  |
| `getFormValue()` | `any` |  |
| `setFormValue(value: any)` | `void` |  |
| `getFieldLabel()` | `string` |  |
| `isOpen()` | `boolean` |  |
| `getTree()` | `ICETree \| null` |  |
| `activate()` | `void` |  |
| `toggle()` | `this` |  |
| `open()` | `this` |  |
| `close()` | `this` |  |

## `ICEDatePicker`

日期选择器（业界组件库 DatePicker 的最小版）。

- 字段区显示所选日期（可自定义 `format`），未选显示 placeholder，错误态边框标红；
- 日历浮层：月份标题 + ‹/› 切月 + 周标题（周一开头）+ 6×7 网格（含上下月补位）； 今天、选中日分别高亮；
- 值统一是 `YYYY-MM-DD` 字符串（可序列化、可直接进表单）；
- 关闭策略与 Select 系列一致：浮层 closeOnOutsideClick:false，由组件自己判断点外 + Esc。

源码：[`src/components/ICEDatePicker.ts`](../../src/components/ICEDatePicker.ts)

**构造参数** `ICEDatePickerOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `weekStart?` | `number` | 一周首日（0=周日 … 6=周六）；缺省按 locale 推导（en-US → 周日，zh-CN → 周一），兜底周一 |
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `value?` | `string` | 当前值 |
| `placeholder?` | `string` | 占位文案 |
| `disabled?` | `boolean` | 是否禁用（禁用后不响应交互、不可聚焦） |
| `format?` | `(value: string) => string` | 显示格式（默认原样显示 YYYY-MM-DD） |
| `today?` | `string` | 注入「今天」，便于测试与演示 |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `height?` | `number` | 高度（不传用组件默认值） |
| `cellSize?` | `number` |  |
| `placement?` | `ICEDatePickerPlacement` |  |
| `onChange?` | `(value: string) => void` | 值变化回调 |
| `manager?` | `ICEOverlayManager` | 浮层管理器（一般不用传，组件会取共享实例） |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getValue()` | `string \| null` |  |
| `setValue(value: string \| null)` | `this` |  |
| `getFormValue()` | `any` |  |
| `setFormValue(value: any)` | `void` |  |
| `getFieldLabel()` | `string` |  |
| `isOpen()` | `boolean` |  |
| `getPanel()` | `ICEPanel \| null` |  |
| `getViewMonth()` | `{ year: number; month: number }` |  |
| `setViewMonth(year: number, month: number)` | `this` |  |
| `prevMonth()` | `this` |  |
| `nextMonth()` | `this` |  |
| `getDayNode(date: string)` | `ICEWidget \| null` |  |
| `getDayCells()` | `ICEDateCell[]` | 当前视图月的 6×7 网格（周一开头，含上下月补位）。 |
| `activate()` | `void` |  |
| `toggle()` | `this` |  |
| `open()` | `this` |  |
| `close()` | `this` |  |

## `ICETimePicker`

时间选择器（业界组件库 TimePicker 的最小版）。

- 字段区显示所选时间，未选显示 placeholder，错误态边框标红；
- 浮层是「时/分/秒」三列（`format: 'HH:mm'` 时只有两列），列内用 `ICEScrollPane` 滚动， 打开时自动滚到当前取值；
- 取值受步进控制（`hourStep` / `minuteStep` / `secondStep`）；
- 点某个取值 → 只改该单位 → 回写值 + 关闭 + `onChange`（与 `ICEDatePicker` 的交互一致）；
- 关闭策略与 Select 系列一致：浮层 closeOnOutsideClick:false，由组件自己判断点外 + Esc。

源码：[`src/components/ICETimePicker.ts`](../../src/components/ICETimePicker.ts)

**构造参数** `ICETimePickerOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `value?` | `string` | 当前值 |
| `placeholder?` | `string` | 占位文案 |
| `disabled?` | `boolean` | 是否禁用（禁用后不响应交互、不可聚焦） |
| `format?` | `ICETimePickerFormat` | 值格式：HH:mm:ss（默认）或 HH:mm |
| `hourStep?` | `number` |  |
| `minuteStep?` | `number` |  |
| `secondStep?` | `number` |  |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `height?` | `number` | 高度（不传用组件默认值） |
| `placement?` | `ICETimePickerPlacement` |  |
| `onChange?` | `(value: string) => void` | 值变化回调 |
| `manager?` | `ICEOverlayManager` | 浮层管理器（一般不用传，组件会取共享实例） |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getValue()` | `string \| undefined` |  |
| `setValue(value: string \| null \| undefined)` | `this` |  |
| `getFormValue()` | `any` |  |
| `setFormValue(value: any)` | `void` |  |
| `getUnits()` | `ICETimeUnit[]` |  |
| `getColumnValues(unit: ICETimeUnit)` | `string[]` | 某一列的候选取值（补零字符串，受对应 step 控制）。 |
| `getFieldLabel()` | `string` |  |
| `isOpen()` | `boolean` |  |
| `getPanel()` | `ICEPanel \| null` |  |
| `getColumnNode(unit: ICETimeUnit)` | `ICEScrollPane \| null` |  |
| `getOptionNode(unit: ICETimeUnit, value: string)` | `ICEWidget \| null` |  |
| `activate()` | `void` |  |
| `toggle()` | `this` |  |
| `open()` | `this` |  |
| `close()` | `this` |  |

## `ICEColorPicker`

颜色选择器（业界组件库 ColorPicker 的色板网格最小版）。

- 按 `colors` 渲染色块网格（`columns` 控制列数），选中色块带描边环；
- 点击色块回写 value 并回调 `onChange`；`disabled` 时忽略交互且不可聚焦；
- 键盘 ↑/↓/←/→ 在网格里移动选择；
- 表单集成：`getFormValue` / `setFormValue`，错误态边框标红。

源码：[`src/components/ICEColorPicker.ts`](../../src/components/ICEColorPicker.ts)

**构造参数** `ICEColorPickerOptions` — 颜色选择器（业界组件库 ColorPicker 的色板网格最小版）。

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `colors?` | `string[]` |  |
| `columns?` | `number` | 列定义 |
| `value?` | `string` | 当前值 |
| `swatchSize?` | `number` |  |
| `gap?` | `number` |  |
| `disabled?` | `boolean` | 是否禁用（禁用后不响应交互、不可聚焦） |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `height?` | `number` | 高度（不传用组件默认值） |
| `onChange?` | `(color: string) => void` | 值变化回调 |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getValue()` | `string \| undefined` |  |
| `setValue(hex: string)` | `this` |  |
| `isSelected(hex: string)` | `boolean` |  |
| `getSwatchNodes()` | `ICEWidget[]` |  |
| `getSwatchNode(color: string)` | `ICEWidget \| null` |  |
| `getRowCount()` | `number` |  |
| `getFormValue()` | `any` |  |
| `setFormValue(value: any)` | `void` |  |

## `ICETransfer`

穿梭框（业界组件库 Transfer 的最小版）。

- 按 `targetKeys` 把 `dataSource` 分成「源 / 目标」两栏，栏内各自可滚动；
- 点行切换勾选；中间按钮把勾选项整体右移 / 左移，移动后清空勾选并回调；
- 没有勾选（或只有被移动方向的非法项）时按钮不可用；
- `disabled` 的行不能勾选、不会被移动；值 = `targetKeys`（字符串数组，可直接进表单）。

源码：[`src/components/ICETransfer.ts`](../../src/components/ICETransfer.ts)

**构造参数** `ICETransferOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `dataSource` | `ICETransferItem[]` | 数据源 |
| `targetKeys?` | `string[]` |  |
| `titles?` | `[string, string]` |  |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `height?` | `number` | 高度（不传用组件默认值） |
| `rowHeight?` | `number` |  |
| `onChange?` | `(targetKeys: string[], direction: ICETransferDirection, moveKeys: string[]) => void` | 值变化回调 |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getSourceKeys()` | `string[]` |  |
| `getTargetKeys()` | `string[]` |  |
| `setTargetKeys(keys: string[])` | `this` |  |
| `getFormValue()` | `any` |  |
| `setFormValue(value: any)` | `void` |  |
| `getCheckedKeys()` | `string[]` |  |
| `isChecked(key: string)` | `boolean` |  |
| `getSourceNode(key: string)` | `ICEWidget \| null` |  |
| `getTargetNode(key: string)` | `ICEWidget \| null` |  |
| `getMoveRightButton()` | `ICEWidget \| null` |  |
| `getMoveLeftButton()` | `ICEWidget \| null` |  |
| `isMoveRightEnabled()` | `boolean` |  |
| `isMoveLeftEnabled()` | `boolean` |  |
| `moveRight()` | `void` |  |
| `moveLeft()` | `void` |  |
| `activate()` | `void` |  |
