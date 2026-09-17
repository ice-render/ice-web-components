# 主题与配色

主题就是一张普通对象：`src/theme/ICETheme.ts` 里的 `ICE_LIGHT_THEME` / `ICE_DARK_THEME`。
`iceUIManager`（`ICEManager` 单例）持有"当前用哪套"。

```ts
import { iceUIManager } from 'ice-web-components';

iceUIManager.setTheme('dark');     // 'light' | 'dark'
const theme = iceUIManager.getTheme();
theme.colors.primary;              // '#0d6efd'
```

> ✅ **组件样式槽里放的是"主题引用"**（`token('ui.colors.text')`），引擎在 **paint 时**解析 ——
> 所以 `setTheme()` 之后**不用重建组件树**，下一帧就是新色。见第七节。
>
> `token()` 是**引擎**（`ice-render`）的东西，本包不再导出同名的（两边导出集合保持零重叠，
> 见 `tests/exports.unique.test.ts`）—— 应用里同时装两个包时，从 `ice-render` 取：
>
> ```ts
> import { token } from 'ice-render';
> ```

## 一、token 分组

### 1.1 哪个底用哪一档（2026-09-17 立，改主题前先看这张表）

同一支语义色在不同底上有**不同的名字**，用错档就是"颜色不对"（而且不报错）。这张表由
`tests/theme-contrast.test.ts` 逐条钉住，**五套出厂主题（浅 / 深 / 高对比 / 街机 / XP）全部要过**：

| 我要画的东西 | 用哪个 token | 判据（WCAG 2.1） |
|---|---|---|
| 正文 | `text` | ≥ 4.5:1（对 surface / background / elevated 三种底） |
| 次级正文 | `textSecondary` | ≥ 4.5:1 |
| **链接 / 数值 / 强调标题 / ✓✕ 这类字形** | **`link`** | ≥ 4.5:1 |
| 提示语 / 占位符 / 辅助说明 | `textTertiary` | ≥ 3:1（**不承担正文**，但也别低到看不见） |
| 状态**实色底**（Alert / Tag 实底、进度条填充） | `success` / `warning` / … | 与相邻色的边界 ≥ 3:1 |
| 状态**浅底上的文字** | `successTextEmphasis` / … | ≥ 4.5:1（对各自的 `*Bg`） |
| **主色底上的文字**（按钮标签） | `primaryText` | ≥ 4.5:1 |
| 填充 / 描边（按钮底、选中框、滑块轨道、拖拽指示条） | `primary` 及状态实色 | 填充不参与文字判据 |
| 聚焦环 / 选中框 | `focusRing` | ≥ 3:1（非文本 UI 部件） |
| 描边 | `border` / `borderSecondary` | **不设阈值**：装饰性（要立"边界必须可见"的产品口径才能测） |

⚠️ **`primary` 与 `link` 是两支，别互相顶替**。`primary`（`#0d6efd`）是饱和色，当**填充**没问题；
当**文字**压在暗色 `surface` 上实测只有 **2.96:1**（连大字的 3:1 都差一点）—— `link` 就是为这件事
存在的：浅色 `#0a58ca`（6.4:1）、暗色 `#6ea8fe`（5.5:1）。这条是实测挖出来的：在 `ice-smart-water`
的深色主题里数出 **49866 个 `#0d6efd` 像素**压在深底上，逐个都是"把 primary 当文字用"的地方。

同类修正（都是这次体检抓到的，改前都不会让任何测试变红）：

- `textTertiary`：浅色 `#adb5bd`（2.07）、暗色 `#6c757d`（2.84）都不到 3:1 → `#868e96` / `#8a9199`；
- 浅色 `focusRing` 原来取 Bootstrap 的 `#86b7fe`，白底上只有 **2.06:1** —— 那是个**看不见的
  聚焦提示** → `#3d8bfd`（3.33）；
