# 数据展示

把数据画出来：表格、列表、树、卡片、统计卡、进度、时间轴、标签等。

## `ICETable`

表格：列定义（宽度 / 对齐 / 排序 / 自定义单元格）+ 行选择 + 分页 + 空态 + 悬停/斑马纹。

- 点表头排序：升 → 降 → 恢复，`sorter` 可为布尔或自定义比较函数；
- 行选择 `rowSelection: 'none' | 'single'（默认）| 'multiple'`：多选时最左侧多出 40px 选择列（表头全选 + 每行复选框），`getSelectedRows()` / `selectAll()` / `clearSelection()` 配合批量操作；选择变化触发 `selectionchange` 与 `onSelectionChange`；
- `pagination: { pageSize, page, showTotal, onChange }`：只渲染当前页并挂出 `ICEPagination`；
- 没有数据时渲染 `ICEEmpty` 空态（不会留一片空白）。

源码：[`src/components/ICETable.ts`](../../src/components/ICETable.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `setData(data: ICETableRow[])` | `this` |  |
| `getTotalRows()` | `number` | 全量行数（排序后、分页前的总数）。 |
| `getPageCount()` | `number` | 总页数；不分页时为 1。 |
| `getPage()` | `number` |  |
| `getPageSize()` | `number` |  |
| `setPage(page: number)` | `this` | 换页：夹取到 [1, pageCount]，重新渲染并回调。 |
| `setPageSize(pageSize: number)` | `this` |  |
| `getPaginationNode()` | `ICEPagination \| null` | 分页器节点（不分页 / 空数据时为 null）。 |
| `getRows()` | `ICETableRow[]` | 当前渲染顺序的数据（排序后）。 |
| `getSortState()` | `ICETableSortState \| null` |  |
| `getHeaderLabel(key: string)` | `string` | 表头文案（排序中的列带 ▲/▼ 指示）。 |
| `toggleSort(key: string)` | `this` | 点表头：升序 → 降序 → 恢复原始顺序。 |
| `sortBy(key: string, order: 'asc' \| 'desc' \| null)` | `this` | 显式设置排序（`order: null` 恢复原始顺序）。 |
| `setSelectedRow(index: number)` | `this` |  |
| `getSelectedIndex()` | `number` |  |
| `getSelectionMode()` | `ICETableSelectionMode` |  |
| `getSelectedIndexes()` | `number[]` |  |
| `getSelectedRows()` | `ICETableRow[]` | 选中的行（多选按行序返回）。 |
| `setSelectedIndexes(indexes: number[])` | `this` | 批量设置选中行（多选模式用；单选模式只认第一个）。 |
| `selectAll()` | `this` |  |
| `clearSelection()` | `this` |  |
| `getSelectionNode(index: number)` | `ICECheckBox \| null` |  |
| `getHeaderCheckbox()` | `ICECheckBox \| null` |  |
| `getColumnWidths()` | `Record<string, number>` | 当前各列实际宽度（按列 key 给，方便断言与持久化）。 |
| `setColumnWidth(key: string, width: number)` | `boolean` | 手动设置某列宽度（拖拽缩列走的就是它）：宽度按 `minWidth` 夹取，改完重排整张表。 |
| `isResizable()` | `boolean` |  |
| `isResizing()` | `boolean` |  |
| `isVirtual()` | `boolean` |  |
| `isScrollable()` | `boolean` |  |
| `getRowRange()` | `{ start: number; end: number; count: number }` | 当前可视行窗口（`[start, end)`，虚拟模式专用；普通模式返回整段）。 |
| `getRenderedRowCount()` | `number` | 真正建出来的行数（虚拟模式下的节点数上界，QA 拿它守「不会全量渲染」）。 |
| `getScroll()` | `{ x: number; y: number }` |  |
| `getContentHeight()` | `number` | 内容总高度（虚拟模式下 = 行数 × 行高）。 |
| `getFrozenWidth()` | `number` | 固定列的总宽度（没有固定列就是 0）。 |
| `setScrollTop(y: number)` | `this` |  |
| `setScrollLeft(x: number)` | `this` |  |
| `scrollToRow(index: number)` | `this` | 把某一行滚进视口（贴顶）。 |
| `isRowDraggable()` | `boolean` |  |
| `isRowDragging()` | `boolean` |  |
| `getDropTarget()` | `ICEDropTarget \| null` | 当前落点（拖拽中才有值；QA 用它断言指示线跟手）。 |
| `moveRow(from: number, target: ICEDropTarget)` | `boolean` | 把第 `from` 行移到落点处（拖拽松手时调用；也可以直接调它做「上移/下移」按钮）。 |

## `ICEList`

列表（Swing JList / 业界组件库 List 的最小版）。

- 选择逻辑在 `ICESelectionModel` 里（single 替换 / multiple 切换），组件只负责渲染与交互；
- 内容高于可视高度时自动套一层 `ICEScrollPane`（复用 A2 的滚动底座与子树裁剪）；
- 交互：点击行选中（disabled 行忽略）；焦点在列表上时 ↑/↓ 移动激活行（跳过 disabled）、 Enter/Space 选中激活行。

源码：[`src/components/ICEList.ts`](../../src/components/ICEList.ts)

**构造参数** `ICEListOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `items` | `ICEListItem[]` | 数据项 |
| `mode?` | `ICESelectionMode` |  |
| `value?` | `string[]` | 当前值 |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `height?` | `number` | 高度（不传用组件默认值） |
| `itemHeight?` | `number` |  |
| `onChange?` | `(keys: string[], item?: ICEListItem) => void` | 值变化回调 |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getSelectedKeys()` | `string[]` |  |
| `setSelectedKeys(keys: string[])` | `this` |  |
| `getSelectionModel()` | `ICESelectionModel` |  |
| `getActiveIndex()` | `number` |  |
| `getRowNode(key: string)` | `ICEWidget \| null` |  |
| `getScrollPane()` | `ICEScrollPane \| null` |  |
| `getItems()` | `ICEListItem[]` |  |
| `setItems(items: ICEListItem[])` | `this` |  |

## `ICETree`

树（Swing JTree / 业界组件库 Tree 的最小可用版）。

- 可见行 = 深度优先遍历、只展开 expandedKeys 里的节点；
- 每层缩进 16px，有子节点的行显示 ▸ / ▾（点箭头只切换展开，不改选择）；
- 选择走 `ICESelectionModel`（single / multiple）；
- 键盘：↑/↓ 移动激活行、→ 展开（已展开则进入首个子节点）、← 折叠（叶子则回父节点）、 Enter/Space 选中；
- 内容超出可视高度时自动套 `ICEScrollPane`。

源码：[`src/components/ICETree.ts`](../../src/components/ICETree.ts)

**构造参数** `ICETreeOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `nodes` | `ICETreeNode[]` | 树节点 |
| `mode?` | `ICESelectionMode` |  |
| `value?` | `string[]` | 当前值 |
| `expandedKeys?` | `string[]` |  |
| `defaultExpandAll?` | `boolean` |  |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `height?` | `number` | 高度（不传用组件默认值） |
| `itemHeight?` | `number` |  |
| `indent?` | `number` |  |
| `onSelect?` | `(keys: string[], node?: ICETreeNode) => void` | 选中回调 |
| `onExpand?` | `(expandedKeys: string[]) => void` |  |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getExpandedKeys()` | `string[]` |  |
| `setExpandedKeys(keys: string[])` | `this` |  |
| `expandAll()` | `this` |  |
| `collapseAll()` | `this` |  |
| `getSelectedKeys()` | `string[]` |  |
| `setSelectedKeys(keys: string[])` | `this` |  |
| `getActiveKey()` | `string \| null` |  |
| `getRowNode(key: string)` | `ICEWidget \| null` |  |
| `getVisibleNodes()` | `ICETreeNode[]` |  |
| `getRowDepth(key: string)` | `number` | 行所在层级（0 = 根层；缩进 = depth × indent）。 |
| `getScrollPane()` | `ICEScrollPane \| null` |  |

## `ICECard`

卡片：面板 + 标题，并提供右上角 `extra` 插槽（放“更多/操作”）。

源码：[`src/components/ICECard.ts`](../../src/components/ICECard.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `setTitle(title: string)` | `this` |  |
| `setExtra(extra: any)` | `this` | 右上角插槽（业界组件库 Card 的 `extra`）：放操作链接 / 按钮等。 |
| `getExtraNode()` | `any` |  |
| `getTitleNode()` | `any` |  |

## `ICEStatCard`

统计卡：图标 + 标题 + 数值 + 涨跌趋势，用于仪表盘顶部指标。

源码：[`src/components/ICEStatCard.ts`](../../src/components/ICEStatCard.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `setValue(value: string \| number)` | `this` |  |
| `setTitle(title: string)` | `this` |  |
| `setTrend(trend: string)` | `this` |  |

## `ICEStatistic`

统计数值（业界组件库 Statistic）：标题 + 大号数字 + 前缀/后缀，支持千分位与精度。  传 `countdown`（剩余毫秒）时进入倒计时模式：按「N 天 HH:mm:ss」显示剩余时间， 归零触发 `finish` 事件与 `onFinish` 回调（业界组件库 的 `Statistic.Countdown`）。

源码：[`src/components/ICEStatistic.ts`](../../src/components/ICEStatistic.ts)

**构造参数** `ICEStatisticOptions` — 统计数值（业界组件库 Statistic）：标题 + 大号数字 + 前缀/后缀，支持千分位与精度。  传 `countdown`（剩余毫秒）时进入倒计时模式：按「N 天 HH:mm:ss」显示剩余时间， 归零触发 `finish` 事件与 `onFinish` 回调（业界组件库 的 `Statistic.Countdown`）。

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `title?` | `string` | 标题 |
| `value?` | `number \| string` | 当前值 |
| `precision?` | `number` | 小数位数，默认 0 |
| `groupSeparator?` | `boolean` | 千分位分隔，默认 false |
| `prefix?` | `string` |  |
| `suffix?` | `string` |  |
| `status?` | `'default' \| 'primary' \| 'success' \| 'warning' \| 'error' \| 'info'` | 数值颜色状态（默认正文色） |
| `countdown?` | `number` | 倒计时剩余毫秒；给了就进入倒计时模式 |
| `autoStart?` | `boolean` | 倒计时是否自动开始（默认 true；测试里可关掉，避免挂定时器） |
| `onFinish?` | `() => void` | 倒计时归零回调（与 `finish` 事件同义） |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `height?` | `number` | 高度（不传用组件默认值） |
| `fontSize?` | `number` |  |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getTitleText()` | `string` |  |
| `getValueText()` | `string` |  |
| `setTitle(title: string)` | `this` |  |
| `setValue(value: number \| string)` | `this` | 普通模式：改数值（字符串原样显示）。 |
| `getValue()` | `number \| string` |  |
| `isCountdown()` | `boolean` |  |
| `getRemaining()` | `number` |  |
| `isRunning()` | `boolean` |  |
| `setCountdown(ms: number)` | `this` | 设置剩余毫秒。≤ 0 视为归零：文案变 `00:00:00`，停止计时并触发完成回调。 |
| `start()` | `this` | 开始（或继续）倒计时。 |
| `stop()` | `this` | 暂停倒计时（保留剩余时间）。 |

## `ICEDescriptions`

描述列表（业界组件库 Descriptions）：成对的「标签 / 值」，支持单列与多列。 常用于详情页（订单信息、用户资料）。

源码：[`src/components/ICEDescriptions.ts`](../../src/components/ICEDescriptions.ts)

**构造参数** `ICEDescriptionsOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `items` | `ICEDescriptionsItem[]` | 数据项 |
| `column?` | `number` |  |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `itemHeight?` | `number` |  |
| `labelWidth?` | `number` |  |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getRowNodes()` | `ICEWidget[]` |  |
| `setItems(items: ICEDescriptionsItem[])` | `this` | 替换数据并重排（列表内容随选中项变化时用）。 |

## `ICETimeline`

时间线（业界组件库 Timeline）：竖线 + 节点圆点 + 标题/描述/时间。

源码：[`src/components/ICETimeline.ts`](../../src/components/ICETimeline.ts)

**构造参数** `ICETimelineOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `items` | `ICETimelineItem[]` | 数据项 |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `itemHeight?` | `number` |  |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getItemNodes()` | `ICEWidget[]` |  |
| `getDotColor(index: number)` | `string` |  |
| `setItems(items: ICETimelineItem[])` | `this` | 替换数据并重排（内容随选中项变化时用）。 |

## `ICEProgressBar`

进度环/进度条。

- 线形（默认）：`ICEBoundedRangeModel` 驱动填充条宽度；
- 环形（`type: 'circle'`）：底环 + 进度弧（Path2D 弧线，12 点方向顺时针）+ 居中百分比； `size` / `strokeWidth` / `showText` / `format` 可配，`status: 'success'` 走成功色。

源码：[`src/components/ICEProgressBar.ts`](../../src/components/ICEProgressBar.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `setValue(value: number)` | `this` |  |
| `getValue()` | `number` |  |
| `isCircle()` | `boolean` |  |
| `getPercent()` | `number` | 归一化进度（0..1）。 |
| `getSweepRatio()` | `number` | 进度弧扫过的比例（0..1）；线形模式同样返回归一化进度。 |
| `getRingNode()` | `any` |  |
| `getTrackRingNode()` | `any` |  |
| `getTextNode()` | `ICELabel \| null` |  |

## `ICEImageView`

图片视图（基于引擎原语 `ICEImage`）。  名字带 `View` 后缀是为了避开引擎自己的 `ICEImage`（图片原语）——两个包同名不同物， 同时 import 会撞名，所以本库的控件一律叫 `ICEImageView`。

- 适配模式 `fill`（拉伸）/ `contain`（留白）/ `cover`（裁剪填满，居中）；
- 原始尺寸未知时先按容器盒铺满，图片载入后由引擎的 ImageCache 回调重排；
- 视口开 `clipChildren`，cover 溢出的部分被裁掉；
- 载入失败标记错误态（保留占位底）。

源码：[`src/components/ICEImageView.ts`](../../src/components/ICEImageView.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getSrc()` | `string` |  |
| `setSrc(src: string)` | `this` |  |
| `getFit()` | `ICEImageFit` |  |
| `setFit(fit: ICEImageFit)` | `this` |  |
| `isLoaded()` | `boolean` |  |
| `isErrored()` | `boolean` |  |
| `markError()` | `this` |  |
| `setNaturalSize(width: number, height: number)` | `this` | 已知原始尺寸时直接设定（图片 onload 回调 / 单测使用）。 |
| `getContentBox()` | `ICEImageContentBox` |  |
| `getViewportNode()` | `ICEWidget \| null` |  |
| `getImageNode()` | `EngineImage \| null` |  |

## `ICEImagePreview`

图片预览（业界组件库 `Image.PreviewGroup`）：全屏遮罩 + 居中图片 + 底部工具栏。

- 上一张 / 下一张循环切换（`change` 事件 + `onIndexChange`）；
- 缩放（步进 + 上下限）与 90° 旋转，`reset()` 复位；
- 关闭途径：工具栏关闭按钮、遮罩点击、Esc；打开期间接管 ←/→/+/− 快捷键；
- 浮层挂在引擎工具层（复用 `ICEOverlayManager`），关闭后自动移除。

源码：[`src/components/ICEImagePreview.ts`](../../src/components/ICEImagePreview.ts)

**构造参数** `ICEImagePreviewOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `images` | `string[]` |  |
| `index?` | `number` | 初始索引，默认 0 |
| `zoomStep?` | `number` | 每次缩放的步进，默认 0.25 |
| `minZoom?` | `number` | 缩放下限，默认 0.25 |
| `maxZoom?` | `number` | 缩放上限，默认 3 |
| `maskClosable?` | `boolean` |  |
| `closeOnEsc?` | `boolean` |  |
| `onIndexChange?` | `(index: number) => void` |  |
| `onClose?` | `(reason: ICEImagePreviewCloseReason) => void` | 关闭回调 |
| `manager?` | `ICEOverlayManager` | 浮层管理器（一般不用传，组件会取共享实例） |
| `focusManager?` | `ICEFocusManager` |  |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `isOpen()` | `boolean` |  |
| `getIndex()` | `number` |  |
| `getZoom()` | `number` |  |
| `getRotation()` | `number` |  |
| `getMask()` | `ICEPanel \| null` |  |
| `getFrame()` | `ICEWidget \| null` |  |
| `getImageNode()` | `ICEImageView \| null` |  |
| `getToolbarButton(name: ICEPreviewToolbarButton)` | `ICEButton \| null` |  |
| `getImages()` | `string[]` |  |
| `open(index?: number)` | `this` |  |
| `close(reason: ICEImagePreviewCloseReason)` | `this` |  |
| `setIndex(index: number)` | `this` |  |
| `next()` | `this` |  |
| `prev()` | `this` |  |
| `zoomIn()` | `this` |  |
| `zoomOut()` | `this` |  |
| `rotateLeft()` | `this` |  |
| `rotateRight()` | `this` |  |
| `reset()` | `this` | 缩放与旋转同时复位。 |
| `on(name: string, handler: (evt: any) => void)` | `this` |  |
| `off(name: string, handler: (evt: any) => void)` | `this` |  |
| `trigger(name: string, evt: any, param?: any)` | `this` |  |

## `ICECalendar`

日历（业界组件库 Calendar 的最小版）：月视图 + 日期选择。

- 标题「YYYY 年 M 月」+ 上/下月切换（回调 `onChangeMonth`）；
- 6×7 网格：相邻月份补齐的格子弱化显示，点击仍然可选；
- 选中日期实底高亮，今天带主色描边（`today` 可注入，便于测试与「业务今天」）；
- 键盘：←/→ 按天、↑/↓ 按周移动选中，PageUp/PageDown 切月。

源码：[`src/components/ICECalendar.ts`](../../src/components/ICECalendar.ts)

**构造参数** `ICECalendarOptions` — 日历（业界组件库 Calendar 的最小版）：月视图 + 日期选择。

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `value?` | `string` | 选中日期 `YYYY-MM-DD` |
| `month?` | `string` | 当前显示的月份 `YYYY-MM`，默认取 value 所在月 / 今天所在月 |
| `today?` | `string` | 「今天」的日期（不传取系统时间；传了便于测试与业务定制） |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `height?` | `number` | 高度（不传用组件默认值） |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `onSelect?` | `(date: string) => void` | 选中回调 |
| `onChangeMonth?` | `(month: string) => void` |  |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getValue()` | `string \| null` |  |
| `setValue(value: any, options: { silent?: boolean })` | `this` |  |
| `getFormValue()` | `any` |  |
| `setFormValue(value: any)` | `void` |  |
| `getVisibleMonth()` | `string` |  |
| `setVisibleMonth(month: string, options: { silent?: boolean })` | `this` |  |
| `prevMonth()` | `this` |  |
| `nextMonth()` | `this` |  |
| `getTitleText()` | `string` |  |
| `getWeekdayTexts()` | `string[]` |  |
| `getCellNodes()` | `ICEWidget[]` |  |
| `getCellNode(date: string)` | `ICEWidget \| null` |  |
| `getCellBackground(date: string)` | `string` |  |
| `getCellTextColor(date: string)` | `string` |  |
| `isToday(date: string)` | `boolean` |  |
| `selectDate(date: string)` | `this` | 程序式选中（不发事件）。 |
| `getPrevButton()` | `ICEWidget \| null` |  |
| `getNextButton()` | `ICEWidget \| null` |  |

## `ICEAvatar`

文字头像：取首字母/汉字，背景色可配，自带描边把相邻头像分开。

源码：[`src/components/ICEAvatar.ts`](../../src/components/ICEAvatar.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `setText(text: string)` | `this` |  |
| `getText()` | `string` |  |

## `ICEAvatarGroup`

头像组（业界组件库 Avatar.Group 的最小版）。

- 头像横向**重叠**排布（每个左移 `overlap`），靠 ICEAvatar 自带的描边把相邻头像分开；
- 超过 `max` 个时折叠：只显示前 max 个，末尾补一个 `+N` 头像；
- 组件宽度按「最后一个头像的右边缘」算，方便直接放进工具栏/表格单元格。

源码：[`src/components/ICEAvatarGroup.ts`](../../src/components/ICEAvatarGroup.ts)

**构造参数** `ICEAvatarGroupOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `avatars` | `ICEAvatarGroupItem[]` |  |
| `size?` | `number` | 尺寸 |
| `max?` | `number` |  |
| `overlap?` | `number` | 相邻头像的重叠像素；默认 size / 4 |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getCount()` | `number` |  |
| `getVisibleCount()` | `number` |  |
| `getRestCount()` | `number` |  |
| `getAvatarNodes()` | `ICEAvatar[]` |  |
| `getRestNode()` | `ICEAvatar \| null` |  |
| `setAvatars(avatars: ICEAvatarGroupItem[])` | `this` |  |

## `ICETag`

标签：默认 Bootstrap 实底（`.text-bg-*`），`variant: 'soft'` 切浅底 + 强调文字。

源码：[`src/components/ICETag.ts`](../../src/components/ICETag.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `setText(text: string)` | `this` |  |

## `ICEBadge`

徽标：数字/文字胶囊；`dot` 是红点模式，`count` 超过阈值自动显示 `99+`。

源码：[`src/components/ICEBadge.ts`](../../src/components/ICEBadge.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `setText(text: string)` | `this` |  |
| `isDot()` | `boolean` | 是否红点模式（只有圆点、没有文字）。 |
| `getText()` | `string` |  |

## `ICECarousel`

轮播（业界组件库 Carousel 的最小版）。

- 结构：裁剪视口（`clipChildren`）里一条横向轨道，幻灯片并排；轨道 left = -index * width；
- `goTo` / `next` / `prev` 切换，`loop` 控制是否循环；箭头与圆点可点，方向键 ←/→ 也可切；
- 切换用可注入 frame driver 的补间（`duration: 0` 时同步落位，便于测试）；
- 自动播放走可注入的调度器（`play` / `pause` / `isPlaying`）。

源码：[`src/components/ICECarousel.ts`](../../src/components/ICECarousel.ts)

**构造参数** `ICECarouselOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `slides?` | `ICEWidget[]` |  |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `height?` | `number` | 高度（不传用组件默认值） |
| `initialIndex?` | `number` |  |
| `loop?` | `boolean` |  |
| `duration?` | `number` | 切换过渡时长（毫秒）；0 = 立即落位 |
| `autoplay?` | `number` | 自动播放间隔（毫秒）；> 0 时构造后即开始播放 |
| `arrows?` | `boolean` |  |
| `dots?` | `boolean` |  |
| `onChange?` | `(index: number) => void` | 值变化回调 |
| `driver?` | `ICECarouselFrameDriver` |  |
| `scheduler?` | `ICECarouselScheduler` |  |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getCount()` | `number` |  |
| `getIndex()` | `number` |  |
| `setSlides(slides: ICEWidget[])` | `this` |  |
| `getSlideNode(index: number)` | `ICEWidget \| null` |  |
| `getTrackNode()` | `ICEWidget \| null` |  |
| `getPrevButton()` | `ICEWidget \| null` |  |
| `getNextButton()` | `ICEWidget \| null` |  |
| `getDotNode(index: number)` | `ICEWidget \| null` |  |
| `isPlaying()` | `boolean` |  |
| `play()` | `this` |  |
| `pause()` | `this` |  |
| `setAutoplay(ms: number)` | `this` |  |
| `goTo(index: number, animate: boolean)` | `this` |  |
| `next()` | `this` |  |
| `prev()` | `this` |  |
| `activate()` | `void` |  |

## `ICECollapse`

折叠面板（业界组件库 Collapse / Swing 无直接对应物）。

- 每项 = 标题行（▸/▾ + 标题）+ 展开时的内容区；内容支持纯文本或组件工厂；
- `accordion: true` 时同时只展开一个；展开/收起会重排并回调 onExpand(keys)；
- 标题行是独立命中区（点标题只切换展开，不触发内容交互）。

源码：[`src/components/ICECollapse.ts`](../../src/components/ICECollapse.ts)

**构造参数** `ICECollapseOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `items` | `ICECollapseItem[]` | 数据项 |
| `activeKeys?` | `string[]` |  |
| `accordion?` | `boolean` |  |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `headerHeight?` | `number` |  |
| `contentHeight?` | `number` |  |
| `onChange?` | `(keys: string[]) => void` | 值变化回调 |
| `onExpand?` | `(keys: string[]) => void` |  |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getActiveKeys()` | `string[]` |  |
| `setActiveKeys(keys: string[])` | `this` |  |
| `getHeaderNode(key: string)` | `ICEWidget \| null` |  |
| `getContentNode(key: string)` | `ICEWidget \| null` |  |
| `getItemTop(key: string)` | `number` |  |

## `ICEComment`

评论（业界组件库 Comment 的最小版）：文字头像 + 作者 + 时间 + 正文 + 操作按钮 + 嵌套回复。  布局自上而下：头像在左，右侧依次是「作者 · 时间」「正文」「操作」「回复（缩进）」。 高度按内容自动累加（正文单行 20px，多行请自行用 content 组件工厂）。

源码：[`src/components/ICEComment.ts`](../../src/components/ICEComment.ts)

**构造参数** `ICECommentOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `author` | `string` |  |
| `content` | `string` | 内容（纯文本，或返回组件的工厂函数） |
| `time?` | `string` |  |
| `avatarText?` | `string` | 文字头像（默认取 author 首字） |
| `avatarColor?` | `string` |  |
| `actions?` | `ICECommentAction[]` |  |
| `onAction?` | `(key: string) => void` | 操作按钮回调 |
| `replies?` | `ICECommentOptions[]` |  |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `indent?` | `number` |  |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getActionButton(key: string)` | `ICEButton \| null` |  |
| `getReplyNodes()` | `ICEComment[]` |  |

## `ICEWatermark`

水印（业界组件库 Watermark）：把一段旋转文字平铺在自己的区域上。

- 用于「内部资料 / 草稿 / 不可外传」这类页面级标记；
- 不参与交互（`interactive: false`），不会挡住底下的点击；
- 裁剪在自己的区域内（`clipChildren`）：边缘瓦片被切掉半截，不会溢出到邻居身上；
- 瓦片数量 = `(⌈width/gapX⌉ + 1) × (⌈height/gapY⌉ + 1)`，`gap` 不传时按文字宽度自适应；
- 颜色默认半透明灰（`rgba(0,0,0,0.08)`），可用 `color` / `opacity` 调整。

源码：[`src/components/ICEWatermark.ts`](../../src/components/ICEWatermark.ts)

**构造参数** `ICEWatermarkOptions` — 水印（业界组件库 Watermark）：把一段旋转文字平铺在自己的区域上。

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎会用它做唯一标识，e2e/调试时可按 id 定位） |
| `text` | `string` | 文案 |
| `fontSize?` | `number` |  |
| `color?` | `string` | 文字颜色，默认 `rgba(0,0,0,0.08)` |
| `opacity?` | `number` | 整体不透明度，默认 1（颜色本身已经半透明） |
| `rotate?` | `number` | 旋转角度（度），默认 -22 |
| `gapX?` | `number` | 水平间距，默认按文字宽度 + 60 自适应 |
| `gapY?` | `number` | 垂直间距，默认 72 |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `height?` | `number` | 高度（不传用组件默认值） |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getText()` | `string` |  |
| `getTileCount()` | `number` |  |
| `getTileNodes()` | `ICELabel[]` |  |
| `setText(text: string)` | `this` |  |
| `setSize(width: number, height: number)` | `this` | 改尺寸后重排瓦片（数量跟着变）。 |

## `ICETileMap`

单个格子的绘制样式。

源码：[`src/components/ICETileMap.ts`](../../src/components/ICETileMap.ts)

**构造参数** `ICETileMapOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎用它做唯一标识；e2e/调试时可按 id 定位） |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `rows` | `number` | 行数 |
| `cols` | `number` |  |
| `cellSize?` | `number` | 每格边长（含间隙），默认 20 |
| `gap?` | `number` | 格子之间的间隙，默认 2（均分在格子两边） |
| `cellRadius?` | `number` | 格子圆角默认值，默认 4 |
| `width?` | `number` | 整块棋盘的宽高（默认 cols*cellSize / rows*cellSize；给大了就留白，便于居中摆放） |
| `height?` | `number` | 高度（不传用组件默认值） |
| `palette?` | `ICETileMapPalette` |  |
| `pulseColor?` | `string` | 脉冲默认颜色 |
| `highlightColor?` | `string` | 高亮默认描边色 |
| `labelFontSize?` | `number` | 标签默认字号 / 颜色（格子样式里可以逐项覆盖） |
| `labelColor?` | `string` |  |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getRows()` | `number` |  |
| `getCols()` | `number` |  |
| `getCellSize()` | `number` |  |
| `getGap()` | `number` |  |
| `getCellRect(row: number, col: number)` | `{ left: number; top: number; width: number; height: number }` | 格子在组件内的矩形（gap 均分在两边）。 |
| `getCellAt(x: number, y: number)` | `{ row: number; col: number } \| null` | 组件内坐标 → 格子（边界外返回 null；落在间隙里算最近的格子）。 |
| `setTiles(tiles: Array<string \| number \| null> \| Array<Array<string \| number \| null>>)` | `this` | 设置格子数据：一维（长度 = rows*cols）或二维（rows 行）；数字会被当成字符串 key。 |
| `getTiles()` | `Array<string \| null>` |  |
| `setLabels(labels: Array<string \| number \| null> \| Array<Array<string \| number \| null>>)` | `this` | 设置标签层（和 tiles 一样长度，值可以是任意字符串）。 |
| `getLabels()` | `Array<string \| null>` |  |
| `setPalette(palette: ICETileMapPalette)` | `this` |  |
| `getPalette()` | `ICETileMapPalette` | 调色板拷贝（改返回值不会影响组件内部）。 |
| `resolveCellStyle(key: string \| null)` | `ICETileMapCellStyle \| null` | 某个 key 对应的样式（未知 key 返回 null = 不绘制）。 |
| `setHighlights(highlights: ICETileMapHighlight[])` | `this` |  |
| `getHighlights()` | `ICETileMapHighlight[]` |  |
| `pulse(cells: ICETileMapPulse[], options: { duration?: number; color?: string; driver?: ICEFrameDriver })` | `this` | 闪一下（消行 / 吃到食物）：用 tween 把 alpha 从 1 拉到 0，结束后自动清空。 |
| `getPulses()` | `ICETileMapPulse[]` |  |
| `getPulseAlpha()` | `number` |  |
| `getPaintCount()` | `number` |  |
| `paintBoard()` | `void` | 自绘整块网格。浏览器里由 `doRender()` 自动调用；单测可以直接调来数自绘次数。 |
| `initEvents()` | `void` |  |

## `ICEVirtualList`

当前该渲染的区间：`[start, end)`。

源码：[`src/components/ICEVirtualList.ts`](../../src/components/ICEVirtualList.ts)

**构造参数** `ICEVirtualListOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `id?` | `string` | 组件 id（引擎用它做唯一标识；e2e/调试时可按 id 定位） |
| `left?` | `number` | 相对父容器的左边距 |
| `top?` | `number` | 相对父容器的上边距 |
| `width?` | `number` | 宽度（不传用组件默认值） |
| `height?` | `number` | 视口高度（列表本身的尺寸，内容由它决定滚动范围） |
| `itemHeight` | `number` | 每行高度（固定行高才谈得上虚拟滚动） |
| `buffer?` | `number` | 上下缓冲条数，默认 2 |
| `items?` | `any[]` | 数据项 |
| `renderItem?` | `(index: number, item: any, node: any) => void` | 渲染一条：拿到的是**数据下标**（不是节点下标），可以复用传入的 node |
| `scrollbar?` | `boolean` | 是否显示滚动条，默认 true |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `getItemCount()` | `number` |  |
| `getItemHeight()` | `number` |  |
| `getBuffer()` | `number` |  |
| `getItems()` | `any[]` |  |
| `getContentHeight()` | `number` | 内容总高度（撑开滚动条用）。 |
| `getScrollTop()` | `number` |  |
| `getRange()` | `ICEVirtualRange` | 当前窗口（查询前会先同步一次，保证拿到的是最新状态）。 |
| `getRenderedNodes()` | `Array<{ index: number; node: any }>` | 当前真正渲染出来的节点（按下标升序）。 |
| `getRenderedCount()` | `number` |  |
| `getScrollPane()` | `ICEScrollPane` | 对外暴露滚动视口（需要挂滚动监听时用）。 |
| `setItems(items: any[])` | `this` |  |
| `setScrollTop(scrollTop: number)` | `this` |  |
| `scrollToIndex(index: number)` | `this` | 把某一条滚进视口（贴顶对齐），下标会被夹进合法范围。 |
