# AGENTS.md

This file summarizes the current renderer-fence workflow and known concerns.

## Current workflow (entry split)
Architecture:
- `index.js` is a compatibility dispatcher (`highlightRenderer` -> markup/custom-highlight entry).
  - compat entry imports both paths; use subpath import when strict load isolation is needed.
- `src/entry/markup-highlight.js` is markup-only entry (does not import custom-highlight runtime/provider code).
- `src/entry/custom-highlight.js` is custom-highlight mode entry (re-exports runtime/payload helpers).
- `src/fence/render-shared.js` contains shared fence normalization/line-splitting/timing helpers.
- `src/fence/render-markup.js` contains markup rendering path.
- `src/fence/render-api.js` contains API mode + runtime helper implementation.

Plugin flow:
1. Parse fence info string and attrs (`{...}`) and merge into token attrs.
2. Normalize attrs:
   - Add language class (`langPrefix + lang`) unless `samp`.
   - Normalize `start`/`pre-start` -> `data-pre-start` and append counter-set style.
   - Normalize `em-lines`/`emphasize-lines` -> `data-pre-emphasis`.
   - Normalize `wrap`/`pre-wrap` -> `data-pre-wrap` + optional inline `preWrapStyle`.
   - Normalize `comment-line` -> `data-pre-comment-line` for comment markers.
3. Render mode branch:
   - `highlightRenderer: 'api'`:
     - Build payload ranges via `customHighlight.provider` (`shiki` via `highlighter.codeToTokens`, or `custom` via `getRanges`).
     - Sanitize scope names for `CSS.highlights` and emit payload via `transport` (`env` / `inline-script`).
     - Render escaped code HTML (token spans are not emitted).
     - On provider errors, fallback by `customHighlight.fallback` (`plain` / `markup`).
   - `highlightRenderer: 'markup'` (default):
     - If `setHighlight` and `md.options.highlight` are enabled, call highlight.
     - Otherwise escape HTML.
4. Markup mode `<pre><code>` wrapper handling:
   - If highlight output contains `<pre><code>`, parse and merge code attrs into token attrs and pre attrs into `preAttrs`.
   - If `useHighlightPre` is true and parsing fails but `<pre>` exists, passthrough the highlight output as-is.
5. Apply line features:
   - In markup mode: only when not in highlight-pre passthrough.
   - In api mode: line features are represented as payload ranges (`em-lines`, `comment-line`), and optional structural spans are controlled by `customHighlight.lineFeatureStrategy`.
   - `setLineNumber`, `setEmphasizeLines`, `lineEndSpanThreshold`, `comment-line`.
   - Uses `splitFenceBlockToLines` to wrap lines and preserve tag balance (line split accepts CRLF/LF/CR).
   - `comment-line` pre-scan is intentionally deferred until after `useHighlightPre` decision.
   - If highlighted output line count does not match source logical line count, `comment-line` markers are skipped to avoid wrong mapping.
6. Render final `<pre><code|samp>` with ordered attrs.

## Options and compatibility notes
- Package exports now provide explicit entrypoints:
  - `@peaceroad/markdown-it-renderer-fence` (compat dispatcher)
  - `@peaceroad/markdown-it-renderer-fence/markup-highlight` (markup-only load path)
  - `@peaceroad/markdown-it-renderer-fence/custom-highlight` (custom-highlight mode load path)
- `lineEndSpanThreshold` is the main option; `setLineEndSpan` is an alias.
- `highlightRenderer` supports `'markup'` (default) and `'api'`.
- `customHighlight.provider`:
  - `shiki`: requires `customHighlight.highlighter.codeToTokens`, and it must be synchronous.
  - `hljs`: uses `customHighlight.hljsHighlight` (or `customHighlight.highlight`, or `md.options.highlight`) and supports highlight.js result object (`_emitter`) or HTML string result.
  - `custom`: requires synchronous `customHighlight.getRanges` (escape hatch for precomputed/custom ranges).
- `customHighlight.transport`:
  - `env`: payloads are stored in `env.rendererFenceCustomHighlights[id]`.
  - `inline-script`: payload is appended as `<script type="application/json" data-pre-highlight="...">`.
  - In `env` mode, payload map/sequence are reset at render start to avoid stale payload carry-over when the same `env` object is reused.
