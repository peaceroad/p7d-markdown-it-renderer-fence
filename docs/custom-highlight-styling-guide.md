# Custom Highlight Styling Guide

This is a practical user guide for API mode styling.

## 1. First Decision

- Recommended default for most users: `markup` mode.
- Use API mode only when you need browser-side Custom Highlight API ranges.

Defaults:

- renderer default: `highlightRenderer: 'markup'`
- API provider default: `customHighlight.provider: 'shiki'`
- Shiki scope mode default: `customHighlight.shikiScopeMode: 'auto'`
- payload style default: `customHighlight.includeScopeStyles: true`

## 2. Where API-Mode Color Comes From

The plugin does not auto-load any CSS file.

In API mode, color comes from one of these:

1. Embedded payload styles (`scopeStyles`) when `includeScopeStyles: true`
2. Your external `::highlight(...)` CSS when `includeScopeStyles: false`

`docs/default-highlight-theme.css` is an optional preset sample only.

## 3. Recommended Production Profile

Use CSS-managed keyword buckets:

```js
customHighlight: {
  provider: 'shiki',
  shikiScopeMode: 'keyword',
  includeScopeStyles: false
}
```

Why this is recommended:

- stable scope names across code blocks/languages
- easier light/dark control with CSS variables
- no large per-block style payloads

## 4. Shiki Scope Modes

### `shikiScopeMode: 'color'`

- scope name is color-derived (example: `hl-shiki-24292e-f0`)
- best for one fixed theme output
- weak for long-term CSS governance

### `shikiScopeMode: 'semantic'`

- scope name is TextMate-like semantic scope (example: `hl-shiki-storage-type-js`)
- useful for inspection and detailed mapping
- more granular and harder to maintain as a global design token set

### `shikiScopeMode: 'keyword'`

- scope name is plugin bucket name (example: `hl-shiki-keyword`, `hl-shiki-number`)
- best for project-wide CSS control and light/dark theming

## 5. Light/Dark Operation

### Pattern A: CSS-managed (recommended)

1. set `includeScopeStyles: false`
2. style scopes in external CSS
3. use `prefers-color-scheme` / CSS variables

### Pattern B: payload-embedded

- set `includeScopeStyles: true`
- optionally set `customHighlight.theme`
- styles are generated at render time for that theme

Note:

- `customHighlight.theme` is passed to Shiki `codeToTokens(...)`
- if `theme` is omitted, behavior depends on your Shiki highlighter setup
- payload-embedded mode is single-theme per render output

## 6. highlight.js Provider in API Mode

- provider: `customHighlight.provider: 'hljs'`
- scope names are hljs-derived (example: `hl-hljs-keyword`)
- `scopeStyles` is usually not emitted
- external `::highlight(...)` CSS is expected

For markup mode, continue to use official highlight.js theme CSS as usual.

## 7. Supported CSS Properties in `::highlight(...)`

In current browser behavior, only a subset is reliable.
This plugin emits/uses:

- `color`
- `background-color`
- `text-decoration`
- `text-shadow`

Not relied on:

- `font-style`
- `font-weight`

So full span-level visual parity (especially italic/bold themes) is not guaranteed in API mode.

## 8. CLI / Script-Based Color Control

This plugin does not ship a standalone CLI.

You still control color in script-driven flows (build scripts, watchers, editor extension host) via options:

- `customHighlight.provider`
- `customHighlight.theme`
- `customHighlight.shikiScopeMode`
- `customHighlight.includeScopeStyles`

Not directly supported by one plugin option:

- per-bucket literal color assignment like `keyword=#ff0000`
- automatic full stylesheet generation from one flag

## 9. Preset CSS Provenance and License

`docs/default-highlight-theme.css` is a repository preset for quick start.

Palette basis:

- highlight.js `github.css` (light)
- highlight.js `github-dark.css` (dark)

License/provenance references:

- `node_modules/highlight.js/styles/github.css`
- `node_modules/highlight.js/styles/github-dark.css`
- `node_modules/highlight.js/LICENSE` (BSD-3-Clause)