- 浅色 `textSecondary` 在**页面底**（`#f8f9fa`）上是 4.45，差 0.05 不过 AA → `#6a7178`（4.69）；
- XP 主题的链接蓝在它的米色页面底上 4.31 → `#2d61b5`（4.93）。

| 分组 | 说明 |
|---|---|
| `colors` | 语义色、中性色、文字层级、状态色的 subtle 背景/边框与强调文字色、`focusRing` |
| `spacing` | `xxs` 4 / `xs` 8 / `sm` 12 / `md` 16 / `lg` 24 / `xl` 32 / `xxl` 48 |
| `radius` | `xs` 2 / `sm` 4 / `md` 6 / `lg` 8 / `xl` 16 / `pill` 999 |
| `font` | 系统字体栈 + 三档字号 + 四档字重 |
| `control` | 控件高度（24 / 32 / 40）、内边距、线宽、开关/复选/单选/进度/滑块尺寸 |
| `shadows` | `sm` / `md` / `lg`，值是引擎认的 `{ shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY }` |

token 分组归属如下：

```mermaid
flowchart TD
  Theme["ICETheme<br/>ICE_LIGHT_THEME / ICE_DARK_THEME"]
  C["colors<br/>语义色·中性色·文字层级·状态色·focusRing"]
  S["spacing<br/>xxs4 xs8 sm12 md16 lg24 xl32 xxl48"]
  R["radius<br/>xs2 sm4 md6 lg8 xl16 pill999"]
  F["font<br/>系统字体栈·三档字号·四档字重"]
  K["control<br/>控件高度·内边距·线宽·尺寸"]
  H["shadows<br/>sm/md/lg（引擎字段）"]
  Theme --> C & S & R & F & K & H
```

## 二、为什么需要 `*TextEmphasis`

配色刻意偏 Bootstrap 5，而 Bootstrap 的 `warning` 是**亮黄 `#ffc107`** —— 这种颜色当文字压在浅黄底上
几乎读不出来。所以每个状态色都有两组文字色：

* `text`：状态**实色**，用在白底上（统计卡的涨跌数字、图标）；
* `*TextEmphasis`：`*-text-emphasis` 深色档，用在 subtle 浅底上（Alert 标题、Tag/Badge 文字）。

`getStatusColors(theme, status)` 会把一组都给你 —— 除了 `onSolid`，**每个值都是主题引用**
（热切换要的就是这个），要参与运算先 `resolveColorValue(...)` 解析成字符串：

```ts
const colors = getStatusColors(theme, 'warning');
// {
//   background: {$token:'ui.colors.warningBg'},      // subtle 底（引用）
//   border:     {$token:'ui.colors.warningBorder'},
//   text:       {$token:'ui.colors.warning'},        // 白底上用
//   strong:     {$token:'ui.colors.warningTextEmphasis'},  // 浅底上用（Alert / Tag 文字）
//   solid:      {$token:'ui.colors.warning'},        // 实底填充（.text-bg-*）
//   onSolid:    '#000000',                           // 实底上的文字：**字面量**（亮底配黑字，与主题无关）
// }
```

## 三、实底还是浅底

`ICETag` / `ICEBadge` 默认是 Bootstrap 的实底风格，`variant: 'soft'` 切回浅底：

```ts
new ICETag({ text: 'Paid', status: 'success' });                  // 绿底白字
new ICETag({ text: 'Paid', status: 'success', variant: 'soft' }); // 浅绿底 + 深绿字
```

实底 / 浅底 的取舍与文字配色逻辑如下：

```mermaid
flowchart TD
  Start["ICETag / ICEBadge"]
  Style{"variant？"}
  Solid["实底（默认）<br/>亮底 → 黑字 onSolid"]
  Soft["浅底（soft）<br/>subtle 底 → *TextEmphasis 深字"]
  Bright{"底色亮度高？"}
  Black["配黑字"]
  White["配白字"]
  Start --> Style
  Style -->|默认| Solid
  Style -->|soft| Soft
  Solid --> Bright
  Soft --> Bright
  Bright -->|是| Black
  Bright -->|否| White
  %% 依亮度自动配文字色：亮底黑字，暗底白字
```

