# ice-web-components

> ⚠️ **Just for fun.**  
> This project is created purely for fun and exploration. I am not sure where it
> can be used, and it is not intended as a production-ready or battle-tested
> UI library.

Swing-style Canvas UI components built on `ice-render`.

## Goals

- Keep the `ice-render` component/props/state model.
- Reuse ICE layout managers for UI layout.
- Provide Swing-like classes: `UIComponent`, `UIContainer`, `UIManager`, and
  `UIPainter`.
- Build Canvas-native UI components such as `UILabel`, `UIButton`, and
  `UIPanel`.

## Commands

```bash
npm install
npm run types:check
npm test
npm run build
```

## Example

After building, open `examples/basic.html` with a static server.

`examples/gallery.html` shows the default light theme across all current components.

## Theme

`ice-web-components` uses a compact 业界组件库-style token set:

- seed colours: `primary`, `success`, `warning`, `error`, `info`
- neutral surfaces: `surface`, `elevated`, `border`, `borderSecondary`
- text hierarchy: `text`, `textSecondary`, `textTertiary`, `textDisabled`
- spacing/radius/control sizes and shadow presets

Switch the global theme with:

```ts
import { uiManager } from 'ice-web-components';

uiManager.setTheme('dark');
```

Components read tokens from `uiManager.getTheme()` when they are created. The
light theme is `UI_LIGHT_THEME` and the dark theme is `UI_DARK_THEME`.

## Hover

ICE deliberately skips full hit-testing on `mousemove` for performance, so
Canvas components do not receive native `mouseenter`/`mouseleave`. Attach
`UIHoverManager` once to enable lightweight hover states:

```ts
import { UIHoverManager } from 'ice-web-components';

new UIHoverManager(ice).start();
```
