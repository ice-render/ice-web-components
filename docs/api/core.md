# 核心与布局

不直接出现在业务页面里，但决定一切的东西：组件基类、滚动视口、浮层/焦点/消息管理器，以及布局与动画工具。

## `ICEScrollPane`

滚动视口（Swing 的 JScrollPane / CSS 的 overflow:auto 容器）。  依赖引擎的**子树裁剪**（`clipChildren`）：内容超出视口的部分被裁掉，滚出去的子组件 也命不中（命中检测同样尊重裁剪区）。  结构： ``` ICEScrollPane (clipChildren: true)   ├── contentBox   位置 = (-scrollX, -scrollY)，尺寸 = 内容尺寸   │     └── 调用方的内容组件   └── scrollbarTrack + scrollbarThumb   滚动条（内容超出时才显示） ``` 内容盒与滚动条都在构造期创建，保证滚动条的 zIndex 恒高于内容（引擎按 zIndex 排序渲染）。

源码：[`src/components/ICEScrollPane.ts`](../../src/components/ICEScrollPane.ts)

**构造参数** `ICEScrollPaneOptions` — 滚动视口（Swing 的 JScrollPane / CSS 的 overflow:auto 容器）。  依赖引擎的**子树裁剪**（`clipChildren`）：内容超出视口的部分被裁掉，滚出去的子组件 也命不中（命中检测同样尊重裁剪区）。  结构： ``` ICEScrollPane (clipChildren: true)   ├── contentBox   位置 = (-scrollX, -scrollY)，尺寸 = 内容尺寸   │     └── 调用方的内容组件   └── scrollbarTrack + scrollbarThumb   滚动条（内容超出时才显示） ``` 内容盒与滚动条都在构造期创建，保证滚动条的 zIndex 恒高于内容（引擎按 zIndex 排序渲染）。

| 参数 | 类型 | 说明 |
|---|---|---|
| `width?` | `number` | 宽度（不传用组件默认值） |
| `height?` | `number` | 高度（不传用组件默认值） |
| `scrollX?` | `number` | 初始滚动位置 |
| `scrollY?` | `number` |  |
| `scrollbar?` | `boolean` | 是否显示滚动条（默认 auto：内容超出时显示） |
| `wheelStep?` | `number` | 滚轮灵敏度（每个 deltaY 像素对应的滚动量，默认 1） |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `setContent(node: any)` | `this` | 设置滚动内容（会替换上一个内容组件）。 |
| `getContent()` | `any` |  |
| `setContentSize(width: number, height: number)` | `this` | 显式设置内容尺寸（内容自己不做布局时用；设置后不再跟随内容组件尺寸）。 |
| `getContentSize()` | `[number, number]` |  |
| `getViewportSize()` | `[number, number]` |  |
| `getScrollRange()` | `[number, number]` | 可滚动范围（上界）；内容不超出时为 0。 |
| `getScroll()` | `[number, number]` |  |
| `setScroll(x: number, y: number)` | `this` | 设置滚动位置（按可滚动范围夹取）。 |
| `scrollBy(dx: number, dy: number)` | `this` |  |
| `isScrollbarVisible()` | `boolean` |  |
| `getScrollbarThumb()` | `any` | 滚动条滑块（测试与自定义样式用）。 |
| `isHorizontalScrollbarVisible()` | `boolean` |  |
| `getHorizontalTrackWidth()` | `number` |  |
| `getHorizontalThumb()` | `any` |  |
| `smoothScrollTo(x: number, y: number, options: { duration?: number })` | `this` | 平滑滚动到 (x, y)。 |
| `isThumbDragging()` | `boolean` | 按住的是哪条滑块（点在轨道空白不算）。 |
| `getVerticalTrackHeight()` | `number` | 竖向轨道的可用高度（拖拽换算用）。 |

## `ICEAffix`

吸顶容器（CSS `position: sticky` 的画布版本）。  长页面里「筛选条 / 表头 / 批量操作栏」跟着滚走是后台最常见的抱怨；DOM 里一行 `position: sticky` 就解决，画布里没有这回事，于是这里把它补上：

