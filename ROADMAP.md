# 路线图

目标：在 `ice-render` 之上做一套 **Canvas 原生的 Swing 风格 / 业界组件库 风格组件库**。
组件不是难点，**底座**才是 —— 下面按「底座 → 组件」排。

> **2026-09-12 变更**：⓪ `examples/admin.html` 升级为多页业务后台（仪表盘 / 订单 / 商品 / 客户 / 设置，
> 侧边栏子菜单 + 标签页切界面 + 弹窗/抽屉/气泡确认/消息通知全覆盖）；
> ① 全库导出统一成 **ICE 前缀**（原 `UI*` 全部改名，文件同名重命名），
> 且**与引擎零重名**（基类 `ICEWidget`、图片控件 `ICEImageView`；布局类直接再导出引擎实现）；
> ② 主题从 业界组件库 配色换成 **Bootstrap 5** 语义色（含 `*-text-emphasis` 强调文字色 + Bootstrap 三段阴影 +
> `focusRing` 聚焦色）；③ `ICETag`/`ICEBadge` 默认改成 Bootstrap 实底 `.text-bg-*`（`variant:'soft'` 保留浅底风格）。
> 细节见 README 的 Naming / Theme / Colour variants 三节。

## 现状（77 个组件源文件 / 94 个导出类 / 582 条单测 / 165 项浏览器断言）

按分组清点（完整清单与参数见 [`docs/components.md`](./docs/components.md)）：

- **基础**：`ICEWidget` `ICEContainer` `ICEPanel` `ICEButton` `ICELabel` `ICETypography`
  `ICEIcon` `ICESvgIcon` `ICESeparator`
- **布局**：`ICESpace`（间距容器）、`ICEGrid` + `ICEGridCol`（24 栅格）、`ICESplitter`、`ICEScrollPane`
- **数据录入**：`ICETextField` `ICETextArea` `ICEPasswordField` `ICEInputNumber`
  `ICECheckBox` `ICECheckboxGroup` `ICERadioButton` `ICERadioGroup` `ICESwitch` `ICESlider`
  `ICESegmented` `ICERate` `ICEUpload` `ICEFormItem` `ICEForm`
- **录入（浮层）**：`ICESelect` `ICEAutoComplete` `ICECascader` `ICETreeSelect`
  `ICEDatePicker` `ICETimePicker` `ICEColorPicker` `ICETransfer`
- **展示**：`ICETable` `ICEList` `ICETree` `ICECard` `ICEStatCard` `ICEStatistic`
  `ICEDescriptions` `ICETimeline` `ICEProgressBar` `ICEImageView` `ICEImagePreview` `ICECalendar`
  `ICEAvatar` `ICEAvatarGroup` `ICETag` `ICEBadge` `ICECarousel` `ICECollapse` `ICEComment` `ICEWatermark`
- **反馈**：`ICEAlert` `ICEModal` `ICEDrawer` `ICEMessage` `ICENotification` `ICETooltip`
  `ICEPopover` `ICEPopconfirm` `ICETour` `ICEFloatButton` `ICEResult` `ICEEmpty` `ICESkeleton`
  `ICESpin` `ICESteps`
- **导航**：`ICEMenu` `ICEBreadcrumb` `ICEAnchor` `ICEBackTop` `ICEDropdown` `ICEPagination` `ICETabs`
- **核心**：`ICEScrollPane` `ICESplitter` `ICEOverlayManager` `ICEFocusManager`
  `ICEHoverManager` `ICEMessageManager` `ICEManager`
- **桌面外壳**：`ICEWindow`（窗口：标题栏/拖动/最小化/最大化/缩放）、`ICEIconTile`（桌面图标）

配套：6 个模型（`ICEButtonModel` / `ICEToggleModel` / `ICEBoundedRangeModel` /
`ICESelectionModel` / `ICEFormModel` / `ICEMinesweeperModel`）、
引擎布局（`ICEFlowLayout` / `ICEBoxLayout` / …）、37 个工具函数。

