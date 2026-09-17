# AGENTS.md — ice-web-components

## 项目定位

基于 **ice-render** 引擎的 Swing 风格 Canvas UI 组件库：所有 UI 像素由引擎绘制，没有 DOM widget。
组件以 `ice-web-components:*` 命名空间注册类型；peer 依赖 `ice-render`（不把内核打进自己的发行包）。
示例页 `examples/*.html` 用真实浏览器冒烟回归（`npm run test:e2e`，见 `e2e/examples-smoke.spec.ts`）。

## 分支与发版约定（家族铁律，2026-09-13 确立）

- **开发**：在临时分支（或 `dev`）上做；`main` 只做集成与发版。
- **发版前**：必须先把开发分支合并进 `main`，**再从 `main` 发版**（跑门禁 → `npm publish`）。
- **禁止**：直接在 `main` 上写实现；也禁止只把改动留在临时分支 / `dev` 而让 `main` 停在旧版本。
- **远端默认分支**必须指向 `main`，且发版后它与开发主线内容一致（否则仓库首页显示旧代码）。
- 本仓主线名：`main`（Gitee `origin` + GitHub `origin-github`，两处都要推）。

## 门禁

- `npm run verify`：types:check → jest（196 suites / 1421 用例，2026-09-17 实测）→ build → docs（API 生成 + 链接检查）
- `npm run verify:full`：verify + `test:e2e`（13 个：9 个合成示例页逐页断言无 console/pageerror、2 个热切换、1 个主题覆盖）
  + `qa:all`（8 套真机 QA）+ `qa:perf`

## 取色铁律（2026-09-17 确立）

**组件样式槽里放主题引用，不要在构造期把 token 抄成字面量。**

```ts
style: { fillStyle: token('ui.colors.text') }        // ✔ paint 时解析，换主题跟着走
style: { fillStyle: iceUIManager.getTheme().colors.text }  // ✘ 冻在构造那一刻
```

规则与边界：

- **`paint` 回调例外**：那里的 `theme` 是引擎每帧传进来的参数，本来就跟主题走；而且
  `ctx.fillStyle` 必须拿到**字符串**。所以 `paint*` 方法 / `({ ctx, theme })` 解构参数里照常写 `theme.colors.x`。
- **要参与运算**（`mix` / `shade` / alpha / 拼 CSS）先把引用**解析成字符串**：`resolveColorValue(...)`；
  读数接口一律用 `resolvedStyleColor(node, key)`（直接 `String(style.fillStyle)` 会拿到 `[object Object]`）。
- **内容色不算主题色**：调色板数据、图片底色这类"换主题不该变"的色，节点上打 `__themeConstant = true`
  （见 `ICEColorPicker` 的色块），覆盖测试会跳过它。

两道门禁各管一头，**别只看源码数字**：

- `tests/theme-refs.test.ts`：源码侧棘轮，按文件记预算，只许减（当前只剩 9 处，全在 `paint` 回调里）；
- `e2e/theme-coverage.spec.ts`：真机侧，逐节点比对 `resolvedStyleColor()` 切主题前后变没变，
  **可疑字面量必须为 0** + 换色节点数不许回退。2026-09-17 迁移前后实测 **306 → 1195**（有色节点 1456 个）。

## 布局铁律（2026-09-15 确立，五条）

引擎的布局机制（`ICELayoutManager` + `setLayout`）是**唯一**的排布入口。历史教训：2026-09-15 之前
全库 80+ 组件只有 `ICETabs` 一处用引擎布局，其余各写一套坐标推导；而引擎当时还会把父层策略
递归灌给后代容器 —— 于是「给面板挂布局」等于把整个界面的内部零件重摆一遍（见引擎仓 CHANGELOG）。

四条口径，改组件前先看：

1. **容器型组件的排布走引擎布局器**：`setLayout(new ICEBoxLayout/ICEFlowLayout/ICEGridLayout/…)`。
   组件自己只保留"组件级策略"（高度 = 内容高度、没给宽/高的那一轴按内容自适应、段宽按文字估算…），
   **不再写 `left/top` 推导**。棘轮测试 `tests/layoutConvention.test.ts` 守住这条：
   新容器必须在"已迁移"或"豁免清单（带原因）"里二选一。
