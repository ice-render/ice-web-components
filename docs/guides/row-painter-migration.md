# 「格子类」组件的 painter 迁移计划（2026-09-15）

> 状态：**未开始**。本文是 2026-09-15 那轮布局收口时逐组件复核出来的结论，
> 供下一轮直接照着做 —— 这些组件**不属于**"把坐标搬进策略"那一类，
> 而是要把"一项一个子节点"改成 **UI delegate 直接画**（Swing 的 `JTable` / `JList` / `JTree` /
> `BasicMenuUI` 都不为 cell/item 建子组件）。

## 为什么必须走 painter 线

布局策略（`ICELayoutManager`）解决的是"**已知的一组子节点**怎么摆"；
而表格/列表/树/菜单的问题是"**子节点数量随数据量线性增长**"：

| 组件 | 行数 | 子节点 | 现状 |
|---|---|---|---|
| `ICETable` | 3064 | 37 处 `addChild` | 表头/单元格/滚动条/编辑框都是节点 |
| `ICETree` | 592 | 8 处 | 行 + 展开手柄是节点 |
| `ICEList` | 262 | 4 处 | 每行 2 个节点（行底板 + 文字） |
| `ICEVirtualList` | 262 | 2 处 | 已做虚拟化，但可见行仍是节点 |
| `ICECarousel` | 425 | 8 处 | 幻灯片是**调用方内容**（必须留节点）+ 指示点是节点 |
| `ICEMenu` | 1019 | — | 菜单项是节点（`BasicMenuUI` 是自绘的） |

节点多的代价：每次数据变化重建子树、每帧渲染/命中/队列遍历都要过一遍、快照里全是派生数据。

## 迁移配方（`ICEAvatar` / `ICESkeleton` 已验证）

1. 组件持有**数据 + 几何**（行高、列宽、滚动偏移…），不再持有行节点；
2. 每帧在 `painter.paint({ ctx, theme, component, origin })` 里画行/单元格/选中态/文字
   （本地坐标，减 `origin`；参考 `ICESkeleton` 的占位条画法与 `util/ICEStyle` 的 `roundRectPath`）；
3. 命中改为**几何反查**：点击坐标 → 行/列下标（表格用 `columnWidths` 的累计前缀和、
   列表用 `Math.floor((y + scrollY) / rowHeight)`、树按行 + 缩进）；
4. 交互（hover / active / 选中）只改数据并 `dirty = true`，不建节点；
5. 真机回归：在 `e2e/painter.spec.ts` 里加一条"采样像素"用例（行底色 / 选中色 / 文字位置）。

## 每个组件的具体落点（复核时逐条确认过）

| 组件 | 入口 | 需要一起改的地方 |
|---|---|---|
| `ICETable` | `__render` / 单元格布局（37 处 `addChild`） | 列宽缓存、表头吸顶、排序指示、编辑框（编辑框是真控件 → 保留为唯一子节点）、`ICETableWideTabScroll` / `ICETable.pagination` / `ICETableEditScroll` 三套用例 |
| `ICETree` | 行 + 展开手柄 | 缩进深度、展开动画（`hover`/`active` 只改数据）、`ICETree` 相关用例 |
| `ICEList` | `__syncRows`（每行 2 节点） | **API 依赖**：`getRowNode(key)` 被 `tests/ICEList.test.ts` 用来 `trigger('click')` → 迁移时要提供 `clickRow(key)` / `setActiveIndex` 之类的数据级入口并改用例 |
| `ICEVirtualList` | 可见行节点 | 与 `ICEList` 同一套配方（它已有虚拟化窗口计算，正好复用） |
| `ICECarousel` | 幻灯片定位 + 指示点 | 幻灯片是**调用方内容**：位置交给自持策略（按 index 平移），指示点/箭头进 painter |
| `ICEMenu` | 菜单项行 | ① 行绘制进 painter；② **先**把展开/收起动画从写 `top` 改成 `transform.translate`（`ANIMATION_SAFE_KEYS` 里安全），否则布局/重排会把动画弹回去 |

## 建议顺序与验收

`ICETable`（收益最大：37 节点 → 1）→ `ICETree` → `ICEList` / `ICEVirtualList` →
`ICECarousel` → `ICEMenu` → `ICEGrid`/`ICEGridCol`（这条是"引擎加跨度分栏"或自持策略，见
`tests/layoutConvention.test.ts` 的豁免清单）。

每完成一个：把该条目从 `tests/layoutConvention.test.ts` 的 `PENDING` 挪进 `MIGRATED`（棘轮会催），
跑它自己的用例文件 + 全量 `npm run verify` + `npm run test:e2e`。
