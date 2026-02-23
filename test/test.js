import assert from 'assert'
import fs from 'fs'
import path from 'path'
import mdit from 'markdown-it'

import mditFigureWithPCaption from '@peaceroad/markdown-it-figure-with-p-caption'
import mditRendererFence, {
  applyCustomHighlights,
  clearCustomHighlights,
  customHighlightPayloadSchemaVersion,
  customHighlightPayloadSupportedVersions,
  getCustomHighlightPayloadMap,
  observeCustomHighlights,
  renderCustomHighlightPayloadScript,
  renderCustomHighlightScopeStyleTag,
} from '../index.js'
import mditAttrs from 'markdown-it-attrs'
import highlightjs from 'highlight.js'
import { createHighlighter } from 'shiki'


let opt = {}

const md = mdit({ html: true }).use(mditRendererFence).use(mditAttrs)
const mdHighlightJs = mdit({
  html: true,
  langPrefix: 'language-',
  typographer: false,
  highlight: (str, lang) => {
    if (lang && highlightjs.getLanguage(lang)) {
      try {
        return highlightjs.highlight(str, { language: lang }).value
      } catch (__) {}
    }
    return md.utils.escapeHtml(str)
  }
}).use(mditRendererFence, opt).use(mditAttrs)
const mdLinesEmphasis = mdit({ html: true }).use(mditRendererFence).use(mditAttrs)
const mdLIneEndSpan = mdit({ html: true }).use(mditRendererFence, { lineEndSpanThreshold: 8 }).use(mditAttrs)
const mdVoidTags = mdit({
  html: true,
  langPrefix: 'language-',
  highlight: (str, lang) => {
    if (lang === 'mock') return 'line1<br>\nline2\n'
    return md.utils.escapeHtml(str)
  }
}).use(mditRendererFence, opt).use(mditAttrs)
const mdCommentLineMismatch = mdit({
  html: true,
  langPrefix: 'language-',
  highlight: (str, lang) => {
    if (lang === 'mock') {
      return str.split('\n').map((line) => `<span>${line}</span>\n<span class="extra">X</span>`).join('\n')
    }
    return md.utils.escapeHtml(str)
  }
}).use(mditRendererFence, opt).use(mditAttrs)
const shikiHighlighter = await createHighlighter({
  themes: ['github-light'],
  langs: ['javascript', 'typescript', 'python', 'shellscript', 'csharp', 'cpp', 'c', 'php', 'hcl'],
})
const mdShiki = mdit({
  html: true,
  langPrefix: 'language-',
  highlight: (str, lang) => {
    if (lang === 'javascript') {
      const html = shikiHighlighter.codeToHtml(str, {
        lang: 'javascript',
        theme: 'github-light',
        structure: 'inline',
      })
      return html.replace(/<br\s*\/?>/g, '\n')
    }
    return md.utils.escapeHtml(str)
  }
}).use(mditRendererFence, opt).use(mditAttrs)
const mdShikiClassic = mdit({
  html: true,
  langPrefix: 'language-',
  highlight: (str, lang) => {
    if (lang === 'javascript') {
      return shikiHighlighter.codeToHtml(str, {
        lang: 'javascript',
        theme: 'github-light',
        structure: 'classic',
      })
    }
    return md.utils.escapeHtml(str)
  }
}).use(mditRendererFence, opt).use(mditAttrs)
const mdShikiClassicPass = mdit({
  html: true,
  langPrefix: 'language-',
  highlight: (str, lang) => {
    if (lang === 'javascript') {
      return shikiHighlighter.codeToHtml(str, {
        lang: 'javascript',
        theme: 'github-light',
        structure: 'classic',
      })
    }
    return md.utils.escapeHtml(str)
  }
}).use(mditRendererFence, { useHighlightPre: true }).use(mditAttrs)
const mdMarkupPreAttrs = mdit({
  html: true,
  langPrefix: 'language-',
  highlight: (str, lang) => {
    if (lang === 'edge-quoted') {
      return `<pre data-title="a > b"><code data-tip="x > y">${str}</code></pre>`
    }
    if (lang === 'edge-variants') {
      return `<pre data-a=alpha data-b='x > y'><code data-c="1" data-d='two words'>${str}</code></pre>`
    }
    if (lang === 'edge-bool') {
      return `<pre data-flag disabled style="color:red"><code data-x="from-highlight" readonly style="font-weight:700">${str}</code></pre>`
    }
    return md.utils.escapeHtml(str)
  },
}).use(mditRendererFence, { useHighlightPre: true }).use(mditAttrs)
const mdApiCustom = mdit({ html: true, langPrefix: 'language-' }).use(mditRendererFence, {
  highlightRenderer: 'api',
  customHighlight: {
    provider: 'custom',
    getRanges: (code) => ({
      ranges: [
        { scope: 'keyword.control.flow.js', start: 0, end: Math.min(5, code.length) },
      ],
    }),
  },
}).use(mditAttrs)
const mdApiFallbackPlain = mdit({ html: true, langPrefix: 'language-' }).use(mditRendererFence, {
  highlightRenderer: 'api',
  customHighlight: {
    provider: 'custom',
    getRanges: () => {
      throw new Error('provider failed')
    },
    fallback: 'plain',
  },
}).use(mditAttrs)
const mdApiFallbackMarkup = mdit({
  html: true,
  langPrefix: 'language-',
  highlight: (str, lang) => {
    if (lang && highlightjs.getLanguage(lang)) {
      try {
        return highlightjs.highlight(str, { language: lang }).value
      } catch (__) {}
    }
    return md.utils.escapeHtml(str)
  },
}).use(mditRendererFence, {
  highlightRenderer: 'api',
  customHighlight: {
    provider: 'custom',
    getRanges: () => {
      throw new Error('provider failed')
    },
    fallback: 'markup',
  },
}).use(mditAttrs)
const mdApiInlineScript = mdit({ html: true, langPrefix: 'language-' }).use(mditRendererFence, {
  highlightRenderer: 'api',
  customHighlight: {
    provider: 'custom',
    transport: 'inline-script',
    getRanges: (code) => ({
      ranges: [
        ['keyword.control.flow.js', 0, Math.min(5, code.length)],
      ],
    }),
  },
}).use(mditAttrs)
const mdApiShikiProvider = mdit({ html: true, langPrefix: 'language-' }).use(mditRendererFence, {
  highlightRenderer: 'api',
  customHighlight: {
    provider: 'shiki',
    highlighter: shikiHighlighter,
    theme: 'github-light',
  },
}).use(mditAttrs)
const mdApiShikiProviderMissingHighlighter = mdit({ html: true, langPrefix: 'language-' }).use(mditRendererFence, {
  highlightRenderer: 'api',
  customHighlight: {
    provider: 'shiki',
  },
}).use(mditAttrs)
const mdApiShikiProviderNoStyles = mdit({ html: true, langPrefix: 'language-' }).use(mditRendererFence, {
  highlightRenderer: 'api',
  customHighlight: {
    provider: 'shiki',
    highlighter: shikiHighlighter,
    theme: 'github-light',
    includeScopeStyles: false,
  },
}).use(mditAttrs)
const mdApiShikiProviderExplanation = mdit({ html: true, langPrefix: 'language-' }).use(mditRendererFence, {
  highlightRenderer: 'api',
  customHighlight: {
    provider: 'shiki',
    highlighter: shikiHighlighter,
    theme: 'github-light',
    includeScopeStyles: false,
    shikiScopeMode: 'semantic',
  },
}).use(mditAttrs)
const mdApiShikiProviderHighlighterExplanation = mdit({ html: true, langPrefix: 'language-' }).use(mditRendererFence, {
  highlightRenderer: 'api',
  customHighlight: {
    provider: 'shiki',
    highlighter: shikiHighlighter,
    theme: 'github-light',
    includeScopeStyles: false,
    shikiScopeMode: 'semantic',
  },
}).use(mditAttrs)
const mdApiShikiProviderKeyword = mdit({ html: true, langPrefix: 'language-' }).use(mditRendererFence, {
  highlightRenderer: 'api',
  customHighlight: {
    provider: 'shiki',
    highlighter: shikiHighlighter,
    theme: 'github-light',
    includeScopeStyles: false,
    shikiScopeMode: 'keyword',
  },
}).use(mditAttrs)
const mdApiShikiProviderKeywordClassifier = mdit({ html: true, langPrefix: 'language-' }).use(mditRendererFence, {
  highlightRenderer: 'api',
  customHighlight: {
    provider: 'shiki',
    highlighter: shikiHighlighter,
    theme: 'github-light',
    includeScopeStyles: false,
    shikiScopeMode: 'keyword',
    shikiKeywordClassifier: (rawScope) => {
      const text = String(rawScope || '')
      if (text.includes('entity.name.function')) return 'fn'
      if (text.includes('constant.numeric')) return 'num'
      return null
    },
  },
}).use(mditAttrs)
const mdApiShikiProviderKeywordLangResolver = mdit({ html: true, langPrefix: 'language-' }).use(mditRendererFence, {
  highlightRenderer: 'api',
  customHighlight: {
    provider: 'shiki',
    highlighter: {
      codeToTokens: () => ([
        [
          { content: 'const', explanation: [{ scopes: ['source.js'] }] },
          { content: ' value', explanation: [{ scopes: ['source.js'] }] },
        ],
      ]),
      getLoadedLanguages: () => ['javascript', 'js'],
      getLanguage: (name) => ({ name: (name === 'js') ? 'javascript' : String(name || '') }),
    },
    includeScopeStyles: false,
    shikiScopeMode: 'keyword',
  },
}).use(mditAttrs)
const mdApiShikiProviderKeywordLangResolverHook = mdit({ html: true, langPrefix: 'language-' }).use(mditRendererFence, {
  highlightRenderer: 'api',
  customHighlight: {
    provider: 'shiki',
    highlighter: {
      codeToTokens: () => ([
        [
          { content: 'const' },
          { content: ' value' },
        ],
      ]),
      getLoadedLanguages: () => ['javascript', 'js'],
      getLanguage: (name) => ({ name: (name === 'js') ? 'javascript' : String(name || '') }),
    },
    includeScopeStyles: false,
    shikiScopeMode: 'keyword',
    shikiKeywordLangResolver: (lang) => {
      if (lang === 'x-unknown') return 'javascript'
      return null
    },
  },
}).use(mditAttrs)
const mdApiShikiProviderKeywordAliasCoverage = mdit({ html: true, langPrefix: 'language-' }).use(mditRendererFence, {
  highlightRenderer: 'api',
  customHighlight: {
    provider: 'shiki',
    highlighter: shikiHighlighter,
    theme: 'github-light',
    includeScopeStyles: false,
    shikiScopeMode: 'keyword',
  },
}).use(mditAttrs)
const mdApiShikiProviderScopeModeSemantic = mdit({ html: true, langPrefix: 'language-' }).use(mditRendererFence, {
  highlightRenderer: 'api',
  customHighlight: {
    provider: 'shiki',
    highlighter: shikiHighlighter,
    theme: 'github-light',
    includeScopeStyles: false,
    shikiScopeMode: 'semantic',
  },
}).use(mditAttrs)
const mdApiHljsProvider = mdit({ html: true, langPrefix: 'language-' }).use(mditRendererFence, {
  highlightRenderer: 'api',
  customHighlight: {
    provider: 'hljs',
    hljsHighlight: (code, lang) => {
      const target = (lang && highlightjs.getLanguage(lang)) ? lang : 'plaintext'
      return highlightjs.highlight(code, { language: target })
    },
  },
}).use(mditAttrs)

