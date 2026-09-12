# ice-web-components

Canvas-native UI components for [`ice-render`](https://github.com/ice-render/ice-render) —
Swing-style widgets with a Bootstrap-flavoured look, rendered entirely on a single
`<canvas>`. No DOM widgets, no CSS framework: every pixel (including popups, focus
rings and shadows) is drawn by the engine.

![ICE Shop admin dashboard](docs/images/admin-dashboard.png)

> ⚠️ **Just for fun.** This project is created purely for fun and exploration. It is
> not intended as a production-ready or battle-tested UI library.

## Highlights

- **89 components** — buttons, inputs, selects, tables, trees, menus, modals,
  drawers, notifications, uploads, date/time pickers, cascader, transfer, carousel,
  colour picker… and the small stuff (tags, badges, avatars, skeletons, spins).
- **One overlay stack for every popup** — Modal / Drawer / Dropdown / Tooltip /
  Popover / Popconfirm / Select / DatePicker / Cascader all go through
  `ICEOverlayManager`: 12 placements, auto flip + clamp to the visible area,
  Esc / outside-click closing, focus trap, enter/exit animation.
- **Forms with sync + async validation** — `ICEFormModel` (required / min / max /
  length / pattern / custom / **asyncValidator**), `ICEFormItem` shows errors and a
  “validating…” state, `submitAsync()` waits for the async rules.
- **Keyboard & focus** — Tab / Shift+Tab rotation, Enter/Space activation,
  arrow keys for sliders, menus, tabs and rate; ring drawn above everything.
- **Bootstrap 5 token theme** (plus a dark theme) — swap with one call.
- **No name collisions with the engine** — the package’s runtime exports are
  disjoint from `ice-render`’s (there is a regression test for it).
- **Actually tested** — 350+ unit tests (form validation, overlay positioning,
  keyboard navigation, sort/hover/focus edge cases) plus `npm run qa:admin`, a real
  browser pass over the demo: layout consistency, every popup layer, zero console
  errors.

## Quick start

> **安装**：引擎 `ice-render` 已经发布到 npm；**组件库本身还没发布**，所以用下面任一种方式装：

```bash
# ① 本地路径（monorepo / workspace 常用）
npm install /path/to/ice-web-components

# ② 直接从 git 安装
npm install git+https://github.com/ice-render/ice-web-components.git

# ③ 先打包再装
(cd /path/to/ice-web-components && npm pack)     # 产出 ice-web-components-0.0.1.tgz
npm install /path/to/ice-web-components-0.0.1.tgz
```

三种方式都会带上依赖 `ice-render@^1.3.0`（从 npm 拉取）。包内只有 `dist/`（cjs + esm + umd + 类型声明）。

```ts
import { ICE } from 'ice-render';
import {
  ICEButton,
  ICEHoverManager,
  ICELabel,
  ICEMessage,
  ICEPanel,
  getICEFocusManager,
} from 'ice-web-components';

const ice = new ICE().init('canvas');
new ICEHoverManager(ice).start();   // canvas has no native hover: opt in
getICEFocusManager(ice).start();    // Tab / Enter / Esc handling

const panel = new ICEPanel({ left: 24, top: 24, width: 372, height: 192 });
panel.addChild(new ICELabel({ left: 24, top: 20, text: 'Quick start' }));

const button = new ICEButton({ left: 24, top: 64, width: 140, text: 'Click me' });
const hint = new ICELabel({ left: 24, top: 112, text: 'clicked 0 times' });
let count = 0;
button.on('click', () => {
  count += 1;
  hint.setText(`clicked ${count} times`);
  ICEMessage.success(ice, `clicked ${count} times`);
});

panel.addChildren([button, hint]);
ice.addChild(panel);
```

![Quick start](docs/images/quick-start.png)

## Documentation

Full docs live in [`docs/`](./docs/README.md):

| | |
|---|---|
| [架构思路](./docs/architecture.md) | 分层、组件模型、渲染与重绘、事件与悬停、浮层/焦点/表单/主题，以及一张“踩坑表” |
| [组件速查](./docs/components.md) | 90 个组件类按分组的一句话说明 + 跳转 API |
| [API 参考](./docs/api/README.md) | 每个组件的构造参数与 public 方法（**从源码生成**，不会漂移） |
| [示例与场景](./docs/guides/examples.md) | 六个示例页分别演示什么、各自用到哪些组件、照着做新场景的清单 |
| [主题与配色](./docs/guides/theming.md) | token 分组、状态色、`*TextEmphasis`、自定义主题 |
| [表单与校验](./docs/guides/forms.md) | 三层结构、规则清单、异步校验、自定义控件接入 |
| [浮层指南](./docs/guides/overlays.md) | 弹窗/抽屉/下拉/提示的三种用法、定位、关闭策略、内容工厂 |
| [画布内布局](./docs/guides/layout.md) | 坐标与 zIndex、簇+货架布局、裁剪与滚动、尺寸时机 |
| [写一个自己的组件](./docs/guides/custom-components.md) | 三档写法、构造约定、交互/表单/浮层/主题接入、类型注册与踩坑 |
| [测试](./docs/guides/testing.md) | 单测套路（假 ICE + 真组件）与浏览器 QA 脚本 |
| [迁移说明](./docs/guides/migration.md) | `UI*` → `ICE*`、业界组件库 → Bootstrap 主题等破坏性变更 |

## Demos

All pages under `examples/` are plain HTML — build the package, then open them
(or serve the folder with any static server).

### `gallery.html` — every component in one page

Rendered with a small hand-rolled flow layout (clusters keep their internal
geometry, clusters wrap like shelves), so adding a demo never requires hunting for
free coordinates.

![Component gallery](docs/images/gallery.png)

### `admin.html` — a six-page back-office

A small “ICE Shop” admin: sidebar with submenus, breadcrumb + page search +
notifications/user menu in the header, a floating action button, a first-run tour,
and six pages that switch inside a scroll pane.

The business flow is deliberately complete: order filtering (keyword / region /
amount range / abnormal-only) with a batch toolbar, an order drawer with
fulfilment steps and a service timeline, inventory warnings with pagination,
product gallery preview, customer insights with satisfaction scoring, a
splitter-based fulfilment workbench with anchors, and a settings pane whose
password form validates across fields.

| Dashboard | Orders |
|---|---|
| ![Dashboard](docs/images/admin-dashboard.png) | ![Orders](docs/images/admin-orders.png) |
| ![Fulfilment](docs/images/admin-fulfillment.png) | ![Products](docs/images/admin-products.png) |
| ![Customers](docs/images/admin-customers.png) | ![Settings](docs/images/admin-settings.png) |

Popup layers used by that demo:

| Order detail drawer | New-order dialog | Notification dropdown |
|---|---|---|
| ![Drawer](docs/images/popup-drawer.png) | ![Modal](docs/images/popup-modal.png) | ![Dropdown](docs/images/popup-dropdown.png) |

### `custom-component.html` — write your own component

The same “write a component and plug it into ICE” story as
[`docs/guides/custom-components.md`](./docs/guides/custom-components.md), but
runnable: a hand-written `ICEMetric` card that reacts to clicks, hover and
keyboard, and participates in `ICEForm` validation.

![Custom component](docs/images/custom-component.png)

### `workbench.html` — customer-support workbench

A second end-to-end scenario (deliberately *not* a dashboard): a three-pane support
workbench built with `ICESplitter` — ticket queue with filters and skeleton loading,
conversation pane with reply composer / quick-reply dropdown / attachment upload /
ticket tags, and a customer profile pane with satisfaction rating, history timeline
and knowledge base. Session log: ticket selection drives the profile, sending a
reply appends a message, the floating button opens a 3-step tour, and the
back-to-top button appears once the conversation scrolls.

![Support workbench](docs/images/workbench.png)

### `windows-xp.html` — a full-screen Windows XP desktop

The fun one: a canvas-only XP desktop — wallpaper, desktop icons, taskbar with a
working clock, a Start menu, and draggable windows with minimise / maximise / close.
Seven tiny apps are wired up (My Computer, My Documents, Notepad, Paint, Minesweeper,
Internet Explorer, Display Properties), and switching the wallpaper in Display
Properties repaints the desktop immediately.

Looks the part too: it switches to the library's built-in `ICE_XP_THEME` (Luna blue +
classic grey controls), draws every icon with engine primitives (no bitmap assets, no
Microsoft artwork), and initialises with `dpr` so text stays crisp on Retina screens.