> **本轮新增（2026-09-12）**：`ICEBreadcrumb`（含 maxItems 折叠）、`ICERadioGroup`、
> `ICECheckboxGroup`（互斥 / 多选 + `max` + 键盘）、`ICEStatistic`（精度 / 千分位 / 倒计时）、
> `ICESplitter`（拖拽分隔）、`ICEWatermark`（平铺 + 裁剪）。
> 第二批：`ICETypography`（标题层级 / 折行省略 / 链接）、`ICEAnchor`（滚动追随高亮）、
> `ICEBackTop`（回到顶部）；`ICEScrollPane` 补 `scroll` 事件（两者的底座）。
> 第三批：`ICEImagePreview`（缩放/旋转/翻页/键盘）、`ICETour`（聚光引导）、
> `ICECalendar`（月视图 + 键盘）。
> 第四批：`ICESpace` / `ICEGrid` + `ICEGridCol`（24 栅格）/ `ICEFloatButton`，
> 以及 `ICETable` 的分页 + 空态。
> 第五批（交互打磨）：`ICETable` 行多选（`rowSelection: 'multiple'`）+ 批量操作；
> **焦点环改为 `:focus-visible` 语义**（鼠标点击/拖动不再冒蓝框，文本类控件 `focusRing: 'always'`）；
> 修掉「纯布局容器吃掉内部控件命中」的一类 bug（`ICEFormItem`/`ICEForm`/`ICESpace`/`ICEGrid`/`ICESplitter`）。
>
> 第六批：`ICEWindow` + `ICEIconTile`（桌面/多窗口场景的底座），并修掉 `ICETable`
> 只改宽度不重算列宽的 bug。
> 第七批：`ICEMinesweeperModel`（扫雷纯逻辑模型：首点安全/洪水填充/插旗循环/chord/胜负/计时）
> + XP 扫雷做成完整游戏（三档难度、右键插旗、双击 chord、LED 计数、最佳成绩）；
> 引擎 1.4.1 修掉 `ICE.init()` 用 `stopPropagation()` 拦死 `contextmenu` 的问题。
> 第八批（美化）：`ICEManager.registerTheme()` 自定义主题 + 内置 `ICE_XP_THEME`（XP 经典配色）；
> 示例全部改用 `dpr` 初始化（Retina 文字不发虚）；XP 桌面全部图标改为自绘；
> 顺带修四类 bug：引擎多行文本行距（中文叠字）、`ICESplitter` 构造期夹取丢掉请求尺寸、
> 显示类组件宽度变化不重排（ICEDescriptions/ICETimeline/ICEList/ICECollapse）、
> `ICEIconTile`/`ICEWindow` 支持自绘图标节点（`iconNode`）。
> 收尾：`ICEDescriptions`/`ICETimeline` 的 `__render()` 现在先清空再重排（否则每次重排都叠加、
> 出现文字重影）；`ICEDescriptions` 的标签/值超宽自动省略号。
>
> 示例：`gallery.html`（组件总览）、`admin.html`（6 页后台）、`workbench.html`（客服工单工作台）、
> `windows-xp.html`（全屏 XP 桌面）、`arcade.html`（ICE Arcade 掌机：两块卡带）、
> `custom-component.html`（自定义组件）——见[示例与场景](./docs/guides/examples.md)。
> 浏览器回归：`qa:admin` 44 项 + `qa:gallery` 32 项 + `qa:workbench` 15 项 + `qa:xp` 35 项
> + `qa:arcade` 39 项，全部走真实鼠标/键盘事件。
>
> 第九批（小游戏合集第 1 弹）：`ICETetrisModel`（俄罗斯方块纯逻辑模型：7-bag 随机、踢墙旋转、
> 软/硬降、消行计分与升级、暂停/重置、变化监听；另导出 `ICE_TETROMINOES` /
> `ICE_TETRIS_LINE_SCORES`）+ `examples/tetris.html` 掌机（自绘机壳与棋盘、幽灵落点、
> 消行闪屏、WebAudio 音效、键盘全接管）。顺带修掉自己挖的坑：换方块/重开时重力计时器
> 没归零，新方块会「一出生就掉一格」。
>
> 第十批（XP 开机流程）：开机画面（自绘四色旗 + 进度条动画）→ 欢迎界面（用户磁贴 / 密码页
> / 关闭计算机）→ 桌面；**任意账号任意密码都能进**。音效全是 WebAudio 现场合成的原创音型
> （开机 / 注销 / 关机 / 咔哒，非微软原版素材），托盘喇叭可一键静音；开始菜单的注销与关机
> 也接上了，能一路 注销 → 登录 → 关机 → 重新开机 循环。
>
> 第十一批（小游戏合集第 2 弹）：`ICESnakeModel`（贪吃蛇纯逻辑模型：转向队列 / 禁止 180°
> 掉头 / 吃到就长 / 撞墙撞自己结束 / 越吃越快 / 可穿墙模式 / 变化监听）；`examples/tetris.html`
> 升级成 `examples/arcade.html` —— 一台掌机插**两块卡带**，卡带注册表用同一套运行时契约
> （model / paint / hud / keydown / frame / setOverlay / destroy）插拔，换卡带连带重写
> HUD 卡片标题与操作说明；`qa:tetris` 也随之扩成 `qa:arcade`（23 → 33 项，覆盖两块卡带
> 与切换）。
>
> 第十二批（引擎能力补课：让游戏真的用上引擎）：新增 `ICETileMap`（**一个节点画整块棋盘**：
> 自绘 `doRender` + 数据签名跳过空刷 + 高亮层 + `pulse()` tween 脉冲 + `cellclick` 命中）、
> `ICE_ARCADE_THEME` / `ICE_ARCADE_PALETTE`（游戏配色进 token，页面不再硬编码色值）、
> `ICEHighScoreModel`（排行榜纯逻辑：排序 / 截断 / 存档容错 / 注入 storage）。arcade 页面
> 随之改成：棋盘 1 个节点（原先 200 / 400 个）、换卡带 `fadeIn`、消行与吃食物 `pulse`、
> GAME OVER `scaleIn`、「排行榜 (L)」弹 `ICEModal`（内嵌 `ICETable` + `ICEScrollPane`）。
> `qa:arcade` 33 → 39 项（新增单节点自绘、tween 淡入、排行榜弹窗与降序、点格子转向）。
> 踩坑入档：`super.doRender()` 之后自绘要 `applyActiveTransform()`，否则坐标跑到画布左上角。