let __dirname = path.dirname(new URL(import.meta.url).pathname)
const isWindows = (process.platform === 'win32')
if (isWindows) {
  __dirname = __dirname.replace(/^\/+/, '').replace(/\//g, '\\')
}

const testData = {
  noOption: __dirname + path.sep +  'examples.txt',
  highlightjs: __dirname + path.sep +  'examples-highlightjs.txt',
  sampComment: __dirname + path.sep + 'example-samp-comment.txt',
  linesEmphasis: __dirname + path.sep +  'example-lines-emphasis.txt',
  lineEndSpan: __dirname + path.sep +  'example-line-end-span.txt',
  startInvalid: __dirname + path.sep + 'example-start-invalid.txt',
  commentLineMismatch: __dirname + path.sep + 'example-comment-line-mismatch.txt',
  voidTags: __dirname + path.sep + 'example-void-tags.txt',
  markupPreAttrs: __dirname + path.sep + 'example-markup-pre-attrs.txt',
  shiki: __dirname + path.sep + 'examples-shiki.txt',
  shikiClassic: __dirname + path.sep + 'examples-shiki-classic.txt',
  shikiClassicPass: __dirname + path.sep + 'examples-shiki-classic-pass.txt',
}
const customHighlightData = {
  apiEnvBasicMd: __dirname + path.sep + 'custom-highlight' + path.sep + 'api-env-basic.md',
  apiEnvBasicHtml: __dirname + path.sep + 'custom-highlight' + path.sep + 'api-env-basic.html',
  apiEnvBasicPayload: __dirname + path.sep + 'custom-highlight' + path.sep + 'api-env-basic.payload.json',
  apiFallbackPlainMd: __dirname + path.sep + 'custom-highlight' + path.sep + 'api-fallback-plain.md',
  apiFallbackPlainHtml: __dirname + path.sep + 'custom-highlight' + path.sep + 'api-fallback-plain.html',
  apiFallbackMarkupMd: __dirname + path.sep + 'custom-highlight' + path.sep + 'api-fallback-markup.md',
  apiFallbackMarkupHtml: __dirname + path.sep + 'custom-highlight' + path.sep + 'api-fallback-markup.html',
  apiInlineScriptMd: __dirname + path.sep + 'custom-highlight' + path.sep + 'api-inline-script.md',
  apiInlineScriptHtml: __dirname + path.sep + 'custom-highlight' + path.sep + 'api-inline-script.html',
  apiShikiProviderMd: __dirname + path.sep + 'custom-highlight' + path.sep + 'api-shiki-provider.md',
  apiShikiProviderHtml: __dirname + path.sep + 'custom-highlight' + path.sep + 'api-shiki-provider.html',
}

const getTestData = (pat) => {
  let ms = [];
  if(!fs.existsSync(pat)) {
    console.log('No exist: ' + pat)
    return ms
  }
  const exampleCont = fs.readFileSync(pat, 'utf-8').trim();

  let ms0 = exampleCont.split(/\n*\[Markdown\]\n/);
  let n = 1;
  while(n < ms0.length) {
    let mhs = ms0[n].split(/\n+\[HTML[^\]]*?\]\n/);
    let i = 1;
    while (i < 2) {
      if (mhs[i] === undefined) {
        mhs[i] = '';
      } else {
        mhs[i] = mhs[i].replace(/$/,'\n');
      }
      i++;
    }
    ms[n] = {
      "markdown": mhs[0],
      "html": mhs[1],
    };
    n++;
  }
  return ms
}

const runTest = (process, pat, pass, testId) => {
  console.log('===========================================================')
  console.log(pat)
  let ms = getTestData(pat)
  if (ms.length === 0) return
  let n = 1;
  let end = ms.length - 1
  if(testId) {
    if (testId[0]) n = testId[0]
    if (testId[1]) {
      if (ms.length >= testId[1]) {
        end = testId[1]
      }
    }
  }
  //console.log(n, end)

  while(n <= end) {
    if (!ms[n]
    //|| n != 14
    ) {
      n++
      continue
    }

    const m = ms[n].markdown;
    const h = process.render(m)
    console.log('Test: ' + n + ' >>>');
    try {
      assert.strictEqual(h, ms[n].html);
    } catch(e) {
      pass = false
      //console.log('Test: ' + n + ' >>>');
      //console.log(opt);
      console.log(ms[n].markdown);
      console.log('incorrect:');
      console.log('H: ' + h +'C: ' + ms[n].html);
    }
    n++;
  }
  return pass
}

const readTextFile = (pat) => {
  if (!fs.existsSync(pat)) throw new Error(`No exist: ${pat}`)
  return fs.readFileSync(pat, 'utf-8')
}

