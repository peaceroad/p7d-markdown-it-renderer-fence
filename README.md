# p7d-markdown-it-renderer-fence

A `markdown-it` plugin for code block rendering and enhancements.

Default is `markup` mode. Custom Highlight API mode is available as an advanced/experimental path.

## Install

```bash
npm i @peaceroad/markdown-it-renderer-fence markdown-it markdown-it-attrs
```

If you use syntax highlighting, install a highlighter too (for example `highlight.js` or `shiki`).

## Entry Points

- `@peaceroad/markdown-it-renderer-fence`  
  Dispatcher entry (`highlightRenderer` selects mode).
- `@peaceroad/markdown-it-renderer-fence/markup-highlight`  
  Markup-focused entry.
- `@peaceroad/markdown-it-renderer-fence/custom-highlight`  
  API-mode entry + runtime/payload helpers.
- `@peaceroad/markdown-it-renderer-fence/custom-highlight-runtime`  
  Runtime-only entry (`applyCustomHighlights` / `observeCustomHighlights` / `clearCustomHighlights`).

## Markup Mode (Default)

### Quick Start

Dispatcher entry:

```js
import MarkdownIt from 'markdown-it'
import markdownItAttrs from 'markdown-it-attrs'
import hljs from 'highlight.js'
import rendererFence from '@peaceroad/markdown-it-renderer-fence'
// Markup-only entry (skips dispatcher/API branch):
// import rendererFence from '@peaceroad/markdown-it-renderer-fence/markup-highlight'

const md = MarkdownIt({
  html: true,
  langPrefix: 'language-',
  highlight: (code, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value
      } catch (e) {}
    }
    return md.utils.escapeHtml(code)
  },
})
  .use(markdownItAttrs)
  .use(rendererFence) // defaults to markup; direct markup entry can be leaner
```

### Markup with Shiki

Use the markup-only entry and provide `md.options.highlight` with Shiki.
For production/blog builds, pre-scan markdown and preload only used languages.