## 阶段 A：底座（先做这个）

| # | 底座 | 状态 | 说明 |
|---|---|---|---|
| A1 | 弹层 / 浮层 | ✅ 已完成 | `ICEOverlayManager`：浮层根节点挂在 ICE **工具层**（递归渲染、绘制在组件之上、不参与 `getComponentById`）；12 种 placement、空间不足自动翻转、夹进可见范围；点外关闭 / Esc / exclusive。带视口缩放平移也正确。 |
| A2 | 滚动容器 | ✅ 已完成 | 引擎侧新增**子树裁剪** `clipChildren`（ice-render 1.2.0：设备空间裁剪、多层求交、命中检测同样尊重裁剪、被裁剪组件不参与离屏缓存）；组件侧 `ICEScrollPane`（内容盒 + 滚动条 + 滚轮/API 滚动）。 |
| A3 | 焦点与键盘导航 | 🟡 基础已做 | `ICEFocusManager`：Tab/Shift+Tab 循环、Esc 取消、Enter/Space 激活（控件自定义 `activate()`）、鼠标点击聚焦（沿父链上溯到最近控件）、焦点环画在工具层并跟随组件移动。**待补**：方向键在组内移动（Radio 组 / Menu / Tabs）、模态焦点陷阱、Slider 方向键调值。 |
| A4 | 表单与校验 | 🟡 基础已做 | `ICEFormModel`（required/min/max/minLength/maxLength/pattern/validator + **asyncValidator** + change 触发 + 监听器）、`ICEFormItem`（标签/控件/错误文案，纵向与横向布局，**校验中…态**）、`ICEForm`（addItem/validate/**validateAsync**/getValues/setValues/reset/submit/**submitAsync**/onSubmit）；控件统一取值约定 `getFormValue/setFormValue` 与 `change` 事件（ICETextField / ICECheckBox / ICESwitch / ICERadioButton / ICESlider）；`setValidateStatus` 提供错误态（文本框边框标红已实现）。**待补**：跨字段依赖重校验、错误态在其它控件上的视觉反馈。 |
| A5 | 动画/过渡 | 🟡 基础已做 | 引擎侧新增**子树不透明度** `opacity`（1.3.0，整棵子树一起淡入淡出）；组件侧 `ICEAnimation`（`tween` + `fadeIn/fadeOut/fadeTo/slideIn/scaleIn`，frame driver 可注入、可取消）；`ICEOverlayManager` 支持 `enterAnimation: 'fade'｜'scale'`、`exitAnimation: 'fade'`。**待补**：折叠/展开的高度过渡、消息堆叠的错峰入场。 |