const runApiFixture = ({ label, mdInstance, markdownPath, htmlPath, payloadPath, verify }) => {
  console.log('===========================================================')
  console.log(label)
  try {
    const markdown = readTextFile(markdownPath)
    const expectedHtml = readTextFile(htmlPath)
    const env = {}
    const actualHtml = mdInstance.render(markdown, env)
    assert.strictEqual(actualHtml, expectedHtml)
    if (payloadPath) {
      const expectedPayload = JSON.parse(readTextFile(payloadPath))
      assert.ok(env.rendererFenceCustomHighlights)
      assert.ok(env.rendererFenceCustomHighlights['hl-1'])
      assert.deepStrictEqual(env.rendererFenceCustomHighlights['hl-1'], expectedPayload)
    }
    if (typeof verify === 'function') verify(env, actualHtml)
    console.log('Test: ' + label + ' >>>')
    return true
  } catch (e) {
    console.log('incorrect:')
    console.log(e)
    return false
  }
}

const withMockHighlightApi = (run) => {
  const prevCss = globalThis.CSS
  const prevHighlight = globalThis.Highlight
  const prevRange = globalThis.Range
  const store = new Map()
  let setCount = 0
  let deleteCount = 0
  globalThis.CSS = {
    highlights: {
      set: (name, value) => {
        setCount++
        store.set(name, value)
      },
      has: (name) => store.has(name),
      delete: (name) => {
        deleteCount++
        store.delete(name)
      },
    },
  }
  globalThis.Highlight = class MockHighlight {
    constructor(...ranges) {
      this.ranges = ranges
    }
  }
  globalThis.Range = class MockRange {}
  try {
    return run({
      store,
      getSetCount: () => setCount,
      getDeleteCount: () => deleteCount,
      resetCounts: () => {
        setCount = 0
        deleteCount = 0
      },
    })
  } finally {
    if (prevCss === undefined) delete globalThis.CSS
    else globalThis.CSS = prevCss
    if (prevHighlight === undefined) delete globalThis.Highlight
    else globalThis.Highlight = prevHighlight
    if (prevRange === undefined) delete globalThis.Range
    else globalThis.Range = prevRange
  }
}

const createMockRuntimeRoot = () => {
  const byId = new Map()
  const headNodes = []
  const documentElementNodes = []
  const aggregateScript = { textContent: '{}', getAttribute: () => null }
  const inlineScripts = []
  const blocks = []
  let walkerCallCount = 0
  const doc = {
    head: {
      appendChild: (node) => {
        headNodes.push(node)
        if (node && node.id) byId.set(node.id, node)
      },
    },
    documentElement: {
      appendChild: (node) => {
        documentElementNodes.push(node)
        if (node && node.id) byId.set(node.id, node)
      },
    },
    getElementById: (id) => byId.get(id) || null,
    createElement: (tag) => ({ tagName: String(tag || '').toUpperCase(), id: '', textContent: '' }),
    createRange: () => ({
      setStart: () => {},
      setEnd: () => {},
    }),
    createTreeWalker: (node) => {
      walkerCallCount++
      const textNodes = Array.isArray(node.__textNodes) ? node.__textNodes : []
      let idx = 0
      return {
        nextNode: () => {
          if (idx >= textNodes.length) return null
          return textNodes[idx++]
        },
      }
    },
  }
  const root = {
    ownerDocument: doc,
    querySelector: (selector) => {
      if (selector === '#pre-highlight-data') return aggregateScript
      return null
    },
    querySelectorAll: (selector) => {
      if (selector.includes('script[type="application/json"][data-pre-highlight]')) return inlineScripts
      if (selector.includes('pre[data-pre-highlight] > code')) return blocks.map((pre) => pre.codeEl)
      if (selector === 'pre[data-pre-highlight]') return blocks
      if (selector === 'pre[data-pre-highlight-applied]') return blocks.filter((pre) => pre.getAttribute('data-pre-highlight-applied'))
      return []
    },
  }

  const setPayloadMap = (payloadMap) => {
    aggregateScript.textContent = JSON.stringify(payloadMap || {})
  }
  const setInlinePayload = (payloadById) => {
    inlineScripts.length = 0
    if (!payloadById || typeof payloadById !== 'object') return
    for (const [id, payload] of Object.entries(payloadById)) {
      inlineScripts.push({
        textContent: JSON.stringify(payload),
        getAttribute: (name) => (name === 'data-pre-highlight' ? id : null),
      })
    }
  }
  const setBlocks = (items) => {
    blocks.length = 0
    for (const item of items) {
      const textNode = { ownerDocument: doc, nodeValue: item.text }
      const codeEl = { ownerDocument: doc, parentElement: null, __textNodes: [textNode] }
      Object.defineProperty(codeEl, 'firstChild', {
        get() {
          return this.__textNodes[0] || null
        },
      })
      Object.defineProperty(codeEl, 'lastChild', {
        get() {
          return this.__textNodes.length ? this.__textNodes[this.__textNodes.length - 1] : null
        },
      })
      Object.defineProperty(codeEl, 'textContent', {
        get() {
          let out = ''
          for (let i = 0; i < this.__textNodes.length; i++) out += this.__textNodes[i].nodeValue || ''
          return out
        },
      })
      const attrs = { 'data-pre-highlight': item.id }
      const pre = {
        ownerDocument: doc,
        codeEl,
        attrs,
        getAttribute: (name) => (Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null),
        setAttribute: (name, value) => {
          attrs[name] = String(value)
        },
        removeAttribute: (name) => {
          delete attrs[name]
        },
      }
      codeEl.parentElement = pre
      blocks.push(pre)
    }
  }
  const getStyleText = () => {
    const node = byId.get('pre-highlight-style')
    return node ? node.textContent : ''
  }
  const getWalkerCallCount = () => walkerCallCount
  const resetWalkerCallCount = () => {
    walkerCallCount = 0
  }

  return {
    root,
    doc,
    setBlocks,
    setPayloadMap,
    setInlinePayload,
    blocks,
    getStyleText,
    headNodes,
    documentElementNodes,
    getWalkerCallCount,
    resetWalkerCallCount,
  }
}

const runRuntimeApiReapplyTest = () => {
  console.log('===========================================================')
  console.log('custom-highlight-runtime-reapply')
  try {
    withMockHighlightApi(({ store }) => {
      const runtime = createMockRuntimeRoot()
      runtime.setBlocks([{ id: 'hl-1', text: 'const value' }])
      runtime.setPayloadMap({
        'hl-1': {
          v: 1,
          engine: 'custom',
          lang: 'js',
          offsetEncoding: 'utf16',
          newline: 'lf',
          textLength: 11,
          scopes: ['hl-keyword'],
          ranges: [[0, 0, 5]],
          scopeStyles: [{ color: '#ff0000' }],
        },
      })

      const first = applyCustomHighlights(runtime.root)
      assert.deepStrictEqual(first, { appliedBlocks: 1, appliedRanges: 1 })
      const firstApplied = runtime.blocks[0].getAttribute('data-pre-highlight-applied')
      assert.ok(firstApplied)
      assert.ok(store.has(firstApplied))
      assert.ok(runtime.getStyleText().includes('::highlight('))

      runtime.blocks[0].setAttribute('data-pre-highlight', 'hl-2')
      runtime.blocks[0].codeEl.__textNodes = [{ ownerDocument: runtime.doc, nodeValue: 'let value' }]
      runtime.setPayloadMap({
        'hl-2': {
          v: 1,
          engine: 'custom',
          lang: 'js',
          offsetEncoding: 'utf16',
          newline: 'lf',
          textLength: 9,
          scopes: ['hl-identifier'],
          ranges: [[0, 4, 9]],
          scopeStyles: [{ color: '#00aa00' }],
        },
      })

      const second = applyCustomHighlights(runtime.root)
      assert.deepStrictEqual(second, { appliedBlocks: 1, appliedRanges: 1 })
      const secondApplied = runtime.blocks[0].getAttribute('data-pre-highlight-applied')
      assert.ok(secondApplied)
      assert.notStrictEqual(secondApplied, firstApplied)
      assert.ok(!store.has(firstApplied))
      assert.ok(store.has(secondApplied))

      const cleared = clearCustomHighlights(runtime.root)
      assert.strictEqual(cleared.cleared, 1)
      assert.ok(!store.has(secondApplied))
    })
    console.log('Test: custom-highlight-runtime-reapply >>>')
    return true
  } catch (e) {
    console.log('incorrect:')
    console.log(e)
    return false
  }
}

