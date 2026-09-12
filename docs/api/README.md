# API 参考

> 本目录由 `npm run docs:api` 从源码生成（解析 `src/**` 的类注释、`ICEXxxOptions` 字段与 public 方法），
> 请勿手改；要改说明就改源码里的 JSDoc。

所有组件都导出为 `ICE` 前缀的类，包内运行时导出与 `ice-render` 零重叠（有回归测试守着）。

- [基础组件](./basic.md) — `ICEWidget` `ICEContainer` `ICEPanel` `ICEButton` `ICELabel` `ICETypography` `ICEIcon` `ICESvgIcon` `ICESeparator`
- [数据录入](./data-entry.md) — `ICETextField` `ICETextArea` `ICEPasswordField` `ICEInputNumber` `ICECheckBox` `ICERadioButton` `ICERadioGroup` `ICECheckboxGroup` `ICESwitch` `ICESlider` `ICESegmented` `ICERate` `ICEUpload` `ICEFormItem` `ICEForm`
- [数据录入（浮层类）](./data-entry-popups.md) — `ICESelect` `ICEAutoComplete` `ICECascader` `ICETreeSelect` `ICEDatePicker` `ICETimePicker` `ICEColorPicker` `ICETransfer`
- [数据展示](./data-display.md) — `ICETable` `ICEList` `ICETree` `ICECard` `ICEStatCard` `ICEStatistic` `ICEDescriptions` `ICETimeline` `ICEProgressBar` `ICEImageView` `ICEImagePreview` `ICECalendar` `ICEAvatar` `ICEAvatarGroup` `ICETag` `ICEBadge` `ICECarousel` `ICECollapse` `ICEComment` `ICEWatermark`
- [反馈与状态](./feedback.md) — `ICEAlert` `ICEModal` `ICEDrawer` `ICEMessage` `ICENotification` `ICETooltip` `ICEPopover` `ICEPopconfirm` `ICEResult` `ICEEmpty` `ICESkeleton` `ICESpin` `ICESteps` `ICETour`
- [导航](./navigation.md) — `ICEMenu` `ICEBreadcrumb` `ICEAnchor` `ICEBackTop` `ICEDropdown` `ICEPagination` `ICETabs`
- [核心与布局](./core.md) — `ICEScrollPane` `ICESplitter` `ICEOverlayManager` `ICEFocusManager` `ICEHoverManager` `ICEMessageManager` `ICEManager`
- [工具函数](./helpers.md) — `attachTooltip` `attachPopover` `attachPopconfirm` `attachDropdown` `openModal` `openDrawer` `getICEOverlayManager` `getICEFocusManager` `getICEMessageManager` `getICEWorldBox` `tween` `fadeIn` `fadeOut` `fadeTo` `slideIn` `scaleIn` `estimateTextWidth` `formatStatisticValue` `formatCountdown` `truncateTextLines` `openImagePreview` `formatCalendarDate` `buildMonthGrid` `tooltipPanelWidth` `readHovered` `createTextNode` `centerTextNode` `getStatusColors` `resolveICEEasing` `easeInQuad` `easeOutCubic` `easeInOutCubic` `resolveICEOverlayPosition` `isPointInsideICEBox` `iceUIManager` `ICE_LIGHT_THEME` `ICE_DARK_THEME`
- [模型](./models.md) — `ICEButtonModel` `ICEToggleModel` `ICEBoundedRangeModel` `ICESelectionModel` `ICEFormModel`
