# AGENTS.md

This file summarizes the current renderer-fence workflow and known concerns.

## Current workflow (index.js)
1. Parse fence info string and attrs (`{...}`) and merge into token attrs.
2. Normalize attrs:
   - Add language class (`langPrefix + lang`) unless `samp`.
   - Normalize `start`/`pre-start` -> `data-pre-start` and append counter-set style.
   - Normalize `em-lines`/`emphasize-lines` -> `data-pre-emphasis`.
   - Normalize `wrap`/`pre-wrap` -> `data-pre-wrap` + optional inline `preWrapStyle`.
   - Normalize `comment-line` -> `data-pre-comment-line` for comment markers.
3. Highlight:
   - If `setHighlight` and `md.options.highlight` are enabled, call highlight.
   - Otherwise escape HTML.
4. If highlight output contains `<pre><code>`:
   - Parse and merge code attrs into token attrs.
   - Parse and merge pre attrs into `preAttrs`.
   - If `useHighlightPre` is true and parsing fails but `<pre>` exists, passthrough the highlight output as-is.
5. Apply line features (only when not in highlight-pre passthrough):
   - `setLineNumber`, `setEmphasizeLines`, `lineEndSpanThreshold`, `comment-line`.
   - Uses `splitFenceBlockToLines` to wrap lines and preserve tag balance.
6. Render final `<pre><code|samp>` with ordered attrs.

## Options and compatibility notes
- `lineEndSpanThreshold` is the main option; `setLineEndSpan` is an alias.
- `useHighlightPre` keeps highlight-provided `<pre><code>` and disables line-splitting features; `<samp>` conversion is not possible in this mode.
- `setPreWrapStyle` controls inline style output for pre-wrap; data-pre-wrap is still added.
- `comment-line` applies to code blocks and relies on line splitting.

## Known concerns / trade-offs
- HTML attr parsing uses regex; unusual attribute values with `>` could break parsing.
- `<pre>` detection is a simple substring check; it handles `<pre>`/`<PRE>` but does not parse full HTML.
- Passthrough mode (`useHighlightPre`) skips line-based features by design to avoid HTML breakage.
- `splitFenceBlockToLines` is the heaviest path and runs only when line features are enabled.

## Tests
- highlight.js, shiki inline, shiki classic, shiki classic passthrough, comment lines.
- passthrough test includes wrap + em-lines to verify attribute merging and disabled line-splitting.