Minesweeper is the full game: beginner / intermediate / expert, first-click-safe mine
placement, flood fill, right-click flag cycle (🚩 / ❓), chord on double click, LED
counters, a timer that starts on the first click, and per-difficulty best times. Its
rules live in a tested pure model (`ICEMinesweeperModel`) — the UI only draws it.

Internet Explorer is a **real** browser too: the address bar `fetch()`es the URL,
`DOMParser` parses the HTML, and the title / headings / paragraphs / links / images are
drawn with canvas components inside a scroll pane (with back / forward / refresh).
Same-origin pages always work; other sites obey CORS like any browser, and failures
land on an XP-style error page. Serve the folder over http (`npx serve .`) — `fetch`
does not work from `file://`.
Right-click works because `ICE.init()` no longer stops the `contextmenu` event on its
way to the dispatcher (ice-render 1.4.1).

Two new generic components came out of it: `ICEWindow` (window chrome with an XP Luna
title bar, drag, resize, maximise/restore, activate event) and `ICEIconTile`
(selectable icon tile that opens on double click).

![Windows XP desktop](docs/images/xp-desktop.png)

### `tetris.html` — ICE Arcade（掌机上的俄罗斯方块）

第一个“小游戏合集”入口：做的不是网页而是**一台掌机**——机壳、屏幕框、HUD 卡片、
按键、音效开关全是 ICE 组件，游戏规则则是纯逻辑的 `ICETetrisModel`。

