# Example

Build the unified provider comparison page:

```bash
npm run build:example:custom-highlight
```

Generated files:

- `example/custom-highlight-provider-matrix.html`
- `example/line-number.css`
- `example/line-number-sample.html`
- `example/line-notes.css`
- `example/line-notes-sample.html`
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
- `line-notes-sample.html` is a small static sample for sidecar `line-notes` / `notes` syntax and shows Markdown input, rendered preview, and emitted HTML side by side.
- `pre-highlight.js` applies payload `scopeStyles` and can be re-run safely for dynamic previews.
- `line-number.css` is a clean reference stylesheet for line-number output (`start`, `line-number-skip`, `line-number-set`) and follows the README counter contract (`counter-set` is the displayed value, increment runs in `.pre-line::after`).
- `line-notes.css` is a companion stylesheet for the external `pre-wrapper-line-notes` / `pre-line-note-layer` contract. It renders notes below the block by default and upgrades to CSS anchor positioning when the block is marked with `data-pre-line-notes-layout="anchor"`. The reference stylesheet defaults `--line-note-width` to `14rem`, which keeps short inline notes readable without stealing too much room from medium-length code lines.
- The reference anchor layout keeps a small default block-end reserve (`--line-note-anchor-padding-block-end`) so wrapped anchored notes are less likely to feel clipped in scrollable previews, without growing ordinary blocks too aggressively.
- In the below-block fallback, the reference CSS treats notes as a compact line-labeled list under the code block (`line 2`, `line 3-4`) and uses only a small label chip instead of separate boxed callouts or divider rules.
- Per-note width can be demonstrated with trailing attr syntax such as `5: cache lookup key {width="8rem"}`. For multiline notes, prefer a trailing attrs-only continuation line such as `  {width="11rem"}`; `--line-note-width` remains the block-level default.
- The sample preview keeps a fixed 720px note layout and scrolls horizontally on narrow screens so mobile inspection can still check the right-side anchored presentation.