- `customHighlight.fallback` controls server-side fallback on API/provider errors: `plain` or `markup`.
- `customHighlight.scopePrefix` is used when sanitizing scope names to CSS-safe highlight names.
- Runtime helpers are exported: `applyCustomHighlights`, `observeCustomHighlights`, `clearCustomHighlights`, `shouldRuntimeFallback`.
- Payload helpers are exported: `getCustomHighlightPayloadMap`, `renderCustomHighlightPayloadScript`, `renderCustomHighlightScopeStyleTag`.
- Payload version helpers are exported: `customHighlightPayloadSchemaVersion`, `customHighlightPayloadSupportedVersions`.
- Demo/runtime helper `test/custom-highlight/pre-highlight.js`:
  - re-apply時の `::highlight(...)` 重複挿入を避けるため、style rule registry を保持。
  - payload `scopeStyles` は `::highlight()` で有効なプロパティのみ出力（`color` / `background-color` / `text-decoration` / `text-shadow`）。
- `onFenceDecision` option can be used as a debug hook to inspect per-fence branch decisions (renderer path, fallback, disabled features).
- `onFenceDecisionTiming: true` adds `timings` to `onFenceDecision` payload (`totalMs`, plus branch counters such as `highlightMs` / `providerMs` / `lineSplitMs` / `attrNormalizeMs` when available).
- API payload `scopeStyles` is emitted only when at least one scope has style data.
- `customHighlight.includeScopeStyles: false` forces payload without `scopeStyles` even when styles are available (CSS-managed mode).
- `customHighlight.shikiScopeMode` is the canonical Shiki naming option:
  - `auto`, `color`, `semantic`, `keyword`.
  - 旧 alias 名（`json` / `bucket` / `keyword-only` など）は未リリース整理で削除済み。
  - `semantic` / `keyword` では `includeExplanation` を内部的に有効化して semantic scope 解決を使う。
- `customHighlight.shikiKeywordClassifier` can override keyword bucket mapping in `shikiScopeMode: 'keyword'`.
- `customHighlight.shikiKeywordLangResolver(lang, scopeCandidates, token)` can override language resolution used by keyword-mode token bucketing.
- `customHighlight.shikiKeywordLangAliases` can extend/override built-in alias mapping for keyword-mode language resolution.
  - when `customHighlight.highlighter` exists, Shiki internal loaded-language aliases are used first.
  - no hardcoded fallback aliases are applied by default.
- `customHighlight` options now go through strict validation + normalization helper (`src/custom-highlight/option-validator.js`).
  - invalid/unknown keys are normalized as before and emit warn-once diagnostics in `NODE_ENV=development`.
- keyword-mode の既定分類は `src/custom-highlight/shiki-keyword.js` を公開入口に統一。
  - `buildShikiKeywordContext()` を共有し、base 判定と rule 判定で scope/token の再計算をしない。
  - `classifyShikiScopeKeywordBaseFromContext()` で base bucket を算出し、`src/custom-highlight/shiki-keyword-rules.js` の rule で後処理（legacy + v4）を適用。
  - 空白トークンは context 構築前に早期 return (`text`) して keyword-mode の hot path を軽量化。
  - scope 判定キャッシュ (`shikiScopeKeywordSingleV3Cache`) は上限超過時に clear して無制限成長を防止。
- `shikiScopeMode: 'keyword'` の既定分類は、leaf scope だけでなく explanation の scope候補 + token content + language keyword set を使う。
  - 言語解決は fence lang だけに依存せず、`source.*` / `text.*` scope候補も使って canonical language を推定する。
  - 未知言語や未対応aliasは安全に scopeヒューリスティックへフォールバックする。
  - 例: SQL の `true` を `literal` として扱う、HTML の `attribute-name` を `attribute` 優先で扱う。
- `applyCustomHighlights` targets both `pre > code` and `pre > samp` in API mode.
- Runtime highlight names are scope-based (shared across blocks), and `applyCustomHighlights` rebuilds/sets them per apply pass for the target root.
- `applyCustomHighlights(..., { incremental: true })` skips re-apply when payload and target block node references are unchanged.
  - Payload digest/state build is performed only in incremental mode (non-incremental path avoids this overhead).
  - When incremental apply is needed, unchanged blocks reuse cached Range computation to reduce repeated TreeWalker work.