## 阶段 B：第一批组件（A1 已就绪，直接可做）

| 组件 | 缺什么 | 依赖 |
|---|---|---|
| ~~`ICETooltip`~~ ✅ | 悬停延时、跟随锚点、多行 | A1 |
| ~~`ICEPopover`~~ ✅ | 任意内容浮层 + 点击/悬停触发 | A1 |
| ~~`ICEDropdown`~~ ✅ | 触发按钮 + 菜单浮层 + disabled/选中态 + 键盘 ↑↓/Enter | A1 + A3 |
| ~~`ICESelect`~~ ✅ | 输入框外观 + 下拉选项 + 单选/多选 + 搜索过滤 + 键盘 ↑↓/Enter | A1 + A3 |
| ~~`ICEModal`~~ ✅ | 遮罩层 + 居中 + 焦点陷阱 + 缩放进入 | A1 + A3 + A5 |
| ~~`ICEDrawer`~~ ✅ | 从边缘滑入的面板（四方向 + 遮罩 + 焦点陷阱） | A1 + A3 + A5 |
| ~~`ICEMessage` / `ICENotification`~~ ✅ | 顶部/右下角堆叠、自动消失、可单独关闭 | A5 |
| ~~`ICEPagination`~~ ✅ | 页码窗口 + 省略号、每页条数切换、共 N 条 | — |
| ~~`ICEPopconfirm`~~ ✅ | 气泡确认（取消/确定 + danger） | A1 |

## 阶段 C：Swing 对应物（补齐 README 的定位）

| Swing | 本库计划 | 依赖 |
|---|---|---|
| `JScrollPane` | ✅ `ICEScrollPane` | A2 |
| `JList` | ✅ `ICEList` + `ICESelectionModel` | A2 + A3 |
| `JComboBox` | 阶段 B 的 `ICEComboBox` | A1/A2/A3 |
| `JSpinner` | `ICESpinner`（数值/步进） | A3 |
| `JTextArea` / `JPasswordField` | ✅ `ICETextArea`（Enter 换行）/ `ICEPasswordField`（掩码 + 眼睛切换） | A2 |
| `JTree` | ✅ `ICETree`（复用 ICESelectionModel） | A2 + A3 |
| `JSplitPane` | `ICESplitPane`（拖拽分隔） | — |
| `JToolBar` | `ICEToolBar` | — |
| `JForm`（无直接对应） | `ICEForm` + `ICEFormItem` | A3 + A4 |

## 阶段 D：业界组件库 风格展示类组件

按「投入产出」排序，前两档建议优先：

1. **高价值、实现直接**：`ICESegmented`、`ICEEmpty`、`ICESkeleton`、`ICEResult`、`ICECollapse`、
   `ICESteps`、`ICETimeline`、`ICEDescriptions`、`ICERate`、`ICEAffix`（画布内由应用控制，低优先）
2. **依赖表单/弹层**：`ICEAutoComplete`、`ICEInputNumber`、`ICEMentions`、
   `ICEDatePicker` / `ICETimePicker`（需要日历浮层 + 日期网格）、`ICECascader`、`ICETreeSelect`、
   `ICETransfer`、`ICEUpload`、`ICEColorPicker`