## 四、改一套自己的主题

两套内置主题都是导出的普通对象，改字段即可（全局生效，建议在应用入口做）：

```ts
import { ICE_LIGHT_THEME } from 'ice-web-components';

ICE_LIGHT_THEME.colors.primary = '#7c3aed';
ICE_LIGHT_THEME.colors.primaryHover = '#6d28d9';
ICE_LIGHT_THEME.colors.primaryBg = '#ede9fe';
ICE_LIGHT_THEME.colors.primaryBorder = '#c4b5fd';
```

颜色值可以是任意 CSS 颜色字符串（`#rrggbb`、`rgba(...)`）。`shadows` 是引擎字段，不是 CSS 文本。

## 五、注册自定义主题（不污染内置主题）

直接改 `ICE_LIGHT_THEME` 是全局副作用；更干净的做法是**注册一套新 token** 再切过去：

```ts
import { ICE_XP_THEME, iceUIManager } from 'ice-web-components';

iceUIManager.registerTheme('xp', ICE_XP_THEME).setTheme('xp');
```

- `registerTheme(name, tokens)` / `hasTheme(name)` / `getThemeNames()` 都是 `iceUIManager` 上的方法；
- `setTheme('未注册的名字')` 会被忽略（不抛异常，也不改变当前主题）；
- 库内置了 `ICE_XP_THEME`（Windows XP 经典：Luna 蓝 `#316ac5` + 米灰控件面 `#ece9d8`、
  小圆角、紧凑控件尺寸），`examples/windows-xp.html` 就是靠它整体换肤的。

> 注册完再 `setTheme('xp')` 即可 —— 已经建好的组件下一帧就换（样式槽里是引用，见第七节）。

## 六、焦点色

`colors.focusRing`（浅色 `#3d8bfd` / 深色 `#6ea8fe`）用于**焦点环**与**输入框聚焦边框**。

浅色那档原来是 Bootstrap 的 `#86b7fe`，压在白底上只有 **2.06:1** —— 一个**几乎看不见的**
聚焦提示；改成 `#3d8bfd`（3.33:1）才够非文本 UI 部件的 3:1。这条是 2026-09-17 的对比度体检
（`tests/theme-contrast.test.ts`）量出来的。

## 七、热切换（2026-09-17 起支持，不用重建组件树）

以前组件是**构造期**把 token 抄成字面量的，所以"换主题"只能重建整棵树 ——
`ice-smart-water` / `ice-agent-console` 两个应用都因此退到"存偏好 + 重新加载"。现在两条腿都通了：

```ts
import { iceUIManager, applyThemeToEngine } from 'ice-web-components';

applyThemeToEngine(ice);            // ① 把主题（含整份 UI token 树）打到引擎实例上
iceUIManager.setTheme('dark');      // ② 换主题：广播到所有登记过的实例 + 通知订阅者
// ③ 引擎标脏 → 下一帧按新色重画。**组件树没动**。
```

原理是引擎的**主题引用**（`src/theme/ICETheme.ts` ④）：样式里的 `token('ui.colors.text')` 是
**paint 时**解析的，所以换主题只要"改表 + 标脏"。库内进样式槽的取色（**554 处**）已经全部改成这种写法
（真机判据：`e2e/theme-hot-switch.spec.ts` —— 同一棵组件树、画面指纹变化、颜色换成新主题那一档）。

### 7.1 三件东西各管什么