const runRuntimeInlineScriptTest = () => {
  console.log('===========================================================')
  console.log('custom-highlight-runtime-inline-script')
  try {
    withMockHighlightApi(() => {
      const runtime = createMockRuntimeRoot()
      runtime.setBlocks([{ id: 'hl-10', text: 'return 1' }])
      runtime.setPayloadMap({})
      runtime.setInlinePayload({
        'hl-10': {
          v: 1,
          engine: 'custom',
          lang: 'js',
          offsetEncoding: 'utf16',
          newline: 'lf',
          textLength: 8,
          scopes: ['hl-keyword'],
          ranges: [[0, 0, 6]],
          scopeStyles: [],
        },
      })
      const result = applyCustomHighlights(runtime.root)
      assert.deepStrictEqual(result, { appliedBlocks: 1, appliedRanges: 1 })
      const applied = runtime.blocks[0].getAttribute('data-pre-highlight-applied')
      assert.ok(applied)
      const cleared = clearCustomHighlights(runtime.root)
      assert.strictEqual(cleared.cleared, 1)
    })
    console.log('Test: custom-highlight-runtime-inline-script >>>')
    return true
  } catch (e) {
    console.log('incorrect:')
    console.log(e)
    return false
  }
}

const runRuntimeIncrementalSkipTest = () => {
  console.log('===========================================================')
  console.log('custom-highlight-runtime-incremental-skip')
  try {
    withMockHighlightApi(() => {
      const runtime = createMockRuntimeRoot()
      runtime.setBlocks([{ id: 'hl-1', text: 'const value' }])
      runtime.setPayloadMap({
        'hl-1': {
          v: 1,
          engine: 'custom',
          lang: 'js',
          offsetEncoding: 'utf16',
          newline: 'lf',
          textLength: 11,
          scopes: ['hl-keyword'],
          ranges: [[0, 0, 5]],
        },
      })
      const first = applyCustomHighlights(runtime.root, { incremental: true })
      assert.deepStrictEqual(first, { appliedBlocks: 1, appliedRanges: 1 })
      const second = applyCustomHighlights(runtime.root, { incremental: true })
      assert.deepStrictEqual(second, { appliedBlocks: 0, appliedRanges: 0, skipped: true, reason: 'unchanged' })
      runtime.setPayloadMap({
        'hl-1': {
          v: 1,
          engine: 'custom',
          lang: 'js',
          offsetEncoding: 'utf16',
          newline: 'lf',
          textLength: 11,
          scopes: ['hl-keyword'],
          ranges: [[0, 6, 11]],
        },
      })
      const third = applyCustomHighlights(runtime.root, { incremental: true })
      assert.deepStrictEqual(third, { appliedBlocks: 1, appliedRanges: 1 })
    })
    console.log('Test: custom-highlight-runtime-incremental-skip >>>')
    return true
  } catch (e) {
    console.log('incorrect:')
    console.log(e)
    return false
  }
}

const runRuntimeIncrementalPartialReuseTest = () => {
  console.log('===========================================================')
  console.log('custom-highlight-runtime-incremental-partial-reuse')
  try {
    withMockHighlightApi(() => {
      const runtime = createMockRuntimeRoot()
      runtime.setBlocks([
        { id: 'hl-1', text: 'const value' },
        { id: 'hl-2', text: 'let value' },
      ])
      runtime.setPayloadMap({
        'hl-1': {
          v: 1,
          engine: 'custom',
          lang: 'js',
          offsetEncoding: 'utf16',
          newline: 'lf',
          textLength: 11,
          scopes: ['hl-keyword'],
          ranges: [[0, 0, 5]],
        },
        'hl-2': {
          v: 1,
          engine: 'custom',
          lang: 'js',
          offsetEncoding: 'utf16',
          newline: 'lf',
          textLength: 9,
          scopes: ['hl-keyword'],
          ranges: [[0, 0, 3]],
        },
      })
      runtime.resetWalkerCallCount()
      const first = applyCustomHighlights(runtime.root, { incremental: true })
      assert.deepStrictEqual(first, { appliedBlocks: 2, appliedRanges: 2 })
      assert.strictEqual(runtime.getWalkerCallCount(), 2)

      runtime.blocks[1].codeEl.__textNodes = [{ ownerDocument: runtime.doc, nodeValue: 'let updated' }]
      runtime.setPayloadMap({
        'hl-1': {
          v: 1,
          engine: 'custom',
          lang: 'js',
          offsetEncoding: 'utf16',
          newline: 'lf',
          textLength: 11,
          scopes: ['hl-keyword'],
          ranges: [[0, 0, 5]],
        },
        'hl-2': {
          v: 1,
          engine: 'custom',
          lang: 'js',
          offsetEncoding: 'utf16',
          newline: 'lf',
          textLength: 11,
          scopes: ['hl-keyword'],
          ranges: [[0, 0, 3]],
        },
      })
      runtime.resetWalkerCallCount()
      const second = applyCustomHighlights(runtime.root, { incremental: true })
      assert.deepStrictEqual(second, { appliedBlocks: 2, appliedRanges: 2 })
      assert.strictEqual(runtime.getWalkerCallCount(), 1)
    })
    console.log('Test: custom-highlight-runtime-incremental-partial-reuse >>>')
    return true
  } catch (e) {
    console.log('incorrect:')
    console.log(e)
    return false
  }
}

const runRuntimeIncrementalScopeDiffUpdateTest = () => {
  console.log('===========================================================')
  console.log('custom-highlight-runtime-incremental-scope-diff-update')
  try {
    withMockHighlightApi(({ getSetCount, getDeleteCount, resetCounts }) => {
      const runtime = createMockRuntimeRoot()
      runtime.setBlocks([
        { id: 'hl-1', text: 'const value' },
        { id: 'hl-2', text: '12345' },
      ])
      runtime.setPayloadMap({
        'hl-1': {
          v: 1,
          engine: 'custom',
          lang: 'js',
          offsetEncoding: 'utf16',
          newline: 'lf',
          textLength: 11,
          scopes: ['hl-keyword'],
          ranges: [[0, 0, 5]],
        },
        'hl-2': {
          v: 1,
          engine: 'custom',
          lang: 'txt',
          offsetEncoding: 'utf16',
          newline: 'lf',
          textLength: 5,
          scopes: ['hl-number'],
          ranges: [[0, 0, 5]],
        },
      })

      const first = applyCustomHighlights(runtime.root, { incremental: true })
      assert.deepStrictEqual(first, { appliedBlocks: 2, appliedRanges: 2 })
      assert.strictEqual(getSetCount(), 2)

      resetCounts()
      runtime.blocks[1].codeEl.__textNodes = [{ ownerDocument: runtime.doc, nodeValue: '987654' }]
      runtime.setPayloadMap({
        'hl-1': {
          v: 1,
          engine: 'custom',
          lang: 'js',
          offsetEncoding: 'utf16',
          newline: 'lf',
          textLength: 11,
          scopes: ['hl-keyword'],
          ranges: [[0, 0, 5]],
        },
        'hl-2': {
          v: 1,
          engine: 'custom',
          lang: 'txt',
          offsetEncoding: 'utf16',
          newline: 'lf',
          textLength: 6,
          scopes: ['hl-number'],
          ranges: [[0, 0, 6]],
        },
      })
      const second = applyCustomHighlights(runtime.root, { incremental: true })
      assert.deepStrictEqual(second, { appliedBlocks: 2, appliedRanges: 2 })
      assert.strictEqual(getSetCount(), 1)
      assert.strictEqual(getDeleteCount(), 0)

      resetCounts()
      runtime.setPayloadMap({
        'hl-1': {
          v: 1,
          engine: 'custom',
          lang: 'js',
          offsetEncoding: 'utf16',
          newline: 'lf',
          textLength: 11,
          scopes: ['hl-keyword'],
          ranges: [[0, 0, 5]],
        },
      })
      const third = applyCustomHighlights(runtime.root, { incremental: true })
      assert.deepStrictEqual(third, { appliedBlocks: 1, appliedRanges: 1 })
      assert.strictEqual(getSetCount(), 0)
      assert.strictEqual(getDeleteCount(), 1)
    })
    console.log('Test: custom-highlight-runtime-incremental-scope-diff-update >>>')
    return true
  } catch (e) {
    console.log('incorrect:')
    console.log(e)
    return false
  }
}

