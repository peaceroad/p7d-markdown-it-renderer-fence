import assert from 'assert'
import fs from 'fs'
import path from 'path'
import mdit from 'markdown-it'
import mditAttrs from 'markdown-it-attrs'
import highlightjs from 'highlight.js'
import { createHighlighter } from 'shiki'

import mditRendererFence, { customHighlightPayloadSchemaVersion } from '../../index.js'

const __dirname = path.dirname(new URL(import.meta.url).pathname)
const isWindows = process.platform === 'win32'
const testDir = isWindows ? __dirname.replace(/^\/+/, '').replace(/\//g, '\\') : __dirname

const fixturePath = path.join(testDir, 'provider-keyword-fixtures.json')
const fixtures = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'))

if (!Array.isArray(fixtures) || fixtures.length === 0) {
  throw new Error('provider-keyword fixtures are empty')
}

const langs = Array.from(new Set(fixtures.map((f) => String(f.lang || '').trim()).filter(Boolean)))
const shikiHighlighter = await createHighlighter({
  themes: ['github-light'],
  langs,
})

const mdShikiKeyword = mdit({ html: true, langPrefix: 'language-' })
  .use(mditAttrs)
  .use(mditRendererFence, {
    highlightRenderer: 'api',
    customHighlight: {
      provider: 'shiki',
      highlighter: shikiHighlighter,
      theme: 'github-light',
      includeScopeStyles: false,
      shikiScopeMode: 'keyword',
    },
  })

const mdHljsProvider = mdit({ html: true, langPrefix: 'language-' })
  .use(mditAttrs)
  .use(mditRendererFence, {
    highlightRenderer: 'api',
    customHighlight: {
      provider: 'hljs',
      includeScopeStyles: false,
      hljsHighlight: (code, lang) => {
        const target = (lang && highlightjs.getLanguage(lang)) ? lang : 'plaintext'
        return highlightjs.highlight(code, { language: target })
      },
    },
  })

const renderOnePayload = (md, lang, code) => {
  const normalizedCode = String(code || '').endsWith('\n') ? String(code || '') : String(code || '') + '\n'
  const markdown = `\`\`\`${lang}\n${normalizedCode}\`\`\`\n`
  const env = {}
  md.render(markdown, env)
  const map = env.rendererFenceCustomHighlights || {}
  const ids = Object.keys(map)
  assert.strictEqual(ids.length, 1, `expected one payload block for ${lang}`)
  return {
    payload: map[ids[0]],
    normalizedCode,
  }
}

const validatePayloadBasic = (id, provider, payload, codeText) => {
  assert.ok(payload && typeof payload === 'object', `${id}: ${provider} payload is required`)
  assert.strictEqual(payload.v, customHighlightPayloadSchemaVersion, `${id}: ${provider} unexpected payload schema version`)
  assert.ok(Array.isArray(payload.scopes), `${id}: ${provider} scopes must be array`)
  assert.ok(Array.isArray(payload.ranges), `${id}: ${provider} ranges must be array`)
  assert.ok(payload.ranges.length > 0, `${id}: ${provider} ranges should not be empty`)
  assert.strictEqual(payload.textLength, codeText.length, `${id}: ${provider} textLength mismatch`)
  for (let i = 0; i < payload.ranges.length; i++) {
    const tuple = payload.ranges[i]
    assert.ok(Array.isArray(tuple) && tuple.length >= 3, `${id}: ${provider} invalid range tuple at ${i}`)
    const scopeIdx = tuple[0]
    const start = tuple[1]
    const end = tuple[2]
    assert.ok(Number.isSafeInteger(scopeIdx), `${id}: ${provider} invalid scope index at ${i}`)
    assert.ok(scopeIdx >= 0 && scopeIdx < payload.scopes.length, `${id}: ${provider} scope index out of range at ${i}`)
    assert.ok(Number.isSafeInteger(start) && Number.isSafeInteger(end), `${id}: ${provider} start/end must be integer at ${i}`)
    assert.ok(start >= 0 && end > start && end <= payload.textLength, `${id}: ${provider} invalid range bounds at ${i}`)
  }
}

const toShikiKeywordBucketSet = (payload, usedScopeIndexes) => {
  const set = new Set()
  const indexes = usedScopeIndexes || payload.scopes.map((_, idx) => idx)
  for (const idx of indexes) {
    const scope = payload.scopes[idx]
    if (typeof scope !== 'string') continue
    if (!scope.startsWith('hl-shiki-')) continue
    const bucket = scope.slice('hl-shiki-'.length)
    if (bucket) set.add(bucket)
  }
  return set
}

const hljsScopeToKeywordBucket = (scopeName) => {
  const raw = String(scopeName || '').replace(/^hl-hljs-/, '')
  if (!raw) return null
  if (raw.includes('comment')) return 'comment'
  if (raw.includes('regexp') || raw.includes('regex') || raw.includes('string')) return 'string'
  if (raw.includes('number')) return 'number'
  if (raw.includes('literal')) return 'literal'
  if (raw.includes('title-function') || (raw.includes('title') && raw.includes('function'))) return 'title-function'
  if (raw.includes('title-class') || (raw.includes('title') && raw.includes('class'))) return 'title-class'
  if (raw.includes('parameter') || raw.includes('params')) return 'variable-parameter'
  if (raw.includes('variable')) return 'variable'
  if (raw.includes('keyword') || raw.includes('operator')) return 'keyword'
  if (raw.includes('attribute') || raw.includes('attr')) return 'attribute'
  if (raw.includes('tag')) return 'tag'
  if (raw.includes('punctuation')) return 'punctuation'
  if (raw.includes('type') || raw.includes('built_in')) return 'type'
  if (raw.includes('meta')) return 'meta'
  return 'text'
}

const toHljsKeywordBucketSet = (payload, usedScopeIndexes) => {
  const set = new Set()
  const indexes = usedScopeIndexes || payload.scopes.map((_, idx) => idx)
  for (const idx of indexes) {
    const scope = payload.scopes[idx]
    const bucket = hljsScopeToKeywordBucket(scope)
    if (bucket) set.add(bucket)
  }
  return set
}

const shikiBucketCompat = {
  variable: ['variable', 'variable-plain', 'variable-property', 'variable-parameter', 'variable-member', 'variable-this', 'variable-const'],
  string: ['string', 'string-unquoted'],
  'title-function': ['title-function', 'title-function-builtin'],
  type: ['type', 'type-name', 'type-primitive'],
  tag: ['tag', 'tag-delimiter'],
  meta: ['meta', 'meta-shebang'],
}

const hasShikiBucket = (set, bucket) => {
  if (set.has(bucket)) return true
  const aliases = shikiBucketCompat[bucket]
  if (!aliases) return false
  for (const name of aliases) {
    if (set.has(name)) return true
  }
  return false
}

const setToSorted = (set) => Array.from(set).sort()

const shikiUnion = new Set()
const hljsUnion = new Set()

console.log('===========================================================')
console.log('custom-highlight-provider-keyword-coverage')

for (const fixture of fixtures) {
  const id = String(fixture.id || '')
  const lang = String(fixture.lang || '')
  const code = String(fixture.code || '')
  const providers = Array.isArray(fixture.providers) && fixture.providers.length
    ? new Set(fixture.providers.map((p) => String(p || '').trim().toLowerCase()).filter(Boolean))
    : new Set(['shiki', 'hljs'])
  const runShiki = providers.has('shiki')
  const runHljs = providers.has('hljs')
  if (!runShiki && !runHljs) {
    throw new Error(`${id}: fixture.providers must include at least one provider`)
  }

  const expectedCommonBuckets = Array.isArray(fixture.expectedCommonBuckets) ? fixture.expectedCommonBuckets : []
  const expectedShikiBuckets = Array.isArray(fixture.expectedShikiBuckets) ? fixture.expectedShikiBuckets : []
  const expectedHljsBuckets = Array.isArray(fixture.expectedHljsBuckets) ? fixture.expectedHljsBuckets : []

  let shikiBuckets = new Set()
  let hljsBuckets = new Set()

  if (runShiki) {
    const shikiRendered = renderOnePayload(mdShikiKeyword, lang, code)
    const shikiPayload = shikiRendered.payload
    validatePayloadBasic(id, 'shiki', shikiPayload, shikiRendered.normalizedCode)
    assert.strictEqual(shikiPayload.engine, 'shiki', `${id}: expected shiki engine`)
    const shikiScopeIndexes = Array.from(new Set(shikiPayload.ranges.map((tuple) => tuple[0])))
    shikiBuckets = toShikiKeywordBucketSet(shikiPayload, shikiScopeIndexes)
    for (const name of shikiPayload.scopes || []) {
      assert.ok(!String(name).includes('object-object'), `${id}: invalid shiki scope token "${name}"`)
      assert.ok(!/-(js|ts|python|bash|json|html)$/.test(String(name)), `${id}: keyword mode should not leak language suffix "${name}"`)
    }
  }

  if (runHljs) {
    const hljsRendered = renderOnePayload(mdHljsProvider, lang, code)
    const hljsPayload = hljsRendered.payload
    validatePayloadBasic(id, 'hljs', hljsPayload, hljsRendered.normalizedCode)
    assert.strictEqual(hljsPayload.engine, 'hljs', `${id}: expected hljs engine`)
    const hljsScopeIndexes = Array.from(new Set(hljsPayload.ranges.map((tuple) => tuple[0])))
    hljsBuckets = toHljsKeywordBucketSet(hljsPayload, hljsScopeIndexes)
  }

  for (const bucket of expectedCommonBuckets) {
    if (runShiki) {
      assert.ok(hasShikiBucket(shikiBuckets, bucket), `${id}: shiki missing bucket "${bucket}"\nactual=${setToSorted(shikiBuckets).join(',')}`)
    }
    if (runHljs) {
      assert.ok(hljsBuckets.has(bucket), `${id}: hljs missing bucket "${bucket}"\nactual=${setToSorted(hljsBuckets).join(',')}`)
    }
  }

  for (const bucket of expectedShikiBuckets) {
    if (!runShiki) continue
    assert.ok(hasShikiBucket(shikiBuckets, bucket), `${id}: shiki missing provider-specific bucket "${bucket}"\nactual=${setToSorted(shikiBuckets).join(',')}`)
  }

  for (const bucket of expectedHljsBuckets) {
    if (!runHljs) continue
    assert.ok(hljsBuckets.has(bucket), `${id}: hljs missing provider-specific bucket "${bucket}"\nactual=${setToSorted(hljsBuckets).join(',')}`)
  }

  if (runShiki) {
    for (const b of shikiBuckets) shikiUnion.add(b)
  }
  if (runHljs) {
    for (const b of hljsBuckets) hljsUnion.add(b)
  }

  const logShiki = runShiki ? `shiki=[${setToSorted(shikiBuckets).join(', ')}]` : 'shiki=[skipped]'
  const logHljs = runHljs ? `hljs=[${setToSorted(hljsBuckets).join(', ')}]` : 'hljs=[skipped]'
  console.log(`${id}: ${logShiki} ${logHljs}`)
}

const coreBuckets = ['keyword', 'string', 'number', 'comment', 'literal', 'variable', 'tag', 'attribute', 'punctuation']
const missingInShiki = coreBuckets.filter((bucket) => hljsUnion.has(bucket) && !hasShikiBucket(shikiUnion, bucket))
assert.strictEqual(missingInShiki.length, 0, `shiki keyword union missing core buckets from hljs union: ${missingInShiki.join(',')}`)

console.log('union shiki =', setToSorted(shikiUnion).join(', '))
console.log('union hljs =', setToSorted(hljsUnion).join(', '))
console.log('Test: custom-highlight-provider-keyword-coverage >>>')