- `applyCustomHighlights` queries target code blocks before payload-script parsing and returns early when no targets are present (no-op fast path).
- `applyCustomHighlights(..., { onRuntimeDiagnostic })` can emit runtime diagnostics for skipped blocks and invalid ranges (`block-skip`, `range-skip`, `runtime-skip`).
- `observeCustomHighlights(root, options)` is an optional lazy wrapper around `IntersectionObserver`:
  - default selector: `pre[data-pre-highlight]`
  - on first intersecting entry (`once: true` default), it triggers `applyCustomHighlights`.
- API provider hooks are normalized once at plugin init (`_customGetRanges`, `_hljsHighlightFn`, `_shikiTokenOptionBase`) to reduce per-fence branching overhead.
- Runtime version policy options:
  - `{ strictVersion: true }` accepts only `v: 1`
  - `{ supportedVersion }` / `{ supportedVersions }` allows custom accepted payload versions.
  - Payload `v` is transport schema version (independent from npm package version); package metadata mirrors this in `package.json > customHighlightPayload`.
  - `v` is shared across providers by design (`engine` is provenance; runtime consumes one normalized payload shape).
- `useHighlightPre` keeps highlight-provided `<pre><code>` and disables line-splitting features; `<samp>` conversion is not possible in this mode.
- `setPreWrapStyle` controls inline style output for pre-wrap; data-pre-wrap is still added.
- `comment-line` applies to code blocks and relies on line splitting.
- `setEmphasizeLines: false` now skips `em-lines` parsing on the hot path.
- `comment-line` scanning is skipped when `useHighlightPre` passthrough is active.
- `start` line numbering is activated only for non-negative safe integers (`0` is allowed); invalid/empty values keep `data-pre-start` but do not enable counter style or line-number wrapping.
- Logical line counting for mismatch guards accepts CRLF/LF/CR and is shared for source and highlighted content.
- markdown-it fence `token.content` is effectively LF-normalized; mismatch guard mainly protects against highlighter-side newline transformation.
- language class からの再抽出は class token split ベースで実装（`#` / `+` を含む言語名、例: `c#`, `c++` を保持）。

## Known concerns / trade-offs
- HTML attr parsing uses regex; unusual attribute values with `>` could break parsing.
- `<pre>` detection is a simple substring check; it handles `<pre>`/`<PRE>` but does not parse full HTML.
- Passthrough mode (`useHighlightPre`) skips line-based features by design to avoid HTML breakage.
- `splitFenceBlockToLines` is the heaviest path and runs only when line features are enabled.
- In api mode, highlight scope names must be sanitized and de-collisioned before `CSS.highlights.set(name, ...)`.
- Runtime CSS generation for per-scope styles is appended dynamically; style property support depends on browser custom highlight support.
- SPA/incremental rendering requires explicit runtime trigger (`applyCustomHighlights`) unless consumer provides its own auto-run hook.

## Tests
- highlight.js, shiki inline, shiki classic, shiki classic passthrough, comment lines.
- custom-highlight fixtures under `test/custom-highlight/`:
  - `api-env-basic` (HTML + payload JSON)
  - `api-fallback-plain`
  - `api-fallback-markup`
  - `api-inline-script`
- runtime mock-DOM tests in `test/test.js`:
  - `custom-highlight-runtime-reapply` (SPA-style re-render + external re-apply trigger)
  - `custom-highlight-runtime-inline-script` (inline payload script parsing path)
  - `custom-highlight-runtime-incremental-skip` (incremental no-op path for unchanged DOM/payload)
  - `custom-highlight-runtime-version-policy` (strict/custom payload version acceptance)
  - `custom-highlight-runtime-incremental-partial-reuse` (incremental partial path: unchanged block range reuse)
  - `custom-highlight-runtime-incremental-scope-diff-update` (incremental scope diff: changed scope set / removed scope delete only)
  - `custom-highlight-runtime-diagnostics-hook` (runtime skip/invalid diagnostics callback)
  - `custom-highlight-runtime-lazy-observer` (`observeCustomHighlights` lazy apply path)