3. **图形类**：`ICECarousel`、`ICECalendar`、`ICEQRCode`（需要编码器）、`ICEWatermark`、
   `ICETour`、`ICEComment`

## 业界组件库 组件对照表（v5 全量 → 本库）

图例：✅ 已有（部分）｜⬜ 计划内｜⊘ 不做/低优先（附原因）

| 业界组件库 分类 | 组件 | 本库 |
|---|---|---|
| 通用 | Button | ✅ `ICEButton` |
| 通用 | FloatButton / BackTop | ✅ `ICEFloatButton`（展开菜单 + 自动收起）+ `ICEBackTop`（跟随滚动容器） |
| 通用 | Icon | ✅ `ICEIcon`（字形）/ `ICESvgIcon`（SVG path） |
| 通用 | Typography | ✅ `ICETypography`（Title 五级 / Paragraph 折行省略 / Link 可点击；无 copyable / editable） |
| 布局 | Divider | ✅ `ICESeparator` |
| 布局 | Flex / Space | ✅ `ICESpace`（横向/纵向 + 交叉轴对齐 + wrap + 按内容自适应尺寸） |
| 布局 | Grid | ✅ `ICEGrid` + `ICEGridCol`（24 栅格 + gutter/offset + 自动换行） |
| 布局 | Layout（Header/Sider/Content/Footer） | ⬜ 阶段 D（画布内更像「模板」而非组件） |
| 布局 | Splitter | ✅ `ICESplitter`（两栏拖拽 + min/max 夹取；无三栏 / 嵌套手柄） |
| 导航 | Anchor | ✅ `ICEAnchor`（点击滚动 + 滚动追随高亮 + ↑↓ 键盘） |
| 导航 | Breadcrumb | ✅ `ICEBreadcrumb`（`maxItems` 折叠 + 点击省略号展开） |
| 导航 | Dropdown | ⬜ 阶段 B（A1 已就绪） |
| 导航 | Menu | ✅ `ICEMenu`（子菜单内联展开 + 多级嵌套；无键盘导航） |
| 导航 | Pagination | ⬜ 阶段 B |
| 导航 | Steps | ✅ `ICESteps` |
| 数据录入 | AutoComplete | ✅ `ICEAutoComplete`（输入过滤 + 候选点选/键盘） |
| 数据录入 | TreeSelect | ✅ `ICETreeSelect`（下拉里装 ICETree） |
| 数据录入 | Cascader | ✅ `ICECascader`（多列级联 + 路径回显；暂不支持同级多选） |
| 数据录入 | Checkbox | ✅ `ICECheckBox` + `ICECheckboxGroup`（多选 / `max` / 键盘；无不确定态） |
| 数据录入 | ColorPicker | ✅ `ICEColorPicker`（色板网格 + 选中环 + 键盘导航；无取色轮/透明度） |
| 数据录入 | DatePicker | ✅ `ICEDatePicker`（日历浮层，周一开头） |
| 数据录入 | TimePicker | ✅ `ICETimePicker`（时/分/秒滚动列 + 步进 + HH:mm 两列模式；无 12 小时制/范围选择） |
| 数据录入 | Form | ✅ `ICEForm` + `ICEFormItem` + `ICEFormModel`（异步校验 / submitAsync / **跨字段依赖 `dependencies`**） |
| 数据录入 | Input | ✅ `ICETextField`（部分：无多行 / 密码 / 前后缀 / 清空） |
| 数据录入 | InputNumber | ✅ `ICEInputNumber`（步进 + 键盘 + 精度） |
| 数据录入 | Mentions | ⊘ 低优先 |
| 数据录入 | Radio | ✅ `ICERadioButton` + `ICERadioGroup`（互斥 / 键盘方向键 / 表单取值） |
| 数据录入 | Rate | ✅ `ICERate`（悬停预览 + 键盘） |
| 数据录入 | Select | ⬜ 阶段 B |
| 数据录入 | Slider | ✅ `ICESlider`（区间双滑块 + `step` 步进 + 方向键；无刻度 / tooltip） |
| 数据录入 | Switch | ✅ `ICESwitch` |
| 数据录入 | Transfer | ✅ `ICETransfer`（双栏勾选搬运 + disabled 行；无搜索/分页） |
| 数据录入 | Upload | ✅ `ICEUpload`（虚线拖拽区 + 隐藏 input 桥接 + accept/maxSize/maxCount/beforeUpload 校验） |
| 数据展示 | Avatar | ✅ `ICEAvatar` + `ICEAvatarGroup`（重叠 + `+N` 折叠；无图片头像） |
| 数据展示 | Badge | ✅ `ICEBadge`（红点 `dot` + 计数封顶 `count`/`overflowCount`） |
| 数据展示 | Calendar | ✅ `ICECalendar`（月视图 + 相邻月弱化 + 键盘；无年/月面板切换、范围选择） |
| 数据展示 | Card | ✅ `ICECard`（含 `extra` 右上角插槽；无操作区 / 底部） |
| 数据展示 | Carousel | ✅ `ICECarousel`（轨道滑动 + 箭头/圆点 + 自动播放；无渐变/多图同屏） |
| 数据展示 | Collapse | ✅ `ICECollapse`（accordion 可选） |
| 数据展示 | Descriptions | ✅ `ICEDescriptions`（1/2 列） |
| 数据展示 | Empty | ✅ `ICEEmpty` |
| 数据展示 | Image | ✅ `ICEImageView` + `ICEImagePreview`（适配模式 + 预览浮层：缩放 / 旋转 / 翻页 / 键盘） |
| 数据展示 | List | ✅ `ICEList` |
| 数据展示 | Popover | ⬜ 阶段 B |
| 数据展示 | QRCode | ⊘ 需要编码器，收益低 |
| 数据展示 | Segmented | ✅ `ICESegmented` |
| 数据展示 | Statistic | ✅ `ICEStatistic`（精度 / 千分位 / 前缀后缀 / 倒计时）+ `ICEStatCard`（卡片态） |
| 数据展示 | Table | ✅ `ICETable`（列排序 + ▲▼ 指示 + 分页 + 空态；无滚动 / 列宽拖拽 / 展开行） |
| 数据展示 | Tabs | ✅ `ICETabs`（部分：无溢出滚动 / 关闭 / 卡片态） |
| 数据展示 | Tag | ✅ `ICETag`（部分：无可关闭 / 多彩） |
| 数据展示 | Timeline | ✅ `ICETimeline` |
| 数据展示 | Comment | ✅ `ICEComment`（嵌套回复 + 操作） |
| 数据展示 | Tooltip | ⬜ 阶段 B |
| 数据展示 | Tour | ✅ `ICETour`（聚光孔 + 面板 + 步骤计数 + ←/→/Enter/Esc） |
| 数据展示 | Tree | ✅ `ICETree` |
| 反馈 | Alert | ✅ `ICEAlert`（`closable` + onClose + 类型图标；无 banner） |
| 反馈 | Drawer | ⬜ 阶段 B |
| 反馈 | Message | ⬜ 阶段 B |
| 反馈 | Modal | ⬜ 阶段 B |
| 反馈 | Notification | ⬜ 阶段 B |
| 反馈 | Popconfirm | ⬜ 阶段 B |
| 反馈 | Progress | ✅ `ICEProgressBar`（线形 + 环形 `type:'circle'`，含百分比文字 / 状态色；无仪表盘） |
| 反馈 | Result | ✅ `ICEResult` |
| 反馈 | Skeleton | ✅ `ICESkeleton`（呼吸动画） |
| 反馈 | Spin | ✅ `ICESpin`（旋转弧线，复用引擎动画） |
| 其他 | Affix | ⊘ 画布内不需要（应用自己控制位置） |
| 其他 | App | ⊘ React 概念；本库对应 `iceUIManager` 主题机制 |
| 其他 | ConfigProvider | ⊘ 同上（主题/暗色已由 `iceUIManager` 提供） |
| 其他 | Watermark | ✅ `ICEWatermark`（平铺旋转文字 + `clipChildren` 裁剪 + 不挡点击） |

