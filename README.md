# ice-web-components

Canvas-native UI components for [`ice-render`](https://github.com/ice-render/ice-render) —
Swing-style widgets with a Bootstrap-flavoured look, rendered entirely on a single
`<canvas>`. No DOM widgets, no CSS framework: every pixel (including popups, focus
rings and shadows) is drawn by the engine.

![ICE Shop admin dashboard](docs/images/admin-dashboard.png)

> ⚠️ **Just for fun.** This project is created purely for fun and exploration. It is
> not intended as a production-ready or battle-tested UI library.

## Highlights

- **60+ components** — buttons, inputs, selects, tables, trees, menus, modals,
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
| [组件速查](./docs/components.md) | 60+ 组件按分组的一句话说明 + 跳转 API |
| [API 参考](./docs/api/README.md) | 每个组件的构造参数与 public 方法（**从源码生成**，不会漂移） |
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

### `admin.html` — a five-page back-office

A small “ICE Shop” admin: sidebar with submenus, header search/notifications/user
menu, and five pages that switch inside a scroll pane.

| Dashboard | Orders |
|---|---|
| ![Dashboard](docs/images/admin-dashboard.png) | ![Orders](docs/images/admin-orders.png) |
| ![Products](docs/images/admin-products.png) | ![Customers](docs/images/admin-customers.png) |
| ![Settings](docs/images/admin-settings.png) | |

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

## Components

| Group | Components |
|---|---|
| Basic | `ICEPanel` `ICEButton` `ICELabel` `ICEIcon` `ICESvgIcon` `ICESeparator` |
| Data entry | `ICETextField` `ICETextArea` `ICEPasswordField` `ICEInputNumber` `ICESelect` `ICEAutoComplete` `ICECascader` `ICETreeSelect` `ICEDatePicker` `ICETimePicker` `ICECheckBox` `ICECheckboxGroup` `ICERadioButton` `ICERadioGroup` `ICESwitch` `ICESlider` `ICESegmented` `ICERate` `ICEColorPicker` `ICETransfer` `ICEUpload` `ICEForm` `ICEFormItem` |
| Data display | `ICETable` `ICEList` `ICETree` `ICEStatCard` `ICEStatistic` `ICECard` `ICEComment` `ICEDescriptions` `ICETimeline` `ICEProgressBar` `ICEAvatar` `ICEAvatarGroup` `ICETag` `ICEBadge` `ICEImageView` `ICECarousel` `ICECollapse` `ICEWatermark` |
| Feedback & status | `ICEAlert` `ICEModal` `ICEDrawer` `ICEMessage` `ICENotification` `ICETooltip` `ICEPopover` `ICEPopconfirm` `ICEEmpty` `ICESkeleton` `ICESpin` `ICEResult` `ICESteps` `ICEOverlayManager` |
| Navigation | `ICEMenu` `ICEBreadcrumb` `ICEDropdown` `ICEPagination` `ICETabs` |
| Layout & core | `ICEWidget` `ICEContainer` `ICEScrollPane` `ICESplitter` `ICEHoverManager` `ICEFocusManager` `ICEMessageManager` `ICEManager` (`ICEPainter` / `ICELayoutManager` are types) |
| Models | `ICEButtonModel` `ICEToggleModel` `ICEBoundedRangeModel` `ICESelectionModel` `ICEFormModel` |

Helper functions: `attachTooltip` `attachPopover` `attachPopconfirm` `attachDropdown`
`openModal` `openDrawer` `getICEOverlayManager` `getICEFocusManager` `getICEMessageManager`
`formatStatisticValue` `formatCountdown` `tween` `fadeIn` `fadeOut` `slideIn` `scaleIn` and friends.

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
  Enter/Space activation, and a ring drawn on the tool layer. Overlays that own the
  keyboard declare `keyboardCaptured` so the scene yields Enter/Space.
- **Rendering pitfalls worth knowing** — the engine sorts by **global zIndex**
  (creation order), so build containers before their children; components that wrap
  caller-provided nodes (carousel slides, card `extra`, modal content) raise those
  subtrees above themselves.

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

# 文档：重新生成 API 参考并检查链接
npm run docs
```

`npm run qa:admin` drives a real browser: it asserts every page has zero overlapping
top-level nodes and identical first-element offsets, opens every popup layer and
asserts it can be closed again, checks that clicking an in-row action button does
not select the row, screenshots each popup to `/tmp/qa-*.png`, and fails on any
console error.

`npm run qa:gallery` does the same for the full gallery page with real mouse
events (hit-test path): it asserts no two top-level clusters overlap, drives the
breadcrumb collapse, the radio / checkbox groups, drags the splitter divider and
checks the watermark tiling, then screenshots to `/tmp/qa-gallery*.png`.

See [ROADMAP.md](./ROADMAP.md) for the component backlog and what is still missing
per component.

## License

[MIT](./LICENSE)