const runRuntimeVersionPolicyTest = () => {
  console.log('===========================================================')
  console.log('custom-highlight-runtime-version-policy')
  try {
    withMockHighlightApi(() => {
      const futureVersion = customHighlightPayloadSchemaVersion + 1
      const runtime = createMockRuntimeRoot()
      runtime.setBlocks([{ id: 'hl-1', text: 'const value' }])
      runtime.setPayloadMap({
        'hl-1': {
          v: futureVersion,
          engine: 'custom',
          lang: 'js',
          offsetEncoding: 'utf16',
          newline: 'lf',
          textLength: 11,
          scopes: ['hl-keyword'],
          ranges: [[0, 0, 5]],
        },
      })
      const strict = applyCustomHighlights(runtime.root, { strictVersion: true })
      assert.deepStrictEqual(strict, { appliedBlocks: 0, appliedRanges: 0 })
      const customAccepted = applyCustomHighlights(runtime.root, {
        supportedVersions: [futureVersion],
      })
      assert.deepStrictEqual(customAccepted, { appliedBlocks: 1, appliedRanges: 1 })
    })
    console.log('Test: custom-highlight-runtime-version-policy >>>')
    return true
  } catch (e) {
    console.log('incorrect:')
    console.log(e)
    return false
  }
}

const runRuntimeDiagnosticsHookTest = () => {
  console.log('===========================================================')
  console.log('custom-highlight-runtime-diagnostics-hook')
  try {
    withMockHighlightApi(() => {
      const runtime = createMockRuntimeRoot()
      runtime.setBlocks([
        { id: 'hl-1', text: 'const value' },
        { id: 'hl-2', text: 'short' },
        { id: 'hl-3', text: 'noop' },
        { id: 'hl-4', text: 'abc' },
      ])
      runtime.setPayloadMap({
        'hl-1': {
          v: 1,
          engine: 'custom',
          lang: 'js',
          offsetEncoding: 'utf16',
          newline: 'lf',
          textLength: 11,
          scopes: ['hl-keyword'],
          ranges: [[0, 0, 5]],
        },
        'hl-2': {
          v: 1,
          engine: 'custom',
          lang: 'txt',
          offsetEncoding: 'utf16',
          newline: 'lf',
          textLength: 999,
          scopes: ['hl-text'],
          ranges: [[0, 0, 5]],
        },
        'hl-4': {
          v: 1,
          engine: 'custom',
          lang: 'txt',
          offsetEncoding: 'utf16',
          newline: 'lf',
          textLength: 3,
          scopes: ['hl-text'],
          ranges: [
            [0, 1],
            [2, 0, 1],
          ],
        },
      })
      const diagnostics = []
      const result = applyCustomHighlights(runtime.root, {
        onRuntimeDiagnostic: (data) => diagnostics.push(data),
      })
      assert.deepStrictEqual(result, { appliedBlocks: 1, appliedRanges: 1 })
      assert.ok(diagnostics.some((d) => d.type === 'block-skip' && d.blockId === 'hl-2' && d.reason === 'text-length-mismatch'))
      assert.ok(diagnostics.some((d) => d.type === 'block-skip' && d.blockId === 'hl-3' && d.reason === 'missing-payload'))
      assert.ok(diagnostics.some((d) => d.type === 'range-skip' && d.blockId === 'hl-4' && d.reason === 'invalid-tuple'))
      assert.ok(diagnostics.some((d) => d.type === 'range-skip' && d.blockId === 'hl-4' && d.reason === 'invalid-scope-index'))
      assert.ok(diagnostics.some((d) => d.type === 'block-skip' && d.blockId === 'hl-4' && d.reason === 'no-valid-ranges'))
    })
    console.log('Test: custom-highlight-runtime-diagnostics-hook >>>')
    return true
  } catch (e) {
    console.log('incorrect:')
    console.log(e)
    return false
  }
}

const runRuntimeLazyObserverTest = () => {
  console.log('===========================================================')
  console.log('custom-highlight-runtime-lazy-observer')
  const prevObserver = globalThis.IntersectionObserver
  let observerInstance = null
  globalThis.IntersectionObserver = class MockIntersectionObserver {
    constructor(callback, opt) {
      this.callback = callback
      this.options = opt
      this.targets = []
      this.disconnected = false
      observerInstance = this
    }
    observe(target) {
      this.targets.push(target)
    }
    disconnect() {
      this.disconnected = true
    }
    trigger(entries) {
      this.callback(entries)
    }
  }
  try {
    withMockHighlightApi(({ store }) => {
      const runtime = createMockRuntimeRoot()
      runtime.setBlocks([{ id: 'hl-1', text: 'const value' }])
      runtime.setPayloadMap({
        'hl-1': {
          v: 1,
          engine: 'custom',
          lang: 'js',
          offsetEncoding: 'utf16',
          newline: 'lf',
          textLength: 11,
          scopes: ['hl-keyword'],
          ranges: [[0, 0, 5]],
        },
      })
      const lazy = observeCustomHighlights(runtime.root, {
        autoStart: true,
        once: true,
        rootMargin: '120px',
      })
      assert.strictEqual(lazy.supported, true)
      assert.ok(observerInstance)
      assert.strictEqual(observerInstance.targets.length, 1)
      observerInstance.trigger([{ target: runtime.blocks[0], isIntersecting: false, intersectionRatio: 0 }])
      assert.strictEqual(runtime.blocks[0].getAttribute('data-pre-highlight-applied'), null)
      observerInstance.trigger([{ target: runtime.blocks[0], isIntersecting: true, intersectionRatio: 1 }])
      const appliedName = runtime.blocks[0].getAttribute('data-pre-highlight-applied')
      assert.ok(appliedName)
      assert.ok(store.has(appliedName))
      assert.strictEqual(observerInstance.disconnected, true)
    })
    console.log('Test: custom-highlight-runtime-lazy-observer >>>')
    return true
  } catch (e) {
    console.log('incorrect:')
    console.log(e)
    return false
  } finally {
    if (prevObserver === undefined) delete globalThis.IntersectionObserver
    else globalThis.IntersectionObserver = prevObserver
  }
}

const runApiHljsProviderTest = () => {
  console.log('===========================================================')
  console.log('api-hljs-provider')
  try {
    const env = {}
    const markdown = '```javascript\nconst x = 1\n```\n'
    const html = mdApiHljsProvider.render(markdown, env)
    assert.ok(html.includes('<pre data-pre-highlight="hl-1"><code class="language-javascript">const x = 1'))
    assert.ok(env.rendererFenceCustomHighlights)
    const payload = env.rendererFenceCustomHighlights['hl-1']
    assert.ok(payload)
    assert.strictEqual(payload.engine, 'hljs')
    assert.ok(Array.isArray(payload.scopes) && payload.scopes.length > 0)
    assert.ok(Array.isArray(payload.ranges) && payload.ranges.length > 0)
    assert.ok(payload.scopes.every(name => name.startsWith('hl-hljs-')))
    console.log('Test: api-hljs-provider >>>')
    return true
  } catch (e) {
    console.log('incorrect:')
    console.log(e)
    return false
  }
}

