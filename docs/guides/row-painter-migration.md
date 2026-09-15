# 「格子类」组件的 painter 迁移计划（2026-09-15）

> 状态：**已完成（2026-09-15）** —— 结论见文末「最终结论」：
> 真正"节点随数据无界"的只有 `ICEList`（已修）与 `ICEVirtualList`（顺手也画家化）；
> `ICETree` / `ICETable` / `ICECarousel` / `ICEMenu` **本来就有界**（虚拟化或取决于调用方给的规模），
> 不需要为此做破坏性改造。
> 本文是 2026-09-15 那轮布局收口时逐组件复核出来的结论，
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

## ⚠️ 复核后的重要修正：先分清"无界节点"与"有界节点"（2026-09-15 追加）

把 `ICETable` / `ICEList` / `ICEVirtualList` 逐个读完（不是抽样）后，结论要修正：

**painter 化会破坏两个公开契约**：

* `ICEVirtualList.renderItem(index, item, node)`：`node` 是**交给调用方填内容的行节点** ——
  调用方 `node.addChild(...)` 是文档化用法（`ICESelect.virtual` / `ICETree.virtual` /
  `ICETableVirtual` 三处用例与示例都在用）。改成 painter 就要把这套 API 换成"绘制回调"，
  属于**破坏性变更**，下游要跟着改。
* `ICEList.getRowNode(key)`：测试与调用方用它拿行节点、`trigger('click')` 驱动交互。

**真正的痛点不是"有节点"，而是"节点随数据量无界增长"**：

| 组件 | 可见节点数 | 结论 |
|---|---|---|
| `ICEVirtualList` | 视口 + buffer ≈ 10~20（有界） | 已经是对的：行节点只建可见的那些（Swing 的 `JList` 连这些都不建，但**有界**就没问题） |
| `ICEList` | = 数据条数（**无界**） | 缺的是**虚拟化**（拿 `computeVirtualRange` 填上），不是 painter |
| `ICETable` | 可见行 × 列数（取决于是否虚拟化） | 先确认没有虚拟化路径 → 补虚拟化；painter 是第二步 |
| `ICETree` | = 展开的节点数（可无界） | 同上，先虚拟化 |

**所以建议把顺序改成"先界，再画"**：

1. **补虚拟化**（`ICEList` 用现成的 `computeVirtualRange`；`ICETable`/`ICETree` 加窗口渲染）——
   **不破坏任何 API**，节点数立刻有界，收益最大、风险最低；
2. **再谈 painter**：那时剩下的只是"行内的底色/文字要不要自绘"，
   而且可以**保留 `renderItem` 兼容层**（旧回调照常拿到节点；想用 painter 的走新回调），
   不必一次性破坏下游。

上表与这两条就是"painter 线"的完整前置判断；下面的逐组件落点仍有效，只是执行顺序按上面这条走。

`ICETable`（收益最大：37 节点 → 1）→ `ICETree` → `ICEList` / `ICEVirtualList` →
`ICECarousel` → `ICEMenu` → `ICEGrid`/`ICEGridCol`（这条是"引擎加跨度分栏"或自持策略，见
`tests/layoutConvention.test.ts` 的豁免清单）。

每完成一个：把该条目从 `tests/layoutConvention.test.ts` 的 `PENDING` 挪进 `MIGRATED`（棘轮会催），
跑它自己的用例文件 + 全量 `npm run verify` + `npm run test:e2e`。

---

## 已完成

### `ICEVirtualList`（2026-09-15，破坏性变更，家族早期趁早改）

`renderItem` 从"给节点"改成"给行矩形直接画"：

```ts
// 之前：回调拿到一个可以 addChild 的行节点
renderItem: (index, item, node) => { node.addChild(...); }

// 现在：回调拿到行矩形，自己往 ctx 上画
renderItem: ({ ctx, index, item, x, y, width, height }) => {
  ctx.fillStyle = index % 2 ? theme.colors.background : theme.colors.surface;
  ctx.fillRect(x, y, width, height);
  ctx.fillText(item.label, x + 10, y + height / 2);
}
```

* 一万条数据现在也是 **0 个行节点**（旧实现是"可见区 + buffer"个节点）；
* `getRenderedNodes()` 删除；`getRenderedCount()` 语义变成"这一帧画几行"（值不变）；
* 新增 `paintItems(ctx, origin?)`：painter 每帧自动调，单测可直接调来断言"画了哪几行、画在哪个矩形"；
* 示例页 `examples/gallery.html` 已同步改成新写法；`tests/ICEVirtualList.test.ts` 新增
  「行不再建节点（内容盒永远是空的）」用例。