- 组件留在原来的位置，**占位高度不变** —— 吸顶不该让下面的内容跳一下；
- 当它随内容滚到「视口顶 + `offsetTop`」以上时，把它贴回去（改自己的 `top` 补偿滚动量）， 并抬到更高 zIndex（否则会被后面的内容盖住）；滚回原位时两样都复原；
- 贴着**最近的祖先滚动视口**（`ICEScrollPane`）算，不是整页；也可以 `scrollTarget` 显式指定。 语义提醒：吸顶期间它会盖住后面的内容（和 CSS sticky 一致），所以页面要留出足够的高度 —— 例如内容顶部加 `offsetTop` 那一条空白。

源码：[`src/components/ICEAffix.ts`](../../src/components/ICEAffix.ts)

**构造参数** `ICEAffixOptions` — 吸顶容器（CSS `position: sticky` 的画布版本）。  长页面里「筛选条 / 表头 / 批量操作栏」跟着滚走是后台最常见的抱怨；DOM 里一行 `position: sticky` 就解决，画布里没有这回事，于是这里把它补上：

| 参数 | 类型 | 说明 |
|---|---|---|
| `offsetTop?` | `number` | 吸顶时距视口顶部多少像素（默认 0；顶部有固定头就传头的高度） |
| `scrollTarget?` | `any` | 贴哪个滚动视口吸顶；不传则自动沿父链找最近的 ICEScrollPane |
| `pinnedZIndex?` | `number` | 吸顶时抬到多高（默认「整棵兄弟子树的最大 zIndex + 10」） |
| `onPinChange?` | `(pinned: boolean) => void` | 吸顶状态翻转时回调 |
| `id?` | `string` | 组件 id（引擎用它做唯一标识；e2e/调试时可按 id 定位） |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `height?` | `number` | 高度（不传用组件默认值） |
| `style?` | `Record<string, any>` | 覆盖样式（fillStyle / strokeStyle / lineWidth / shadow …） |
| `fill?` | `boolean` |  |
| `stroke?` | `boolean` |  |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getScrollTarget()` | `any` |  |
| `getOffsetTop()` | `number` |  |
| `setOffsetTop(value: number)` | `this` |  |
| `getBaseTop()` | `number` | 布局给的位置（吸顶时它仍然是「本来该在的地方」）。 |
| `getBaseZIndex()` | `number` |  |
| `isPinned()` | `boolean` |  |
| `update()` | `this` | 重算吸顶。 |

## `ICELayout`

布局骨架：顶栏 / 侧栏 / 内容 / 页脚。  后台外壳每个示例都在手搭（算坐标、算剩余宽度、侧栏收起时手动把内容挪过去）， 这里把它沉淀成一个件：

- 四个区域都是可选的，**没给的不占空间**（没页脚时内容直接到底）；
- 侧栏可在左 / 在右，可收起（`setSiderVisible(false)` / `setSiderWidth(0)`）；
- 容器尺寸变化会自动重排（`__afterStateMerge` 里补一次），不是一次性算完就固定；
- 区域节点被真的摆到对应盒子里（改它们的 left/top/width/height）， `getRegionBox(name)` 把版式暴露出来给测试与几何审计。 用在需要「整页骨架」的场景；只是想给一段内容加个壳的话，`ICEPanel` / `ICECard` 更轻。

源码：[`src/components/ICELayout.ts`](../../src/components/ICELayout.ts)

**构造参数** `ICELayoutOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎用它做唯一标识；e2e/调试时可按 id 定位） |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `height?` | `number` | 高度（不传用组件默认值） |
| `headerHeight?` | `number` |  |
| `footerHeight?` | `number` |  |
| `siderWidth?` | `number` |  |
| `siderPosition?` | `'left' \| 'right'` |  |
| `header?` | `any` |  |
| `sider?` | `any` |  |
| `content?` | `any` | 内容（纯文本，或返回组件的工厂函数） |
| `footer?` | `any` |  |
| `style?` | `Record<string, any>` | 覆盖样式（fillStyle / strokeStyle / lineWidth / shadow …） |
| `background?` | `string` |  |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `setHeader(node: any)` | `this` |  |
| `setSider(node: any)` | `this` |  |
| `setContent(node: any)` | `this` |  |
| `setFooter(node: any)` | `this` |  |
| `getHeader()` | `any` |  |
| `getSider()` | `any` |  |
| `getContent()` | `any` |  |
| `getFooter()` | `any` |  |
| `setSiderWidth(width: number)` | `this` |  |
| `getSiderWidth()` | `number` |  |
| `setSiderVisible(visible: boolean)` | `this` |  |
| `isSiderVisible()` | `boolean` |  |
| `setHeaderHeight(height: number)` | `this` |  |
| `setFooterHeight(height: number)` | `this` |  |
| `getRegionBox(name: ICELayoutRegion)` | `ICELayoutBox` | 区域盒子（没给该区域时是零尺寸的盒子，位置按「不占空间」算）。 |
| `layout()` | `this` | 按当前尺寸把各区域摆好（尺寸变化后由 `__afterStateMerge` 自动调）。 |

