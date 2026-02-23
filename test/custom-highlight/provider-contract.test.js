import assert from 'assert'
import mdit from 'markdown-it'
import mditAttrs from 'markdown-it-attrs'
import highlightjs from 'highlight.js'
import { createHighlighter } from 'shiki'

import mditRendererFence, {
  customHighlightPayloadSchemaVersion,
  customHighlightPayloadSupportedVersions,
} from '../../index.js'

const shikiHighlighter = await createHighlighter({
  themes: ['github-light'],
  langs: ['javascript', 'typescript', 'python', 'json'],
})

const createMd = (customHighlight) => {
  return mdit({ html: true, langPrefix: 'language-' })
    .use(mditAttrs)
    .use(mditRendererFence, {
      highlightRenderer: 'api',
      customHighlight,
    })
}

const mdShikiColor = createMd({
  provider: 'shiki',
  highlighter: shikiHighlighter,
  theme: 'github-light',
  shikiScopeMode: 'color',
})

const mdShikiSemantic = createMd({
  provider: 'shiki',
  highlighter: shikiHighlighter,
  theme: 'github-light',
  includeScopeStyles: false,
  shikiScopeMode: 'semantic',
})

const mdShikiKeyword = createMd({
  provider: 'shiki',
  highlighter: shikiHighlighter,
  theme: 'github-light',
  includeScopeStyles: false,
  shikiScopeMode: 'keyword',
})

const mdHljs = createMd({
  provider: 'hljs',
  includeScopeStyles: false,
  hljsHighlight: (code, lang) => {
    const target = lang && highlightjs.getLanguage(lang) ? lang : 'plaintext'
    return highlightjs.highlight(code, { language: target })
  },
})

const mdCustom = createMd({
  provider: 'custom',
  getRanges: (code) => ({
    ranges: [
      { scope: 'unsafe.scope name', start: 0, end: Math.min(5, code.length), style: { color: '#ff0000', fontWeight: '700' } },
      { scope: 'n2', start: Math.max(0, code.length - 3), end: code.length },
    ],
  }),
})

const scopeNameReg = /^[A-Za-z_][A-Za-z0-9_-]*$/
const allowedStyleKeys = new Set(['color', 'backgroundColor', 'textDecoration', 'textShadow'])

const renderPayload = (md, lang, code) => {
  const normalized = String(code || '').endsWith('\n') ? String(code || '') : String(code || '') + '\n'
  const markdown = `\`\`\`${lang}\n${normalized}\`\`\`\n`
  const env = {}
  md.render(markdown, env)
  const map = env.rendererFenceCustomHighlights || {}
  const ids = Object.keys(map)
  assert.strictEqual(ids.length, 1, `expected one payload block for ${lang}`)
  return { payload: map[ids[0]], text: normalized }
}

const validatePayloadContract = (label, payload, text) => {
  assert.ok(payload && typeof payload === 'object', `${label}: payload is required`)
  assert.strictEqual(payload.v, customHighlightPayloadSchemaVersion, `${label}: schema version mismatch`)
  assert.ok(customHighlightPayloadSupportedVersions.includes(payload.v), `${label}: unsupported payload version`)
  assert.strictEqual(payload.offsetEncoding, 'utf16', `${label}: offsetEncoding must be utf16`)
  assert.strictEqual(payload.newline, 'lf', `${label}: newline must be lf`)
  assert.strictEqual(payload.textLength, text.length, `${label}: textLength mismatch`)
  assert.ok(Array.isArray(payload.scopes), `${label}: scopes must be array`)
  assert.ok(Array.isArray(payload.ranges), `${label}: ranges must be array`)

  const seenScopes = new Set()
  for (let i = 0; i < payload.scopes.length; i++) {
    const scope = payload.scopes[i]
    assert.strictEqual(typeof scope, 'string', `${label}: scope must be string at ${i}`)
    assert.ok(scope.length > 0, `${label}: scope should not be empty at ${i}`)
    assert.ok(scopeNameReg.test(scope), `${label}: invalid scope name format "${scope}"`)
    assert.ok(!seenScopes.has(scope), `${label}: duplicate scope name "${scope}"`)
    seenScopes.add(scope)
  }

  if (payload.scopeStyles !== undefined) {
    assert.ok(Array.isArray(payload.scopeStyles), `${label}: scopeStyles must be array when present`)
    assert.strictEqual(payload.scopeStyles.length, payload.scopes.length, `${label}: scopeStyles length mismatch`)
    for (let i = 0; i < payload.scopeStyles.length; i++) {
      const style = payload.scopeStyles[i]
      if (!style) continue
      assert.ok(typeof style === 'object', `${label}: scopeStyles entry must be object/null at ${i}`)
      for (const key of Object.keys(style)) {
        assert.ok(allowedStyleKeys.has(key), `${label}: unsupported style key "${key}"`)
        assert.strictEqual(typeof style[key], 'string', `${label}: style value must be string for ${key}`)
      }
    }
  }

  for (let i = 0; i < payload.ranges.length; i++) {
    const tuple = payload.ranges[i]
    assert.ok(Array.isArray(tuple), `${label}: range tuple must be array at ${i}`)
    assert.ok(tuple.length >= 3, `${label}: range tuple length must be >= 3 at ${i}`)
    const scopeIdx = tuple[0]
    const start = tuple[1]
    const end = tuple[2]
    assert.ok(Number.isSafeInteger(scopeIdx), `${label}: invalid scope index at ${i}`)
    assert.ok(scopeIdx >= 0 && scopeIdx < payload.scopes.length, `${label}: scope index out of bounds at ${i}`)
    assert.ok(Number.isSafeInteger(start) && Number.isSafeInteger(end), `${label}: start/end must be integers at ${i}`)
    assert.ok(start >= 0 && end > start && end <= payload.textLength, `${label}: invalid range bounds at ${i}`)
  }
}

const samples = [
  { lang: 'javascript', code: 'const a = 1\nconsole.log(a)' },
  { lang: 'typescript', code: 'type User = { id: number }\nconst u: User = { id: 1 }' },
  { lang: 'python', code: 'def inc(x):\n    return x + 1' },
  { lang: 'json', code: '{ "ok": true, "n": 1 }' },
]

const providers = [
  { name: 'shiki-color', md: mdShikiColor, scopePrefix: 'hl-shiki-' },
  { name: 'shiki-semantic', md: mdShikiSemantic, scopePrefix: 'hl-shiki-' },
  { name: 'shiki-keyword', md: mdShikiKeyword, scopePrefix: 'hl-shiki-' },
  { name: 'hljs', md: mdHljs, scopePrefix: 'hl-hljs-' },
]

console.log('===========================================================')
console.log('custom-highlight-provider-contract')

for (const provider of providers) {
  for (const sample of samples) {
    const rendered = renderPayload(provider.md, sample.lang, sample.code)
    const label = `${provider.name}:${sample.lang}`
    validatePayloadContract(label, rendered.payload, rendered.text)
    for (const scope of rendered.payload.scopes) {
      assert.ok(scope.startsWith(provider.scopePrefix), `${label}: unexpected scope prefix "${scope}"`)
    }
  }
}

{
  const rendered = renderPayload(mdCustom, 'javascript', 'const x = 1')
  validatePayloadContract('custom:javascript', rendered.payload, rendered.text)
  assert.ok(rendered.payload.scopes.some((name) => name.includes('unsafe-scope-name')), 'custom scope should be sanitized')
}

console.log('Test: custom-highlight-provider-contract >>>')