## 下一批候选（调研结论）

按「用户能立刻感知价值 / 依赖是否就绪」排序（前 6 项已完成 ✅）：

1. ~~Typography（Title / Paragraph / Text / Link + 省略号）~~ ✅ `ICETypography`
   （含 `truncateTextLines` 折行省略；缺 copyable / editable）
2. ~~Image preview~~ ✅ `ICEImagePreview`（缩放 / 旋转 / 翻页 / 键盘 / 遮罩点击关闭）
3. ~~Anchor（锚点导航 + 滚动高亮）~~ ✅ `ICEAnchor`（依赖 `ICEScrollPane` 的 `scroll` 事件）
4. ~~BackTop / FloatButton~~ ✅ `ICEBackTop`（FloatButton 形态：自定义图标 / 悬浮组，待做）
5. ~~Tour~~ ✅ `ICETour`（聚光孔 + 引导面板：标题/描述/步骤计数/上一步/下一步/跳过）
6. ~~Calendar~~ ✅ `ICECalendar`（月视图 + 相邻月弱化 + ←→↑↓/PageUp-PageDown）
7. **QRCode**（需自带编码器，约 200 行）—— 收益中等，排最后；
8. **Layout / Grid / Space**（Header-Sider-Content-Footer、Row-Col、间距容器）——
   引擎已有 `ICEGridLayout`，缺 UI 封装；定位更接近「模板」，**下一批第一顺位**；