规则按现代标准俄罗斯方块：7-bag 公平随机、简易踢墙（0/±1/±2）、幽灵落点、
软降 +1/格、硬降 +2/格、消 1/2/3/4 行 = 100/300/500/800 × 等级、每 10 行升一级
（下落间隔 800ms 起按等级递减）。键盘：`←/→` 移动、`↓` 软降、`空格` 硬降、
`↑`/`X` 顺时针、`Z` 逆时针、`P` 暂停、`R` 重开；切走标签页会自动暂停。

模型和 UI 是彻底分开的：`ICETetrisModel`（81 个用例里的 16 条）不碰 canvas，
页面只负责“读模型 → 画格子”，所以规则可以在 node 里跑测试、也能以后接别的皮肤。

![ICE Arcade tetris](docs/images/tetris.png)

> 这一页**不启动** `ICEFocusManager`：它会用 Enter/Space 激活「有焦点的按钮」，
> 正好和「空格硬降」打架。游戏页把键盘完全留给自己，鼠标 hover 照常接管。

## Components

| Group | Components |
|---|---|
| Basic | `ICEPanel` `ICEButton` `ICELabel` `ICETypography` `ICEIcon` `ICESvgIcon` `ICESeparator` |
| Layout | `ICESpace` `ICEGrid` `ICEGridCol` `ICESplitter` `ICEScrollPane` |
| Data entry | `ICETextField` `ICETextArea` `ICEPasswordField` `ICEInputNumber` `ICESelect` `ICEAutoComplete` `ICECascader` `ICETreeSelect` `ICEDatePicker` `ICETimePicker` `ICECheckBox` `ICECheckboxGroup` `ICERadioButton` `ICERadioGroup` `ICESwitch` `ICESlider` `ICESegmented` `ICERate` `ICEColorPicker` `ICETransfer` `ICEUpload` `ICEForm` `ICEFormItem` |
| Data display | `ICETable` `ICEList` `ICETree` `ICEStatCard` `ICEStatistic` `ICECard` `ICEComment` `ICEDescriptions` `ICETimeline` `ICEProgressBar` `ICEAvatar` `ICEAvatarGroup` `ICETag` `ICEBadge` `ICEImageView` `ICEImagePreview` `ICECalendar` `ICECarousel` `ICECollapse` `ICEWatermark` |
| Feedback & status | `ICEAlert` `ICEModal` `ICEDrawer` `ICEMessage` `ICENotification` `ICETooltip` `ICEPopover` `ICEPopconfirm` `ICETour` `ICEFloatButton` `ICEEmpty` `ICESkeleton` `ICESpin` `ICEResult` `ICESteps` `ICEOverlayManager` |
| Navigation | `ICEMenu` `ICEBreadcrumb` `ICEAnchor` `ICEBackTop` `ICEDropdown` `ICEPagination` `ICETabs` |
| Layout & core | `ICEWidget` `ICEContainer` `ICEHoverManager` `ICEFocusManager` `ICEMessageManager` `ICEManager` (`ICEPainter` / `ICELayoutManager` are types) |
| Models | `ICEButtonModel` `ICEToggleModel` `ICEBoundedRangeModel` `ICESelectionModel` `ICEFormModel` |

