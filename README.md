# p7d-markdown-it-renderer-fence

A `markdown-it` plugin for code block rendering and enhancements.

Default is `markup` mode. `api` mode is available as an advanced/experimental path for Custom Highlight API workflows.

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
- line number wrapping via `start` / `data-pre-start`.
- emphasized lines via `em-lines` / `emphasize-lines`.
- optional line-end spacer via `lineEndSpanThreshold`.
- optional pre-wrap support via `wrap` / `pre-wrap`.
- comment line markers via `comment-line`.

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
```samp {comment-line="#"}
# comment
echo 1
```
~~~

```html
<pre><samp data-pre-comment-line="#" class="language-samp">
<span class="pre-comment-line"># comment</span>
echo 1
</samp></pre>
```

### Markup Notes

- `useHighlightPre: true` keeps highlighter-provided `<pre><code>` when present.
- In that passthrough path, line-splitting features are intentionally disabled:
  - line numbers
  - `em-lines`
  - line-end spacer
  - `comment-line`
  - `samp` conversion

### Markup Options

- `attrsOrder` (default: `['class', 'id', 'data-*', 'style']`): output attribute order (`data-*` wildcard supported).
- `setHighlight` (default: `true`): call `md.options.highlight` when available.
- `setLineNumber` (default: `true`): enable line wrapper spans when `start` is valid.
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

## API Mode (Experimental / Advanced)

API mode renders plain code text and emits range payloads for browser-side Custom Highlight API application.

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

Recommended production profile for API mode:

```js
customHighlight: {
  provider: 'shiki',
  shikiScopeMode: 'keyword',
  includeScopeStyles: false
}
```

### API Options

- `highlightRenderer` (`'markup' | 'api'`, default: `'markup'`): dispatcher mode selector (`/custom-highlight` entry does not need this).
- `customHighlight.provider` (default: `'shiki'`): range source (`'shiki' | 'hljs' | 'custom'`).
- `customHighlight.getRanges`: required when `provider: 'custom'`; must return synchronous ranges.
- `customHighlight.highlighter`: Shiki highlighter object with synchronous `codeToTokens`.
- `customHighlight.hljsHighlight`: highlight.js-style function used when `provider: 'hljs'`.
- `customHighlight.highlight`: fallback highlight function for `hljs` provider.
- `customHighlight.defaultLang`: default language when fence language is empty.
- `customHighlight.theme`: Shiki theme forwarded to `codeToTokens`.
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

## Docs and Examples

- API styling guide: `docs/custom-highlight-styling-guide.md`
- default preset CSS sample: `docs/default-highlight-theme.css`
- provider matrix page: `example/custom-highlight-provider-matrix.html`

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
