# 组件速查

> 由 `npm run docs:api` 从源码生成。点组件名进入对应 API 页；每条的说明取自源码里的类注释首句。

| 分组 | 组件 | 说明 |
|---|---|---|
| [基础组件](./api/basic.md) | [`ICEWidget`](./api/basic.md#icewidget) | 所有 UI 组件的基类（继承引擎 ICEGroup）。  在引擎的绘制能力之上只加四件事：交互态（enabled / hovered / focused）、键盘焦点 （`focusable` / `activate()`）、表单校验态（`validateStatus`）、表单取值约定 （`getFormValue` / `setFormValue`）。 |
|  | [`ICEContainer`](./api/basic.md#icecontainer) | 容器基类：在此挂布局策略（`setLayout`，链式返回自身）。 |
|  | [`ICEPanel`](./api/basic.md#icepanel) | 面板：带填充、描边、圆角与阴影的基础容器，业务页面的“卡片底座”。 |
|  | [`ICEButton`](./api/basic.md#icebutton) | 按钮：`primary` / `default` / `text` / `link` 变体，`danger` 与三种尺寸， 自带 hover / 焦点 / 禁用态，点击时触发 `click`。 |
|  | [`ICELabel`](./api/basic.md#icelabel) | 文本标签：包装引擎 `ICEText`，支持水平（`align`）与垂直（`verticalAlign`）对齐； 未显式给尺寸时采用文字的实测尺寸，便于参与流式/盒式布局。 |
|  | [`ICEIcon`](./api/basic.md#iceicon) | 图标：一个居中的字形（★ ✓ ℹ …），字号与颜色可配。 |
|  | [`ICESvgIcon`](./api/basic.md#icesvgicon) | SVG 路径图标：给一段 `d` 路径数据，按 `viewBox` 缩放到目标尺寸并描边。 |
|  | [`ICESeparator`](./api/basic.md#iceseparator) | 分隔线：1px 的水平或垂直分隔。 |
| [数据录入](./api/data-entry.md) | [`ICETextField`](./api/data-entry.md#icetextfield) | 单行文本输入：聚焦边框、错误态、表单取值约定与键盘输入； 子类通过覆盖 `__allowNewline()` 等钩子扩展（见 ICETextArea）。 |
|  | [`ICETextArea`](./api/data-entry.md#icetextarea) | 多行文本框：与 ICETextField 同语义（取值约定 / change 事件 / 错误态 / 焦点）， 差别是允许换行（Enter 插入 `\n`）且默认更高。 |
|  | [`ICEPasswordField`](./api/data-entry.md#icepasswordfield) | 密码框：显示掩码（• 数量 = 真实长度），`getValue()` / 表单取值仍是明文。  `showToggle: true` 时右侧出现眼睛按钮，可在明文/掩码之间切换（便于用户核对输入）。 |
|  | [`ICEInputNumber`](./api/data-entry.md#iceinputnumber) | 数字输入框（业界组件库 InputNumber / Swing JSpinner 的最小版）。 |
|  | [`ICECheckBox`](./api/data-entry.md#icecheckbox) | 复选框：点击或 Enter/Space 切换勾选，触发 `change`，可直接进表单。 |
|  | [`ICERadioButton`](./api/data-entry.md#iceradiobutton) | 单选框：点击或 Enter/Space 选中；同组互斥由调用方（表单/业务）维护。 |
|  | [`ICERadioGroup`](./api/data-entry.md#iceradiogroup) | 单选组（业界组件库 Radio.Group）：一组互斥选项，整行可点，值是选项的 `value`。  与 `ICERadioButton` 的分工：单个按钮只管「选中/未选中」，**互斥与取值由本组件维护**， 因此业务代码不用再自己写「点了 A 要把 B 取消」这类同步逻辑。 |
|  | [`ICECheckboxGroup`](./api/data-entry.md#icecheckboxgroup) | 多选组（业界组件库 Checkbox.Group）：一组可多选的选项，值是 `string[]`（按选项顺序）。 |
|  | [`ICESwitch`](./api/data-entry.md#iceswitch) | 开关：点击或 Enter/Space 切换，滑块带过渡动画，触发 `change`。 |
|  | [`ICESlider`](./api/data-entry.md#iceslider) | 滑块：单值 / 区间双滑块，支持 `step` 量化与方向键微调。 |
|  | [`ICESegmented`](./api/data-entry.md#icesegmented) | 分段控制器（业界组件库 Segmented / iOS ICESegmentedControl 的最小版）： 一组互斥选项，选中项实心高亮。每个分段是 ICEButton，因此天然可聚焦（Tab/Enter 可操作）。 |
|  | [`ICERate`](./api/data-entry.md#icerate) | 评分（业界组件库 Rate）：N 颗星，点击设置分值、悬停预览、键盘 ←/→ 调整。 |
|  | [`ICEUpload`](./api/data-entry.md#iceupload) | 上传选择器（业界组件库 Upload 的最小版）。 |
|  | [`ICEFormItem`](./api/data-entry.md#iceformitem) | 表单项：标签 + 控件 + 错误文案。  只负责「摆位置 + 显示错误」；值的读写与校验规则由 ICEForm / ICEFormModel 管。 控件必须实现取值约定（`getFormValue` / `setFormValue`）。  布局： |
|  | [`ICEForm`](./api/data-entry.md#iceform) | 表单容器：把若干 ICEFormItem 纵向堆叠，绑上校验模型。 |
| [数据录入（浮层类）](./api/data-entry-popups.md) | [`ICESelect`](./api/data-entry-popups.md#iceselect) | 选择器：输入框外观 + 下拉选项（单选 / 多选 / 搜索过滤）。 |
|  | [`ICEAutoComplete`](./api/data-entry-popups.md#iceautocomplete) | 自动完成（业界组件库 AutoComplete）：文本输入 + 候选下拉。 |
|  | [`ICECascader`](./api/data-entry-popups.md#icecascader) | 级联选择（业界组件库 Cascader 的最小版）。 |
|  | [`ICETreeSelect`](./api/data-entry-popups.md#icetreeselect) | 树选择器（业界组件库 TreeSelect）：下拉里放一棵 ICETree，选中节点后回写值。 |
|  | [`ICEDatePicker`](./api/data-entry-popups.md#icedatepicker) | 日期选择器（业界组件库 DatePicker 的最小版）。 |
|  | [`ICETimePicker`](./api/data-entry-popups.md#icetimepicker) | 时间选择器（业界组件库 TimePicker 的最小版）。 |
|  | [`ICEColorPicker`](./api/data-entry-popups.md#icecolorpicker) | 颜色选择器（业界组件库 ColorPicker 的色板网格最小版）。 |
|  | [`ICETransfer`](./api/data-entry-popups.md#icetransfer) | 穿梭框（业界组件库 Transfer 的最小版）。 |
| [数据展示](./api/data-display.md) | [`ICETable`](./api/data-display.md#icetable) | 表格：列定义（宽度 / 对齐 / 排序 / 自定义单元格）+ 行选中 + 悬停反馈 + 斑马纹； 点表头排序（升 → 降 → 恢复），`sorter` 可为布尔或自定义比较函数。 |
|  | [`ICEList`](./api/data-display.md#icelist) | 列表（Swing JList / 业界组件库 List 的最小版）。 |
|  | [`ICETree`](./api/data-display.md#icetree) | 树（Swing JTree / 业界组件库 Tree 的最小可用版）。 |
|  | [`ICECard`](./api/data-display.md#icecard) | 卡片：面板 + 标题，并提供右上角 `extra` 插槽（放“更多/操作”）。 |
|  | [`ICEStatCard`](./api/data-display.md#icestatcard) | 统计卡：图标 + 标题 + 数值 + 涨跌趋势，用于仪表盘顶部指标。 |
|  | [`ICEStatistic`](./api/data-display.md#icestatistic) | 统计数值（业界组件库 Statistic）：标题 + 大号数字 + 前缀/后缀，支持千分位与精度。  传 `countdown`（剩余毫秒）时进入倒计时模式：按「N 天 HH:mm:ss」显示剩余时间， 归零触发 `finish` 事件与 `onFinish` 回调（业界组件库 的 `Statistic.Countdown`）。 |
|  | [`ICEDescriptions`](./api/data-display.md#icedescriptions) | 描述列表（业界组件库 Descriptions）：成对的「标签 / 值」，支持单列与多列。 常用于详情页（订单信息、用户资料）。 |
|  | [`ICETimeline`](./api/data-display.md#icetimeline) | 时间线（业界组件库 Timeline）：竖线 + 节点圆点 + 标题/描述/时间。 |
|  | [`ICEProgressBar`](./api/data-display.md#iceprogressbar) | 进度环/进度条。 |
|  | [`ICEImageView`](./api/data-display.md#iceimageview) | 图片视图（基于引擎原语 `ICEImage`）。  名字带 `View` 后缀是为了避开引擎自己的 `ICEImage`（图片原语）——两个包同名不同物， 同时 import 会撞名，所以本库的控件一律叫 `ICEImageView`。 |
|  | [`ICEAvatar`](./api/data-display.md#iceavatar) | 文字头像：取首字母/汉字，背景色可配，自带描边把相邻头像分开。 |
|  | [`ICEAvatarGroup`](./api/data-display.md#iceavatargroup) | 头像组（业界组件库 Avatar.Group 的最小版）。 |
|  | [`ICETag`](./api/data-display.md#icetag) | 标签：默认 Bootstrap 实底（`.text-bg-*`），`variant: 'soft'` 切浅底 + 强调文字。 |
|  | [`ICEBadge`](./api/data-display.md#icebadge) | 徽标：数字/文字胶囊；`dot` 是红点模式，`count` 超过阈值自动显示 `99+`。 |
|  | [`ICECarousel`](./api/data-display.md#icecarousel) | 轮播（业界组件库 Carousel 的最小版）。 |
|  | [`ICECollapse`](./api/data-display.md#icecollapse) | 折叠面板（业界组件库 Collapse / Swing 无直接对应物）。 |
|  | [`ICEComment`](./api/data-display.md#icecomment) | 评论（业界组件库 Comment 的最小版）：文字头像 + 作者 + 时间 + 正文 + 操作按钮 + 嵌套回复。  布局自上而下：头像在左，右侧依次是「作者 · 时间」「正文」「操作」「回复（缩进）」。 高度按内容自动累加（正文单行 20px，多行请自行用 content 组件工厂）。 |
|  | [`ICEWatermark`](./api/data-display.md#icewatermark) | 水印（业界组件库 Watermark）：把一段旋转文字平铺在自己的区域上。 |
| [反馈与状态](./api/feedback.md) | [`ICEAlert`](./api/feedback.md#icealert) | 提示条：info / success / warning / error 四种状态 + 类型图标，可关闭。 |
|  | [`ICEModal`](./api/feedback.md#icemodal) | 模态对话框：全屏遮罩 + 居中面板 + 焦点陷阱。 |
|  | [`ICEDrawer`](./api/feedback.md#icedrawer) | 抽屉：从屏幕某一边滑入的面板（带遮罩与焦点陷阱）。  与 ICEModal 同源（遮罩 + 焦点范围 + 关闭途径），差别只在： |
|  | [`ICETooltip`](./api/feedback.md#icetooltip) | 工具提示：鼠标悬停在目标组件上、延时后弹出的小浮层。 |
|  | [`ICEPopover`](./api/feedback.md#icepopover) | 卡片式浮层：点击（默认）或悬停触发，内容可以是文本或自定义组件工厂。  与 ICETooltip 的区别： |
|  | [`ICEPopconfirm`](./api/feedback.md#icepopconfirm) | 气泡确认框：点击目标弹出「标题 + 说明 + 取消/确定」的小卡片。  复用 ICEPopover 的触发与定位；确认/取消后自动关闭并回调。 |
|  | [`ICEResult`](./api/feedback.md#iceresult) | 结果页（业界组件库 Result）：状态图标 + 标题 + 副标题 + 操作按钮组。 用于提交成功/失败、404、无权限等场景。 |
|  | [`ICEEmpty`](./api/feedback.md#iceempty) | 空状态：居中的图标 + 描述 + 可选操作按钮。 常用于列表/表格无数据、搜索无结果。 |
|  | [`ICESkeleton`](./api/feedback.md#iceskeleton) | 骨架屏：内容加载前的灰色占位。  `active` 打开时整体做呼吸（opacity 0.55 ⇄ 1 循环），加载完成后 setActive(false) 并移除。 |
|  | [`ICESpin`](./api/feedback.md#icespin) | 加载指示器（业界组件库 Spin 的最小版）：一段圆弧绕中心旋转。 |
|  | [`ICESteps`](./api/feedback.md#icesteps) | 步骤条（业界组件库 Steps）：横向序号 + 标题/描述 + 连接线，当前步骤高亮、已完成打勾。 |
| [导航](./api/navigation.md) | [`ICEMenu`](./api/navigation.md#icemenu) | 菜单：菜单项 +（可选）子菜单内联展开；选中态与悬停态分离，父项在子项选中时只做“当前分组”提示。 |
|  | [`ICEBreadcrumb`](./api/navigation.md#icebreadcrumb) | 面包屑（业界组件库 Breadcrumb）：一行「路径 + 分隔符」，最后一项是当前页。 |
|  | [`ICEDropdown`](./api/navigation.md#icedropdown) | 下拉菜单：点击触发组件弹出选项列表。 |
|  | [`ICEPagination`](./api/navigation.md#icepagination) | 分页器：页码 + 上一页/下一页 + 可选「共 N 条」与每页条数切换。 |
|  | [`ICETabs`](./api/navigation.md#icetabs) | 标签页：一组互斥按钮，`onChange` 通知切换（程序式 `setActiveIndex` 不触发回调）。 |
| [核心与布局](./api/core.md) | [`ICEScrollPane`](./api/core.md#icescrollpane) | 滚动视口（Swing 的 JScrollPane / 业界组件库 的 overflow:auto 容器）。  依赖引擎的**子树裁剪**（`clipChildren`）：内容超出视口的部分被裁掉，滚出去的子组件 也命不中（命中检测同样尊重裁剪区）。  结构： ``` ICEScrollPane (clipChildren: true)   ├── contentBox   位置 = (-scrollX, -scrollY)，尺寸 = 内容尺寸   │     └── 调用方的内容组件   └── scrollbarTrack + scrollbarThumb   滚动条（内容超出时才显示） ``` 内容盒与滚动条都在构造期创建，保证滚动条的 zIndex 恒高于内容（引擎按 zIndex 排序渲染）。 |
|  | [`ICESplitter`](./api/core.md#icesplitter) | 分隔面板（业界组件库 Splitter）：两栏 + 可拖动的分隔条。 |
|  | [`ICEOverlayManager`](./api/core.md#iceoverlaymanager) | 弹层/浮层底座。  所有需要「浮在其它组件之上」的组件（Modal、Dropdown、Select、Tooltip、Popover、 右键菜单…）都走这一层，避免每个组件各自实现锚点定位、z 序、点外关闭、Esc 关闭。  实现要点： |
|  | [`ICEFocusManager`](./api/core.md#icefocusmanager) | 键盘焦点与焦点环。  引擎只负责「键盘事件派发给谁」（`ice.setFocusedComponent` + DOMEventDispatcher）， 上层的策略在这里： |
|  | [`ICEHoverManager`](./api/core.md#icehovermanager) | ICE 内核的移动类事件为了性能不会在 mousemove 时做全量命中检测， 因此 Canvas 组件没有内置 mouseenter/mouseleave 语义。  ICEHoverManager 通过事件总线的 mousemove + ice.hitTest() 自己维护当前 hover 组件， 并把状态同步到带 setHovered() 的 ICEWidget 上，实现接近 HTML 组件的 hover 效果。 |
|  | [`ICEMessageManager`](./api/core.md#icemessagemanager) | 全局提示（Message / Notification）。 |
|  | [`ICEManager`](./api/core.md#icemanager) | 主题管理单例（`iceUIManager`）：持有当前 token 表，组件构造时从这里取主题。 |

模型与工具函数见 [API 参考](./api/README.md)。