Helper functions: `attachTooltip` `attachPopover` `attachPopconfirm` `attachDropdown`
`openModal` `openDrawer` `getICEOverlayManager` `getICEFocusManager` `getICEMessageManager`
`formatStatisticValue` `formatCountdown` `truncateTextLines` `buildMonthGrid` `formatCalendarDate`
`openImagePreview` `tween` `fadeIn` `fadeOut` `slideIn` `scaleIn` and friends.

## Theme

A compact **Bootstrap 5-style** token set (see `ICE_LIGHT_THEME` / `ICE_DARK_THEME`):

- semantic colours — `primary` `#0d6efd`, `success` `#198754`, `warning` `#ffc107`,
  `error` `#dc3545`, `info` `#0dcaf0`;
- subtle pairs for soft surfaces — `primaryBg` / `primaryBorder`, `successBg` /
  `successBorder`, … plus `*TextEmphasis` (Bootstrap’s `*-text-emphasis`) for text
  sitting on those subtle backgrounds;
- neutrals — `surface`, `elevated`, `background`, `border`, `borderSecondary`;
- text hierarchy — `text`, `textSecondary`, `textTertiary`, `textDisabled`;
- spacing / radius / control sizes, Bootstrap’s three shadows (`sm` / `md` / `lg`,
  expressed as explicit `shadowColor` `shadowBlur` `shadowOffset*` numbers), and a
  `focusRing` colour for focused controls.

```ts
import { iceUIManager } from 'ice-web-components';

iceUIManager.setTheme('dark'); // components read tokens when they are created
```

Status chips default to Bootstrap’s solid `.text-bg-*` look (white text, black text
on the light `warning` / `info` colours). Pass `variant: 'soft'` for the subtle
background + emphasis text variant:

```ts
new ICETag({ text: 'Paid', status: 'success' });                     // solid green
new ICETag({ text: 'Paid', status: 'success', variant: 'soft' });    // #d1e7dd / #0a3622
```

## Naming & exports

Everything exported by this package uses the **`ICE`** prefix (same convention as
`ice-render`), and the package’s runtime exports do **not overlap** with the
engine’s — you can import both namespaces, or name-import from both, without
ambiguity:

| concept | this package | `ice-render` |
|---|---|---|
| base class | `ICEWidget` (UI widget base, extends `ICEGroup`) | `ICEComponent` (graphic component base) |
| image | `ICEImageView` (widget, wraps the primitive) | `ICEImage` (image primitive) |

Layout classes are **not** re-exported — they belong to the engine:

```ts
import { ICEFlowLayout } from 'ice-render';
import { ICEPanel } from 'ice-web-components';

panel.setLayout(new ICEFlowLayout({ gap: 8 }));
```

## Interaction notes

- **Hover** — ICE deliberately skips full hit-testing on `mousemove`, so canvas
  components have no native `mouseenter` / `mouseleave`. Attach
  `new ICEHoverManager(ice).start()` once and components get lightweight hover
  states (table rows, menu/tree items, buttons, chips…).
- **Popups** — always open through `getICEOverlayManager(ice)`; overlay content is
  mounted on the engine’s tool layer, so it renders above the scene, follows the
  anchor, and is excluded from scene hit-testing.
- **Focus** — `getICEFocusManager(ice).start()` gives Tab / Shift+Tab rotation,
  Enter/Space activation, and a ring drawn on the tool layer. The ring follows
  `:focus-visible` semantics: it only appears for **keyboard** focus, so mouse
  clicks and thumb drags stay clean. Text-entry controls (text field, number,
  select, date/time/cascader, colour picker…) opt into `focusRing: 'always'`;
  any component can declare `focusRing: 'keyboard' | 'always' | 'never'` (or
  `setFocusRingMode()`). Overlays that own the keyboard declare `keyboardCaptured`
  so the scene yields Enter/Space.