2. **内部装饰不进 `childNodes`**：组件自己画的造型（头像圆底、骨架屏占位条…）用 `painter`
   （Swing 的 `ComponentUI` 位，见 `docs/guides/custom-components.md`）；
   调用方传进来的节点（`extra` / 幻灯片 / `first`-`second`）才是内容，留在树里。
3. **内容与可交互装饰混在一起时，组件自持策略**（Swing `JScrollPane`+`ScrollPaneLayout` 的路子）：
   写一个 `ICELayoutManager` 子类同时摆内容与装饰，而不是在 `doLayout` 里手写坐标。
4. **布局要能被序列化**：挂的都是引擎内置布局（已注册 + 实现 `toJSON()`），快照往返不会丢版式；
   自研布局必须 `ice.registerType('your-ns:MyLayout', MyLayout)` + 实现 `toJSON()`。
5. **复合组件的内部零件必须跟随自身尺寸**（2026-09-15 立，紧接前四条）：
   只要组件在 `childNodes` 里放了**按自身宽高算出来的**零件（文字盒、图标盒、轨道/进度条、
   居中偏移、断行结果、派生尺寸如格子高/色块边长），就必须实现
   `protected __syncInternalLayout(): void` —— `ICEWidget.__afterStateMerge` 会在自身尺寸
   变化时自动调它。**构造期算一次就存成字段**是本类缺陷的根源（等分网格里必现），
   棘轮测试 `tests/resizeFollowsOwnSize.test.ts` 守住这条（口径：400×260 建出来再缩到 200×130，
   内部零件几何必须与"一开始就 200×130 建出来"完全一致）。

   > 为什么引擎救不了这一类：`ICELayoutManager` **尊重子项的显式尺寸**（几何量测的既定语义），
   > 而这些组件正是把自己的尺寸写成子项的显式尺寸 —— 于是没有任何一层会去改它。
   > 只有"知道自己内部怎么摆"的组件自己能修，所以契约落在组件层而不是引擎层。
   >
   > 实现要点：只改内部零件的几何，**别重建子树**（会丢事件监听与子组件状态）；
   > 幂等；拿不到尺寸就早退；派生值（格子高、色块边长、行高）要在钩子里按新尺寸**重算**再排。
   > 若组件自己的重建路径也会 `setState({height})`，记得防重入（见 `ICEMenu.__rendering`）。

参考：[`docs/guides/layout.md`](./docs/guides/layout.md)（选型与坐标来源）、
[`docs/guides/custom-components.md`](./docs/guides/custom-components.md)（painter 契约）。

## 成员顺序（2026-09-17 定）

家族的应用层（各仓的页面 / 示例页）按这个顺序排类成员，正则 `S*T*F*C*(A|M)*`：

```
static 常量/字段  →  static 方法  →  实例字段  →  构造函数  →  访问器 / 实例方法
```

**本仓是组件库，`src/` 不强制这条** —— 2026-09-17 体检里有 8 个组件类偏离，形态都很单一：
`private static __countText()` / `__iconOf()` / `__defaultPalette()` 这类**静态小助手紧挨着
它唯一的调用者**。这正是 Google Java Style §3.4.2 说的"每种顺序都讲得通、维护者能解释"
那类顺序；该指南同时明确说成员顺序"**没有唯一正确的配方**"，Google 的 TypeScript 指南对
顺序**完全沉默**（全文 "ordering" 出现 0 次）。

所以：**新代码照契约写（静态的都在最前）；存量不搬迁** —— 代价不对称，而且 **TS 里字段的
声明顺序是有语义的**（初始化按声明顺序执行 + 影响 V8 的 class shape），为排版挪字段不划算。

## 家族级事实来源

引擎仓的 `AGENTS.md`（`../ice-render/AGENTS.md`）汇总了跨仓铁律（渲染/序列化/事件/i18n 边界/动画等），
本仓改动涉及引擎契约时以那份为准。

**应用层页面怎么写**（一页一类、`onUpdate()` 由谁在什么时候调、稳定结构的边界、入口决策表、
验收清单、常见坑）单一来源是 [`docs/guides/app-pages.md`](./docs/guides/app-pages.md)；
容器本身的契约见 [`docs/guides/layout.md`](./docs/guides/layout.md) 第六节。各应用仓的 AGENTS
只记自己特有的部分，**别在那里再写一份** —— 两份契约一定会漂。
