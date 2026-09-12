# 工具函数

挂载浮层、开弹窗/抽屉、做过渡动画的便捷入口。

### `attachTooltip` — 函数

便捷绑定：`attachTooltip(ice, target, options)`。

```ts
attachTooltip(ice: any, target: any, options: ICETooltipOptions): ICETooltip
```

### `attachPopover` — 函数

```ts
attachPopover(ice: any, target: any, options: ICEPopoverOptions): ICEPopover
```

### `attachPopconfirm` — 函数

```ts
attachPopconfirm(ice: any, target: any, options: ICEPopconfirmOptions): ICEPopconfirm
```

### `attachDropdown` — 函数

便捷绑定：`attachDropdown(ice, target, options)`。

```ts
attachDropdown(ice: any, target: any, options: ICEDropdownOptions): ICEDropdown
```

### `openModal` — 函数

便捷入口：`ICEModal.open(ice, options)` 等价于 new ICEModal(ice, options).open()。

```ts
openModal(ice: any, options: ICEModalOptions): ICEModal
```

### `openDrawer` — 函数

便捷入口：`openDrawer(ice, options)`。

```ts
openDrawer(ice: any, options: ICEDrawerOptions): ICEDrawer
```

### `getICEOverlayManager` — 函数

```ts
getICEOverlayManager(ice: any): ICEOverlayManager
```

### `getICEFocusManager` — 函数

每个 ICE 实例一个焦点管理器（懒创建）。

```ts
getICEFocusManager(ice: any): ICEFocusManager
```

### `getICEMessageManager` — 函数

```ts
getICEMessageManager(ice: any): ICEMessageManager
```

### `getICEWorldBox` — 函数

```ts
getICEWorldBox(component: any): ICEWorldBox
```

### `tween` — 函数

单值补间（frame driver 可注入，测试里手动 step）。

```ts
tween(options: ICETweenOptions): ICETweenHandle
```

### `fadeIn` — 函数

淡入：从 0 到 1。

```ts
fadeIn(component: any, options: ICETransitionOptions): ICETweenHandle
```

### `fadeOut` — 函数

淡出：从当前值到 0（完成后通常再移除组件）。

```ts
fadeOut(component: any, options: ICETransitionOptions): ICETweenHandle
```

### `fadeTo` — 函数

把不透明度过渡到指定值。

```ts
fadeTo(component: any, to: number, options: ICETransitionOptions): ICETweenHandle
```

### `slideIn` — 函数

滑入：从指定方向的偏移位置移到当前位置（可选同时淡入）。

```ts
slideIn(component: any, options: ICESlideOptions): ICETweenHandle
```

### `scaleIn` — 函数

缩放进入：scale 从 from 到 1（可选同时淡入）。

```ts
scaleIn(component: any, options: ICEScaleInOptions): ICETweenHandle
```

### `estimateTextWidth` — 函数

极简文本宽度估算（给「按最长文字定容器宽度」用的）。

```ts
estimateTextWidth(text: string, fontSize: number): number
```

### `formatStatisticValue` — 函数

数值格式化：精度 + 可选千分位；非数字（如「暂缺」）原样返回。

```ts
formatStatisticValue(value: number | string, precision: number, group: boolean): string
```

### `formatCountdown` — 函数

倒计时格式：`N 天 HH:mm:ss`；不足一天时省略「N 天」。

```ts
formatCountdown(ms: number): string
```

### `truncateTextLines` — 函数

按宽度把文本切成若干行，超出部分用 `…` 收尾。

```ts
truncateTextLines(text: string, options: { maxWidth: number; fontSize: number; maxLines?: number }): string[]
```

### `tooltipPanelWidth` — 函数

气泡面板宽度：按文字估算（中文 1em、拉丁 0.6em），避免长中文被压出色块外面。

```ts
tooltipPanelWidth(title: string): number
```

### `readHovered` — 函数

从 `hoverchange` 事件里读取 hovered。

```ts
readHovered(evt: any): boolean
```

### `createTextNode` — 函数

创建一段按照 ICE 约定居中显示的文本。

```ts
createTextNode(props: { text?: string; left?: number; top?: number; width?: number; height?: number; fillStyle?: string; fontFamily?: string; fontSize?: number; fontWeight?: string; align?: 'left' | 'center' | 'right'; verticalAlign?: 'top' | 'middle' | 'bottom'; })
```

### `centerTextNode` — 函数

```ts
centerTextNode(text: string, theme: ICEThemeTokens, width: number, height: number, options: { fontSize?: number; fontWeight?: string; fillStyle?: string })
```

### `getStatusColors` — 函数

```ts
getStatusColors(theme: ICEThemeTokens, status: ICEStatusColor)
```

### `resolveICEEasing` — 函数

```ts
resolveICEEasing(easing?: ICEEasing): (t: number) => number
```

### `easeInQuad` — 函数

```ts
easeInQuad(t: number): number
```

### `easeOutCubic` — 函数

```ts
easeOutCubic(t: number): number
```

### `easeInOutCubic` — 函数

```ts
easeInOutCubic(t: number): number
```

### `resolveICEOverlayPosition` — 函数

计算浮层位置：优先用请求的 placement；放不下且 flip 打开时翻到对侧；

```ts
resolveICEOverlayPosition(input: ICEOverlayPositionInput): ICEOverlayPosition
```

### `isPointInsideICEBox` — 函数

```ts
isPointInsideICEBox(box: ICEWorldBox, x: number, y: number): boolean
```

### `iceUIManager` — 常量

源码：`src/core/ICEManager.ts`

### `ICE_LIGHT_THEME` — 常量

源码：`src/theme/ICETheme.ts`

### `ICE_DARK_THEME` — 常量

源码：`src/theme/ICETheme.ts`
