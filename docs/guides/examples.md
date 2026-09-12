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
| [`windows-xp.html`](../../examples/windows-xp.html) | 全屏 Windows XP 桌面（好玩的那一个） | `ICEWindow`、`ICEIconTile` + 几乎全套组件 |

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

## `windows-xp.html`：全屏 Windows XP 桌面

一个纯 canvas 的 XP 桌面：壁纸、桌面图标、任务栏、开始菜单、可拖动/最小化/最大化/关闭的窗口，
外加七个能点的小程序 —— 全部用这套组件拼出来（壁纸和「画图」的笔画用的是引擎原语）。

![Windows XP 桌面](../images/xp-desktop.png)

**为此新添的两个通用组件**：

| 组件 | 作用 |
|---|---|
| `ICEWindow` | 通用窗口外壳：标题栏（XP Luna 渐变，激活/非激活两套配色）+ 最小化/最大化/关闭 + 可拖动 + 右下角缩放 + 客户端内容区；`bounds` 限制拖动与最大化范围，`activate()` 广播事件给外部窗口管理器抬 zIndex |
| `ICEIconTile` | 图标磁贴：大图标字形 + 文字标签；单击选中（蓝底白字）、双击打开、Enter/Space 等价 |

**七个应用**（都在 `examples/windows-xp.html` 里，可直接抄）：

| 应用 | 用到的东西 |
|---|---|
| 我的电脑 | `ICESplitter` 双栏 + `ICETree` 文件夹树 + `ICETable` 驱动器列表 + `ICEDescriptions` 系统信息 |
| 我的文档 | `ICETable` + 分页（`pagination`）+ 工具栏按钮 |
| 记事本 | `ICETextArea` + 下拉菜单（`attachDropdown`）+ 状态栏 |
| 画图 | 页面内自定义的 `XPaintCanvas`（继承 `ICEWidget`，用引擎 `ICEPolyLine` 记录每一笔）+ 色板 + `ICESlider` 笔刷粗细 |
| 扫雷 | `ICEMinesweeperModel`（纯逻辑模型）+ 自绘格子：初级/中级/高级、首点安全、洪水填充、右键插旗（🚩/❓ 循环）、双击数字 chord、LED 计数、计时、笑脸重开、最佳成绩 |
| Internet Explorer | 地址栏 `ICETextField` + 转到按钮 + 列表链接 + 状态栏 |
| 显示 属性 | `ICERadioGroup` 选壁纸 + 预览块 + 应用/取消（应用后立即重绘桌面） |

**外壳交互**：任务栏（开始按钮 / 任务按钮 / 托盘时钟，时钟每秒走）、开始菜单（`ICEOverlayManager`
定位在开始按钮上方，点外关闭）、窗口焦点（点谁谁的标题栏变蓝、其余变灰）、最小化到任务栏、
双击桌面图标打开程序、点桌面空白取消图标选中。

### 美化：主题、图标、Retina

- **主题**：注册并使用库内置的 `ICE_XP_THEME`（`iceUIManager.registerTheme('xp', …).setTheme('xp')`）——
  按钮/输入框/表格/单选等所有控件一次性换成 XP 经典配色，不用逐个传 `style`；
- **图标**：全部**自绘**（`examples/windows-xp.html` 里的 `xpIcon(kind, size)`：显示器、文件夹、
  记事本、调色盘、地雷、IE「e」、显示属性、开始徽标），用引擎图元拼出来 —— 离线可用、
  任意尺寸都清晰，也避开了 Windows 原版图标的版权问题（微软素材不能随仓库分发）；
- **Retina**：示例用 `ICE.init('canvas', { dpr: window.devicePixelRatio })` 初始化，
  高分屏下文字/描边不再发虚（否则 canvas 位图会被浏览器放大，看起来就是「文字变形」）。

> 这个页面也是「容器命中检测」规则的试金石：桌面根容器、任务栏、任务按钮容器、各应用的
> 布局面板全部 `interactive: false`，只有真正要响应鼠标的节点（图标、窗口、按钮、格子、画布）
> 才参与命中。第一版没这么做时，任务栏按钮点不动、扫雷格子点不动。
>
> 顺带修掉一个库级 bug：`ICETable` 在**只改宽度**（窗口缩放、分栏拖动）时不会重算列宽，
> 单元格文字会互相重叠 —— 现在宽度变化会触发整表重渲染（`tests/ICETable.resize.test.ts` 守着）。
> 同一类问题这一轮又修了三处：`ICESplitter` 构造时把调用方要的 `size` 夹取后丢掉（容器
> 后拿到真实尺寸无法恢复）、`ICEDescriptions` / `ICETimeline` / `ICEList` / `ICECollapse`
> 宽度变化不重排（值列宽度算成 0，文字直接消失）、引擎多行文本行距用了字形墨迹高（中文叠字）。

### 扫雷：一个「游戏级」的例子

扫雷的规则有整整一套，所以逻辑单独抽成了模型 `ICEMinesweeperModel`
（在[模型 API](../api/models.md#iceminesweepermodel) 里，14 条单测覆盖全部规则），
UI 只负责把模型画出来：

```ts
import { ICEMinesweeperModel, ICE_MINESWEEPER_DIFFICULTIES } from 'ice-web-components';

const model = new ICEMinesweeperModel({ ...ICE_MINESWEEPER_DIFFICULTIES[0] });  // 初级 9×9 / 10 雷
model.addChangeListener(() => render());   // 掀开 / 插旗 / 胜负任意变化后重绘
model.reveal(row, col);                     // 左键
model.toggleFlag(row, col);                 // 右键：无 → 🚩 → ❓ → 无
model.chord(row, col);                      // 双击数字：周围旗数够就展开
setInterval(() => model.tick(), 1000);      // 计时（只有 playing 会累加）
```

![扫雷](../images/xp-minesweeper.png)

按 Windows XP 的规则：**首次点击才布雷**（排除首点及其 8 邻域，第一下永远不会炸）、
相邻雷为 0 时洪水填充、插旗循环、chord、胜负判定（胜利自动给雷插旗并记录最佳成绩）、
计时从第一次点击开始；三档难度 + 按难度分别保存最佳成绩（localStorage）。

> 右键插旗能生效，靠的是引擎侧一个修复：`ICE.init()` 原来在 canvas 上
> `preventDefault()` + `stopPropagation()` 屏蔽原生菜单，而 stopPropagation 让事件
> 到不了 `DOMEventInterceptor`，组件永远收不到 `contextmenu`。现在只 `preventDefault()`，
> 事件继续冒泡 → 组件能收到右键（ice-render 1.4.1）。

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