const runApiShikiProviderNoStylesTest = () => {
  console.log('===========================================================')
  console.log('api-shiki-provider-no-scope-styles')
  try {
    const env = {}
    const markdown = '```javascript\nconst x = 1\n```\n'
    mdApiShikiProviderNoStyles.render(markdown, env)
    assert.ok(env.rendererFenceCustomHighlights)
    const payload = env.rendererFenceCustomHighlights['hl-1']
    assert.ok(payload)
    assert.strictEqual(payload.engine, 'shiki')
    assert.ok(Array.isArray(payload.scopes) && payload.scopes.length > 0)
    assert.ok(Array.isArray(payload.ranges) && payload.ranges.length > 0)
    assert.ok(!Object.prototype.hasOwnProperty.call(payload, 'scopeStyles'))
    console.log('Test: api-shiki-provider-no-scope-styles >>>')
    return true
  } catch (e) {
    console.log('incorrect:')
    console.log(e)
    return false
  }
}

const runApiShikiProviderMissingHighlighterTest = () => {
  console.log('===========================================================')
  console.log('api-shiki-provider-missing-highlighter')
  try {
    const env = {}
    const markdown = '```javascript\nconst x = 1\n```\n'
    const html = mdApiShikiProviderMissingHighlighter.render(markdown, env)
    assert.ok(html.includes('<pre><code class=\"language-javascript\">const x = 1'))
    assert.ok(env.rendererFenceCustomHighlights)
    assert.strictEqual(Object.keys(env.rendererFenceCustomHighlights).length, 0)
    console.log('Test: api-shiki-provider-missing-highlighter >>>')
    return true
  } catch (e) {
    console.log('incorrect:')
    console.log(e)
    return false
  }
}

const runApiShikiProviderExplanationTest = () => {
  console.log('===========================================================')
  console.log('api-shiki-provider-explanation')
  try {
    const env = {}
    const markdown = '```javascript\nconst x = 1\n```\n'
    mdApiShikiProviderExplanation.render(markdown, env)
    assert.ok(env.rendererFenceCustomHighlights)
    const payload = env.rendererFenceCustomHighlights['hl-1']
    assert.ok(payload)
    assert.strictEqual(payload.engine, 'shiki')
    assert.ok(Array.isArray(payload.scopes) && payload.scopes.length > 0)
    assert.ok(payload.scopes.some(name => name.includes('storage-type-js')))
    assert.ok(payload.scopes.every(name => !name.includes('object-object')))
    console.log('Test: api-shiki-provider-explanation >>>')
    return true
  } catch (e) {
    console.log('incorrect:')
    console.log(e)
    return false
  }
}

const runApiShikiProviderHighlighterExplanationTest = () => {
  console.log('===========================================================')
  console.log('api-shiki-provider-highlighter-explanation')
  try {
    const env = {}
    const markdown = '```javascript\nconst x = 1\n```\n'
    mdApiShikiProviderHighlighterExplanation.render(markdown, env)
    assert.ok(env.rendererFenceCustomHighlights)
    const payload = env.rendererFenceCustomHighlights['hl-1']
    assert.ok(payload)
    assert.strictEqual(payload.engine, 'shiki')
    assert.ok(Array.isArray(payload.scopes) && payload.scopes.length > 0)
    assert.ok(payload.scopes.some(name => name.includes('storage-type-js')))
    assert.ok(payload.scopes.every(name => !name.includes('object-object')))
    console.log('Test: api-shiki-provider-highlighter-explanation >>>')
    return true
  } catch (e) {
    console.log('incorrect:')
    console.log(e)
    return false
  }
}

const runApiShikiProviderKeywordTest = () => {
  console.log('===========================================================')
  console.log('api-shiki-provider-keyword')
  try {
    const env = {}
    const markdown = '```javascript\nconst x = 1\n```\n'
    mdApiShikiProviderKeyword.render(markdown, env)
    assert.ok(env.rendererFenceCustomHighlights)
    const payload = env.rendererFenceCustomHighlights['hl-1']
    assert.ok(payload)
    assert.strictEqual(payload.engine, 'shiki')
    assert.ok(Array.isArray(payload.scopes) && payload.scopes.length > 0)
    assert.ok(payload.scopes.every(name => name.startsWith('hl-shiki-')))
    assert.ok(payload.scopes.some(name => name.endsWith('-keyword')))
    assert.ok(payload.scopes.some(name => name.endsWith('-number')))
    assert.ok(payload.scopes.every(name => !name.endsWith('-js')))
    assert.ok(payload.scopes.every(name => !name.includes('object-object')))
    assert.ok(!Object.prototype.hasOwnProperty.call(payload, 'scopeStyles'))
    console.log('Test: api-shiki-provider-keyword >>>')
    return true
  } catch (e) {
    console.log('incorrect:')
    console.log(e)
    return false
  }
}

const runApiShikiProviderScopeModeSemanticTest = () => {
  console.log('===========================================================')
  console.log('api-shiki-provider-scope-mode-semantic')
  try {
    const env = {}
    const markdown = '```javascript\nconst x = 1\n```\n'
    mdApiShikiProviderScopeModeSemantic.render(markdown, env)
    assert.ok(env.rendererFenceCustomHighlights)
    const payload = env.rendererFenceCustomHighlights['hl-1']
    assert.ok(payload)
    assert.strictEqual(payload.engine, 'shiki')
    assert.ok(Array.isArray(payload.scopes) && payload.scopes.length > 0)
    assert.ok(payload.scopes.some(name => name.includes('storage-type-js')))
    assert.ok(payload.scopes.every(name => !name.includes('object-object')))
    assert.ok(!Object.prototype.hasOwnProperty.call(payload, 'scopeStyles'))
    console.log('Test: api-shiki-provider-scope-mode-semantic >>>')
    return true
  } catch (e) {
    console.log('incorrect:')
    console.log(e)
    return false
  }
}

const runApiShikiProviderScopeModeKeywordTest = () => {
  console.log('===========================================================')
  console.log('api-shiki-provider-scope-mode-keyword')
  try {
    const mdKeyword = mdit({ html: true, langPrefix: 'language-' }).use(mditRendererFence, {
      highlightRenderer: 'api',
      customHighlight: {
        provider: 'shiki',
        highlighter: shikiHighlighter,
        theme: 'github-light',
        includeScopeStyles: false,
        shikiScopeMode: 'keyword',
      },
    }).use(mditAttrs)
    const env = {}
    mdKeyword.render('```php\n$list = [1, 2];\n$next = array_slice($list, 0, 1);\n```\n', env)
    const payload = env.rendererFenceCustomHighlights['hl-1']
    assert.ok(payload)
    assert.ok(Array.isArray(payload.scopes) && payload.scopes.length > 0)
    assert.ok(payload.scopes.every(name => name.startsWith('hl-shiki-')))
    assert.ok(payload.scopes.some(name => name.endsWith('-title-function-builtin') || name.endsWith('-variable-const') || name.endsWith('-keyword')))
    assert.ok(payload.scopes.every(name => !name.endsWith('-php')))

    console.log('Test: api-shiki-provider-scope-mode-keyword >>>')
    return true
  } catch (e) {
    console.log('incorrect:')
    console.log(e)
    return false
  }
}

const runApiShikiProviderKeywordClassifierTest = () => {
  console.log('===========================================================')
  console.log('api-shiki-provider-keyword-classifier')
  try {
    const env = {}
    const markdown = '```javascript\nconst x = 1\n```\n'
    mdApiShikiProviderKeywordClassifier.render(markdown, env)
    assert.ok(env.rendererFenceCustomHighlights)
    const payload = env.rendererFenceCustomHighlights['hl-1']
    assert.ok(payload)
    assert.strictEqual(payload.engine, 'shiki')
    assert.ok(Array.isArray(payload.scopes) && payload.scopes.length > 0)
    assert.ok(payload.scopes.some(name => name.endsWith('-num')))
    assert.ok(payload.scopes.some(name => name.endsWith('-keyword')))
    console.log('Test: api-shiki-provider-keyword-classifier >>>')
    return true
  } catch (e) {
    console.log('incorrect:')
    console.log(e)
    return false
  }
}