```js
import MarkdownIt from 'markdown-it'
import markdownItAttrs from 'markdown-it-attrs'
import { createHighlighter } from 'shiki'
import rendererFence from '@peaceroad/markdown-it-renderer-fence/markup-highlight'
import fs from 'node:fs'
import path from 'node:path'

const fenceInfoReg = /^```([^\s`{]+)/gm
const collectFenceLangs = (markdown) => {
  const out = new Set()
  if (!markdown) return out
  let m
  while ((m = fenceInfoReg.exec(markdown)) !== null) {
    const lang = String(m[1] || '').trim().toLowerCase()
    if (lang) out.add(lang)
  }
  return out
}

// Example: scan markdown source(s) before highlighter creation
const markdown = fs.readFileSync(path.join(process.cwd(), 'article.md'), 'utf8')
const langs = Array.from(collectFenceLangs(markdown))
langs.push('text') // safe fallback

const highlighter = await createHighlighter({
  themes: ['github-light'],
  langs, // preload grammars; Shiki does not auto-detect language
})

const md = MarkdownIt({
  html: true,
  langPrefix: 'language-',
  highlight: (code, lang) => {
    const targetLang = lang || 'text'
    try {
      return highlighter.codeToHtml(code, { lang: targetLang, theme: 'github-light' })
    } catch (e) {
      // when lang grammar is not loaded (or invalid), keep output safe
      return md.utils.escapeHtml(code)
    }
  },
})
  .use(markdownItAttrs)
  .use(rendererFence)
```

Note:

- For small projects, a fixed list like `['javascript', 'typescript', 'json', 'text']` is also fine.
- If Shiki grammar for a language is not loaded, `codeToHtml` can fail.
- In markup mode, handle this in your `highlight` callback (for example fallback to escaped plain text as above).

### Main Features

- `samp` rendering for `samp`, `shell`, `console` languages.
- line number wrapping via `start` (`line-number-start` long form) / `data-pre-start`.
- line number skip/set controls via `line-number-skip` / `line-number-set`.
- emphasized lines via `em-lines` / `emphasize-lines`.
- optional line-end spacer via `lineEndSpanThreshold`.
- optional pre-wrap support via `wrap` / `pre-wrap`.
- comment line markers via `comment-mark`.
- sidecar line notes via immediate `line-notes` fence (`notes` alias).

### Fence Attribute Examples

Simplified HTML below focuses on renderer-fence structure (not full highlighter token spans).

`samp` conversion:

~~~md
```shell
$ pwd
```
~~~

```html
<pre><samp class="language-shell">$ pwd
</samp></pre>
```

Line numbers:

~~~md
```js {start="1"}
const a = 1
console.log(a)
```
~~~

```html
<pre><code class="language-js" data-pre-start="1" style="counter-set:pre-line-number 1;">
<span class="pre-line">const a = 1</span>
<span class="pre-line">console.log(a)</span>
</code></pre>
```

Advanced line number control:

~~~md
```txt {start="25" line-number-skip="5" line-number-set="6:136"}
line1
line2
line3
line4
...
line6
```
~~~

```html
<pre><code class="language-txt" data-pre-start="25" data-pre-line-number-skip="5" data-pre-line-number-set="6:136" style="counter-set:pre-line-number 25;">
<span class="pre-line">line1</span>
<span class="pre-line">line2</span>
<span class="pre-line">line3</span>
<span class="pre-line">line4</span>
<span class="pre-line pre-line-no-number">...</span>
<span class="pre-line" style="counter-set:pre-line-number 136;">line6</span>
</code></pre>
```

Emphasis:

~~~md
```js {em-lines="2,4-5"}
line1
line2
line3
line4
line5
```
~~~

```html
<pre><code class="language-js" data-pre-emphasis="2,4-5">line1
<span class="pre-lines-emphasis">line2</span>
line3
<span class="pre-lines-emphasis">line4
line5</span>
</code></pre>
```

Wrap:

~~~md
```js {wrap}
const veryLongLine = '...'
```
~~~

```html
<pre data-pre-wrap="true" style="white-space: pre-wrap; overflow-wrap: anywhere;">
<code class="language-js">const veryLongLine = '...'
</code></pre>
```

Comment line marker:

~~~md
```samp {comment-mark="#"}
# comment
echo 1
```
~~~

```html
<pre><samp data-pre-comment-mark="#" class="language-samp">
<span class="pre-line-comment"># comment</span>
echo 1
</samp></pre>
```

Line notes:

~~~md
```js {start="5"}
const a = 1
console.log(a)
```
```line-notes
1: setup {width="7em"}
2：result {width="10em"}
```
~~~

```html
<div class="pre-wrapper-line-notes" data-pre-line-notes-layout="anchor"><pre><code class="language-js" data-pre-start="5" data-pre-line-notes="true" style="counter-set:pre-line-number 5;"><span class="pre-line pre-line-has-end-note" data-pre-line-note-from="1" data-pre-line-note-to="1"><span class="pre-line-content" style="anchor-name:--pre-line-note-1;" aria-describedby="pre-line-note-1-1-1">const a = 1</span></span>
<span class="pre-line pre-line-has-end-note" data-pre-line-note-from="2" data-pre-line-note-to="2"><span class="pre-line-content" style="anchor-name:--pre-line-note-2;" aria-describedby="pre-line-note-1-1-2">console.log(a)</span></span>
</code></pre><div class="pre-line-note-layer"><div id="pre-line-note-1-1-1" class="pre-line-note" role="note" data-pre-line-note-from="1" data-pre-line-note-to="1" data-pre-line-note-label="1" style="position-anchor:--pre-line-note-1; --line-note-width:7em;">setup</div><div id="pre-line-note-1-1-2" class="pre-line-note" role="note" data-pre-line-note-from="2" data-pre-line-note-to="2" data-pre-line-note-label="2" style="position-anchor:--pre-line-note-2; --line-note-width:10em;">result</div></div></div>
```

### Markup Notes

- `useHighlightPre: true` keeps highlighter-provided `<pre><code>` when present.
- In that passthrough path, line-splitting features are intentionally disabled:
  - line numbers
  - `line-number-skip`
  - `line-number-set`
  - `em-lines`
  - line-end spacer
  - `comment-mark`
  - `line-notes`
  - `samp` conversion

Reference line-number CSS contract:

Minimum counter contract:

```css
pre :is(code, samp)[data-pre-start] .pre-line::before {
  content: counter(pre-line-number);
}

pre :is(code, samp)[data-pre-start] .pre-line::after {
  content: "";
  counter-increment: pre-line-number;
}

pre :is(code, samp)[data-pre-start] .pre-line.pre-line-no-number::before {
  content: "";
}

pre :is(code, samp)[data-pre-start] .pre-line.pre-line-no-number::after {
  counter-increment: none;
}
```

Recommended display CSS:

- See [`example/line-number.css`](./example/line-number.css) for the full reference stylesheet.
- See [`example/line-number-sample.html`](./example/line-number-sample.html) for Markdown / Preview / HTML side-by-side examples.
- See [`example/line-notes.css`](./example/line-notes.css) for the companion line-note stylesheet.
- See [`example/line-notes-sample.html`](./example/line-notes-sample.html) for sidecar line-note examples.

Note:

- renderer-fence emits `counter-set` as the displayed line number value itself
- the reference CSS increments the counter in `span.pre-line::after`, so `start="1"` maps directly to `counter-set:pre-line-number 1;`
- `line-number-set="6:136"` similarly emits `counter-set:pre-line-number 136;` on that line wrapper
- the minimum contract above is the required part; `example/line-number.css` adds gutter width, divider line, and whitespace handling
- if a consumer uses a different counter strategy, its CSS must be aligned with this HTML contract

### Markup Options

- `attrsOrder` (default: `['class', 'id', 'data-*', 'style']`): output attribute order (`data-*` wildcard supported).
- `setHighlight` (default: `true`): call `md.options.highlight` when available.
- `setLineNumber` (default: `true`): enable line wrapper spans when `start` / `line-number-start` is valid.
- `setEmphasizeLines` (default: `true`): enable `em-lines` / `emphasize-lines`.
- `lineEndSpanThreshold` (default: `0`): append line-end spacer span when visual width threshold is met.
- `setLineEndSpan`: alias of `lineEndSpanThreshold`.
- `lineEndSpanClass` (default: `'pre-lineend-spacer'`): CSS class of the spacer span.
- `setPreWrapStyle` (default: `true`): inject inline pre-wrap style for wrap-enabled blocks.
- `sampLang` (default: `'shell,console'`): additional fence langs rendered as `<samp>`.
- `langPrefix` (default: `md.options.langPrefix || 'language-'`): class prefix for language class.
- `useHighlightPre` (default: `false`): passthrough highlighter `<pre><code>` wrappers and skip line-splitting features.
- `onFenceDecision` (default: `null`): debug hook for per-fence branch decisions.
- `onFenceDecisionTiming` (default: `false`): include timing fields in `onFenceDecision`.

`em-lines` syntax note:

- supports single values (`2`) and ranges (`4-6`)
- supports open-ended forms (`3-`, `-2`)
- reversed ranges are normalized (`5-3` behaves as `3-5`)

Line-number attr syntax note:

- `line-number-start` is the long form of `start`; rendered output still uses `data-pre-start`.
- `line-number-skip` supports single values (`2`), ranges (`4-6`), and open-ended forms (`3-`).
- `line-number-set` uses `line:number` pairs (for example `6:136,14:220`).
- `line-number-skip` and `line-number-set` must not target the same source line. If they overlap, the skipped line stays blank and the conflicting `line-number-set` entry is ignored.
- `line-number-skip` / `line-number-set` are applied only when source and highlighted logical line counts match; otherwise renderer falls back to plain sequential numbering.

Line-note syntax note:

- `line-notes` is the canonical sidecar fence name; `notes` is a short alias.
- Sidecar notes are folded only when they immediately follow a code/samp fence.
- Immediate sidecar folding is fail-closed: if any non-empty line is malformed, a note entry is incomplete, or the same note start line appears twice, the `line-notes` fence stays as a normal literal fence block.
- Syntax supports `N: text`, `N-M: text`, `N：text`, and `N-M：text`.
- Per-note attrs can be appended in markdown-it-attrs style on the same line for single-line notes, for example `5: cache lookup key {width="8rem"}`.
- For multiline notes, prefer a trailing attrs-only continuation line, for example `  {width="11rem"}`.
- Continuation lines start with indentation (`  ` or tab) and append multiline note text to the previous note.
- Output keeps note text outside `<code>/<samp>` in a sibling note layer for safer copy semantics.
- Line-note blocks use the external wrapper contract `pre-wrapper-line-notes`.
- `data-pre-line-notes-layout="anchor"` is added only for simple non-overlapping note layouts. The current check is intentionally lightweight: it uses the note start line plus the note text's explicit logical line count, so a two-line note starting at line `3` prevents another anchored note from starting at line `4`.
- This anchor-safety check does not measure CSS wrapping. If a note wraps because of narrow CSS width, consumer CSS should still be prepared to fall back to a below-block list.
- When anchor positioning is unavailable or the layout is not marked safe, consumer CSS should render notes as a below-block list. The reference stylesheet uses `data-pre-line-note-label` so the fallback still shows which source line each note belongs to.
- In anchor layouts, the rendered line HTML carries note metadata on `.pre-line`, and the anchor itself is attached to `.pre-line-content` so notes can start from the rendered code end.
- Accessibility contract: the rendered `.pre-line-content` carries `aria-describedby`, and each note item renders with a stable `id` plus `role="note"`, so assistive tech can associate the note text with its anchor line.
- When a sidecar fence is folded, the previous fence token `map` is extended to cover the absorbed note-fence lines so editor scroll/jump integrations can still treat the merged output as one source span.
- `line-notes` are applied only when source and highlighted logical line counts match; otherwise note markup is skipped.

Migration note (`0.5.0`):

- `comment-line` / `data-pre-comment-line` / `pre-comment-line` were removed
- use `comment-mark` / `data-pre-comment-mark` / `pre-line-comment`
- `line-number-reset` was removed; use `line-number-set`

## Custom Highlight API Mode (Experimental / Advanced)

Custom Highlight API mode renders plain code text and emits range payloads for browser-side Custom Highlight API application.

Important:

- You must run runtime apply in the browser (`applyCustomHighlights` or `observeCustomHighlights`).
- Without runtime apply, payload exists but browser highlights are not activated.
- `test/custom-highlight/pre-highlight.js` is a demo helper, not the package runtime API contract.

Use API mode only if you need runtime range highlighting and can manage runtime/CSS integration in your app.

### Minimal API Example (Shiki provider)

```js
import MarkdownIt from 'markdown-it'
import markdownItAttrs from 'markdown-it-attrs'
import { createHighlighter } from 'shiki'
import rendererFenceApi, {
  applyCustomHighlights,
  renderCustomHighlightPayloadScript,
} from '@peaceroad/markdown-it-renderer-fence/custom-highlight'
// Dispatcher entry alternative:
// import rendererFenceApi from '@peaceroad/markdown-it-renderer-fence'

const highlighter = await createHighlighter({
  themes: ['github-light'],
  langs: ['javascript', 'typescript', 'json'], // preload grammars; Shiki does not auto-detect language
})

const md = MarkdownIt({ html: true })
  .use(markdownItAttrs)
  .use(rendererFenceApi, {
    // highlightRenderer: 'api', // required only with dispatcher entry
    customHighlight: {
      provider: 'shiki',
      highlighter,
      theme: 'github-light',
      transport: 'env',
    },
  })

const env = {}
const html = md.render('```js\nconst x = 1\n```', env)
const payloadScript = renderCustomHighlightPayloadScript(env) // id="pre-highlight-data"
```

Browser-side apply:

```js
applyCustomHighlights(document)
```

When using `colorScheme: 'auto'`, scheme resolution happens at apply time.
If OS/browser theme changes after first apply, re-run apply (or use observer watch mode below).

If you only need runtime apply on the browser, import runtime-only entry:

```js
import { observeCustomHighlights } from '@peaceroad/markdown-it-renderer-fence/custom-highlight-runtime'
```

`langs` note:

- `createHighlighter({ langs: [...] })` should include the languages you expect to render.
- Shiki does not auto-detect language from code text.
- if a target language is not loaded, this plugin falls back to Shiki `text` tokenization for that block (safe, but no syntax color buckets).

### Minimal API Example (highlight.js provider)

```js
import MarkdownIt from 'markdown-it'
import markdownItAttrs from 'markdown-it-attrs'
import hljs from 'highlight.js'
import rendererFenceApi from '@peaceroad/markdown-it-renderer-fence/custom-highlight'
// Dispatcher entry alternative:
// import rendererFenceApi from '@peaceroad/markdown-it-renderer-fence'

const md = MarkdownIt({ html: true })
  .use(markdownItAttrs)
  .use(rendererFenceApi, {
    // highlightRenderer: 'api', // required only with dispatcher entry
    customHighlight: {
      provider: 'hljs',
      hljsHighlight: (code, lang) => {
        if (lang && hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang }).value
        }
        return hljs.highlight(code, { language: 'plaintext' }).value
      },
      transport: 'env',
    },
  })
```

### API Providers

- `customHighlight.provider: 'shiki'`  
  Requires `customHighlight.highlighter.codeToTokens(...)` (synchronous).
- `customHighlight.provider: 'hljs'`  
  Uses `customHighlight.hljsHighlight`, fallback to `customHighlight.highlight`, then `md.options.highlight`.
- `customHighlight.provider: 'custom'`  
  Escape hatch. Requires synchronous `customHighlight.getRanges(...)`.

### Shiki Scope Modes

- `auto` (default)
- `color`
- `semantic`
- `keyword` (best for stable CSS-managed styling)

Migration note (`0.5.0`):

- legacy aliases like `json`, `bucket`, `keyword-only` are removed
- use canonical values: `auto | color | semantic | keyword`

Recommended production profile for API mode:

```js
customHighlight: {
  provider: 'shiki',
  shikiScopeMode: 'keyword',
  includeScopeStyles: false
}
```

### API Multi-Theme (Shiki, `v:1` additive payload)

When you need runtime light/dark switching with Shiki color styles, pass object form theme:

```js
customHighlight: {
  provider: 'shiki',
  highlighter,
  shikiScopeMode: 'color',
  includeScopeStyles: true,
  theme: {
    light: 'github-light',
    dark: 'github-dark',
    default: 'light',
  },
}
```

Runtime apply can choose variant:

```js
applyCustomHighlights(document, { colorScheme: 'auto' }) // 'auto' | 'light' | 'dark'
```

Auto re-apply on color-scheme change:

```js
observeCustomHighlights(document, {
  applyOptions: { colorScheme: 'auto', incremental: true },
  watchColorScheme: true,
})
```

### CMS / Copy-Paste Operation

If you copy rendered HTML+payload JSON into another CMS/page:

- API mode works only when runtime JS is also available on that page.
- payload JSON alone is not enough.
- if the target CMS cannot run custom JS, use `markup` mode instead.
- this plugin does not auto-generate/write runtime JS files during markdown render.

Practical patterns:

1. Site/app with bundler  
   Bundle `@peaceroad/markdown-it-renderer-fence/custom-highlight-runtime` and run `observeCustomHighlights(...)`.
2. Static page with module scripts  
   Load runtime entry via your ESM delivery path and call `applyCustomHighlights(...)`.
3. HTML-only CMS (no JS injection)  
   Use `markup` mode (API mode is not suitable).

### CLI Build Artifact Contract

For CLI/static generation, treat API mode output as two artifacts:

1. HTML artifact  
   Includes `<pre data-pre-highlight="...">...</pre>` and payload JSON (`env` script or inline-script transport).
2. Runtime artifact  
   Browser JS that imports `@peaceroad/markdown-it-renderer-fence/custom-highlight-runtime` and runs `applyCustomHighlights(...)` or `observeCustomHighlights(...)`.

Typical runtime bridge file:

```js
import { observeCustomHighlights } from '@peaceroad/markdown-it-renderer-fence/custom-highlight-runtime'

observeCustomHighlights(document, {
  applyOptions: { colorScheme: 'auto', incremental: true },
  watchColorScheme: true,
})
```

Then include that bridge in generated HTML:

```html
<script type="module" src="/assets/custom-highlight-runtime.js"></script>
```

### API Options

- `highlightRenderer` (`'markup' | 'api' | 'custom-highlight-api'`, default: `'markup'`): dispatcher mode selector (`/custom-highlight` entry does not need this).
- `customHighlight.provider` (default: `'shiki'`): range source (`'shiki' | 'hljs' | 'custom'`).
- `customHighlight.getRanges`: required when `provider: 'custom'`; must return synchronous ranges.
- `customHighlight.highlighter`: Shiki highlighter object with synchronous `codeToTokens`.
- `customHighlight.hljsHighlight`: highlight.js-style function used when `provider: 'hljs'`.
- `customHighlight.highlight`: fallback highlight function for `hljs` provider.
- `customHighlight.defaultLang`: default language when fence language is empty.
- `customHighlight.theme`: Shiki theme name string, or object `{ light, dark, default? }` for dual-theme payload.
- `customHighlight.shikiScopeMode` (default: `'auto'`): scope naming mode (`auto | color | semantic | keyword`).
- `customHighlight.shikiKeywordClassifier`: custom classifier hook for keyword mode.
- `customHighlight.shikiKeywordLangResolver`: custom language resolver hook for keyword mode.
- `customHighlight.shikiKeywordLangAliases`: language alias map for keyword resolver.
- `customHighlight.includeScopeStyles` (default: `true`): include payload `scopeStyles` when available.
- `customHighlight.fallback` (`'plain' | 'markup'`, default: `'plain'`): server-side fallback renderer on provider errors.
- `customHighlight.fallbackOn`: restrict fallback trigger reasons.
- `customHighlight.transport` (`'env' | 'inline-script'`, default: `'env'`): payload transport target.
- `customHighlight.idPrefix` (default: `'hl-'`): generated per-block payload id prefix.
- `customHighlight.scopePrefix` (default: `'hl'`): scope name prefix used for highlight registration.
- `customHighlight.lineFeatureStrategy` (`'hybrid' | 'disable'`, default: `'hybrid'`): keep or disable line-span features in API rendering.
- In `NODE_ENV=development`, invalid known enum-like values and unknown `customHighlight` keys emit warn-once diagnostics while keeping normalized fallback behavior.

### API Helper Exports

- `applyCustomHighlights`
- `observeCustomHighlights`
- `clearCustomHighlights`
- `shouldRuntimeFallback`
- `getCustomHighlightPayloadMap`
- `renderCustomHighlightPayloadScript`
- `renderCustomHighlightScopeStyleTag`
- `customHighlightPayloadSchemaVersion`
- `customHighlightPayloadSupportedVersions`

### Runtime Version Policy

- `applyCustomHighlights(..., { strictVersion: true })` accepts only `customHighlightPayloadSupportedVersions` (currently `v:1`).
- `supportedVersion` / `supportedVersions` allow explicit accepted payload versions.
- If `strictVersion` is `true`, it takes precedence and custom accepted versions are ignored.

## Docs and Examples

- API styling guide: `docs/custom-highlight-styling-guide.md`
- default preset CSS sample: `docs/default-highlight-theme.css`
- provider matrix page: `example/custom-highlight-provider-matrix.html`
- line-number sample: `example/line-number-sample.html`
- line-notes sample: `example/line-notes-sample.html`

## Tests and Benchmarks

- all tests: `npm test`
- provider contract: `npm run test:provider:contract`
- keyword coverage: `npm run test:provider:keyword`
- keyword holdout parity: `npm run test:provider:keyword:holdout`
- performance baseline: `npm run test:performance`
- runtime apply benchmark: `npm run test:performance:runtime`

## License and Notices

- Project license: MIT (`LICENSE`)
- Third-party notices: `THIRD_PARTY_NOTICES.md`
- `docs/default-highlight-theme.css` contains mappings derived from highlight.js theme families (BSD-3-Clause; see notices).
