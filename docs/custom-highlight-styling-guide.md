# Custom Highlight Styling Guide

This guide explains practical styling choices for `highlightRenderer: 'api'`.

## 1. Choose Your Mode First

- Most users should stay on `markup` mode.
- Use API mode only when you need browser runtime ranges (`CSS.highlights`) and custom runtime control.

Runtime note:

- API mode requires browser-side apply (`applyCustomHighlights` or `observeCustomHighlights`).
- `test/custom-highlight/pre-highlight.js` is a demo helper, not the package runtime API contract.
- runtime-only import path is `@peaceroad/markdown-it-renderer-fence/custom-highlight-runtime`.
- markdown-it render itself does not emit runtime JS files; CLI/static generators should output a small runtime bridge asset separately.

## 2. Where API-Mode Colors Come From

In API mode, color comes from one of two sources:

1. payload `scopeStyles` (`customHighlight.includeScopeStyles: true`)
2. external `::highlight(...)` CSS (`customHighlight.includeScopeStyles: false`)

The plugin does not auto-load theme CSS files.

## 3. Recommended Profiles

### Profile A (recommended for production)

Use CSS-managed keyword buckets:

```js
customHighlight: {
  provider: 'shiki',
  shikiScopeMode: 'keyword',
  includeScopeStyles: false,
}
```

Why:

- stable scope names (`hl-shiki-keyword`, `hl-shiki-string`, ...)
- easiest light/dark control with CSS variables and media queries
- smaller payloads

### Profile B (theme-faithful embedded colors)

Use Shiki color scopes with embedded styles:

```js
customHighlight: {
  provider: 'shiki',
  shikiScopeMode: 'color',
  includeScopeStyles: true,
  theme: {
    light: 'github-light',
    dark: 'github-dark',
    default: 'light',
  },
}
```

Use this only when you need self-contained per-theme styles in payloads.

## 4. Shiki Scope Modes

### `shikiScopeMode: 'color'`

- scope name is color-derived
- closest to selected Shiki theme output
- less maintainable for long-term CSS governance

### `shikiScopeMode: 'semantic'`

- scope name is TextMate-like semantic scope
- useful for analysis and fine-grained mapping
- usually more complex than needed for site-wide design tokens

### `shikiScopeMode: 'keyword'`

- scope name is plugin bucket name
- best for long-term CSS-managed theming

## 5. Light/Dark Behavior (Important)

### Initial apply

- `applyCustomHighlights(root, { colorScheme: 'auto' })` resolves current scheme at apply time.

### After page is already open and OS/browser theme changes

- `applyCustomHighlights(...)` does not automatically rerun by itself.
- You need either:
  1. explicit re-apply call, or
  2. observer with color-scheme watch.

Example with automatic watch:

```js
const lazy = observeCustomHighlights(document, {
  applyOptions: { colorScheme: 'auto', incremental: true },
  watchColorScheme: true,
})
```

With `watchColorScheme: true`, after the first apply, `prefers-color-scheme` changes trigger re-apply.

## 6. Theme Option Shapes

`customHighlight.theme` supports:

- `string` (single-theme payload)
- `{ light, dark, default? }` (dual-theme payload with additive `v:1` fields)

Notes:

- object form runs Shiki tokenization twice (`light` + `dark`)
- payload size can grow (especially in `shikiScopeMode: 'color'`)

## 7. Runtime and CSS Constraints

`::highlight(...)` reliably supports only a subset of properties.
This plugin emits/uses:

- `color`
- `background-color`
- `text-decoration`
- `text-shadow`

Do not expect full token-span parity for properties like:

- `font-style`
- `font-weight`

## 8. highlight.js Provider Notes

For `customHighlight.provider: 'hljs'`:

- scope names are hljs-derived (`hl-hljs-*`)
- `scopeStyles` is typically not emitted
- external `::highlight(...)` CSS is the standard approach

For normal markup highlighting with highlight.js, continue using highlight.js theme CSS.

## 9. Preset CSS Provenance

`docs/default-highlight-theme.css` is an optional repository preset.

Palette basis:

- highlight.js `github.css`
- highlight.js `github-dark.css`

License reference:

- `node_modules/highlight.js/LICENSE` (BSD-3-Clause)
