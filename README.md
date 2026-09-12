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

## Quick start

```bash
npm install ice-render ice-web-components
```

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

## Demos

Both pages under `examples/` are plain HTML — build the package, then open them
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

## Components

| Group | Components |
|---|---|
| Basic | `ICEPanel` `ICEButton` `ICELabel` `ICEIcon` `ICESvgIcon` `ICESeparator` |
| Data entry | `ICETextField` `ICETextArea` `ICEPasswordField` `ICEInputNumber` `ICESelect` `ICEAutoComplete` `ICECascader` `ICETreeSelect` `ICEDatePicker` `ICETimePicker` `ICECheckBox` `ICERadioButton` `ICESwitch` `ICESlider` `ICESegmented` `ICERate` `ICEColorPicker` `ICETransfer` `ICEUpload` `ICEForm` `ICEFormItem` |
| Data display | `ICETable` `ICEList` `ICETree` `ICEStatCard` `ICECard` `ICEComment` `ICEDescriptions` `ICETimeline` `ICEProgressBar` `ICEAvatar` `ICEAvatarGroup` `ICETag` `ICEBadge` `ICEImageView` `ICECarousel` `ICECollapse` |
| Feedback & status | `ICEAlert` `ICEModal` `ICEDrawer` `ICEMessage` `ICENotification` `ICETooltip` `ICEPopover` `ICEPopconfirm` `ICEEmpty` `ICESkeleton` `ICESpin` `ICEResult` `ICESteps` `ICEOverlayManager` |
| Navigation | `ICEMenu` `ICEDropdown` `ICEPagination` `ICETabs` |
| Layout & core | `ICEWidget` `ICEContainer` `ICEScrollPane` `ICEHoverManager` `ICEFocusManager` `ICEMessageManager` `ICEManager` (`ICEPainter` / `ICELayoutManager` are types) |
| Models | `ICEButtonModel` `ICEToggleModel` `ICEBoundedRangeModel` `ICESelectionModel` `ICEFormModel` |

Helper functions: `attachTooltip` `attachPopover` `attachPopconfirm` `attachDropdown`
`openModal` `openDrawer` `getICEOverlayManager` `getICEFocusManager` `getICEMessageManager`
`tween` `fadeIn` `fadeOut` `slideIn` `scaleIn` and friends.

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
```

`npm run qa:admin` drives a real browser: it asserts every page has zero overlapping
top-level nodes and identical first-element offsets, opens every popup layer and
asserts it can be closed again, checks that clicking an in-row action button does
not select the row, screenshots each popup to `/tmp/qa-*.png`, and fails on any
console error.

See [ROADMAP.md](./ROADMAP.md) for the component backlog and what is still missing
per component.

## License

[MIT](./LICENSE)
