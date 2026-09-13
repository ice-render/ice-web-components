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

## 家族级事实来源

引擎仓的 `AGENTS.md`（`../ice-render/AGENTS.md`）汇总了跨仓铁律（渲染/序列化/事件/i18n 边界/动画等），
本仓改动涉及引擎契约时以那份为准。
