# 路线图

目标：在 `ice-render` 之上做一套 **Canvas 原生的 Swing 风格 / 业界组件库 风格组件库**。
组件不是难点，**底座**才是 —— 下面按「底座 → 组件」排。

## 现状（21 个组件）

`UIButton` `UILabel` `UIPanel` `UICard` `UITextField` `UITable` `UIMenu` `UITabs`
`UIAlert` `UIStatCard` `UITag` `UIBadge` `UIAvatar` `UIIcon` `UISvgIcon`
`UISeparator` `UICheckBox` `UIRadioButton` `UISwitch` `UIProgressBar` `UISlider`

配套：3 个模型（`UIButtonModel` / `UIToggleModel` / `UIBoundedRangeModel`）、
2 个布局（`UIFlowLayout` / `UIBoxLayout`）、`UIHoverManager`、`UIOverlayManager`（新增）。

## 阶段 A：底座（先做这个）

| # | 底座 | 状态 | 说明 |
|---|---|---|---|
| A1 | 弹层 / 浮层 | ✅ 已完成 | `UIOverlayManager`：浮层根节点挂在 ICE **工具层**（递归渲染、绘制在组件之上、不参与 `getComponentById`）；12 种 placement、空间不足自动翻转、夹进可见范围；点外关闭 / Esc / exclusive。带视口缩放平移也正确。 |
| A2 | 滚动容器 | ✅ 已完成 | 引擎侧新增**子树裁剪** `clipChildren`（ice-render 1.2.0：设备空间裁剪、多层求交、命中检测同样尊重裁剪、被裁剪组件不参与离屏缓存）；组件侧 `UIScrollPane`（内容盒 + 滚动条 + 滚轮/API 滚动）。 |
| A3 | 焦点与键盘导航 | 🟡 基础已做 | `UIFocusManager`：Tab/Shift+Tab 循环、Esc 取消、Enter/Space 激活（控件自定义 `activate()`）、鼠标点击聚焦（沿父链上溯到最近控件）、焦点环画在工具层并跟随组件移动。**待补**：方向键在组内移动（Radio 组 / Menu / Tabs）、模态焦点陷阱、Slider 方向键调值。 |
| A4 | 表单与校验 | 🟡 基础已做 | `UIFormModel`（required/min/max/minLength/maxLength/pattern/validator + change 触发 + 监听器）、`UIFormItem`（标签/控件/错误文案，纵向与横向布局）、`UIForm`（addItem/validate/getValues/setValues/reset/submit/onSubmit）；控件统一取值约定 `getFormValue/setFormValue` 与 `change` 事件（UITextField / UICheckBox / UISwitch / UIRadioButton / UISlider）；`setValidateStatus` 提供错误态（文本框边框标红已实现）。**待补**：异步校验、跨字段依赖重校验、错误态在其它控件上的视觉反馈。 |
| A5 | 动画/过渡 | 🟡 基础已做 | 引擎侧新增**子树不透明度** `opacity`（1.3.0，整棵子树一起淡入淡出）；组件侧 `UIAnimation`（`tween` + `fadeIn/fadeOut/fadeTo/slideIn/scaleIn`，frame driver 可注入、可取消）；`UIOverlayManager` 支持 `enterAnimation: 'fade'｜'scale'`、`exitAnimation: 'fade'`。**待补**：折叠/展开的高度过渡、消息堆叠的错峰入场。 |

## 阶段 B：第一批组件（A1 已就绪，直接可做）

| 组件 | 缺什么 | 依赖 |
|---|---|---|
| ~~`UITooltip`~~ ✅ | 悬停延时、跟随锚点、多行 | A1 |
| ~~`UIPopover`~~ ✅ | 任意内容浮层 + 点击/悬停触发 | A1 |
| ~~`UIDropdown`~~ ✅ | 触发按钮 + 菜单浮层 + disabled/选中态 + 键盘 ↑↓/Enter | A1 + A3 |
| ~~`UISelect`~~ ✅ | 输入框外观 + 下拉选项 + 单选/多选 + 搜索过滤 + 键盘 ↑↓/Enter | A1 + A3 |
| ~~`UIModal`~~ ✅ | 遮罩层 + 居中 + 焦点陷阱 + 缩放进入 | A1 + A3 + A5 |
| ~~`UIDrawer`~~ ✅ | 从边缘滑入的面板（四方向 + 遮罩 + 焦点陷阱） | A1 + A3 + A5 |
| ~~`UIMessage` / `UINotification`~~ ✅ | 顶部/右下角堆叠、自动消失、可单独关闭 | A5 |
| ~~`UIPagination`~~ ✅ | 页码窗口 + 省略号、每页条数切换、共 N 条 | — |
| ~~`UIPopconfirm`~~ ✅ | 气泡确认（取消/确定 + danger） | A1 |