const runApiShikiProviderKeywordLangResolverTest = () => {
  console.log('===========================================================')
  console.log('api-shiki-provider-keyword-lang-resolver')
  try {
    const env = {}
    const markdown = '```x-unknown\nconst value\n```\n'
    mdApiShikiProviderKeywordLangResolver.render(markdown, env)
    assert.ok(env.rendererFenceCustomHighlights)
    const payload = env.rendererFenceCustomHighlights['hl-1']
    assert.ok(payload)
    assert.strictEqual(payload.engine, 'shiki')
    assert.ok(Array.isArray(payload.scopes) && payload.scopes.length > 0)
    assert.ok(payload.scopes.some(name => name.endsWith('-keyword')), `expected keyword bucket in scopes: ${payload.scopes.join(', ')}`)
    console.log('Test: api-shiki-provider-keyword-lang-resolver >>>')
    return true
  } catch (e) {
    console.log('incorrect:')
    console.log(e)
    return false
  }
}

const runApiShikiProviderKeywordLangResolverHookTest = () => {
  console.log('===========================================================')
  console.log('api-shiki-provider-keyword-lang-resolver-hook')
  try {
    const env = {}
    const markdown = '```x-unknown\nconst value\n```\n'
    mdApiShikiProviderKeywordLangResolverHook.render(markdown, env)
    assert.ok(env.rendererFenceCustomHighlights)
    const payload = env.rendererFenceCustomHighlights['hl-1']
    assert.ok(payload)
    assert.strictEqual(payload.engine, 'shiki')
    assert.ok(Array.isArray(payload.scopes) && payload.scopes.length > 0)
    assert.ok(payload.scopes.some(name => name.endsWith('-keyword')), `expected keyword bucket in scopes: ${payload.scopes.join(', ')}`)
    console.log('Test: api-shiki-provider-keyword-lang-resolver-hook >>>')
    return true
  } catch (e) {
    console.log('incorrect:')
    console.log(e)
    return false
  }
}

const runApiShikiProviderKeywordAliasCoverageTest = () => {
  console.log('===========================================================')
  console.log('api-shiki-provider-keyword-alias-coverage')
  try {
    const cases = [
      { lang: 'js', code: 'const x = 1', bucket: 'keyword' },
      { lang: 'ts', code: 'interface User {}', bucket: 'keyword' },
      { lang: 'shell', code: 'if [ -n \"$x\" ]; then', bucket: 'keyword' },
      { lang: 'c#', code: 'namespace App {', bucket: 'keyword' },
      { lang: 'c++', code: 'template <typename T>', bucket: 'keyword' },
      { lang: 'php', code: 'function hello() {', bucket: 'keyword' },
      { lang: 'hcl', code: 'resource \"null_resource\" \"x\" {', bucket: 'title-class' },
      { lang: 'terraform', code: 'resource \"null_resource\" \"x\" {', bucket: 'text' },
    ]
    for (const item of cases) {
      const env = {}
      const markdown = `\`\`\`${item.lang}\n${item.code}\n\`\`\`\n`
      mdApiShikiProviderKeywordAliasCoverage.render(markdown, env)
      assert.ok(env.rendererFenceCustomHighlights, `missing payload map for ${item.lang}`)
      const payload = env.rendererFenceCustomHighlights['hl-1']
      assert.ok(payload, `missing payload block for ${item.lang}`)
      assert.strictEqual(payload.engine, 'shiki')
      assert.ok(Array.isArray(payload.scopes) && payload.scopes.length > 0, `missing scopes for ${item.lang}`)
      assert.ok(
        payload.scopes.some((name) => name.endsWith('-' + item.bucket)),
        `expected ${item.bucket} bucket for ${item.lang}, scopes=${payload.scopes.join(', ')}`,
      )
    }
    console.log('Test: api-shiki-provider-keyword-alias-coverage >>>')
    return true
  } catch (e) {
    console.log('incorrect:')
    console.log(e)
    return false
  }
}

const runFenceDecisionHookTest = () => {
  console.log('===========================================================')
  console.log('fence-decision-hook')
  try {
    const calls = []
    const mdHook = mdit({
      html: true,
      langPrefix: 'language-',
      highlight: (str, lang) => {
        if (lang === 'javascript') return `<pre><code>${str}</code></pre>`
        return str
      },
    }).use(mditRendererFence, {
      useHighlightPre: true,
      onFenceDecision: (data) => calls.push(data),
    }).use(mditAttrs)
    mdHook.render('```javascript\nconst a = 1\n```\n')
    assert.ok(calls.length > 0)
    const last = calls[calls.length - 1]
    assert.strictEqual(last.renderer, 'markup')
    assert.strictEqual(last.useHighlightPre, true)
    assert.ok(Array.isArray(last.disabledFeatures))
    assert.ok(last.disabledFeatures.includes('setLineNumber'))
    console.log('Test: fence-decision-hook >>>')
    return true
  } catch (e) {
    console.log('incorrect:')
    console.log(e)
    return false
  }
}

const runFenceDecisionTimingHookTest = () => {
  console.log('===========================================================')
  console.log('fence-decision-hook-timing')
  try {
    const calls = []
    const mdHook = mdit({
      html: true,
      langPrefix: 'language-',
      highlight: (str) => str,
    }).use(mditRendererFence, {
      onFenceDecision: (data) => calls.push(data),
      onFenceDecisionTiming: true,
    }).use(mditAttrs)
    mdHook.render('```javascript\nconst a = 1\n```\n')
    assert.ok(calls.length > 0)
    const last = calls[calls.length - 1]
    assert.ok(last.timings && typeof last.timings === 'object')
    assert.ok(Number.isFinite(last.timings.totalMs))
    console.log('Test: fence-decision-hook-timing >>>')
    return true
  } catch (e) {
    console.log('incorrect:')
    console.log(e)
    return false
  }
}

const runCustomHighlightOptionValidationWarnOnceTest = () => {
  console.log('===========================================================')
  console.log('custom-highlight-option-validation-warn-once')
  const prevWarn = console.warn
  const prevNodeEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'development'
  const warns = []
  console.warn = (msg) => warns.push(String(msg || ''))
  try {
    const createMdWithUnknownOpt = () => {
      return mdit({ html: true, langPrefix: 'language-' })
        .use(mditAttrs)
        .use(mditRendererFence, {
          highlightRenderer: 'api',
          customHighlight: {
            provider: 'custom',
            getRanges: () => ({ ranges: [[0, 0, 1]], scopes: ['x'] }),
            unknownFlagForWarnOnce: true,
          },
        })
    }
    const md1 = createMdWithUnknownOpt()
    const md2 = createMdWithUnknownOpt()
    md1.render('```txt\na\n```\n')
    md2.render('```txt\na\n```\n')
    const hits = warns.filter((msg) => msg.includes('unknownFlagForWarnOnce'))
    assert.strictEqual(hits.length, 1)
    console.log('Test: custom-highlight-option-validation-warn-once >>>')
    return true
  } catch (e) {
    console.log('incorrect:')
    console.log(e)
    return false
  } finally {
    console.warn = prevWarn
    process.env.NODE_ENV = prevNodeEnv
  }
}

const runPayloadScriptHelperTest = () => {
  console.log('===========================================================')
  console.log('custom-highlight-payload-helper')
  try {
    const env = {}
    mdApiCustom.render('```js\nconst y = 2\n```\n', env)
    const payloadMap = getCustomHighlightPayloadMap(env)
    assert.ok(payloadMap && payloadMap['hl-1'])
    const script = renderCustomHighlightPayloadScript(env)
    assert.ok(script.startsWith('<script type="application/json" id="pre-highlight-data">'))
    assert.ok(script.endsWith('</script>'))
    const jsonText = script.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')
    const parsed = JSON.parse(jsonText)
    assert.ok(parsed['hl-1'])

    const styleTag = renderCustomHighlightScopeStyleTag(env)
    assert.strictEqual(styleTag, '')

    const envShiki = {}
    mdApiShikiProvider.render('```javascript\nconst z = 3\n```\n', envShiki)
    const styleTagShiki = renderCustomHighlightScopeStyleTag(envShiki)
    assert.ok(styleTagShiki.startsWith('<style id="pre-highlight-scope-style">'))
    assert.ok(styleTagShiki.includes('::highlight('))
    console.log('Test: custom-highlight-payload-helper >>>')
    return true
  } catch (e) {
    console.log('incorrect:')
    console.log(e)
    return false
  }
}

