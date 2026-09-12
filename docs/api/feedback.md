# 反馈与状态

提示、确认、弹出层与占位状态。

## `ICEAlert`

提示条：info / success / warning / error 四种状态 + 类型图标，可关闭。

源码：[`src/components/ICEAlert.ts`](../../src/components/ICEAlert.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `setTitle(title: string)` | `this` |  |
| `setMessage(message: string)` | `this` |  |
| `getType()` | `ICEAlertType` |  |
| `getIconNode()` | `ICELabel \| null` |  |
| `getTitleNode()` | `any` |  |
| `close()` | `this` | 关闭（隐藏整棵子树）并回调 onClose；重复调用只生效一次。 |
| `isClosed()` | `boolean` |  |
| `isClosable()` | `boolean` |  |
| `getCloseButton()` | `ICEWidget \| null` |  |

## `ICEModal`

模态对话框：全屏遮罩 + 居中面板 + 焦点陷阱。

- 遮罩铺满可见区域且可交互 —— 引擎按 zIndex 命中，模态打开时点击不会穿透到下面的组件；
- 焦点被限制在对话框内（`ICEFocusManager.setFocusScope`），打开时聚焦第一个可聚焦控件， 关闭后恢复打开前的焦点；
- 关闭途径：遮罩点击（`maskClosable`）、Esc（`closeOnEsc`）、确定/取消按钮、显式 `close()`。

源码：[`src/components/ICEModal.ts`](../../src/components/ICEModal.ts)

**构造参数** `ICEModalOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `title?` | `string` | 标题 |
| `content?` | `string \| (() => any)` | 正文文本或内容工厂 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `height?` | `number` | 面板高度（不传按内容估算） |
| `confirmText?` | `string` |  |
| `cancelText?` | `string` |  |
| `showFooter?` | `boolean` |  |
| `closeOnConfirm?` | `boolean` | `onConfirm` 之后是否自动关闭（默认 true）。 |
| `maskClosable?` | `boolean` |  |
| `closeOnEsc?` | `boolean` |  |
| `confirmLoading?` | `boolean` |  |
| `onConfirm?` | `() => void` |  |
| `onCancel?` | `() => void` |  |
| `onClose?` | `(reason: ICEModalCloseReason) => void` | 关闭回调 |
| `manager?` | `ICEOverlayManager` | 浮层管理器（一般不用传，组件会取共享实例） |
| `focusManager?` | `ICEFocusManager` |  |
| `animation?` | `{ duration?: number; delay?: number; easing?: ICEEasing; driver?: ICEFrameDriver }` |  |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `isOpen()` | `boolean` |  |
| `getMask()` | `ICEPanel \| null` |  |
| `getDialog()` | `ICEPanel \| null` |  |
| `getConfirmButton()` | `ICEButton \| null` |  |
| `getCancelButton()` | `ICEButton \| null` |  |
| `open()` | `this` |  |
| `close(reason: ICEModalCloseReason)` | `this` |  |

## `ICEDrawer`

抽屉：从屏幕某一边滑入的面板（带遮罩与焦点陷阱）。  与 ICEModal 同源（遮罩 + 焦点范围 + 关闭途径），差别只在：

- 面板贴边（right / left / top / bottom）并沿该方向占满整条边；
- 入场动效是与方向一致的滑入（A5 的 `slideIn`）。

源码：[`src/components/ICEDrawer.ts`](../../src/components/ICEDrawer.ts)

**构造参数** `ICEDrawerOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `title?` | `string` | 标题 |
| `content?` | `string \| (() => any)` | 内容（纯文本，或返回组件的工厂函数） |
| `placement?` | `ICEDrawerPlacement` |  |
| `width?` | `number` | left/right 方向的宽度（默认 360） |
| `height?` | `number` | top/bottom 方向的高度（默认 240） |
| `closable?` | `boolean` |  |
| `maskClosable?` | `boolean` |  |
| `closeOnEsc?` | `boolean` |  |
| `onClose?` | `(reason: ICEDrawerCloseReason) => void` | 关闭回调 |
| `manager?` | `ICEOverlayManager` | 浮层管理器（一般不用传，组件会取共享实例） |
| `focusManager?` | `ICEFocusManager` |  |
| `animation?` | `{ duration?: number; delay?: number; easing?: ICEEasing; driver?: ICEFrameDriver }` |  |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `isOpen()` | `boolean` |  |
| `getMask()` | `ICEPanel \| null` |  |
| `getPanel()` | `ICEPanel \| null` |  |
| `getCloseButton()` | `ICEButton \| null` |  |
| `open()` | `this` |  |
| `close(reason: ICEDrawerCloseReason)` | `this` |  |

### `ICEMessage` — 常量

便捷入口：`ICEMessage.success(ice, '已保存')`。

| 成员 | 返回 | 说明 |
|---|---|---|
| `show(ice: any, text: string, options: Omit<ICEMessageOptions, 'text'>)` |  |  |
| `success(ice: any, text: string, options: Omit<ICEMessageOptions, 'text' | 'type'>)` |  |  |
| `error(ice: any, text: string, options: Omit<ICEMessageOptions, 'text' | 'type'>)` |  |  |
| `warning(ice: any, text: string, options: Omit<ICEMessageOptions, 'text' | 'type'>)` |  |  |
| `info(ice: any, text: string, options: Omit<ICEMessageOptions, 'text' | 'type'>)` |  |  |
| `loading(ice: any, text: string, options: Omit<ICEMessageOptions, 'text' | 'type'>)` |  |  |

源码：`src/core/ICEMessageManager.ts`

### `ICENotification` — 常量

便捷入口：`ICENotification.open(ice, { title, description })`。

| 成员 | 返回 | 说明 |
|---|---|---|
| `open(ice: any, options: ICENotificationOptions)` |  |  |

源码：`src/core/ICEMessageManager.ts`

## `ICETooltip`

工具提示：鼠标悬停在目标组件上、延时后弹出的小浮层。

- 悬停检测复用 `ICEWidget` 的 hover 状态（ICEHoverManager 命中后调 `setHovered`， 本组件监听目标的 `hoverchange` 事件）；
- 弹出/关闭都有延时（业界组件库 的 mouseEnterDelay / mouseLeaveDelay 语义），进入延时期内离开则不弹；
- 浮层定位、点外关闭、z 序全部交给 `ICEOverlayManager`（工具层，恒在组件之上）；
- 浮层关闭时内容会被销毁，所以内容每次弹出都新建（`title` 字符串自动包成小面板， 或用 `content: () => component` 自定义）。

源码：[`src/components/ICETooltip.ts`](../../src/components/ICETooltip.ts)

**构造参数** `ICETooltipOptions` — 工具提示：鼠标悬停在目标组件上、延时后弹出的小浮层。

| 参数 | 类型 | 说明 |
|---|---|---|
| `title?` | `string` | 文本内容（自动包成深色小气泡） |
| `content?` | `() => any` | 自定义内容工厂：每次弹出调用一次 |
| `placement?` | `ICEOverlayPlacement` |  |
| `offset?` | `number` | 与目标的间距（默认 8） |
| `mouseEnterDelay?` | `number` |  |
| `mouseLeaveDelay?` | `number` |  |
| `enterAnimation?` | `'none' \| 'fade' \| 'scale'` |  |
| `manager?` | `ICEOverlayManager` | 复用外部浮层管理器（测试注入） |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `start()` | `this` | 绑定目标的 hover 事件（幂等）。 |
| `destroy()` | `this` |  |
| `isOpen()` | `boolean` |  |
| `show()` | `this` | 立即弹出（不走进入延时）。 |
| `hide()` | `this` | 立即关闭。 |

## `ICEPopover`

卡片式浮层：点击（默认）或悬停触发，内容可以是文本或自定义组件工厂。  与 ICETooltip 的区别：

- 触发方式默认是 click（可切 hover）；
- 内容通常是「标题 + 正文」的卡片，也支持自定义组件；
- 点击目标会 toggle；点浮层外、按 Esc 关闭（由 ICEOverlayManager 负责）。

源码：[`src/components/ICEPopover.ts`](../../src/components/ICEPopover.ts)

**构造参数** `ICEPopoverOptions` — 卡片式浮层：点击（默认）或悬停触发，内容可以是文本或自定义组件工厂。  与 ICETooltip 的区别：

| 参数 | 类型 | 说明 |
|---|---|---|
| `title?` | `string` | 标题 |
| `content?` | `string \| (() => any)` | 正文文本，或内容工厂（每次弹出新建） |
| `trigger?` | `'click' \| 'hover'` |  |
| `placement?` | `ICEOverlayPlacement` |  |
| `offset?` | `number` |  |
| `mouseEnterDelay?` | `number` |  |
| `mouseLeaveDelay?` | `number` |  |
| `enterAnimation?` | `'none' \| 'fade' \| 'scale'` |  |
| `exitAnimation?` | `'none' \| 'fade'` |  |
| `manager?` | `ICEOverlayManager` | 复用外部浮层管理器（测试注入） |
| `onOpenChange?` | `(open: boolean) => void` |  |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `start()` | `this` |  |
| `destroy()` | `this` |  |
| `isOpen()` | `boolean` |  |
| `show()` | `this` |  |
| `hide()` | `this` |  |
| `toggle()` | `this` |  |

## `ICEPopconfirm`

气泡确认框：点击目标弹出「标题 + 说明 + 取消/确定」的小卡片。  复用 ICEPopover 的触发与定位；确认/取消后自动关闭并回调。

源码：[`src/components/ICEPopconfirm.ts`](../../src/components/ICEPopconfirm.ts)

**构造参数** `ICEPopconfirmOptions` — 气泡确认框：点击目标弹出「标题 + 说明 + 取消/确定」的小卡片。  复用 ICEPopover 的触发与定位；确认/取消后自动关闭并回调。

| 参数 | 类型 | 说明 |
|---|---|---|
| `description?` | `string` |  |
| `confirmText?` | `string` |  |
| `cancelText?` | `string` |  |
| `danger?` | `boolean` | 危险操作：确认按钮用 error 色 |
| `onConfirm?` | `() => void` |  |
| `onCancel?` | `() => void` |  |

## `ICEResult`

结果页（业界组件库 Result）：状态图标 + 标题 + 副标题 + 操作按钮组。 用于提交成功/失败、404、无权限等场景。

源码：[`src/components/ICEResult.ts`](../../src/components/ICEResult.ts)

**构造参数** `ICEResultOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `status?` | `ICEResultStatus` | 状态色：default / primary / success / warning / error / info |
| `title?` | `string` | 标题 |
| `subtitle?` | `string` |  |
| `actions?` | `ICEResultAction[]` |  |
| `onAction?` | `(key: string) => void` | 操作按钮回调 |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `height?` | `number` | 高度（不传用组件默认值） |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getActionButton(key: string)` | `ICEButton \| null` |  |

## `ICEEmpty`

空状态：居中的图标 + 描述 + 可选操作按钮。 常用于列表/表格无数据、搜索无结果。

源码：[`src/components/ICEEmpty.ts`](../../src/components/ICEEmpty.ts)

**构造参数** `ICEEmptyOptions` — 空状态：居中的图标 + 描述 + 可选操作按钮。 常用于列表/表格无数据、搜索无结果。

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `description?` | `string` |  |
| `icon?` | `string` | 图标字形（默认 ◌） |
| `actionText?` | `string` |  |
| `onAction?` | `() => void` | 操作按钮回调 |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `height?` | `number` | 高度（不传用组件默认值） |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getActionButton()` | `ICEButton \| null` |  |
| `getDescription()` | `string` | 空态描述文案（测试 / QA 用；语言包切换后重建组件即变）。 |

## `ICESkeleton`

骨架屏：内容加载前的灰色占位。  `active` 打开时整体做呼吸（opacity 0.55 ⇄ 1 循环），加载完成后 setActive(false) 并移除。

源码：[`src/components/ICESkeleton.ts`](../../src/components/ICESkeleton.ts)

**构造参数** `ICESkeletonOptions` — 骨架屏：内容加载前的灰色占位。  `active` 打开时整体做呼吸（opacity 0.55 ⇄ 1 循环），加载完成后 setActive(false) 并移除。

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `rows?` | `number` | 行数 |
| `avatar?` | `boolean` |  |
| `title?` | `boolean` | 标题 |
| `active?` | `boolean` |  |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `height?` | `number` | 高度（不传用组件默认值） |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `isActive()` | `boolean` |  |
| `getPlaceholderCount()` | `number` |  |
| `setActive(active: boolean)` | `this` |  |

## `ICESpin`

加载指示器（业界组件库 Spin 的最小版）：一段圆弧绕中心旋转。

- 旋转复用引擎的动画系统（`transform.rotate` 0→360 循环），与流动虚线同一套路；
- `spinning: false` 停止旋转（弧线保持显示）；`tip` 可在右侧显示提示文字。

源码：[`src/components/ICESpin.ts`](../../src/components/ICESpin.ts)

**构造参数** `ICESpinOptions` — 加载指示器（业界组件库 Spin 的最小版）：一段圆弧绕中心旋转。

| 参数 | 类型 | 说明 |
|---|---|---|
| `size?` | `number` | 尺寸 |
| `spinning?` | `boolean` |  |
| `tip?` | `string` | 提示文案 |
| `color?` | `string` | 颜色 |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `isSpinning()` | `boolean` |  |
| `getArcNode()` | `ICESpinArc` |  |
| `setSpinning(spinning: boolean)` | `this` |  |

## `ICESteps`

步骤条（业界组件库 Steps）：横向序号 + 标题/描述 + 连接线，当前步骤高亮、已完成打勾。

源码：[`src/components/ICESteps.ts`](../../src/components/ICESteps.ts)

**构造参数** `ICEStepsOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `items` | `ICEStepsItem[]` | 数据项 |
| `current?` | `number` |  |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `circleSize?` | `number` |  |
| `onChange?` | `(current: number) => void` | 值变化回调 |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getCurrent()` | `number` |  |
| `setCurrent(current: number)` | `this` |  |
| `getStepNode(index: number)` | `ICEWidget \| null` |  |

## `ICETour`

漫游式引导（业界组件库 Tour）：一步一步把用户带过关键界面。

- 每一步有目标组件 + 标题 + 描述；目标被一圈主色边框框住，四周用遮罩压暗；
- 面板显示「当前/总数」，带「上一步 / 下一步（最后一步为完成）/ 跳过」；
- 键盘：→/Enter 下一步、← 上一步、Esc 跳过；
- 关闭途径：完成（`finish()`，回调 `onFinish`）、跳过、Esc、`close()`。

源码：[`src/components/ICETour.ts`](../../src/components/ICETour.ts)

**构造参数** `ICETourOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `steps` | `ICETourStep[]` |  |
| `current?` | `number` | 初始步骤，默认 0 |
| `panelWidth?` | `number` | 面板宽度，默认 260 |
| `onNext?` | `(index: number) => void` |  |
| `onPrev?` | `(index: number) => void` |  |
| `onChange?` | `(index: number) => void` | 值变化回调 |
| `onFinish?` | `() => void` |  |
| `onClose?` | `(reason: 'skip' \| 'esc' \| 'api') => void` | 关闭回调 |
| `manager?` | `ICEOverlayManager` | 浮层管理器（一般不用传，组件会取共享实例） |
| `focusManager?` | `ICEFocusManager` |  |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `isOpen()` | `boolean` |  |
| `isFinished()` | `boolean` |  |
| `getCurrent()` | `number` |  |
| `getCurrentStep()` | `ICETourStep \| null` |  |
| `getSteps()` | `ICETourStep[]` |  |
| `getPanel()` | `ICEPanel \| null` |  |
| `getMask()` | `ICEWidget \| null` |  |
| `getHighlightNode()` | `ICEWidget \| null` |  |
| `getTitleText()` | `string` |  |
| `getDescriptionText()` | `string` |  |
| `getCounterText()` | `string` |  |
| `getNextButton()` | `ICEButton \| null` |  |
| `getPrevButton()` | `ICEButton \| null` |  |
| `getSkipButton()` | `ICEButton \| null` |  |
| `getHighlightBox()` | `{ left: number; top: number; width: number; height: number } \| null` | 当前高亮框（世界坐标）。 |
| `setSteps(steps: ICETourStep[])` | `this` |  |
| `open(index?: number)` | `this` |  |
| `close(reason: ICETourCloseReason)` | `this` |  |
| `next()` | `this` |  |
| `prev()` | `this` |  |
| `finish()` | `this` | 完成引导（最后一步的「下一步」/ 外部主动调用）。 |
| `skip()` | `this` |  |

## `ICEFloatButton`

悬浮操作按钮（业界组件库 FloatButton）：一个圆形主按钮，点击展开一组子按钮。

- 默认收起，子按钮 `display:false`（既不显示也不参与命中）；
- 展开后子按钮沿 `direction`（默认向上）依次排开；
- 点子按钮回调 `onItemClick(key)` 与子项自己的 `onClick`，并自动收起；
- `type: 'primary' | 'default'` 决定主按钮底色。

源码：[`src/components/ICEFloatButton.ts`](../../src/components/ICEFloatButton.ts)

**构造参数** `ICEFloatButtonOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `icon?` | `string` | 主按钮图标，默认 ＋（展开时变 ×） |
| `expandedIcon?` | `string` | 展开后的图标，默认 × |
| `size?` | `number` | 尺寸 |
| `gap?` | `number` | 与子按钮的间距，默认 8 |
| `direction?` | `'up' \| 'down'` |  |
| `type?` | `'primary' \| 'default'` |  |
| `items?` | `ICEFloatButtonItem[]` | 数据项 |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `onClick?` | `() => void` | 点击回调 |
| `onItemClick?` | `(key: string) => void` |  |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `isExpanded()` | `boolean` |  |
| `getItemNode(key: string)` | `ICEWidget \| null` |  |
| `getItems()` | `ICEFloatButtonItem[]` |  |
| `getButtonColor()` | `string` |  |
| `expand()` | `this` |  |
| `collapse()` | `this` |  |
| `toggle()` | `this` |  |
| `activate()` | `void` | @overwrite 键盘激活等价一次点击（展开 / 收起）。 |
