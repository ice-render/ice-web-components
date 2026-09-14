# 导航

菜单、面包屑、锚点导航、回到顶部、下拉触发、分页与标签页。

## `ICEMenu`

菜单：菜单项 +（可选）子菜单内联展开；选中态与悬停态分离，父项在子项选中时只做“当前分组”提示。

源码：[`src/components/ICEMenu.ts`](../../src/components/ICEMenu.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `setSelectedKey(key: string \| null)` | `this` |  |
| `getSelectedKey()` | `string \| null` |  |
| `getVisibleItems()` | `ICEMenuItem[]` | 可见行（展开状态下的扁平列表）。 |
| `getItemNode(key: string)` | `any` |  |
| `isExpanded(key: string)` | `boolean` |  |
| `toggleExpand(key: string)` | `this` |  |
| `setExpandedKeys(keys: string[])` | `this` |  |
| `activateItem(key: string)` | `this` | 激活某个可见项：父节点展开/收起，叶子项选中并回调。 |
| `getMode()` | `'vertical' \| 'horizontal'` |  |
| `isCollapsed()` | `boolean` |  |
| `setCollapsed(collapsed: boolean)` | `this` |  |
| `isLabelVisible(key: string)` | `boolean` | 该项当前画没画文字（收起态只有图标）。 |
| `hasIcon(key: string)` | `boolean` |  |
| `getItemBoxes()` | `Array<{ key: string; left: number; top: number; width: number; height: number }>` | 每个可见项的盒子（形态断言 / 几何审计用）。 |
| `isSubmenuOpen()` | `boolean` |  |
| `getSubmenuKey()` | `string \| null` |  |
| `getSubmenuItemNode(key: string)` | `any` |  |
| `closeSubmenu()` | `this` |  |
| `openSubmenu(key: string)` | `this` | 打开某一项的子菜单浮层（横向模式的父项）。 |
| `getActiveKey()` | `string \| null` |  |
| `setActiveKey(key: string \| null)` | `this` |  |

## `ICEBreadcrumb`

面包屑：一行「路径 + 分隔符」，最后一项是当前页。

- 宽度按内容自适应（中文按 1em 估算，不会把文字压出色块外）；
- 除最后一项外都可点击，点击触发 `navigate` 事件（载荷 `{ item, index }`）与 `onNavigate`；
- `maxItems` 超长时把中间项折叠成「…」，点击省略号展开（折叠语义： `maxItems` 只数真实项，省略号不占额度）。

源码：[`src/components/ICEBreadcrumb.ts`](../../src/components/ICEBreadcrumb.ts)

**构造参数** `ICEBreadcrumbOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `items` | `ICEBreadcrumbItem[]` | 数据项 |
| `separator?` | `string` | 分隔符，默认 `›` |
| `maxItems?` | `number` | 最多显示多少**真实项**（超过则中间折叠为省略号）；不传或 ≤ 0 表示不折叠 |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `height?` | `number` | 高度（不传用组件默认值） |
| `fontSize?` | `number` |  |
| `onNavigate?` | `(item: ICEBreadcrumbItem, index: number) => void` | 点击非当前项的回调（与 `navigate` 事件同义） |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getLabelTexts()` | `string[]` | 当前显示的标签（折叠时中间会多出一个 `…`）。 |
| `getItemNodes()` | `ICEBreadcrumbItemNode[]` |  |
| `getSeparatorNodes()` | `ICELabel[]` |  |
| `getItems()` | `ICEBreadcrumbItem[]` |  |
| `isCollapsed()` | `boolean` |  |
| `expand()` | `this` | 展开被折叠的中间项。 |
| `setItems(items: ICEBreadcrumbItem[])` | `this` |  |

## `ICEAnchor`

锚点导航：一列锚点，点击滚到目标位置，滚动时自动高亮当前项。  与 `ICEScrollPane` 配合使用：`target` 传滚动容器，`items[].top` 是该段落在 **内容坐标系**里的纵向位置。滚动事件由 `ICEScrollPane` 的 `scroll` 事件驱动。

源码：[`src/components/ICEAnchor.ts`](../../src/components/ICEAnchor.ts)

**构造参数** `ICEAnchorOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `target` | `any` | 跟随的滚动容器 |
| `items` | `ICEAnchorItem[]` | 数据项 |
| `activeKey?` | `string` | 初始活动项，默认第一项 |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `itemHeight?` | `number` |  |
| `fontSize?` | `number` |  |
| `onChange?` | `(key: string) => void` | 用户点击 / 键盘切换锚点时的回调（滚动带出来的高亮不回调） |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getActiveKey()` | `string \| null` |  |
| `getLabelTexts()` | `string[]` |  |
| `getItemNode(key: string)` | `ICEWidget \| null` |  |
| `getLabelColor(key: string)` | `string` |  |
| `setActiveKey(key: string, options: { scroll?: boolean })` | `this` | 程序式切换活动项（默认不滚动，传 scroll: true 才滚）。 |
| `getItems()` | `ICEAnchorItem[]` |  |
| `setItems(items: ICEAnchorItem[])` | `this` |  |

## `ICEBackTop`

回到顶部：一个小圆按钮，滚动超过阈值才出现。  用法是把滚动容器交给它：`new ICEBackTop({ target: scrollPane })`。 依赖 `ICEScrollPane` 的 `scroll` 事件（滚动位置变化时派发）， 点击后把目标滚回 `(0, 0)` 并回调 `onClick`。

源码：[`src/components/ICEBackTop.ts`](../../src/components/ICEBackTop.ts)

**构造参数** `ICEBackTopOptions` — 回到顶部：一个小圆按钮，滚动超过阈值才出现。  用法是把滚动容器交给它：`new ICEBackTop({ target: scrollPane })`。 依赖 `ICEScrollPane` 的 `scroll` 事件（滚动位置变化时派发）， 点击后把目标滚回 `(0, 0)` 并回调 `onClick`。

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `target` | `any` | 跟随的滚动容器（实现 getScroll / setScroll / on('scroll') 即可） |
| `visibilityHeight?` | `number` | 超过多少滚动量才出现，默认 200 |
| `size?` | `number` | 圆按钮直径，默认 36 |
| `icon?` | `string` | 图标字形，默认 ↑ |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `onClick?` | `() => void` | 点击回调 |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `isVisible()` | `boolean` |  |
| `getButtonColor()` | `string` | 当前按钮底色（悬停态取主色 hover）。 |
| `setTarget(target: any)` | `this` |  |

## `ICEDropdown`

下拉菜单：点击触发组件弹出选项列表。

- 弹出/定位/点外关闭/Esc 全部复用 `ICEOverlayManager`；
- 菜单项支持 disabled 与选中态（primary + ✓）；点选回调 `onSelect(item, index)`；
- 键盘：↑/↓ 在可选项间移动（跳过 disabled、首尾回绕），Enter 选中并关闭。 关闭状态下不响应方向键（避免抢走页面的按键）。

源码：[`src/components/ICEDropdown.ts`](../../src/components/ICEDropdown.ts)

**构造参数** `ICEDropdownOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `items` | `ICEDropdownItem[]` | 数据项 |
| `selectedKey?` | `string` |  |
| `placement?` | `ICEOverlayPlacement` |  |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `itemHeight?` | `number` |  |
| `offset?` | `number` |  |
| `onSelect?` | `(item: ICEDropdownItem, index: number) => void` | 选中回调 |
| `manager?` | `ICEOverlayManager` | 浮层管理器（一般不用传，组件会取共享实例） |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `start()` | `this` |  |
| `destroy()` | `this` |  |
| `isOpen()` | `boolean` |  |
| `getSelectedKey()` | `string \| null` |  |
| `setSelectedKey(key: string \| null)` | `this` |  |
| `getActiveIndex()` | `number` |  |
| `getItemNode(index: number)` | `ICEWidget \| null` |  |
| `setItems(items: ICEDropdownItem[])` | `this` |  |
| `open()` | `this` |  |
| `close()` | `this` |  |
| `toggle()` | `this` |  |

## `ICEPagination`

分页器：页码 + 上一页/下一页 + 可选「共 N 条」与每页条数切换。

- 页码按钮就是 `ICEButton`，所以天然可聚焦（Tab / Enter 可操作，见 ICEFocusManager）；
- 页数多时用省略号收口：始终显示首页、末页与当前页附近的窗口（最多 `maxPageButtons` 个页码位）；
- `setCurrent` / `setPageSize` 会夹取并重排，变更后回调 `onChange(page, pageSize)`。

源码：[`src/components/ICEPagination.ts`](../../src/components/ICEPagination.ts)

**构造参数** `ICEPaginationOptions` — 分页器：页码 + 上一页/下一页 + 可选「共 N 条」与每页条数切换。

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `total?` | `number` |  |
| `pageSize?` | `number` |  |
| `current?` | `number` |  |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `maxPageButtons?` | `number` | 页码位上限（含省略号，默认 7） |
| `showTotal?` | `boolean` |  |
| `showSizeChanger?` | `boolean` |  |
| `pageSizeOptions?` | `number[]` |  |
| `size?` | `'default' \| 'small'` | 尺寸 |
| `onChange?` | `(page: number, pageSize: number) => void` | 值变化回调 |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getTotal()` | `number` |  |
| `getPageCount()` | `number` |  |
| `getCurrent()` | `number` |  |
| `getPageSize()` | `number` |  |
| `getPrevButton()` | `ICEButton \| null` |  |
| `getNextButton()` | `ICEButton \| null` |  |
| `getPageButton(page: number)` | `ICEButton \| null` |  |
| `getSizeChanger()` | `ICEButton \| null` |  |
| `setTotal(total: number)` | `this` |  |
| `setCurrent(page: number, options: { silent?: boolean })` | `this` | 设置当前页（自动夹取到 [1, pageCount]），变化时回调 onChange。 |
| `setPageSize(pageSize: number, options: { silent?: boolean })` | `this` | 设置每页条数（重算页数并把 current 夹取到合法范围），变化时回调 onChange。 |

## `ICETabs`

标签页：一组互斥按钮，`onChange` 通知切换（程序式 `setActiveIndex` 不触发回调）。

源码：[`src/components/ICETabs.ts`](../../src/components/ICETabs.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getPlacement()` | `'top' \| 'bottom' \| 'left' \| 'right'` |  |
| `isReordering()` | `boolean` |  |
| `getActiveLabel()` | `string` |  |
| `getActiveIndex()` | `number` |  |
| `setActiveIndex(index: number)` | `this` |  |
| `getTabs()` | `string[]` |  |
| `getType()` | `'line' \| 'card'` |  |
| `isClosable()` | `boolean` |  |
| `getExtra()` | `any[]` |  |
| `isOverflow()` | `boolean` |  |
| `getScrollOffset()` | `number` |  |
| `getViewportWidth()` | `number` |  |
| `getMaxScroll()` | `number` |  |
| `setScrollOffset(offset: number)` | `this` | 按固定偏移滚动（自动夹取）。 |
| `scrollBy(delta: number)` | `this` |  |
| `scrollIntoView(index: number)` | `this` | 把某一页滚进可视区（点被裁掉的页签时用）。 |
| `getPrevButton()` | `ICEButton \| null` |  |
| `getNextButton()` | `ICEButton \| null` |  |
| `getTabBoxes()` | `Array<{ left: number; top: number; width: number; height: number }>` | 页签当前的盒子（相对组件；含滚动偏移）。 |
| `closeTab(index: number)` | `this` | 关掉某个页签：移除按钮与标签、通知 `onClose`、把激活下标夹回合法范围。 |