### `ICEList`（2026-09-15，破坏性变更）

行同样改由 painter 画（Swing 的 `JList` + `ListCellRenderer` 位），并且**把点击改成几何反查**：

* 删除 `getRowNode(key)`（没有行节点了）→ 新增
  `clickRow(key)`（程序式点击，等价用户点中那一行）与 `getRowBox(key)`（行矩形，几何审计/e2e 用）；
* 真实点击走 `__indexAtPoint`：事件坐标 → `screenToWorld` → 减去列表世界盒 + 滚动偏移 → 行下标；
* 绘制走 `paintRows(ctx, theme, origin)`（painter 每帧自动调，单测可直接调）；
* 行数不再影响节点数：内容盒永远是空的。

**给后续 `ICETable` / `ICETree` 的模板**：数据+几何留在组件里 → painter 画窗口内的行
→ 命中改几何反查 → 只改数据置脏（不建/拆节点）。


---

## 最终结论（2026-09-15，逐组件核实后）

按"先界，再画"的原则逐个核实（不是抽样）后的判定表：

| 组件 | 节点数上界 | 判定 |
|---|---|---|
| `ICEVirtualList` | 可视区 + buffer（≈10~20） | ✅ 本就有界；顺手改成 painter（`39ad6f2`），一万条 = 0 行节点 |
| `ICEList` | ~~= 数据条数（无界）~~ → **0** | ✅ 已修（`5d59a32`）：行改 painter + 点击几何反查 |
| `ICETree` | 可视窗口 + 缓冲（`ICETree.virtual` 用例断言"节点数有上界"） | 本就有界 → **不需要** painter 改造 |
| `ICETable` | `virtual: true` 时 `getRenderedRowCount() <= 12`（`tests/ICETableVirtual.test.ts` 断言） | 本就有界（大数据请用 virtual）；非 virtual 是调用方选择的小数据场景 |
| `ICECarousel` | 5 + 幻灯片数（幻灯片是调用方内容，必须留节点） | 有界 → 不动（圆点/箭头还需要真实命中区，Swing 的 `JScrollPane` 箭头同样是真组件） |
| `ICEMenu` | 菜单项数量（个位数~几十，由调用方定义） | 有界 → 不动 |

**所以 "painter 线" 到此结束**：它要解决的是"节点随数据无界增长"，
而库里真正有这个问题的是 `ICEList`（已修）与 `ICEVirtualList`（已画家化）；
其余组件要么本来虚拟化、要么规模由调用方决定。**不为"自绘而自绘"做破坏性变更** ——
自绘只在"装饰"场景（`ICEAvatar` / `ICESkeleton` / 已完成的两个列表）用，
新组件的规则见 `AGENTS.md`「布局铁律」第 2 条。

---

## 后续：画家化之后漏掉的一条（2026-09-15 第二轮审计）

画家化的直接后果是**"没有节点可以命中"** —— 命中必须落在**宿主组件**身上。

`ICEList` 当时漏了一步：内部内容盒（`this.content`，行画在它上面）是 `ICEWidget` 的默认值
`interactive: true`，于是真实鼠标点击先被内容盒命中、被它吃掉，列表自己的
`__indexAtPoint` **永远收不到 click** —— 表现就是"点行没反应、键盘还能用"。

三条教训（写进本仓规矩）：

1. **纯绘制用的内容盒一律 `interactive: false`**（`ICEVirtualList` 一直是对的，
   `ICEList` 这次补上）；构建期就定死，别留给"反正它没挂 click"的侥幸。
2. **程序式 API 会掩盖命中路径的缺陷**：QA 脚本原来用
   `getRowNode(key).trigger('click')`（已随行节点一起删除），既绕过了命中检测，
   又在 API 删掉之后**静默变成"永远 false"**。QA 一律改成**真实鼠标**：
   `getRowBox(key)` 拿行矩形 → 叠上列表绝对盒 → 点行中心（`qa-workbench.mjs` /
   `qa-admin.mjs` 的 `clickListRow()`）。
3. **删 API 要连带改测试脚本**：`getRowNode` 删除时只改了 CHANGELOG 与单测，
   两个 QA 脚本（workbench / admin）从那以后**一直在失败**却没人发现 ——
   因为 QA 脚本不在 `npm run verify` 里（见 `docs/guides/testing.md` 的取舍）。
   改组件公共 API 时，除 `npm test` 外请顺手跑一遍 `npm run qa:*`。