- adapter/helper tests in `test/test.js`:
  - `api-hljs-provider` (highlight.js -> payload conversion path)
  - `api-shiki-provider-missing-highlighter` (`provider: shiki` misconfiguration falls back to plain without payload by default)
  - `api-shiki-provider-scope-mode-semantic` (canonical scope mode option)
  - `api-shiki-provider-scope-mode-keyword` (canonical `keyword` mode behavior)
  - `api-shiki-provider-keyword-classifier` (custom keyword bucket mapping)
  - `api-shiki-provider-keyword-lang-resolver` (scope-derived language fallback in keyword mode)
  - `api-shiki-provider-keyword-lang-resolver-hook` (custom language resolver hook path)
  - `custom-highlight-payload-helper` (env payload script rendering path)
  - `custom-highlight-payload-schema-version` (payload `v` follows exported schema constant contract)
  - `custom-highlight-env-reuse-reset` (same env reused across renders does not accumulate stale payload IDs)
  - `custom-highlight-option-validation-warn-once` (invalid/unknown customHighlight option diagnostics are warn-once)
- provider coverage suite (separate file):
  - fixture: `test/custom-highlight/provider-keyword-fixtures.json`
  - runner: `test/custom-highlight/provider-keyword-coverage.test.js`
  - holdout fixture (more complex samples): `test/custom-highlight/provider-keyword-holdout-fixtures.json`
  - holdout runner (keyword parity vs shiki color): `test/custom-highlight/provider-keyword-holdout-parity.test.js`
  - verifies payload basics (`v`, `textLength`, range bounds, scope index bounds) plus shiki keyword buckets and hljs-mapped buckets.
  - shiki provider checks in this suite use `shikiScopeMode: 'keyword'`.
  - fixture language matrix: `javascript`, `typescript`, `python`, `bash`, `json`, `html`, `css`, `yaml`, `sql`, `go`, `rust`, `java`, `ruby`, `csharp`, `php`, `cpp`, `c`, `hcl`.
  - fixtureごとに `providers` を持てる（例: `hcl` は `["shiki"]` のみ）。
  - validates practical bucket parity, not full 1:1 scope taxonomy identity between providers.
  - demo generator: `test/custom-highlight/build-provider-keyword-demos.js` (`npm run build:demo:provider:keyword`)
  - unified comparison example generator: `example/build-custom-highlight-compare.js` (`npm run build:example:custom-highlight`)
  - keyword mismatch analyzer: `test/custom-highlight/provider-keyword-mismatch-report.js`
    - run: `node test/custom-highlight/provider-keyword-mismatch-report.js`
    - optional detail: `node test/custom-highlight/provider-keyword-mismatch-report.js example/custom-highlight-provider-matrix.html java --detail`
    - compares `Shiki/color` vs `Shiki/keyword` and reports semantic-scope/token-level residuals.
  - matrix exampleの `hljs` API側 `::highlight(...)` は、`node_modules/highlight.js/styles/github.css` から自動抽出生成（手書き色マップではない）。
  - `example/custom-highlight-provider-matrix.html` には一致率の可視化（全体サマリ / 言語別テーブル / 言語セクション内メトリクス）を出力。
- markup robustness test:
  - fixture: `test/example-markup-pre-attrs.txt` (quoted `>`, mixed quoted/unquoted attrs, boolean attrs + style merge in `useHighlightPre` wrapper path)
  - `fence-decision-hook` (`onFenceDecision` receives markup branch decisions with disabled feature list)
  - `fence-decision-hook-timing` (`onFenceDecisionTiming` includes timing counters)
- provider contract test (separate file):
  - runner: `test/custom-highlight/provider-contract.test.js`
  - verifies strict payload invariants across providers/modes:
    - payload version contract
    - scope naming format
    - range boundary invariants
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
- Provider mode comparison (`markup/api` x `shiki/highlight.js`): `test/performance/provider-mode-benchmark.js`
- Run: `npm run test:performance:provider-modes` (alias: `npm run test:performance:keyword`)
- Runtime apply micro-benchmark: `test/performance/runtime-apply-benchmark.js`
- Run: `npm run test:performance:runtime`
- Optional knobs: `--samples`, `--iterations`, `--warmup`
- The benchmark batches short inputs and reports median/p95 ms-per-render to reduce timer noise.
- For optimization validation, compare `HEAD` and current branch with the same corpus and alternate run order (A/B then B/A) to reduce order bias.

## Highlighter note (current local benchmark)
- In this repository's Node benchmark corpus, `highlight.js` is significantly faster than `shiki` for render throughput.
- `shiki` also has one-time highlighter initialization cost.
- Keep this as an environment-dependent observation; rerun local benchmark before making final defaults.
