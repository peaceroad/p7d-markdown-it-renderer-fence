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
   - Uses `splitFenceBlockToLines` to wrap lines and preserve tag balance (line split accepts CRLF/LF/CR).
   - `comment-line` pre-scan is intentionally deferred until after `useHighlightPre` decision.
   - If highlighted output line count does not match source logical line count, `comment-line` markers are skipped to avoid wrong mapping.
6. Render final `<pre><code|samp>` with ordered attrs.

## Options and compatibility notes
- `lineEndSpanThreshold` is the main option; `setLineEndSpan` is an alias.
- `useHighlightPre` keeps highlight-provided `<pre><code>` and disables line-splitting features; `<samp>` conversion is not possible in this mode.
- `setPreWrapStyle` controls inline style output for pre-wrap; data-pre-wrap is still added.
- `comment-line` applies to code blocks and relies on line splitting.
- `setEmphasizeLines: false` now skips `em-lines` parsing on the hot path.
- `comment-line` scanning is skipped when `useHighlightPre` passthrough is active.
- `start` line numbering is activated only for non-negative safe integers (`0` is allowed); invalid/empty values keep `data-pre-start` but do not enable counter style or line-number wrapping.
- Logical line counting for mismatch guards accepts CRLF/LF/CR and is shared for source and highlighted content.
- markdown-it fence `token.content` is effectively LF-normalized; mismatch guard mainly protects against highlighter-side newline transformation.

## Known concerns / trade-offs
- HTML attr parsing uses regex; unusual attribute values with `>` could break parsing.
- `<pre>` detection is a simple substring check; it handles `<pre>`/`<PRE>` but does not parse full HTML.
- Passthrough mode (`useHighlightPre`) skips line-based features by design to avoid HTML breakage.
- `splitFenceBlockToLines` is the heaviest path and runs only when line features are enabled.

## Tests
- highlight.js, shiki inline, shiki classic, shiki classic passthrough, comment lines.
- passthrough test includes wrap + em-lines to verify attribute merging and disabled line-splitting.
- start-invalid fixture verifies `start=""`, non-numeric, and decimal inputs do not activate line-number processing.
- comment-line-mismatch fixture verifies comment marking is skipped when highlighted logical line count diverges from source.
- mixed-newline inline test verifies CRLF/LF mixed markdown still maps line features correctly.
- mixed-newline case is kept inline in `test/test.js` (not file fixture) to avoid Git line-ending normalization masking the scenario.

## Performance workflow
- Benchmark script: `test/performance/benchmark.js`
- Run: `npm run test:performance`
- Highlighter comparison: `test/performance/highlighter-benchmark.js`
- Run: `npm run test:performance:highlighter`
- Optional knobs: `--samples`, `--iterations`, `--warmup`
- The benchmark batches short inputs and reports median/p95 ms-per-render to reduce timer noise.
- For optimization validation, compare `HEAD` and current branch with the same corpus and alternate run order (A/B then B/A) to reduce order bias.

## Highlighter note (current local benchmark)
- In this repository's Node benchmark corpus, `highlight.js` is significantly faster than `shiki` for render throughput.
- `shiki` also has one-time highlighter initialization cost.
- Keep this as an environment-dependent observation; rerun local benchmark before making final defaults.
