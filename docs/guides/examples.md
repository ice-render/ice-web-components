# 示例与场景

仓库里有四个示例页，**都是纯 HTML + 一个 UMD 包**，不用打包工具就能打开看效果。
它们同时也是这套组件库的“验收现场”：每页都配了浏览器 QA 脚本（见[测试](./testing.md)）。

```bash
npm run build          # 先产出 dist/（示例页引用 ../dist/index.umd.js）
# 然后直接用浏览器打开，或起个静态服务器
npx serve .
```

| 示例 | 场景 | 主要用到的东西 |
|---|---|---|
| [`gallery.html`](../../examples/gallery.html) | 组件总览（一个个组件排开） | 几乎全部组件 + 手写「簇 + 货架」流式布局 |
| [`admin.html`](../../examples/admin.html) | 后台管理（6 页业务闭环） | 布局外壳、表格、表单、浮层、分栏、日历、引导… |
| [`workbench.html`](../../examples/workbench.html) | 客服工单工作台（三栏高频操作） | `ICESplitter`、`ICEList`、`ICEComment`、`ICETimeline`… |
| [`custom-component.html`](../../examples/custom-component.html) | 自己写组件并接进体系 | `ICEWidget` + 表单/焦点/主题约定 |

![组件总览](../images/gallery.png)

---

## `gallery.html`：组件总览

一页把库里能独立展示的组件都摆出来，用来快速“看长相、点交互”。

* 布局是手写的 **cluster + 货架** 流式排布（每个 demo 自带局部坐标，整体平移；
  放不下才换行）。思路与代码骨架见[画布内布局](./layout.md#示例页里的簇-货架流式布局)；
* 加新组件时：在对应 `sections` 里加一项、给它一个 `id`，然后在
  `scripts/qa-gallery.mjs` 里补一条断言即可。

## `admin.html`：后台管理（6 页）

一个虚构的「ICE Shop」后台：**仪表盘 / 订单管理 / 履约中心 / 商品管理 / 客户管理 / 设置**。
它不是“控件陈列”，而是把组件放进真实业务流里：

| 页面 | 业务动作 | 用到的组件（节选） |
|---|---|---|
| 仪表盘 | 看指标、处理待办、盯库存、看最近订单 | `ICEStatCard`、`ICEStatistic`（倒计时）、`ICEProgressBar`、`ICECheckboxGroup`、`ICETable` + 分页、`ICEWatermark`、`ICECarousel` |
| 订单管理 | 筛选（关键字/区域/金额区间/只看异常）→ 勾选多行 → 批量发货 / 删除 / 导出 | `ICESegmented`、`ICESlider`（区间）、`ICECheckboxGroup`、`ICESwitch`、`ICETable`（多选 + 分页）、`ICEPopconfirm`、`ICEDropdown` |
| 履约中心 | 派单队列 → 看详情 / 物流轨迹 → 催办 | `ICESplitter`、`ICEList`、`ICEScrollPane`、`ICEAnchor`、`ICEDescriptions`、`ICETimeline`、`ICEComment` |
| 商品管理 | 上架/预售、改折扣、传主图、看大图预览 | `ICEUpload`、`ICEImagePreview`、`ICERadioGroup`、`ICESlider`、`ICETree`、`ICECascader`、`ICEColorPicker`、`ICETransfer` |
| 客户管理 | 看档案、跟进记录、打分、打标签 | `ICEList`、`ICEDescriptions`、`ICETimeline`、`ICEComment`、`ICERate`、`ICECheckboxGroup`、`ICEStatistic` |
| 设置 | 改资料 / 安全 / 通知偏好 / 业务偏好（含跨字段校验） | `ICEForm`、`ICEFormItem`、`ICETabs`、`ICETransfer`、`ICERadioGroup`、`ICESlider`、`ICECheckboxGroup`、`ICEAlert` |

外壳本身也用了不少东西：侧边栏 `ICEMenu`（带二级菜单）、面包屑 `ICEBreadcrumb`、
顶部搜索 `ICEAutoComplete`、通知 `ICEBadge` + `ICEDropdown`、右下角 `ICEFloatButton`
（新建订单 / 导出 / 新手引导）、`ICEBackTop`、首次进入的 `ICETour` 四步引导。

![仪表盘](../images/admin-dashboard.png)

| 订单管理 | 履约中心 |
|---|---|
| ![订单](../images/admin-orders.png) | ![履约](../images/admin-fulfillment.png) |

## `workbench.html`：客服工单工作台

**刻意做成“非后台列表”**的第二种场景：三栏、高频、以会话为中心。

* 左：工单队列 —— `ICESegmented` 筛选（全部/我的/未分配）、`ICEList`、加载时的
  `ICESkeleton`、筛空时的 `ICEEmpty`；
* 中：会话 —— `ICEComment` 气泡、`ICETextArea` 回复框（⌘/Ctrl+Enter 发送）、
  `ICEDropdown` 快捷回复模板、`ICEUpload` 附件、`ICECheckboxGroup` 工单标签；
* 右：客户档案 —— `ICEAvatar`、`ICETag`、`ICEDescriptions`、`ICERate` 满意度、
  `ICETimeline` 处理记录、`ICECollapse` 知识库；
* 三栏由 `ICESplitter` 分栏（可拖），会话区是可滚动的 `ICEScrollPane` +
  `ICEBackTop`，右下角 `ICEFloatButton` 里藏着 `ICETour` 三步引导。

![客服工作台](../images/workbench.png)

## `custom-component.html`：写自己的组件

一个手写的 `ICEMetric` 指标卡（点击 +1、聚焦后 ↑/↓ 调值、能进 `ICEForm` 校验），
把「接入 ICE 体系」的每个接入点都标了序号。完整讲解见
[写一个自己的组件](./custom-components.md)。

---

## 照着做一个新场景的清单

1. **先定场景，再选组件**：把业务动作列成表（谁在什么界面做什么），再往里填组件 ——
   `admin.html` 的六个页面就是这么拆出来的；
2. **外壳先搭**：顶栏/侧边栏/内容区用的 `ICEPanel` 要**先创建**，内容晚于它创建
   （引擎按创建顺序定 zIndex，反了会被底色盖住，见[画布内布局](./layout.md#zindex-与创建顺序最常见的坑)）；
3. **内容区用 `ICEScrollPane`**：页面比视口高时的标准做法，顺便能挂 `ICEBackTop`；
4. **纯布局容器一律 `interactive: false`**：否则它会挡住内部控件的命中检测
   （`ICEFormItem` / `ICESpace` / `ICEGrid` / `ICESplitter` 都是这么处理的）；
5. **弹层走 `ICEOverlayManager`**，别自己算定位（见[浮层指南](./overlays.md)）；
6. **给关键交互配 QA**：在 `scripts/qa-*.mjs` 里加断言，`npm run qa:xxx` 会真开浏览器点一遍。