## `ICESplitter`

分隔面板：两栏 + 可拖动的分隔条。

- `direction: 'horizontal'`（默认）左右分栏，`'vertical'` 上下分栏；
- `size` 是第一栏的像素尺寸，夹取范围 `[min, 容器尺寸 - dividerSize - min]`；
- 拖动分隔条改变尺寸（mousedown 必须落在分隔条上），拖动中触发 `resize` （载荷 `{ size }`）与 `onResize`；
- 两栏是调用方传进来的组件，本组件只负责摆位置与改尺寸。

源码：[`src/components/ICESplitter.ts`](../../src/components/ICESplitter.ts)

**构造参数** `ICESplitterOptions` — 分隔面板：两栏 + 可拖动的分隔条。

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `direction?` | `'horizontal' \| 'vertical'` | horizontal = 左右分栏（默认），vertical = 上下分栏 |
| `size?` | `number` | 第一栏尺寸（像素） |
| `min?` | `number` | 两栏最小尺寸，默认 40 |
| `dividerSize?` | `number` | 分隔条粗细，默认 6 |
| `first?` | `any` | 第一栏组件 |
| `second?` | `any` | 第二栏组件 |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `height?` | `number` | 高度（不传用组件默认值） |
| `onResize?` | `(size: number) => void` |  |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getSize()` | `number` | 当前第一栏尺寸。 |
| `getRatio()` | `number` | 第一栏占比（0..1）。 |
| `setRatio(ratio: number)` | `this` |  |
| `setSize(size: number)` | `this` |  |
| `getDividerNode()` | `ICESplitterDivider` |  |
| `getFirstNode()` | `any` |  |
| `getSecondNode()` | `any` |  |
| `isDragging()` | `boolean` | 是否可拖动：分隔条自身 + 2px 容错（细条不好瞄）。 |

## `ICEWindow`

通用窗口外壳（桌面 / 多窗口场景的底座）：标题栏 + 按钮 + 客户端区域 + 缩放手柄。

- **拖动**：按住标题栏移动（受 `bounds` 限制，拖不出桌面）；点在按钮上不触发拖动；
- **焦点**：`active` 决定标题栏配色（XP 蓝 / 灰），点窗口任意位置会 `activate()` 并广播 `activate` 事件 —— 由外部窗口管理器据此抬 zIndex；
- **最大化 / 还原**：记住还原前的盒子，按 `bounds` 铺满；`minimize()` 只广播事件， 怎么藏（隐藏 or 收到任务栏）交给调用方；
- **缩放**：右下角手柄（`resizable: false` 可关），受 `minWidth` / `minHeight` 限制；
- **内容**：`content` 或 `setContent()` 装进客户端区域，自动铺满。 外观**默认取主题里的 `window` token**（`iceUIManager.setTheme()` 换主题时窗口跟着换）， `props.appearance` 可以逐项覆盖。怀旧主题（XP / 街机）在 `window` 里放它们自己的窗口外观， 所以那些页面的观感不变 —— 但不再是"写死在组件里、主题改不动"。

源码：[`src/components/ICEWindow.ts`](../../src/components/ICEWindow.ts)

**构造参数** `ICEWindowOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `title?` | `string` | 标题 |
| `icon?` | `string` | 标题栏左侧的图标字形 |
| `iconNode?` | `any` | 自绘图标节点（给了它就代替 `icon` 字形），会在标题栏左侧居中 |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `height?` | `number` | 高度（不传用组件默认值） |
| `bounds?` | `{ left: number; top: number; width: number; height: number }` | 拖动 / 最大化的活动范围（一般是桌面工作区） |
| `titleBarHeight?` | `number` |  |
| `movable?` | `boolean` |  |
| `resizable?` | `boolean` |  |
| `closable?` | `boolean` |  |
| `minimizable?` | `boolean` |  |
| `maximizable?` | `boolean` |  |
| `active?` | `boolean` |  |
| `minWidth?` | `number` |  |
| `minHeight?` | `number` |  |
| `content?` | `any` | 客户端内容（会铺满客户端区域） |
| `appearance?` | `ICEWindowAppearance` |  |
| `onClose?` | `() => void` | 关闭回调 |
| `onMinimize?` | `() => void` |  |
| `onMaximize?` | `(maximized: boolean) => void` |  |
| `onActivate?` | `() => void` |  |
| `onMove?` | `(left: number, top: number) => void` |  |
| `onResize?` | `(width: number, height: number) => void` |  |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getTitle()` | `string` |  |
| `setTitle(title: string)` | `this` |  |
| `getTitleBar()` | `ICEWidget` |  |
| `getTitleBarHeight()` | `number` |  |
| `getClientBox()` | `{ left: number; top: number; width: number; height: number }` | 客户端区域的盒子（相对窗口自身）。 |
| `getClientNode()` | `ICEWidget` |  |
| `getCloseButton()` | `ICEWindowButton` |  |
| `getMinimizeButton()` | `ICEWindowButton` |  |
| `getMaximizeButton()` | `ICEWindowButton` |  |
| `getResizeHandle()` | `ICEWidget` |  |
| `getTitleBarColor()` | `string` | 标题栏当前色（激活/非激活的中间色）——测试与主题调试用。 |
| `isActive()` | `boolean` |  |
| `setActive(active: boolean)` | `this` |  |
| `activate()` | `this` | 激活窗口并广播（外部据此抬 zIndex）。已经激活时也会广播，方便“置顶”）。 |
| `isMaximized()` | `boolean` |  |
| `maximize()` | `this` |  |
| `restore()` | `this` |  |
| `setContent(node: any)` | `this` |  |
| `getContent()` | `any` |  |
| `isDragging()` | `boolean` |  |
| `isResizing()` | `boolean` |  |
| `setBounds(bounds: { left: number; top: number; width: number; height: number })` | `this` |  |
| `setSize(width: number, height: number)` | `this` |  |

## `ICEOverlayManager`

弹层/浮层底座。  所有需要「浮在其它组件之上」的组件（Modal、Dropdown、Select、Tooltip、Popover、 右键菜单…）都走这一层，避免每个组件各自实现锚点定位、z 序、点外关闭、Esc 关闭。  实现要点：

- 浮层根节点挂在 **ICE 的工具层**（`ice.addTool`）：工具层会被递归渲染、绘制在所有 组件之上，且不参与 getComponentById 查找；根节点 `interactive:false`，所以它自身 不会被命中，只有浮层内容可交互。
- 浮层内容是根节点的子组件，位置由 `resolveICEOverlayPosition()` 按锚点世界盒算出来 （支持 12 种 placement、空间不足自动翻转、夹进可见范围；带视口缩放/平移也正确）。
- 关闭：点击浮层与锚点之外、Esc、或调用 handle.close()。

源码：[`src/core/ICEOverlayManager.ts`](../../src/core/ICEOverlayManager.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `start()` | `this` | 幂等：创建浮层根节点（挂到 ICE 工具层）并绑定关闭事件。 |
| `stop()` | `this` | 解绑并移除浮层根节点（关闭所有浮层）。 |
| `open(options: ICEOverlayOptions)` | `ICEOverlayHandle` |  |
| `close(handle: ICEOverlayHandle, reason: ICEOverlayCloseReason)` | `void` |  |
| `closeAll(reason: ICEOverlayCloseReason)` | `void` |  |
| `isOpen()` | `boolean` |  |
| `isKeyboardCaptured()` | `boolean` | 是否有浮层正在接管键盘（见 ICEOverlayOptions.keyboardCaptured）。 |
| `getLayer()` | `any` |  |

## `ICEFocusManager`

键盘焦点与焦点环。  引擎只负责「键盘事件派发给谁」（`ice.setFocusedComponent` + DOMEventDispatcher）， 上层的策略在这里：

- **可聚焦集合**：`ICEWidget.isFocusable()`（控件显式声明 + 启用 + 可见），按文档序；
- **Tab / Shift+Tab** 循环轮转，**Escape** 取消焦点，**Enter / Space** 激活 （调用控件的 `activate()`，勾选/开关/单选会覆盖成对应的切换动作）；
- **鼠标点击**同样会聚焦：命中后沿父链上溯到最近的可聚焦控件（点标签也能聚焦按钮）， 点在非控件区域则取消焦点；
- **焦点环**画在 ICE 工具层（非交互、绘制在所有组件之上），外扩 2px 跟随焦点组件。 焦点环跟随组件移动：组件触发 AFTER_MOVE 时重算（拖拽、布局变化都能跟上）。

源码：[`src/core/ICEFocusManager.ts`](../../src/core/ICEFocusManager.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `start()` | `this` | 幂等：创建焦点环（挂 ICE 工具层）并绑定键盘/鼠标事件。 |
| `stop()` | `this` | 解绑事件、清空焦点并摘除焦点环。 |
| `getFocused()` | `any` | 当前焦点控件（无焦点返回 null）。 |
| `getRing()` | `any` | 焦点环组件（测试与自定义样式用）。 |
| `getFocusOrigin()` | `'mouse' \| 'keyboard' \| 'api'` | 当前焦点是怎么来的（mouse / keyboard / api）。 |
| `isRingVisible()` | `boolean` | 焦点环此刻是否可见（`:focus-visible` 的结果）。 |
| `getFocusables()` | `any[]` | 按文档序返回当前可聚焦的控件。 |
| `setFocusScope(container: any)` | `this` | 限制焦点范围（模态对话框 / 抽屉的「焦点陷阱」）。 |
| `getFocusScope()` | `any` |  |
| `focus(component: any, options: { origin?: 'mouse' \| 'keyboard' \| 'api' })` | `this` | 设置焦点（传 null 取消焦点）。非可聚焦对象会被忽略成取消焦点。 |
| `focusNext()` | `this` | Tab：聚焦下一个（未聚焦时聚焦第一个；到末尾回绕）。 |
| `focusPrev()` | `this` | Shift+Tab：聚焦上一个。 |

## `ICEHoverManager`

ICE 内核的移动类事件为了性能不会在 mousemove 时做全量命中检测， 因此 Canvas 组件没有内置 mouseenter/mouseleave 语义。  ICEHoverManager 通过事件总线的 mousemove + ice.hitTest() 自己维护当前 hover 组件， 并把状态同步到带 setHovered() 的 ICEWidget 上，实现接近 HTML 组件的 hover 效果。

源码：[`src/core/ICEHoverManager.ts`](../../src/core/ICEHoverManager.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `start()` | `this` |  |
| `stop()` | `this` |  |
| `getHoveredComponent()` | `any` |  |

## `ICEMessageManager`

全局提示（Message / Notification）。

- 消息挂在**独立的工具层容器**上，与浮层系统解耦：打开 Modal / Popover 不会清掉消息， 消息也不参与浮层的 exclusive 关闭；
- `show()` 顶部居中堆叠，`notification()` 右下角倒序堆叠；
- duration 到期自动淡出后移除（0 表示常驻）；每条消息返回 handle 可单独关闭。

源码：[`src/core/ICEMessageManager.ts`](../../src/core/ICEMessageManager.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `start()` | `this` | 幂等：创建消息容器（挂 ICE 工具层）。 |
| `stop()` | `this` |  |
| `getLayer()` | `ICEWidget \| null` |  |
| `show(options: ICEMessageOptions)` | `ICEMessageHandle` | 顶部居中消息。 |
| `notification(options: ICENotificationOptions)` | `ICEMessageHandle` | 右下角通知（带标题、说明与关闭按钮）。 |
| `closeAll()` | `void` |  |
| `isOpen()` | `boolean` |  |

## `ICEManager`

主题管理单例（`iceUIManager`）：持有当前 token 表，组件构造时从这里取主题。

- 内置 `light` / `dark`；
- `registerTheme(name, tokens)` 注册自定义主题（例如库内置的 `ICE_XP_THEME`）， 然后 `setTheme('xp')` 切换；
- **主题在组件构造时读取一次**，要热切换就重建组件（见 docs/guides/theming.md）。

源码：[`src/core/ICEManager.ts`](../../src/core/ICEManager.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `setDensity(density: ICEDensity)` | `this` | 切换密度。 |
| `getDensity()` | `ICEDensity` |  |
| `setTheme(name: ICEThemeName, ice?: any)` | `this` | 切换主题。 |
| `getThemeName()` | `ICEThemeName` |  |
| `registerTheme(name: string, tokens: ICEThemeTokens)` | `this` | 注册（或覆盖）一套主题 token。 |
| `hasTheme(name: string)` | `boolean` |  |
| `getThemeNames()` | `string[]` | 已注册的主题名（内置 + 自定义）。 |
| `getTheme()` | `ICEThemeTokens` |  |
