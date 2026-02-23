# Example

Build the unified provider comparison page:

```bash
npm run build:example:custom-highlight
```

Generated files:

- `example/custom-highlight-provider-matrix.html`
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
- `pre-highlight.js` applies payload `scopeStyles` and can be re-run safely for dynamic previews.
