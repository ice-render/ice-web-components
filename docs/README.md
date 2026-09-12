# ice-web-components 文档

> 组件库的完整文档：架构思路、组件速查、API 参考、主题/表单/浮层/布局/测试指南，以及破坏性变更记录。

## 从哪里开始

| 你在做什么 | 看这里 |
|---|---|
| 第一次接触这个库，想搞懂它怎么运转 | [架构思路](./architecture.md) |
| 找某个组件怎么用、有哪些参数 | [组件速查](./components.md) → [API 参考](./api/README.md) |
| **写自己的组件、接进这套体系** | [写一个自己的组件](./guides/custom-components.md) |
| 想换配色 / 加一套主题 | [主题与配色](./guides/theming.md) |
| 做表单、写校验（含异步） | [表单与校验](./guides/forms.md) |
| 弹窗 / 抽屉 / 下拉 / 提示怎么用 | [浮层指南](./guides/overlays.md) |
| 自己排布局、被“组件不见了”坑过 | [画布内布局](./guides/layout.md) |
| 给库加组件、写测试 | [测试](./guides/testing.md) |
| 从旧版本升上来 | [迁移说明](./guides/migration.md) |

## 文档地图

```
docs/
  architecture.md        分层、组件模型、渲染、事件、浮层、焦点、表单、主题、目录结构、踩坑表
  components.md          组件速查（按分组，一句话说明 + 跳转 API）      ← 生成
  api/                   API 参考（构造参数 + public 方法）              ← 生成
    README.md  basic  data-entry  data-entry-popups  data-display
    feedback   navigation  core  helpers  models
  guides/
    theming.md           主题 token、状态色、自定义主题
    forms.md             表单三层结构、规则、异步校验、自定义控件接入
    overlays.md          三类浮层用法、定位、关闭策略、动画、内容工厂
    layout.md            坐标、zIndex 与创建顺序、簇+货架布局、裁剪与滚动
    testing.md           单测套路（假 ICE + 真组件）、浏览器 QA（qa:admin）
    migration.md         UI* → ICE*、业界组件库 → Bootstrap、API 变更
    custom-components.md 三档写法、构造约定、交互/表单/浮层/主题接入、注册与踩坑
  examples/ICEMetric.ts  「写自己的组件」的完整示例（有单测 + 示例页）
  images/                README 与文档用的截图
```

标了「生成」的文件由 `npm run docs:api` 从 `src/**` 的 JSDoc 与类型定义生成
（`scripts/gen-docs.mjs`）：组件说明取类注释，参数表取 `ICEXxxOptions` 字段，
方法表取 public 方法。**要改这些内容请改源码里的注释**，不要在生成物上直接改。

```bash
npm run docs:api     # 重新生成 components.md 与 api/*.md
```

## 三个最容易踩的坑（先看，能省半天）

1. **创建顺序就是 zIndex**：先建容器再建子组件；不得不先建子组件时，把子树整体抬到容器之上。
2. **组件内部的展示节点要 `interactive: false`**：否则它们会抢走点击（按钮点不动、色块要点两次）。
3. **浮层里点击行时不要用 `closeOnOutsideClick`**：它可能在 `click` 派发前就把浮层关掉；
   用 `closeOnOutsideClick: false` + 自己判点外。

更多见[架构思路的踩坑表](./architecture.md#十踩过的坑写新组件时请先看这一节)。
