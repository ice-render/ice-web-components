# 工具函数

挂载浮层、开弹窗/抽屉、做过渡动画的便捷入口。

### `attachTooltip` — 函数

便捷绑定：`attachTooltip(ice, target, options)`。

```ts
attachTooltip(ice: any, target: any, options: ICETooltipOptions): ICETooltip
```

## `ICENativeInput`

原生输入替身（canvas 里支持中文 IME 的关键一步）。  问题：canvas 组件自己处理 `keydown` 只能吃单字符键 —— **中文输入法在组字阶段根本没有 keydown**，所以「打中文」一直打不进去（只能 `setValue`）。  做法（和引擎 `ICEText.startEditing()` 同一套路）：聚焦时在组件上方挂一个**完全透明**的 原生 `<input>` / `<textarea>`，让浏览器和输入法去做它们擅长的事，再把结果回写：

- `input`：普通输入（打字、粘贴、删除）
- `compositionend`：输入法组字结束（中文/日文/韩文走这条）
- `Enter` / `Escape` / `blur`：交给组件决定（提交、取消、收尾） 元素是透明的（文字透明、背景透明、无边框），**画面仍然由 canvas 画**，元素只提供光标与输入法。 没有 `document` 的运行时（Node / 小程序）里 `mount()` 是空操作，组件据此降级回 keydown 输入。

源码：[`src/util/ICENativeInput.ts`](../../src/util/ICENativeInput.ts)

**构造参数** `ICENativeInputOptions`

| 参数 | 类型 | 说明 |
|---|---|---|
| `doc?` | `any` | 注入 document（测试用假对象）；不传则取全局 document |
| `box` | `ICENativeInputBox` | 组件的世界坐标盒（CSS 像素，相对画布左上角） |
| `value?` | `string` | 当前值 |
| `font?` | `string` | 与 canvas 完全一致的字体串（`400 14px Tahoma`），否则光标与文本对不齐 |
| `caretColor?` | `string` |  |
| `maxLength?` | `number` | 0 / 不传 = 不限制 |
| `multiline?` | `boolean` | 多行模式：创建 textarea（Enter 换行，不触发 onEnter） |
| `onInput?` | `(value: string) => void` |  |
| `onEnter?` | `() => void` |  |
| `onEscape?` | `() => void` |  |
| `onBlur?` | `() => void` |  |

**方法**

| 方法 | 返回 | 说明 |
|---|---|---|
| `isMounted()` | `boolean` |  |
| `getElement()` | `any` |  |
| `getValue()` | `string` |  |
| `mount()` | `this` | 挂载：创建元素、定位、聚焦、把光标放到末尾。重复调用是幂等的。 |
| `unmount()` | `void` | 卸载并解绑；重复调用安全。 |
| `setValue(value: string)` | `this` | 外部改值（例如 setValue）：同步到元素并把光标移到末尾。 |
| `focus()` | `this` |  |
| `setCaretColor(color: string)` | `this` | 改光标颜色（密码框在明文 / 掩码之间切换时用）。 |

### `computeVirtualRange` — 函数

纯窗口计算：给定滚动位置、视口高度、行高与总数，算出该渲染哪一段。

```ts
computeVirtualRange(options: ICEVirtualWindowOptions): ICEVirtualRange
```

### `resolveColumnWidths` — 函数

列宽求解（纯函数，方便单测）。

```ts
resolveColumnWidths(columns: Array<{ width?: number; minWidth?: number }>, totalWidth: number, defaultMinWidth: number): number[]
```

### `computeDropTarget` — 函数

指针坐标 → 落点。

```ts
computeDropTarget(options: ICEDropTargetOptions): ICEDropTarget | null
```

### `moveItem` — 函数

把第 `from` 项移到落点处，返回新数组。

```ts
moveItem(items: T[], from: number, target: ICEDropTarget): ICEMoveResult<T>
```

### `moveKanbanCard` — 函数

看板卡片移动：从原列取出，插到目标列的 `index` 位置。

```ts
moveKanbanCard(columns: C[], cardKey: string, targetColumnKey: string, index: number): ICEKanbanMoveResult<C>
```

### `mountICEAccessibilityMirror` — 函数

```ts
mountICEAccessibilityMirror(ice: any, options: ICEA11yMirrorOptions): ICEA11yMirrorHandle
```

### `setICELocale` — 函数

切换语言；未注册的语言会被忽略。

```ts
setICELocale(locale: string): void
```

### `getICELocale` — 函数

