# 基础组件

所有组件的最小构件：面板、按钮、文本、图标与分隔线。

## `ICEWidget`

所有 UI 组件的基类（继承引擎 ICEGroup）。  在引擎的绘制能力之上只加四件事：交互态（enabled / hovered / focused）、键盘焦点 （`focusable` / `activate()`）、表单校验态（`validateStatus`）、表单取值约定 （`getFormValue` / `setFormValue`）。

源码：[`src/core/ICEWidget.ts`](../../src/core/ICEWidget.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `setEnabled(enabled: boolean)` | `this` |  |
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

## `ICEButton`

按钮：`primary` / `default` / `text` / `link` 变体，`danger` 与三种尺寸， 自带 hover / 焦点 / 禁用态，点击时触发 `click`。

源码：[`src/components/ICEButton.ts`](../../src/components/ICEButton.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
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
| `getPreferredSize()` | `[number, number]` | @overwrite |

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

## `ICESeparator`

分隔线：1px 的水平或垂直分隔。

源码：[`src/components/ICESeparator.ts`](../../src/components/ICESeparator.ts)
