# 数据录入

表单控件。统一遵循「`getFormValue` / `setFormValue` + `change` 事件」约定，可直接接入 `ICEForm`。

## `ICETextField`

单行文本输入：聚焦边框、错误态、表单取值约定与键盘输入； 子类通过覆盖 `__allowNewline()` 等钩子扩展（见 ICETextArea）。

源码：[`src/components/ICETextField.ts`](../../src/components/ICETextField.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getValue()` | `string` |  |
| `getTextNodes()` | `{ prefix: string; suffix: string; count: string; clear: any }` | 附属物句柄（QA / 调试用；也让调用方能读到当前显示的字数）。 |
| `getCountText()` | `string` |  |
| `isClearVisible()` | `boolean` |  |
| `clear()` | `this` | 清空（表单重置 / 点击清除按钮都走它）。 |
| `getFormValue()` | `any` |  |
| `setFormValue(value: any)` | `void` |  |
| `setValue(value: string)` | `this` |  |
| `getPlaceholder()` | `string` |  |
| `setPlaceholder(placeholder: string)` | `this` |  |
| `focus()` | `this` |  |
| `blur()` | `this` |  |
| `activate()` | `void` | 文本输入由控件自己的 keydown 处理（见 __onGlobalKeyDown）；Enter/Space 不额外触发 click。 |
| `getFieldText()` | `string` | 当前显示的文本（含聚焦时的光标占位）。 |
| `refresh()` | `void` | 子类改动了显示相关状态后，重新渲染字段。 |
| `formatDisplayValue(value: string)` | `string` | 子类扩展点：把真实值转成显示文本（密码掩码）。 |

## `ICETextArea`

多行文本框：与 ICETextField 同语义（取值约定 / change 事件 / 错误态 / 焦点）， 差别是允许换行（Enter 插入 `\n`）且默认更高。

源码：[`src/components/ICETextArea.ts`](../../src/components/ICETextArea.ts)

## `ICEPasswordField`

密码框：显示掩码（• 数量 = 真实长度），`getValue()` / 表单取值仍是明文。  `showToggle: true` 时右侧出现眼睛按钮，可在明文/掩码之间切换（便于用户核对输入）。

源码：[`src/components/ICEPasswordField.ts`](../../src/components/ICEPasswordField.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `isVisible()` | `boolean` | 明文 / 掩码。 |
| `setVisible(visible: boolean)` | `this` |  |
| `getToggleButton()` | `ICEButton \| null` |  |
| `formatDisplayValue(value: string)` | `string` |  |

## `ICEInputNumber`

数字输入框。

- 左右步进按钮 + 键盘 ↑/↓ 步进，按 min/max 夹取，结果按 precision 取整；
- 支持直接输入数字（数字键 / 小数点 / 负号 / Backspace）；
- 表单集成：`getFormValue` / `setFormValue`，错误态边框标红。

源码：[`src/components/ICEInputNumber.ts`](../../src/components/ICEInputNumber.ts)

**构造参数** `ICEInputNumberOptions` — 数字输入框。

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `value?` | `number` | 当前值 |
| `min?` | `number` |  |
| `max?` | `number` |  |
| `step?` | `number` |  |
| `precision?` | `number` |  |
| `disabled?` | `boolean` | 是否禁用（禁用后不响应交互、不可聚焦） |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `height?` | `number` | 高度（不传用组件默认值） |
| `onChange?` | `(value: number) => void` | 值变化回调 |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getValue()` | `number` |  |
| `setValue(value: number)` | `this` |  |
| `getFormValue()` | `any` |  |
| `setFormValue(value: any)` | `void` |  |
| `getText()` | `string` |  |
| `getIncreaseButton()` | `ICEButton \| null` |  |
| `getDecreaseButton()` | `ICEButton \| null` |  |
| `setEnabled(enabled: boolean)` | `this` |  |

## `ICECheckBox`

复选框：点击或 Enter/Space 切换勾选，触发 `change`，可直接进表单。

源码：[`src/components/ICECheckBox.ts`](../../src/components/ICECheckBox.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `isSelected()` | `boolean` |  |
| `setSelected(selected: boolean)` | `this` |  |
| `getFormValue()` | `any` |  |
| `setFormValue(value: any)` | `void` |  |
| `activate()` | `void` | 键盘激活（Enter / Space）与鼠标点击同义：切换勾选状态。 |
| `initEvents()` | `void` |  |

## `ICERadioButton`

单选框：点击或 Enter/Space 选中；同组互斥由调用方（表单/业务）维护。

源码：[`src/components/ICERadioButton.ts`](../../src/components/ICERadioButton.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `isSelected()` | `boolean` |  |
| `setSelected(selected: boolean)` | `this` |  |
| `getFormValue()` | `any` |  |
| `setFormValue(value: any)` | `void` |  |
| `activate()` | `void` | 键盘激活（Enter / Space）与鼠标点击同义：选中本项。 |
| `initEvents()` | `void` |  |

## `ICERadioGroup`

单选组：一组互斥选项，整行可点，值是选项的 `value`。  与 `ICERadioButton` 的分工：单个按钮只管「选中/未选中」，**互斥与取值由本组件维护**， 因此业务代码不用再自己写「点了 A 要把 B 取消」这类同步逻辑。

- 键盘：聚焦后 ←/↑ 上一项、→/↓ 下一项（自动跳过禁用项），Enter/Space 选中当前项；
- 表单：实现取值约定，可直接放进 `ICEForm`；
- 事件：值变化触发 `change`（载荷 `{ value }`）并调用 `onChange`。

源码：[`src/components/ICERadioGroup.ts`](../../src/components/ICERadioGroup.ts)

**构造参数** `ICERadioGroupOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `options` | `ICERadioGroupOption[]` | 候选项 |
| `value?` | `string` | 当前选中值（不在选项里的值会被忽略） |
| `direction?` | `'horizontal' \| 'vertical'` | 排布方向，默认 horizontal |
| `itemGap?` | `number` | 选项之间的间距，默认 16 |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `height?` | `number` | 高度（不传用组件默认值） |
| `fontSize?` | `number` |  |
| `onChange?` | `(value: string) => void` | 值变化回调 |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getValue()` | `string \| null` |  |
| `setValue(value: string)` | `this` | 程序式改值：只发 `change` 事件，不回调 `onChange`（与库内其它控件一致）。 |
| `getFormValue()` | `any` |  |
| `setFormValue(value: any)` | `void` |  |
| `getOptionNodes()` | `ICEWidget[]` |  |
| `getItemNode(value: string)` | `ICEWidget \| null` |  |
| `getRadioNode(value: string)` | `ICERadioButton \| null` |  |
| `getLabelTexts()` | `string[]` |  |
| `getActiveIndex()` | `number` | 当前键盘活动项（不一定是选中项）。 |
| `setOptions(options: ICERadioGroupOption[])` | `this` |  |

## `ICECheckboxGroup`

多选组：一组可多选的选项，值是 `string[]`（按选项顺序）。

- 整行可点（点文字也能勾选）；
- `max` 限制最多勾选几项，超出时忽略并触发 `exceed`（载荷 `{ value, max }`）；
- 键盘：方向键移动活动项、Space 切换；
- 表单：值为数组，`setFormValue` 兼容单值 / 空值；
- 事件：值变化触发 `change`（载荷 `{ value }`）并调用 `onChange`。

源码：[`src/components/ICECheckboxGroup.ts`](../../src/components/ICECheckboxGroup.ts)

**构造参数** `ICECheckboxGroupOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `options` | `ICECheckboxGroupOption[]` | 候选项 |
| `value?` | `string[]` | 已选值（按选项顺序归一化） |
| `direction?` | `'horizontal' \| 'vertical'` |  |
| `itemGap?` | `number` |  |
| `max?` | `number` | 最多可勾选数量，不传表示不限 |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `height?` | `number` | 高度（不传用组件默认值） |
| `fontSize?` | `number` |  |
| `onChange?` | `(value: string[]) => void` | 值变化回调 |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getValue()` | `string[]` | 已选值（按选项顺序）。 |
| `getCheckedCount()` | `number` |  |
| `isChecked(value: string)` | `boolean` |  |
| `setValue(value: string[])` | `this` | 程序式设值：只发 `change` 事件，不回调 `onChange`。 |
| `checkAll()` | `this` | 全选（受 `max` 限制）。 |
| `clear()` | `this` |  |
| `getFormValue()` | `any` |  |
| `setFormValue(value: any)` | `void` |  |
| `getOptionNodes()` | `ICEWidget[]` |  |
| `getItemNode(value: string)` | `ICEWidget \| null` |  |
| `getCheckboxNode(value: string)` | `ICECheckBox \| null` |  |
| `getLabelTexts()` | `string[]` |  |
| `getActiveIndex()` | `number` |  |
| `setOptions(options: ICECheckboxGroupOption[])` | `this` |  |

## `ICESwitch`

开关：点击或 Enter/Space 切换，滑块带过渡动画，触发 `change`。

源码：[`src/components/ICESwitch.ts`](../../src/components/ICESwitch.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `isSelected()` | `boolean` |  |
| `setSelected(selected: boolean)` | `this` |  |
| `getFormValue()` | `any` |  |
| `setFormValue(value: any)` | `void` |  |
| `activate()` | `void` | 键盘激活（Enter / Space）与鼠标点击同义：切换开关。 |
| `initEvents()` | `void` |  |

## `ICESlider`

滑块：单值 / 区间双滑块，支持 `step` 量化与方向键微调。

源码：[`src/components/ICESlider.ts`](../../src/components/ICESlider.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `isRange()` | `boolean` | 是否区间模式（双滑块）。 |
| `setValue(value: number)` | `this` |  |
| `getValue()` | `number` |  |
| `getRangeValue()` | `[number, number] \| null` | 区间取值 [下界, 上界]；单值模式返回 null。 |
| `setRangeValue(value: [number, number] \| number[])` | `this` | 设置区间：各自夹取到 [min,max]，反序时自动交换。 |
| `getThumbs()` | `any[]` |  |
| `getActiveThumb()` | `'lower' \| 'upper'` | 当前操作中的滑块（键盘调整 / 拖动高亮用）。 |
| `setActiveThumb(thumb: 'lower' \| 'upper')` | `this` |  |
| `setValueFromRatio(ratio: number, thumb?: 'lower' \| 'upper')` | `this` | 按比例（0..1）落值。 |
| `getFormValue()` | `any` |  |
| `setFormValue(value: any)` | `void` |  |

## `ICESegmented`

分段控制器： 一组互斥选项，选中项实心高亮。每个分段是 ICEButton，因此天然可聚焦（Tab/Enter 可操作）。

源码：[`src/components/ICESegmented.ts`](../../src/components/ICESegmented.ts)

**构造参数** `ICESegmentedOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `options` | `ICESegmentedOption[]` | 候选项 |
| `value?` | `string` | 当前值 |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `height?` | `number` | 高度（不传用组件默认值） |
| `block?` | `boolean` | `block`：各段等宽铺满整条（默认，也是老行为）；传 `false` 时按文字宽度排。 |
| `onChange?` | `(value: string) => void` | 值变化回调 |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getValue()` | `string \| null` |  |
| `setValue(value: string)` | `this` |  |
| `getSegmentNode(value: string)` | `ICEButton \| null` |  |
| `isBlock()` | `boolean` |  |
| `getSegmentBoxes()` | `Array<{ value: string; left: number; top: number; width: number; height: number }>` | 各段的实际盒子（测试与几何审计用）。 |

## `ICERate`

评分：N 颗星，点击设置分值、悬停预览、键盘 ←/→ 调整。

源码：[`src/components/ICERate.ts`](../../src/components/ICERate.ts)

**构造参数** `ICERateOptions` — 评分：N 颗星，点击设置分值、悬停预览、键盘 ←/→ 调整。

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `count?` | `number` | 数量 |
| `value?` | `number` | 当前值 |
| `disabled?` | `boolean` | 是否禁用（禁用后不响应交互、不可聚焦） |
| `size?` | `number` | 尺寸 |
| `color?` | `string` | 颜色 |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `onChange?` | `(value: number) => void` | 值变化回调 |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getValue()` | `number` |  |
| `setValue(value: number)` | `this` |  |
| `getPreviewValue()` | `number` |  |
| `getStarNodes()` | `ICEWidget[]` |  |
| `setDisabled(disabled: boolean)` | `this` |  |

## `ICEUpload`

上传选择器。

- 上：虚线拖拽区（点击唤起隐藏的 `<input type="file">`）；
- 下：文件列表（名称 / 大小 / 删除）；
- 校验：`accept`（扩展名或 MIME，支持 `image/*`）、`maxSize`、`maxCount`、`beforeUpload`；
- 被拒时 `addFile` 返回 false 并记录原因（`getLastRejectReason()`），列表与回调都不动；
- 文件对象是**纯数据**（`{uid,name,size,type,url}`），不依赖 DOM，便于测试与序列化。

源码：[`src/components/ICEUpload.ts`](../../src/components/ICEUpload.ts)

**构造参数** `ICEUploadOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `accept?` | `string` |  |
| `multiple?` | `boolean` |  |
| `maxCount?` | `number` |  |
| `maxSize?` | `number` | 单文件大小上限（字节） |
| `disabled?` | `boolean` | 是否禁用（禁用后不响应交互、不可聚焦） |
| `text?` | `string` | 文案 |
| `hint?` | `string` |  |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `height?` | `number` | 高度（不传用组件默认值） |
| `rowHeight?` | `number` |  |
| `beforeUpload?` | `(file: ICEUploadFile) => boolean \| string \| undefined` |  |
| `onChange?` | `(files: ICEUploadFile[]) => void` | 值变化回调 |
| `onRemove?` | `(file: ICEUploadFile) => void` | 删掉一个文件时回调（✕ 与 `removeFile` 同一条路径） |
| `showFileList?` | `boolean` | 是否画文件列表（默认 true；只要拖拽区就传 false） |
| `customRequest?` | `( file: ICEUploadFile, hooks: { onProgress: (percent: number) => void; onSuccess: (response?: { url?: string }) => void; onError: (message: string) => void; }, ) => void \| Promise<any>` | 自定义上传实现：给了它，加入文件就自动开始上传。 |
| `draggable?` | `boolean` | 文件行可以上下拖拽排序 |
| `onReorder?` | `(files: ICEUploadFile[], from: number, to: number) => void` | 排序落下后的回调（顺序变了才触发） |
| `uploadConcurrency?` | `number` | 同时上传几个（默认 1）；其余排队，按列表顺序依次启动 |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getFileList()` | `ICEUploadFile[]` |  |
| `isDisabled()` | `boolean` |  |
| `getLastRejectReason()` | `string \| null` |  |
| `getDropZoneNode()` | `ICEWidget \| null` |  |
| `getHintText()` | `string` | 上传区提示文案（测试 / QA 用）。 |
| `getFileNode(uid: string)` | `ICEWidget \| null` |  |
| `addFile(file: Partial<ICEUploadFile>)` | `boolean` | 加入一个文件（真实选择结果或调用方构造的数据）；被拒时返回 false。 |
| `getQueuedCount()` | `number` | 排队中的文件数（不含正在传的）。 |
| `getConcurrency()` | `number` |  |
| `setUploadConcurrency(concurrency: number)` | `this` | 运行中调整并发：调大**立刻**补队列；调小只是不再补新的， |
| `isUploadsPaused()` | `boolean` |  |
| `pauseUploads()` | `this` | 暂停派发新任务；已经在传的让它跑完。 |
| `resumeUploads()` | `this` | 继续派发（按当前列表顺序把队列灌满）。 |
| `getFileStatus(uid: string)` | `'pending' \| 'uploading' \| 'done' \| 'error' \| null` | 上传状态：'uploading' | 'done' | 'error'（没用 customRequest 时是 null）。 |
| `isDragOver()` | `boolean` | 有文件正悬在拖拽区上方（用于高亮反馈）。 |
| `isRowDragging()` | `boolean` |  |
| `retryFile(uid: string)` | `boolean` | 失败重传（只有失败的行能重试）。 |
| `removeFile(uid: string)` | `this` |  |
| `getFileRows()` | `any[]` | 文件行节点（`showFileList: false` 时为空）。 |
| `getFileRowText(uid: string)` | `string` | 某一行的整行文案（测试 / 无障碍镜像用）。 |
| `getFileRemoveButton(uid: string)` | `any` |  |
| `getFileProgressNode(uid: string)` | `any` | 上传中那一行的进度条（没有进度 / 已完成时为 null）。 |
| `getFileProgress(uid: string)` | `number \| null` |  |
| `setFileProgress(uid: string, progress: number)` | `this` | 设置某一行进度（0-100 夹取）；100 表示完成，行里不再显示进度条。 |
| `formatFileSize(bytes: number)` | `string` | 人类可读的文件大小（512 B / 2.0 KB / 5.0 MB）。 |
| `clear()` | `this` |  |
| `setDisabled(disabled: boolean)` | `this` |  |
| `openPicker()` | `boolean` | 唤起系统文件选择框（无 DOM 环境返回 false）。 |
| `activate()` | `void` |  |

## `ICEFormItem`

表单项：标签 + 控件 + 错误文案。  只负责「摆位置 + 显示错误」；值的读写与校验规则由 ICEForm / ICEFormModel 管。 控件必须实现取值约定（`getFormValue` / `setFormValue`）。  布局：

- `vertical`（默认）：标签在上一行，控件居中，错误文案在最下（高度预留，避免校验时抖动）；
- `horizontal`：标签占左侧 labelWidth，控件与错误文案在右侧。

源码：[`src/components/ICEFormItem.ts`](../../src/components/ICEFormItem.ts)

**构造参数** `ICEFormItemOptions` — 表单项：标签 + 控件 + 错误文案。  只负责「摆位置 + 显示错误」；值的读写与校验规则由 ICEForm / ICEFormModel 管。 控件必须实现取值约定（`getFormValue` / `setFormValue`）。  布局：

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `name` | `string` |  |
| `label?` | `string` |  |
| `control` | `any` |  |
| `rules?` | `ICEFormRule[]` | 校验规则（透传给 ICEFormModel） |
| `dependencies?` | `string[]` | 依赖的字段名：这些字段变化时本项自动重算（跨字段校验，如「确认密码」）。 |
| `layout?` | `'vertical' \| 'horizontal'` |  |
| `labelWidth?` | `number` |  |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `labelHeight?` | `number` | 标签行高 / 错误行高 / 间距 |
| `errorHeight?` | `number` |  |
| `gap?` | `number` |  |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getName()` | `string` |  |
| `getLabel()` | `string` |  |
| `getRules()` | `ICEFormRule[]` |  |
| `getDependencies()` | `string[]` | 依赖的字段名（跨字段重校验用）。 |
| `getControl()` | `any` |  |
| `getLabelNode()` | `ICELabel` |  |
| `getErrorNode()` | `ICELabel` |  |
| `getErrorText()` | `string` |  |
| `isValidating()` | `boolean` |  |
| `setValidating(pending: boolean)` | `this` | 异步校验中：错误行显示「校验中…」（错误文案让位，校验完再由 setError 接管）。 |
| `setError(message: string \| null)` | `this` | 设置错误文案（null / '' 表示通过）；同时把控件切到 error / default 状态。 |

## `ICEForm`

表单容器：把若干 ICEFormItem 纵向堆叠，绑上校验模型。

- 值与校验都在 `ICEFormModel` 里（纯逻辑），ICEForm 负责「控件 ⇄ 模型」同步与错误渲染；
- 控件触发 `change` → 写回模型并按 validateTrigger 校验 → 模型通知 → 表单项更新错误显示；
- `submit()` 校验通过才回调 `onSubmit`（回调拿到当前值快照）。

源码：[`src/components/ICEForm.ts`](../../src/components/ICEForm.ts)

**构造参数** `ICEFormOptions` — 表单容器：把若干 ICEFormItem 纵向堆叠，绑上校验模型。

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `gap?` | `number` |  |
| `model?` | `ICEFormModel` | 复用外部模型（表单与业务共享状态） |
| `items?` | `ICEFormItem[]` | 数据项 |
| `validateDebounce?` | `number` | 改值后延迟多少毫秒再校验（默认 0 = 立刻校验）。 |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getModel()` | `ICEFormModel` |  |
| `flushValidateDebounce()` | `this` | 取消防抖（组件卸载 / 立刻校验前调用）。 |
| `getItems()` | `ICEFormItem[]` |  |
| `addItems(items: ICEFormItem[])` | `this` |  |
| `addItem(item: ICEFormItem)` | `this` |  |
| `getValues()` | `Record<string, any>` |  |
| `setValues(values: Record<string, any>)` | `this` |  |
| `reset()` | `this` |  |
| `validate()` | `boolean` |  |
| `validateAsync()` | `Promise<boolean>` | 同步 + 异步校验全部字段（返回是否通过）。 |
| `onSubmit(handler: ICEFormSubmitHandler)` | `this` |  |
| `submit()` | `boolean` | 校验通过才回调 onSubmit。 |
| `submitAsync()` | `Promise<boolean>` | 异步版提交：等异步校验通过才回调 onSubmit。 |

## `ICEFormList`

可增删的重复表单项（多联系人 / 多地址 / 明细行）。  这类结构的难点不在「画一行」，而在**行身份**：用下标当 key，删掉第一行之后， 第二行的控件就会显示第一行的数据（重复行最经典的 bug）。所以每一行都有稳定的 `rowKey`， 增删只动那一行，`onChange(rows)` 给的是最新全量。  用法： ```ts const list = new ICEFormList({   renderRow: (row, ctx) => textFieldFor(row),   // 返回这一行的内容组件   initialRows: [{}],   minRows: 1, maxRows: 5,   onChange: (rows) => console.log(rows), }); ``` 行内的控件由调用方创建；改完值调 `list.updateRow(index, patch)` 把数据写回去。

源码：[`src/components/ICEFormList.ts`](../../src/components/ICEFormList.ts)

**构造参数** `ICEFormListOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎用它做唯一标识；e2e/调试时可按 id 定位） |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `rowHeight?` | `number` | 每行内容的高度（默认 36） |
| `gap?` | `number` | 行间距（默认 8） |
| `initialRows?` | `any[]` | 初始行（默认一行空数据） |
| `minRows?` | `number` | 最少几行（到了就禁用「删除」，默认 0） |
| `maxRows?` | `number` | 最多几行（到了就禁用「添加」，默认不限） |
| `addText?` | `string` |  |
| `removeText?` | `string` |  |
| `renderRow` | `(row: any, ctx: ICEFormListRowContext) => any` | 生成一行内容；返回的组件会被放到该行里（宽 = width - 删除按钮那一列） |
| `onChange?` | `(rows: any[]) => void` | 值变化回调 |
| `onAdd?` | `(row: any) => void` |  |
| `onRemove?` | `(row: any, index: number) => void` |  |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getRows()` | `any[]` |  |
| `getRowKeys()` | `string[]` |  |
| `getRowCount()` | `number` |  |
| `addRow(data: any)` | `this` |  |
| `removeRow(index: number)` | `this` |  |
| `updateRow(index: number, patch: any)` | `this` |  |
| `setRows(rows: any[])` | `this` |  |
| `isAddDisabled()` | `boolean` |  |
| `isRemoveDisabled(index: number)` | `boolean` |  |
| `getRowNode(index: number)` | `ICEWidget \| null` |  |
| `getRemoveButton(index: number)` | `ICEButton \| null` |  |
| `getAddButton()` | `ICEButton \| null` |  |
| `getContentHeight()` | `number` | 内容总高（行 + 间隙 + 添加按钮那一行）。 |
