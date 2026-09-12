# 数据展示

把数据画出来：表格、列表、树、卡片、统计卡、进度、时间轴、标签等。

## `ICETable`

表格：列定义（宽度 / 对齐 / 排序 / 自定义单元格）+ 行选中 + 悬停反馈 + 斑马纹； 点表头排序（升 → 降 → 恢复），`sorter` 可为布尔或自定义比较函数。

源码：[`src/components/ICETable.ts`](../../src/components/ICETable.ts)

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `setData(data: ICETableRow[])` | `this` |  |
| `getRows()` | `ICETableRow[]` | 当前渲染顺序的数据（排序后）。 |
| `getSortState()` | `ICETableSortState \| null` |  |
| `getHeaderLabel(key: string)` | `string` | 表头文案（排序中的列带 ▲/▼ 指示）。 |
| `toggleSort(key: string)` | `this` | 点表头：升序 → 降序 → 恢复原始顺序。 |
| `sortBy(key: string, order: 'asc' \| 'desc' \| null)` | `this` | 显式设置排序（`order: null` 恢复原始顺序）。 |
| `setSelectedRow(index: number)` | `this` |  |
| `getSelectedIndex()` | `number` |  |

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
