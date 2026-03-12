# Example

Build the unified provider comparison page:

```bash
npm run build:example:custom-highlight
```

Generated files:

- `example/custom-highlight-provider-matrix.html`
- `example/line-number.css`
- `example/line-number-sample.html`
- `example/pre-highlight.js`

This page compares the same language samples across:

- API: Shiki (`color`)
- API: Shiki (`semantic`)
- API: Shiki (`keyword`)
- API: highlight.js provider
- Markup: shiki-inside
- Markup: highlight.js

Notes:

- API `highlight.js provider` styles are generated from `highlight.js/styles/github.css` (theme-driven), not a hand-written palette map.
- `line-number-sample.html` is a small static sample for the line-number contract and shows Markdown input, rendered preview, and emitted HTML side by side.
- `pre-highlight.js` applies payload `scopeStyles` and can be re-run safely for dynamic previews.
- `line-number.css` is a clean reference stylesheet for line-number output (`start`, `line-number-skip`, `line-number-set`) and follows the README counter contract (`counter-set` is the displayed value, increment runs in `.pre-line::after`).
