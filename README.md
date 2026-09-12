# ice-web-components

> ⚠️ **Just for fun.**  
> This project is created purely for fun and exploration. I am not sure where it
> can be used, and it is not intended as a production-ready or battle-tested
> UI library.

Swing-style Canvas UI components built on `ice-render`.

## Goals

- Keep the `ice-render` component/props/state model.
- Reuse ICE layout managers for UI layout.
- Provide Swing-like classes: `ICEComponent`, `ICEContainer`, `ICEManager`, and
  `ICEPainter`.
- Build Canvas-native UI components such as `ICELabel`, `ICEButton`, and
  `ICEPanel`.
- Provide admin-oriented components such as `ICETable`, `ICEMenu`,
  `ICETextField`, `ICEAlert`, and `ICEStatCard`.

See [ROADMAP.md](./ROADMAP.md) for the component backlog (业界组件库 对照表)
and the foundations still to build (scroll container, focus/keyboard, forms).

## Commands

```bash
npm install
npm run types:check
npm test
npm run build
```

## Example

After building, open the pages under `examples/` with a static server.

`examples/gallery.html` shows the default light theme across all current components.

`examples/admin.html` is a larger admin-dashboard-style composition using the
current component set.

## Theme

`ice-web-components` uses a compact **Bootstrap 5-style** token set:

- seed colours: `primary` `#0d6efd`, `success` `#198754`, `warning` `#ffc107`,
  `error` `#dc3545`, `info` `#0dcaf0`
- subtle pairs for filled-soft surfaces: `primaryBg`/`primaryBorder`, `successBg`/
  `successBorder`, … plus `*TextEmphasis` (Bootstrap's `*-text-emphasis`) for text
  sitting on those subtle backgrounds
- neutral surfaces: `surface`, `elevated`, `border`, `borderSecondary`
- text hierarchy: `text`, `textSecondary`, `textTertiary`, `textDisabled`
- spacing/radius/control sizes and the three Bootstrap shadows (`sm`/`md`/`lg`,
  given as explicit `shadowColor/shadowBlur/shadowOffset*` numbers)

Switch the global theme with:

```ts
import { iceUIManager } from 'ice-web-components';

iceUIManager.setTheme('dark');
```

Components read tokens from `iceUIManager.getTheme()` when they are created. The
light theme is `ICE_LIGHT_THEME` and the dark theme is `ICE_DARK_THEME`.

## Naming

Everything exported by this package uses the **`ICE`** prefix (same convention as
`ice-render`). Two names intentionally collide with engine exports, because both
packages describe the same concept with the same word:

| this package | `ice-render` |
|---|---|
| `ICEComponent` (UI component base, extends `ICEGroup`) | `ICEComponent` (graphic component base) |
| `ICEImage` (image widget, wraps the engine primitive) | `ICEImage` (image primitive) |

Import them from one package, or alias one side when you need both:

```ts
import { ICEComponent as EngineComponent } from 'ice-render';
import { ICEComponent } from 'ice-web-components';
```

`ICEFlowLayout`, `ICEBoxLayout` and the `ICELayoutManager` type are **re-exported
from `ice-render`** (identical classes), so those three names never differ
between packages.

## Hover

ICE deliberately skips full hit-testing on `mousemove` for performance, so
Canvas components do not receive native `mouseenter`/`mouseleave`. Attach
`ICEHoverManager` once to enable lightweight hover states:

```ts
import { ICEHoverManager } from 'ice-web-components';

new ICEHoverManager(ice).start();
```
