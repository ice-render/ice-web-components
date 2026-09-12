# 主题与配色

主题就是一张普通对象：`src/theme/ICETheme.ts` 里的 `ICE_LIGHT_THEME` / `ICE_DARK_THEME`。
`iceUIManager`（`ICEManager` 单例）持有“当前用哪套”，组件在**构造时**读一次。

```ts
import { iceUIManager } from 'ice-web-components';

iceUIManager.setTheme('dark');     // 'light' | 'dark'
const theme = iceUIManager.getTheme();
theme.colors.primary;              // '#0d6efd'
```

> ⚠️ 组件是**构造时**取色的：`setTheme` 之后新建的组件才会用新主题。需要热切换就重建组件树
> （示例页的做法是切页/重建；`ICEMessage`/`ICEModal` 这类每次打开都新建的组件天然跟随）。

## token 分组

| 分组 | 说明 |
|---|---|
| `colors` | 语义色、中性色、文字层级、状态色的 subtle 背景/边框与强调文字色、`focusRing` |
| `spacing` | `xxs` 4 / `xs` 8 / `sm` 12 / `md` 16 / `lg` 24 / `xl` 32 / `xxl` 48 |
| `radius` | `xs` 2 / `sm` 4 / `md` 6 / `lg` 8 / `xl` 16 / `pill` 999 |
| `font` | 系统字体栈 + 三档字号 + 四档字重 |
| `control` | 控件高度（24 / 32 / 40）、内边距、线宽、开关/复选/单选/进度/滑块尺寸 |
| `shadows` | `sm` / `md` / `lg`，值是引擎认的 `{ shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY }` |

## 为什么需要 `*TextEmphasis`

配色刻意偏 Bootstrap 5，而 Bootstrap 的 `warning` 是**亮黄 `#ffc107`** —— 这种颜色当文字压在浅黄底上
几乎读不出来。所以每个状态色都有两组文字色：

* `text`：状态**实色**，用在白底上（统计卡的涨跌数字、图标）；
* `*TextEmphasis`：`*-text-emphasis` 深色档，用在 subtle 浅底上（Alert 标题、Tag/Badge 文字）。

`getStatusColors(theme, status)` 会把一组都给你：

```ts
const colors = getStatusColors(theme, 'warning');
// {
//   background: '#fff3cd',  // subtle 底
//   border:     '#ffe69c',
//   text:       '#ffc107',  // 白底上用
//   strong:     '#664d03',  // 浅底上用（Alert / Tag 文字）
//   solid:      '#ffc107',  // 实底填充（.text-bg-*）
//   onSolid:    '#000000',  // 实底上的文字：亮色配黑字
// }
```

## 实底还是浅底

`ICETag` / `ICEBadge` 默认是 Bootstrap 的实底风格，`variant: 'soft'` 切回浅底：

```ts
new ICETag({ text: 'Paid', status: 'success' });                  // 绿底白字
new ICETag({ text: 'Paid', status: 'success', variant: 'soft' }); // 浅绿底 + 深绿字
```

## 改一套自己的主题

两套内置主题都是导出的普通对象，改字段即可（全局生效，建议在应用入口做）：

```ts
import { ICE_LIGHT_THEME } from 'ice-web-components';

ICE_LIGHT_THEME.colors.primary = '#7c3aed';
ICE_LIGHT_THEME.colors.primaryHover = '#6d28d9';
ICE_LIGHT_THEME.colors.primaryBg = '#ede9fe';
ICE_LIGHT_THEME.colors.primaryBorder = '#c4b5fd';
```

颜色值可以是任意 CSS 颜色字符串（`#rrggbb`、`rgba(...)`）。`shadows` 是引擎字段，不是 CSS 文本。

## 焦点色

`colors.focusRing`（浅色 `#86b7fe` / 深色 `#6ea8fe`）用于**焦点环**与**输入框聚焦边框** ——
浅蓝而不是主色，是 Bootstrap 的取值。