| 件 | 作用 | 谁调 |
|---|---|---|
| `applyThemeToEngine(ice)` | 把 UI token 树（`semantic.ui`）+ 语义色 + 交互外壳打进**这个引擎实例** | 应用（每个 `new ICE()` 一次）。**忘了也不要紧**：组件挂载时会按主题版本号兜底补一次 |
| `iceUIManager.setTheme(name)` | 换主题 + **广播**到所有登记过的实例 + 通知订阅者 | 应用（切主题时一次） |
| `ICEWidget.onThemeChange()` | 派生色组件的重算钩子（挂载时订阅、卸载时退订） | 组件自己（**只有算出来的颜色才需要**） |
| `themeScope('dark')` | **局部**主题：给一棵子树单独一套（不影响整页） | 应用（分屏 / 暗底嵌亮卡片时，写在容器的 `theme` 上）。见第八节 |

### 7.2 什么时候还需要 `onThemeChange()`

只有**算出来的颜色**（`mix` / `shade` / alpha）才需要 —— 它们没法写成一条引用，
得在钩子里**重新算一遍**（先 `resolveColorValue()` 把引用化成字符串再算）：

```ts
class Fancy extends ICEWidget {
  protected onThemeChange(): void {
    const theme = iceUIManager.getTheme();
    // 派生色：混色 / 压暗 / 加透明度 / 按状态查表（先用 resolveColorValue 解析成字符串）
    this.setState({
      style: { ...this.state.style, fillStyle: shade(resolveColorValue(token('ui.colors.primary')), -0.35) },
    });
  }
}
```

直接用 token 的地方**不要**实现它（引擎会自己重画，重复设置只是白费）。

> **`paint` 回调是例外**：那里的 `theme` 是引擎**每帧传进来的参数**，本来就跟主题走；
> 而且 `ctx.fillStyle` 必须拿到**字符串**，塞引用反而画不出来。所以 painter / `renderItem`
> 这类回调里照常写 `theme.colors.x`（库内剩的 9 处就是它们，见 7.3）。

### 7.3 迁移进度与棘轮（别让新代码走回头路）

两道门禁各管一头，**别只看源码数字**：

| 门禁 | 看什么 | 当前 |
|---|---|---|
| `tests/theme-refs.test.ts` | 源码侧"构造期取色"的**预算**，按文件记用户名；涨了红、降了不登记也红 | **9 处 / 3 个文件**（全是 `paint` 回调：`ICEList` 5 / `ICEAvatar` 3 / `ICESkeleton` 1） |
| `e2e/theme-coverage.spec.ts` | 真机侧：逐节点比对 `resolvedStyleColor()` 切主题前后变没变 | 可疑字面量 **0**；换色节点 **1195 / 1456**（迁移前只有 306） |

真机那道的判据是"**画出来的颜色**"，不是源码里的计数 —— 2026-09-17 就是它抓出了两处漏网的
（`ICEDescriptions` / `ICETree` 用了 `iceUIManager.getTheme().colors.x`，源码棘轮当时数不到）。

自己写组件时：**颜色能写成 `token('ui.colors.x')` 就写成引用** —— 那样热切换、多实例主题、
暗色适配三件事一起解决；确实要算的（`mix` / `shade` / alpha）再加 `onThemeChange()`。

## 八、局部主题作用域（分屏大屏 / 暗底面板里嵌亮底卡片，2026-09-17 起）

整页一套主题不够用时，给某棵子树单独声明：

```ts
import { ICEPanel, themeScope } from 'ice-web-components';

// 整页浅色，这一块固定深色 —— 页面换主题时它**不跟着变**（这就是"分区用不同主题"）
new ICEPanel({ left: 512, top: 72, width: 456, height: 440, theme: themeScope('dark') });
// 也可以直接给一套 token：themeScope(ICE_XP_THEME)
```

`theme` 是**引擎**的入口（`props.theme` 是一份主题补丁，`themeOf()` 沿祖先链由外向内合并，
按「主题版本 + 参与作用域的组件身份」缓存 → 每帧零重算）；`themeScope()` 只是把本库的 token 树
包成引擎认的那份补丁，省得应用自己拼。