9. ~~FloatButton 完整形态~~ ✅ `ICEFloatButton`（展开菜单 / 自动收起）
10. ~~Form 跨字段依赖重校验~~ ✅ `dependencies` + 空值上也跑自定义 validator；
11. **Table 的剩余部分**（滚动 / 列宽拖拽 / 展开行）、**QRCode**（需自带编码器）、
    **FloatButton 的「速度仪表盘」形态** —— **下一批第一顺位是 Table 的滚动与列宽拖拽**。

## 现有组件的「做满」清单

新组件之外，下面这些缺口同样影响观感，按需插空做：

- `ICETable`：分页、滚动、列宽拖拽、空态（排序 ✅ 已做）
- `ICETextField`：多行（TextArea）、密码、前后缀、清除按钮、错误态
- `ICEMenu`：键盘操作（子菜单 / 折叠 ✅ 已做）
- `ICETabs`：溢出滚动、关闭、位置（上下左右）
- `ICEAlert`：banner 形态（关闭按钮 / 图标 ✅ 已做）
- `ICEProgressBar`：仪表盘形态（环形 + 状态色 ✅ 已做）
- `ICESlider`：区间选择、刻度、拖拽 tooltip
- `ICECard`：操作区、封面、底部（右上角 extra ✅ 已做）
- `ICEBadge`：红点 / 计数封顶 ✅ 已做
- `ICEAvatar`：图片头像（头像组 ✅ `ICEAvatarGroup`）

## 工程约定

- 新组件一律：`src/components/ICEXxx.ts` + `tests/` 单测 + 在 `examples/gallery.html`（必要时 `admin.html`）里加一行演示。
- 状态用「模型 + 监听器」（沿用 `ICEButtonModel` 等既有模式），不要在组件里散落状态。
- 涉及浮层的组件**必须**走 `ICEOverlayManager`，不要各自实现定位与关闭逻辑。
- 主题色一律取自 `iceUIManager.getTheme()`，禁止硬编码色值（示例除外）。
- 提交前跑 `npm run types:check && npm test && npm run build`。

## 引擎已知约束（组件作者必读）

- **渲染顺序是全局 `zIndex`**（构造时按自增赋值），不是「父先子后」：**先创建子组件、后创建父容器**
  会导致父容器的背景盖住子组件。组装顺序按「容器 → 子组件」写；需要时显式指定 `state.zIndex`
  （`ICEScrollPane` 内部就是这么自保的）。
- **子树裁剪**：容器设 `state.clipChildren = true` 可把后代裁到自己的盒子里（滚动容器在用）。
- **离屏缓存**：被裁剪的组件不参与缓存；视口变化帧整体不缓存。
