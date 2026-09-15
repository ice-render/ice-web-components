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

- `npm run verify`：types:check → jest（837 用例）→ build → docs（API 生成 + 链接检查）
- `npm run verify:full`：verify + `test:e2e`（9 个合成示例页逐页断言无 console/pageerror、画布内容像素占比达标）

## 布局铁律（2026-09-15 确立）

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

参考：[`docs/guides/layout.md`](./docs/guides/layout.md)（选型与坐标来源）、
[`docs/guides/custom-components.md`](./docs/guides/custom-components.md)（painter 契约）。

## 家族级事实来源

引擎仓的 `AGENTS.md`（`../ice-render/AGENTS.md`）汇总了跨仓铁律（渲染/序列化/事件/i18n 边界/动画等），
本仓改动涉及引擎契约时以那份为准。