```ts
getICELocale(): string
```

### `getICELocaleNames` — 函数

```ts
getICELocaleNames(): string[]
```

### `registerICELocale` — 函数

注册（或覆盖）一个语言包。

```ts
registerICELocale(locale: string, messages: ICELocaleMessages): void
```

### `getICELocaleMessages` — 函数

取当前语言的完整包（拷贝，避免外部改坏内置包）。

```ts
getICELocaleMessages(locale: string): ICELocaleMessages
```

### `t` — 函数

取文案（用**当前语言**）：当前语言 → 默认语言 → key 本身；`{name}` 会被 `vars` 里的值替换。

```ts
t(key: string, vars?: Record<string, string | number>): string
```

### `ICE_DEFAULT_LOCALE` — 常量

默认语言。

源码：`src/i18n/ICEI18n.ts`

### `ICE_LOCALE_ZH_CN` — 常量

内置中文包（组件的默认文案）。

源码：`src/i18n/ICEI18n.ts`

### `ICE_LOCALE_EN_US` — 常量

内置英文包。

源码：`src/i18n/ICEI18n.ts`

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

### `openImagePreview` — 函数

便捷入口：`openImagePreview(ice, { images: [...], index: 0 })`。

```ts
openImagePreview(ice: any, options: ICEImagePreviewOptions): ICEImagePreview
```

### `formatCalendarDate` — 函数

`YYYY-MM-DD`（本地时区，日期选择器统一用这个字符串形态）。

```ts
formatCalendarDate(date: Date): string
```

### `buildMonthGrid` — 函数

生成月视图网格（固定 6 行 × 7 列 = 42 格，前后用相邻月份补齐）。

```ts
buildMonthGrid(month: string, options: { weekStart?: number }): ICECalendarCell[]
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
createTextNode(props: { text?: string; left?: number; top?: number; width?: number; height?: number; /** 允许直接给色值，也允许给引擎的主题引用（`token('ui.colors.text')`）—— 后者才能热切换。 */ fillStyle?: string | ICEThemeTokenRef; fontFamily?: string; fontSize?: number; fontWeight?: string; align?: 'left' | 'center' | 'right'; verticalAlign?: 'top' | 'middle' | 'bottom'; })
```

### `centerTextNode` — 函数

```ts
centerTextNode(text: string, theme: ICEThemeTokens, width: number, height: number, options: { fontSize?: number; fontWeight?: string; fillStyle?: string | ICEThemeTokenRef })
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

### `ICE_HIGH_CONTRAST_THEME` — 常量

高对比度主题（`high-contrast`）。  给「屏幕反光 / 视力不好 / 投影仪」这些场景：纯黑底 + 纯白正文， 语义色一律换成暗底上也够亮的版本，描边从浅灰提到中灰 —— 不然边界在暗底上根本看不见。 正文对底色 21:1、次要文字 ~15:1（WCAG AAA 是 7:1），主色对底色也在 10:1 以上。

源码：`src/theme/ICETheme.ts`

### `ICE_XP_THEME` — 常量

Windows XP 经典主题（Luna 蓝 + 米灰控件）。  用途：桌面 / 怀旧风格的应用。用 `iceUIManager.registerTheme('xp', ICE_XP_THEME).setTheme('xp')` 切换（主题在组件构造时读取，先切主题再建组件）。  取色要点：

源码：`src/theme/ICETheme.ts`

### `ICE_ARCADE_THEME` — 常量

街机主题：给「掌机 / 游戏」这类深色场景用的一套 token。  为什么要有它：arcade 示例一开始把方块和蛇的颜色写死在页面里，结果是**面板文字跟着主题走、 游戏美术不跟** —— 一个页面两套配色来源。现在游戏配色也收进 token：  ```ts iceUIManager.registerTheme('arcade', ICE_ARCADE_THEME).setTheme('arcade'); const board = new ICETileMap({ rows, cols, palette: ICE_ARCADE_PALETTE }); ```  它是**完整主题**（不是补丁）：token 组与内置 dark 完全一致，只换颜色，所以任何组件切过去 都不会缺 token。

源码：`src/theme/ICEArcadeTheme.ts`

### `ICE_ARCADE_PALETTE` — 常量

游戏调色板：方块 7 种 + 蛇头 / 蛇身 / 食物。 颜色取 Bootstrap 语义色，描边统一是填充色压暗 35%（和页面里 `shade(color, -0.35)` 一致）。

源码：`src/theme/ICEArcadeTheme.ts`