const runPayloadSchemaVersionContractTest = () => {
  console.log('===========================================================')
  console.log('custom-highlight-payload-schema-version')
  try {
    assert.ok(customHighlightPayloadSupportedVersions.includes(customHighlightPayloadSchemaVersion))
    const env = {}
    mdApiCustom.render('```js\nconst p = 9\n```\n', env)
    assert.ok(env.rendererFenceCustomHighlights)
    const payload = env.rendererFenceCustomHighlights['hl-1']
    assert.ok(payload)
    assert.strictEqual(payload.v, customHighlightPayloadSchemaVersion)
    console.log('Test: custom-highlight-payload-schema-version >>>')
    return true
  } catch (e) {
    console.log('incorrect:')
    console.log(e)
    return false
  }
}

const runEnvReuseResetTest = () => {
  console.log('===========================================================')
  console.log('custom-highlight-env-reuse-reset')
  try {
    const env = {}
    mdApiCustom.render('```js\nconst x = 1\n```\n', env)
    assert.ok(env.rendererFenceCustomHighlights)
    assert.strictEqual(Object.keys(env.rendererFenceCustomHighlights).length, 1)
    assert.ok(env.rendererFenceCustomHighlights['hl-1'])

    mdApiCustom.render('```js\nconst y = 2\n```\n', env)
    assert.ok(env.rendererFenceCustomHighlights)
    assert.strictEqual(Object.keys(env.rendererFenceCustomHighlights).length, 1)
    assert.ok(env.rendererFenceCustomHighlights['hl-1'])
    assert.ok(!env.rendererFenceCustomHighlights['hl-2'])
    console.log('Test: custom-highlight-env-reuse-reset >>>')
    return true
  } catch (e) {
    console.log('incorrect:')
    console.log(e)
    return false
  }
}

const runMarkdownItFenceLfNormalizationTest = () => {
  console.log('===========================================================')
  console.log('markdown-it-fence-lf-normalization')
  try {
    const mdPlain = mdit({ html: true })
    const markdown = '```txt\r\na\r\nb\n\rc\n```\r\n'
    const tokens = mdPlain.parse(markdown, {})
    const fence = tokens.find((token) => token.type === 'fence')
    assert.ok(fence)
    assert.strictEqual(fence.content, 'a\nb\n\nc\n')
    assert.strictEqual(fence.content.indexOf('\r'), -1)
    console.log('Test: markdown-it-fence-lf-normalization >>>')
    return true
  } catch (e) {
    console.log('incorrect:')
    console.log(e)
    return false
  }
}

let pass = true
pass = runTest(md, testData.noOption, pass)
pass = runTest(md, testData.sampComment, pass)
pass = runTest(mdHighlightJs, testData.highlightjs, pass)
pass = runTest(mdLinesEmphasis, testData.linesEmphasis, pass)
pass = runTest(mdLIneEndSpan, testData.lineEndSpan, pass)
pass = runTest(md, testData.startInvalid, pass)
pass = runTest(mdCommentLineMismatch, testData.commentLineMismatch, pass)
pass = runTest(mdVoidTags, testData.voidTags, pass)
pass = runTest(mdMarkupPreAttrs, testData.markupPreAttrs, pass)
pass = runTest(mdShiki, testData.shiki, pass)
pass = runTest(mdShikiClassic, testData.shikiClassic, pass)
pass = runTest(mdShikiClassicPass, testData.shikiClassicPass, pass)

console.log('===========================================================')
console.log('mixed-newline-inline')
const mixedNewlineMarkdown = '```txt {start=\"1\" comment-mark=\"#\"}\r\n# a\nline\r\n# b\n```\r\n'
const mixedNewlineExpected = '<pre><code class=\"language-txt\" data-pre-start=\"1\" data-pre-comment-mark=\"#\" style=\"counter-set:pre-line-number 1;\"><span class=\"pre-line\"><span class=\"pre-line-comment\"># a</span></span>\n<span class=\"pre-line\">line</span>\n<span class=\"pre-line\"><span class=\"pre-line-comment\"># b</span></span>\n</code></pre>\n'
try {
  assert.strictEqual(md.render(mixedNewlineMarkdown), mixedNewlineExpected)
  console.log('Test: mixed-newline-inline >>>')
} catch (e) {
  pass = false
  console.log('incorrect:')
  console.log(md.render(mixedNewlineMarkdown))
}

pass = runApiFixture({
  label: 'api-env-basic',
  mdInstance: mdApiCustom,
  markdownPath: customHighlightData.apiEnvBasicMd,
  htmlPath: customHighlightData.apiEnvBasicHtml,
  payloadPath: customHighlightData.apiEnvBasicPayload,
}) && pass
pass = runApiFixture({
  label: 'api-fallback-plain',
  mdInstance: mdApiFallbackPlain,
  markdownPath: customHighlightData.apiFallbackPlainMd,
  htmlPath: customHighlightData.apiFallbackPlainHtml,
}) && pass
pass = runApiFixture({
  label: 'api-fallback-markup',
  mdInstance: mdApiFallbackMarkup,
  markdownPath: customHighlightData.apiFallbackMarkupMd,
  htmlPath: customHighlightData.apiFallbackMarkupHtml,
}) && pass
pass = runApiFixture({
  label: 'api-inline-script',
  mdInstance: mdApiInlineScript,
  markdownPath: customHighlightData.apiInlineScriptMd,
  htmlPath: customHighlightData.apiInlineScriptHtml,
}) && pass
pass = runApiFixture({
  label: 'api-shiki-provider',
  mdInstance: mdApiShikiProvider,
  markdownPath: customHighlightData.apiShikiProviderMd,
  htmlPath: customHighlightData.apiShikiProviderHtml,
  verify: (env) => {
    assert.ok(env.rendererFenceCustomHighlights)
    const payload = env.rendererFenceCustomHighlights['hl-1']
    assert.ok(payload)
    assert.strictEqual(payload.engine, 'shiki')
    assert.ok(Array.isArray(payload.scopes) && payload.scopes.length > 0)
    assert.ok(Array.isArray(payload.ranges) && payload.ranges.length > 0)
    assert.ok(payload.scopes.every(name => name.startsWith('hl-')))
    assert.ok(Array.isArray(payload.scopeStyles))
    assert.ok(payload.scopeStyles.some(style => style && typeof style.color === 'string'))
  },
}) && pass
pass = runApiHljsProviderTest() && pass
pass = runApiShikiProviderNoStylesTest() && pass
pass = runApiShikiProviderMissingHighlighterTest() && pass
pass = runApiShikiProviderExplanationTest() && pass
pass = runApiShikiProviderHighlighterExplanationTest() && pass
pass = runApiShikiProviderKeywordTest() && pass
pass = runApiShikiProviderScopeModeSemanticTest() && pass
pass = runApiShikiProviderScopeModeKeywordTest() && pass
pass = runApiShikiProviderKeywordClassifierTest() && pass
pass = runApiShikiProviderKeywordLangResolverTest() && pass
pass = runApiShikiProviderKeywordLangResolverHookTest() && pass
pass = runApiShikiProviderKeywordAliasCoverageTest() && pass
pass = runFenceDecisionHookTest() && pass
pass = runFenceDecisionTimingHookTest() && pass
pass = runCustomHighlightOptionValidationWarnOnceTest() && pass
pass = runPayloadScriptHelperTest() && pass
pass = runPayloadSchemaVersionContractTest() && pass
pass = runEnvReuseResetTest() && pass
pass = runMarkdownItFenceLfNormalizationTest() && pass
pass = runRuntimeApiReapplyTest() && pass
pass = runRuntimeInlineScriptTest() && pass
pass = runRuntimeIncrementalSkipTest() && pass
pass = runRuntimeIncrementalPartialReuseTest() && pass
pass = runRuntimeIncrementalScopeDiffUpdateTest() && pass
pass = runRuntimeVersionPolicyTest() && pass
pass = runRuntimeDiagnosticsHookTest() && pass
pass = runRuntimeLazyObserverTest() && pass

if (pass) console.log('Passed all test.')