```mermaid
flowchart TD
  Ice["ICE 实例主题<br/>applyThemeToEngine(ice)"]
  Scope["面板 A<br/>theme: themeScope('dark')"]
  ScopeB["面板 B<br/>无作用域"]
  ChildA["A 里的按钮 / 列表 / 骨架屏"]
  ChildB["B 里的按钮 / 列表 / 骨架屏"]
  Ice --> Scope --> ChildA
  Ice --> ScopeB --> ChildB
  %% 两条链各自解析：A 用深色档，B 跟页面
```

要写对，注意两件事：

- **`themeScope()` 必须带整份 `ui` token 树**，不能只带几个色值 —— 圆角、字体、控件尺寸都在里面，
  少一半会让作用域里的控件跟外面不一样高（`tests/theme-scope.test.ts` 钉着这条）。
- **先建父容器、再建子组件**。引擎的默认 `zIndex` 是**构造顺序计数器**，而渲染队列是**全局按
  `zIndex` 排序**的 —— 父容器比子组件后构造时 `zIndex` 更高，会把自己的整棵子树盖住
  （画出来一片空白，不报错）。这不是主题的问题，写任何页面都适用。

真机判据：`e2e/theme-scope.spec.ts`（同一个组件分别放进有/无作用域的两块面板，读**画布像素**确认
分属两套主题；切页面主题时只有无作用域那块变），样板页 `examples/theme-scope.html`。

## 九、自己加 token（应用扩展）

token 表是**契约**，不是封闭集合：应用可以往里加自己的颜色，而且**四条路径全认**
（查表 / CSS 变量 / 主题作用域 / 热切换）—— 因为它们都走同一套按路径查制的通用逻辑。

先声明（类型上也要知道它存在），再加：

```ts
// ① 声明合并（放自己的 .d.ts / 入口文件）
declare module 'ice-web-components' {
  interface ICECustomColorTokens {
    'brand-custom': string;
  }
}

// ② 注册一套带自定义 token 的主题
iceUIManager.registerTheme('brand', {
  ...ICE_LIGHT_THEME,
  colors: { ...ICE_LIGHT_THEME.colors, 'brand-custom': '#123456' },
});

// ③ 用起来与内置 token 完全一样
style: { fillStyle: token('ui.colors.brand-custom') }
```

- **为什么不直接给 `colors` 加索引签名**：那样 `colors.texxt` 这种拼写错误也会编译通过
  （等于把类型检查关掉）。声明合并两头都要：**加得进去，也仍然报错拼写**（实测：`primray`
  报 TS2561 并提示"Did you mean 'primary'?"）。
- **CSS 变量自动生成**：`--ice-color-brand-custom`（`themeCssVariables()` 遍历 `colors` 的所有键）。
- 判据：`tests/theme-custom-tokens.test.ts`。

## 十、谁写引擎主题（契约，引擎 2.14 起）

一个画布上可能有**两个来源**都在写引擎主题：UI 主题（本库的 `applyThemeToEngine`）和领域主题
（图表的调色板、设计器的外壳）。引擎 2.14 起把它们分成**两层**，谁写哪层是定死的：

| 层 | 谁写 | 怎么写 |
|---|---|---|
| **基座** | UI 主题 / 应用 | `applyThemeToEngine(ice)`（内部就是 `ice.setTheme()`） |
| **命名补丁** | **领域库** | `ice.setThemePatch('ice-chart', patch)` / `clearThemePatch(id)` |

合成顺序固定为 `基座 → 命名补丁`，所以：**调用顺序无关**、**互不覆盖**；换 UI 主题时领域补丁
**自动重放**。以前两边都直接改实例主题，胜负取决于谁后写 —— 换 UI 主题会把图表主题抹掉，反之亦然。

应用层不需要碰 `setThemePatch`（那是库的活）；**领域库不要再调 `setTheme` / `setChrome`**。
