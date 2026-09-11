# ice-web-components

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