## 阶段 C：Swing 对应物（补齐 README 的定位）

| Swing | 本库计划 | 依赖 |
|---|---|---|
| `JScrollPane` | ✅ `UIScrollPane` | A2 |
| `JList` | ✅ `UIList` + `UISelectionModel` | A2 + A3 |
| `JComboBox` | 阶段 B 的 `UIComboBox` | A1/A2/A3 |
| `JSpinner` | `UISpinner`（数值/步进） | A3 |
| `JTextArea` / `JPasswordField` | `UITextArea` / `UIPasswordField` | A2 |
| `JTree` | ✅ `UITree`（复用 UISelectionModel） | A2 + A3 |
| `JSplitPane` | `UISplitPane`（拖拽分隔） | — |
| `JToolBar` | `UIToolBar` | — |
| `JForm`（无直接对应） | `UIForm` + `UIFormItem` | A3 + A4 |

## 阶段 D：业界组件库 风格展示类组件

按「投入产出」排序，前两档建议优先：

1. **高价值、实现直接**：`UISegmented`、`UIEmpty`、`UISkeleton`、`UIResult`、`UICollapse`、
   `UISteps`、`UITimeline`、`UIDescriptions`、`UIRate`、`UIAffix`（画布内由应用控制，低优先）
2. **依赖表单/弹层**：`UIAutoComplete`、`UIInputNumber`、`UIMentions`、
   `UIDatePicker` / `UITimePicker`（需要日历浮层 + 日期网格）、`UICascader`、`UITreeSelect`、
   `UITransfer`、`UIUpload`、`UIColorPicker`
3. **图形类**：`UICarousel`、`UICalendar`、`UIQRCode`（需要编码器）、`UIWatermark`、
   `UITour`、`UIComment`

## 业界组件库 组件对照表（v5 全量 → 本库）

图例：✅ 已有（部分）｜⬜ 计划内｜⊘ 不做/低优先（附原因）

