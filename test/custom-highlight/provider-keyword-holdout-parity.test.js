import assert from 'assert'
import fs from 'fs'
import path from 'path'
import mdit from 'markdown-it'
import mditAttrs from 'markdown-it-attrs'
import { createHighlighter } from 'shiki'

import mditRendererFence from '../../index.js'

const __dirname = path.dirname(new URL(import.meta.url).pathname)
const isWindows = process.platform === 'win32'
const testDir = isWindows ? __dirname.replace(/^\/+/, '').replace(/\//g, '\\') : __dirname
const fixturePath = path.join(testDir, 'provider-keyword-holdout-fixtures.json')
const fixtures = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))

if (!Array.isArray(fixtures) || fixtures.length === 0) {
  throw new Error('provider-keyword holdout fixtures are empty')
}

const shikiKeywordScopeColorMap = {
  'hl-shiki-comment': '#6A737D',
  'hl-shiki-meta-shebang': '#6A737D',
  'hl-shiki-tag-delimiter': '#24292E',
  'hl-shiki-attribute': '#6F42C1',
  'hl-shiki-tag': '#22863A',
  'hl-shiki-variable-this': '#005CC5',
  'hl-shiki-variable-const': '#005CC5',
  'hl-shiki-variable-parameter': '#E36209',
  'hl-shiki-variable-member': '#24292E',
  'hl-shiki-variable-property': '#E36209',
  'hl-shiki-variable-plain': '#24292E',
  'hl-shiki-variable': '#E36209',
  'hl-shiki-string-unquoted': '#032F62',
  'hl-shiki-string': '#032F62',
  'hl-shiki-number': '#005CC5',
  'hl-shiki-literal': '#005CC5',
  'hl-shiki-type-primitive': '#D73A49',
  'hl-shiki-keyword': '#D73A49',
  'hl-shiki-type-name': '#6F42C1',
  'hl-shiki-type': '#005CC5',
  'hl-shiki-namespace': '#6F42C1',
  'hl-shiki-title-function-builtin': '#005CC5',
  'hl-shiki-title-function': '#6F42C1',
  'hl-shiki-title-class': '#6F42C1',
  'hl-shiki-punctuation': '#24292E',
  'hl-shiki-meta': '#24292E',
  'hl-shiki-text': '#24292E',
}

const langs = Array.from(new Set(fixtures.map((f) => String(f.lang || '').trim()).filter(Boolean)))
const shikiHighlighter = await createHighlighter({
  themes: ['github-light'],
  langs,
})

const createMd = (shikiScopeMode, includeScopeStyles) => {
  return mdit({ html: true, langPrefix: 'language-' })
    .use(mditAttrs)
    .use(mditRendererFence, {
      highlightRenderer: 'api',
      customHighlight: {
        provider: 'shiki',
        highlighter: shikiHighlighter,
        theme: 'github-light',
        includeScopeStyles,
        shikiScopeMode,
      },
    })
}

const mdShikiColor = createMd('color', true)
const mdShikiKeyword = createMd('keyword', false)

const renderOnePayload = (md, lang, code) => {
  const normalizedCode = String(code || '').endsWith('\n') ? String(code || '') : String(code || '') + '\n'
  const markdown = `\`\`\`${lang}\n${normalizedCode}\`\`\`\n`
  const env = {}
  md.render(markdown, env)
  const map = env.rendererFenceCustomHighlights || {}
  const ids = Object.keys(map)
  assert.strictEqual(ids.length, 1, `expected one payload block for ${lang}`)
  return { payload: map[ids[0]], normalizedCode }
}

const getScopeColor = (payload, scopeIdx, fallbackMap) => {
  if (!payload || !Array.isArray(payload.scopes) || scopeIdx < 0 || scopeIdx >= payload.scopes.length) return ''
  if (Array.isArray(payload.scopeStyles) && payload.scopeStyles[scopeIdx] && payload.scopeStyles[scopeIdx].color) {
    return String(payload.scopeStyles[scopeIdx].color || '').toUpperCase()
  }
  const scope = String(payload.scopes[scopeIdx] || '')
  return String((fallbackMap && fallbackMap[scope]) || '').toUpperCase()
}

const toColorMap = (payload, textLength, fallbackMap) => {
  const map = new Array(textLength).fill('')
  for (const tuple of payload.ranges || []) {
    if (!Array.isArray(tuple) || tuple.length < 3) continue
    const scopeIdx = tuple[0]
    const start = tuple[1]
    const end = tuple[2]
    if (!Number.isSafeInteger(scopeIdx) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) continue
    if (end <= start || start < 0 || end > textLength) continue
    const color = getScopeColor(payload, scopeIdx, fallbackMap)
    for (let i = start; i < end; i++) map[i] = color
  }
  return map
}

const isWhitespace = (ch) => ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t'

const calcParity = (reference, candidate, text) => {
  const len = Math.min(reference.length, candidate.length, text.length)
  let allTotal = 0
  let allSame = 0
  let nwTotal = 0
  let nwSame = 0
  for (let i = 0; i < len; i++) {
    const same = (reference[i] || '') === (candidate[i] || '')
    allTotal++
    if (same) allSame++
    if (!isWhitespace(text[i])) {
      nwTotal++
      if (same) nwSame++
    }
  }
  return {
    all: allTotal ? allSame / allTotal : 1,
    nonWhitespace: nwTotal ? nwSame / nwTotal : 1,
  }
}

const formatPct = (n) => `${(n * 100).toFixed(2)}%`

console.log('===========================================================')
console.log('custom-highlight-provider-keyword-holdout-parity')

const metricsKeyword = []

for (const fixture of fixtures) {
  const id = String(fixture.id || '')
  const lang = String(fixture.lang || '')
  const code = String(fixture.code || '')
  const c = renderOnePayload(mdShikiColor, lang, code)
  const kw = renderOnePayload(mdShikiKeyword, lang, code)

  assert.strictEqual(c.normalizedCode, kw.normalizedCode, `${id}: keyword normalized code mismatch`)
  assert.strictEqual(c.payload.textLength, kw.payload.textLength, `${id}: keyword textLength mismatch`)

  const text = c.normalizedCode
  const refMap = toColorMap(c.payload, text.length, null)
  const kwMap = toColorMap(kw.payload, text.length, shikiKeywordScopeColorMap)
  const p = calcParity(refMap, kwMap, text)
  metricsKeyword.push(p)

  console.log(`${id} (${lang}): keyword=${formatPct(p.nonWhitespace)} [all keyword=${formatPct(p.all)}]`)
}

const avg = (list, key) => list.reduce((acc, x) => acc + x[key], 0) / (list.length || 1)
const avgAll = avg(metricsKeyword, 'all')
const avgNw = avg(metricsKeyword, 'nonWhitespace')

console.log(`summary: keyword non-ws=${formatPct(avgNw)} all=${formatPct(avgAll)}`)
assert.ok(avgNw >= 0.98, `holdout average keyword non-whitespace parity is too low: ${avgNw}`)
console.log('Test: custom-highlight-provider-keyword-holdout-parity >>>')
