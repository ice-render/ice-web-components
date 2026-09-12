# 模型

纯逻辑、不碰 canvas：状态与校验规则集中在这里，组件只负责「画出来」。

## `ICEButtonModel`

源码：[`src/model/ICEButtonModel.ts`](../../src/model/ICEButtonModel.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `isEnabled()` | `boolean` |  |
| `setEnabled(enabled: boolean)` | `this` |  |
| `isPressed()` | `boolean` |  |
| `setPressed(pressed: boolean)` | `this` |  |
| `addChangeListener(listener: ICEButtonModelListener)` | `this` |  |
| `removeChangeListener(listener: ICEButtonModelListener)` | `this` |  |

## `ICEToggleModel`

源码：[`src/model/ICEToggleModel.ts`](../../src/model/ICEToggleModel.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `isSelected()` | `boolean` |  |
| `setSelected(selected: boolean)` | `this` |  |
| `toggle()` | `this` |  |
| `addChangeListener(listener: ICEToggleModelListener)` | `this` |  |
| `removeChangeListener(listener: ICEToggleModelListener)` | `this` |  |

## `ICEBoundedRangeModel`

源码：[`src/model/ICEBoundedRangeModel.ts`](../../src/model/ICEBoundedRangeModel.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getValue()` | `number` |  |
| `getMinimum()` | `number` |  |
| `getMaximum()` | `number` |  |
| `setValue(value: number)` | `this` |  |
| `addChangeListener(listener: ICEBoundedRangeModelListener)` | `this` |  |
| `removeChangeListener(listener: ICEBoundedRangeModelListener)` | `this` |  |

## `ICESelectionModel`

选择模型：列表 / 树 / 穿梭框共用的选择状态。  与其它模型（ICEButtonModel / ICEToggleModel / ICEBoundedRangeModel）同风格： 纯状态 + 监听器，UI 组件只负责把状态画出来。

源码：[`src/model/ICESelectionModel.ts`](../../src/model/ICESelectionModel.ts)

**构造参数** `ICESelectionModelOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `mode?` | `ICESelectionMode` |  |
| `selected?` | `string[]` |  |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getMode()` | `ICESelectionMode` |  |
| `setMode(mode: ICESelectionMode)` | `this` |  |
| `getSelectedKeys()` | `string[]` |  |
| `isSelected(key: string)` | `boolean` |  |
| `select(key: string)` | `this` | 选中（single 替换；multiple 追加，已选中则不变）。 |
| `toggle(key: string)` | `this` | 切换选中状态（点一下选中、再点取消）。 |
| `setSelected(keys: string[])` | `this` |  |
| `clear()` | `this` |  |
| `addChangeListener(listener: ICESelectionListener)` | `() => void` |  |

## `ICEFormModel`

表单校验模型：字段值 + 规则 + 错误 + 变更通知。  纯逻辑、不碰 canvas —— UI 层（ICEFormItem / ICEForm）只负责把值与错误**画出来**。 规则语义：一条规则失败即停止（取第一条错误信息）。

源码：[`src/model/ICEFormModel.ts`](../../src/model/ICEFormModel.ts)

**构造参数** `ICEFormModelOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `validateTrigger?` | `'change' \| 'none'` | 改值时是否自动重算该字段（默认 change；'none' 表示只在手动校验时算） |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `addField(options: ICEFormFieldOptions)` | `this` |  |
| `removeField(name: string)` | `this` |  |
| `getField(name: string)` | `ICEFormField \| undefined` |  |
| `getFieldNames()` | `string[]` |  |
| `getLabel(name: string)` | `string` |  |
| `getValue(name: string)` | `any` |  |
| `getValues()` | `Record<string, any>` |  |
| `setValue(name: string, value: any, options: { silent?: boolean })` | `this` | 设置字段值。默认按 `validateTrigger` 决定是否立刻重算该字段（默认重算）， |
| `setValues(values: Record<string, any>, options: { silent?: boolean })` | `this` |  |
| `getError(name: string)` | `string \| null \| undefined` |  |
| `getErrors()` | `Record<string, string>` | 只返回有错误的字段（无错误时为空对象） |
| `hasErrors()` | `boolean` |  |
| `validateField(name: string, options: { silent?: boolean })` | `string \| null` | 校验单个字段并写回错误；返回错误文案（null 表示通过）。 |
| `validate()` | `boolean` | 校验全部字段并返回是否全部通过。 |
| `isValidating(name: string)` | `boolean` | 该字段是否正在异步校验中（UI 可显示「校验中…」）。 |
| `validateFieldAsync(name: string)` | `Promise<string \| null>` | 单字段异步校验：先跑同步规则（失败即短路、不发请求），再依次跑异步校验器。 |
| `validateAsync()` | `Promise<boolean>` | 校验全部字段（同步 + 异步），返回是否全部通过。 |
| `reset()` | `this` | 回到初始值并清空错误。 |
| `addChangeListener(listener: ICEFormModelListener)` | `() => void` |  |
