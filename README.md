# ice-web-components

> ⚠️ **Just for fun.**  
> This project is created purely for fun and exploration. I am not sure where it
> can be used, and it is not intended as a production-ready or battle-tested
> UI library.

Swing-style Canvas UI components built on `ice-render`.

## Goals

- Keep the `ice-render` component/props/state model.
- Reuse ICE layout managers for UI layout (imported from `ice-render`).
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
# 浏览器端 QA：逐页布局一致性 + 弹出层开关（需要 playwright，可用 PLAYWRIGHT_PATH 指定）
npm run qa:admin
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
`ice-render`), and **the package's runtime exports do not overlap with the engine's
at all** (there is a regression test for it) — you can
`import * as ICE from 'ice-render'` and `import * as W from 'ice-web-components'`
side by side, or name-import from both, without ambiguity:

| concept | this package | `ice-render` |
|---|---|---|
| base class | `ICEWidget` (UI widget base, extends `ICEGroup`) | `ICEComponent` (graphic component base) |
| image | `ICEImageView` (widget, wraps the primitive) | `ICEImage` (image primitive) |

Layout classes are **not** re-exported: `ICEFlowLayout`, `ICEBoxLayout` and the
`ICELayoutManager` type belong to `ice-render`, so import them from there:

```ts
import { ICEFlowLayout } from 'ice-render';
import { ICEPanel } from 'ice-web-components';

panel.setLayout(new ICEFlowLayout({ gap: 8 }));
```

## Colour variants

Status-coloured chips (`ICETag` / `ICEBadge`) default to Bootstrap's solid
`.text-bg-*` look — solid status colour with white text (black text on the light
`warning` / `info` colours). Pass `variant: 'soft'` for the subtle-background
version with a `*-text-emphasis` label:

```ts
new ICETag({ text: 'Paid', status: 'success' }); // solid green, white text
new ICETag({ text: 'Paid', status: 'success', variant: 'soft' }); // #d1e7dd bg, #0a3622 text
```

## Hover

ICE deliberately skips full hit-testing on `mousemove` for performance, so
Canvas components do not receive native `mouseenter`/`mouseleave`. Attach
`ICEHoverManager` once to enable lightweight hover states:

```ts
import { ICEHoverManager } from 'ice-web-components';

new ICEHoverManager(ice).start();
```