- **Rendering pitfalls worth knowing** — the engine sorts by **global zIndex**
  (creation order), so build containers before their children; components that wrap
  caller-provided nodes (carousel slides, card `extra`, modal content) raise those
  subtrees above themselves.
- **Container hit-testing** — a container that is created *after* its children and
  stays interactive will swallow every click inside it (`ICESplitter` and plain
  layout wrappers therefore ship with `interactive: false`; if you build your own
  wrapper, do the same).
- **Focus ring vs. hit-testing** — the two rules above bite together: a form item
  wrapper left interactive hides its own input from `ice.hitTest()`, so the focus
  manager can't focus it (no ring, and `getFocused()` returns null while the field
  still accepts typing through its own point-in-box check). `ICEFormItem`,
  `ICEForm`, `ICESpace`, `ICEGrid` and `ICESplitter` are all `interactive: false`.
- **Text input & IME** — canvas text fields handle per-key `keydown` (ASCII letters,
  digits, backspace…). IME composition (Chinese / Japanese input) is not wired yet,
  so CJK text currently has to go through `setValue()`.

## Development

```bash
npm install
npm run types:check      # tsc --noEmit
npm test                 # jest (unit tests, node env)
npm run build            # cjs + esm + umd + d.ts

# browser QA for examples/admin.html: layout consistency + popup open/close
# (needs playwright; point PLAYWRIGHT_PATH at an existing install if needed)
npm run qa:admin

# browser QA for examples/gallery.html: zero overlap + real interactions of the
# newest components (breadcrumb collapse, countdown, radio/checkbox groups,
# splitter drag, watermark tiling)
npm run qa:gallery

# browser QA for examples/workbench.html: queue → profile, reply composer,
# quick replies, tags/rating, tour, back-to-top, splitter drag
npm run qa:workbench

# browser QA for examples/windows-xp.html: icons, windows (drag/minimise/restore),
# start menu, minesweeper, paint strokes, wallpaper switch, clock
npm run qa:xp

# browser QA for examples/tetris.html: keyboard-driven play (move / rotate / soft &
# hard drop / pause / line clear / game over / restart) + real clicks on the HUD
npm run qa:tetris

# 文档：重新生成 API 参考并检查链接
npm run docs
```

`npm run qa:admin` drives a real browser: it asserts every page has zero overlapping
top-level nodes and identical first-element offsets, opens every popup layer and
asserts it can be closed again, checks that clicking an in-row action button does
not select the row, then walks the business scenario — breadcrumb follows the page,
the floating button opens the tour, the back-to-top button returns to the top, the
inventory table pages, the order queue drives the detail pane, anchors scroll the
detail, the image preview opens/zooms, and the settings password form revalidates
across fields. Every popup is screenshotted to `/tmp/qa-*.png`, and any console
error fails the run.

`npm run qa:gallery` does the same for the full gallery page with real mouse
events (hit-test path): it asserts no two top-level clusters overlap, drives the
breadcrumb collapse, the radio / checkbox groups, drags the splitter divider and
checks the watermark tiling, then screenshots to `/tmp/qa-gallery*.png`.

`npm run qa:workbench` covers the support workbench (queue → profile, reply composer,
quick replies, tags, rating, tour, back-to-top, splitter drag) and `npm run qa:xp`
covers the Windows XP desktop: icons, window drag/minimise/restore, Start menu,
Minesweeper (first-click-safe, flag cycle, difficulty, timer, win), the Paint canvas,
the wallpaper switch, the clock — and the IE window really fetching pages (plus its
404 page, back button, `about:xp` table and bookmarks). `qa:xp` starts a small static
server itself, because `fetch` does not work from `file://`.

`npm run qa:tetris` plays the arcade page with **real key presses**: arrows move and
rotate the piece, `Space` hard-drops, `P` pauses (and it asserts gravity really stops),
then it builds a deterministic board to force a line clear, keeps dropping until
game over (best score lands in `localStorage`), restarts with `R`, and clicks the
HUD buttons / sound switch with the mouse. Layout assertions keep the board inside
the screen bezel and the panels from overlapping.

See [ROADMAP.md](./ROADMAP.md) for the component backlog and what is still missing
per component.

## License

[MIT](./LICENSE)