| 业界组件库 分类 | 组件 | 本库 |
|---|---|---|
| 通用 | Button | ✅ `UIButton` |
| 通用 | FloatButton | ⊘ 画布场景收益低 |
| 通用 | Icon | ✅ `UIIcon`（字形）/ `UISvgIcon`（SVG path） |
| 通用 | Typography | ✅ `UILabel`（部分：无 Title/Paragraph 语义、省略、可复制） |
| 布局 | Divider | ✅ `UISeparator` |
| 布局 | Flex / Space | ⬜ 可用现有 Flow/Box 布局覆盖，低优先 |
| 布局 | Grid | ⬜ 引擎已有 `ICEGridLayout`，缺 UI 封装 |
| 布局 | Layout（Header/Sider/Content/Footer） | ⬜ 阶段 D（画布内更像「模板」而非组件） |
| 布局 | Splitter | ⬜ 计划 `UISplitPane` |
| 导航 | Anchor | ⊘ 依赖滚动容器与页面语义，低优先 |
| 导航 | Breadcrumb | ⬜ 阶段 D |
| 导航 | Dropdown | ⬜ 阶段 B（A1 已就绪） |
| 导航 | Menu | ✅ `UIMenu`（部分：无子菜单 / inline 折叠 / 键盘导航） |
| 导航 | Pagination | ⬜ 阶段 B |
| 导航 | Steps | ⬜ 阶段 D |
| 数据录入 | AutoComplete | ⬜ 阶段 D（依赖 Select 与键盘） |
| 数据录入 | Cascader / TreeSelect | ⬜ 阶段 D |
| 数据录入 | Checkbox | ✅ `UICheckBox`（部分：无 Group / 不确定态） |
| 数据录入 | ColorPicker | ⬜ 低优先（交互重） |
| 数据录入 | DatePicker / TimePicker | ⬜ 阶段 D（需日历浮层） |
| 数据录入 | Form | ⬜ 阶段 A4 + C |
| 数据录入 | Input | ✅ `UITextField`（部分：无多行 / 密码 / 前后缀 / 清空） |
| 数据录入 | InputNumber | ⬜ 阶段 D |
| 数据录入 | Mentions | ⊘ 低优先 |
| 数据录入 | Radio | ✅ `UIRadioButton`（部分：无 Group） |
| 数据录入 | Rate | ⬜ 阶段 D |
| 数据录入 | Select | ⬜ 阶段 B |
| 数据录入 | Slider | ✅ `UISlider`（部分：无区间 / 刻度 / tooltip） |
| 数据录入 | Switch | ✅ `UISwitch` |
| 数据录入 | Transfer | ⬜ 阶段 D |
| 数据录入 | Upload | ⬜ 阶段 D（画布内需与 DOM input 桥接） |
| 数据展示 | Avatar | ✅ `UIAvatar`（部分：无 Group / 图片头像） |
| 数据展示 | Badge | ✅ `UIBadge`（部分：无红点 / 计数封顶） |
| 数据展示 | Calendar | ⬜ 阶段 D |
| 数据展示 | Card | ✅ `UICard`（部分：无 extra / 操作区 / 底部） |
| 数据展示 | Carousel | ⬜ 阶段 D |
| 数据展示 | Collapse | ⬜ 阶段 D |
| 数据展示 | Descriptions | ⬜ 阶段 D |
| 数据展示 | Empty | ⬜ 阶段 D |
| 数据展示 | Image | ⬜ 引擎有 `ICEImage`，缺预览/加载态封装 |
| 数据展示 | List | ✅ `UIList` |
| 数据展示 | Popover | ⬜ 阶段 B |
| 数据展示 | QRCode | ⊘ 需要编码器，收益低 |
| 数据展示 | Segmented | ⬜ 阶段 D |
| 数据展示 | Statistic | ✅ `UIStatCard` |
| 数据展示 | Table | ✅ `UITable`（部分：无排序 / 分页 / 滚动 / 列宽拖拽） |
| 数据展示 | Tabs | ✅ `UITabs`（部分：无溢出滚动 / 关闭 / 卡片态） |
| 数据展示 | Tag | ✅ `UITag`（部分：无可关闭 / 多彩） |
| 数据展示 | Timeline | ⬜ 阶段 D |
| 数据展示 | Tooltip | ⬜ 阶段 B |
| 数据展示 | Tour | ⊘ 低优先 |
| 数据展示 | Tree | ✅ `UITree` |
| 反馈 | Alert | ✅ `UIAlert`（部分：无关闭 / 图标 / banner） |
| 反馈 | Drawer | ⬜ 阶段 B |
| 反馈 | Message | ⬜ 阶段 B |
| 反馈 | Modal | ⬜ 阶段 B |
| 反馈 | Notification | ⬜ 阶段 B |
| 反馈 | Popconfirm | ⬜ 阶段 B |
| 反馈 | Progress | ✅ `UIProgressBar`（部分：无环形 / 仪表盘） |
| 反馈 | Result | ⬜ 阶段 D |
| 反馈 | Skeleton | ⬜ 阶段 D |
| 反馈 | Spin | ⬜ 阶段 D（需要动画底座 A5） |
| 其他 | Affix | ⊘ 画布内不需要（应用自己控制位置） |
| 其他 | App | ⊘ React 概念；本库对应 `uiManager` 主题机制 |
| 其他 | ConfigProvider | ⊘ 同上（主题/暗色已由 `uiManager` 提供） |
| 其他 | Watermark | ⊘ 低优先 |

## 现有组件的「做满」清单

新组件之外，下面这些缺口同样影响观感，按需插空做：

- `UITable`：排序、分页、滚动、列宽拖拽、空态
- `UITextField`：多行（TextArea）、密码、前后缀、清除按钮、错误态
- `UIMenu`：子菜单、键盘操作、折叠
- `UITabs`：溢出滚动、关闭、位置（上下左右）
- `UIAlert`：关闭按钮、图标、banner 形态
- `UIProgressBar`：环形 / 仪表盘 / 状态色
- `UISlider`：区间选择、刻度、拖拽 tooltip
- `UICard`：extra 区、操作区、封面、底部
- `UIBadge`：红点、计数封顶（99+）
- `UIAvatar`：头像组、图片头像

## 工程约定

- 新组件一律：`src/components/UIXxx.ts` + `tests/` 单测 + 在 `examples/gallery.html`（必要时 `admin.html`）里加一行演示。
- 状态用「模型 + 监听器」（沿用 `UIButtonModel` 等既有模式），不要在组件里散落状态。
- 涉及浮层的组件**必须**走 `UIOverlayManager`，不要各自实现定位与关闭逻辑。
- 主题色一律取自 `uiManager.getTheme()`，禁止硬编码色值（示例除外）。
- 提交前跑 `npm run types:check && npm test && npm run build`。

## 引擎已知约束（组件作者必读）

- **渲染顺序是全局 `zIndex`**（构造时按自增赋值），不是「父先子后」：**先创建子组件、后创建父容器**
  会导致父容器的背景盖住子组件。组装顺序按「容器 → 子组件」写；需要时显式指定 `state.zIndex`
  （`UIScrollPane` 内部就是这么自保的）。
- **子树裁剪**：容器设 `state.clipChildren = true` 可把后代裁到自己的盒子里（滚动容器在用）。
- **离屏缓存**：被裁剪的组件不参与缓存；视口变化帧整体不缓存。
