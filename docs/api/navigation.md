# 导航

菜单、下拉触发、分页与标签页。

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
| `getActiveIndex()` | `number` |  |
| `setActiveIndex(index: number)` | `this` |  |
| `getTabs()` | `string[]` |  |
