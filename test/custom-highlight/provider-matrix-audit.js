import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const matrixPath = process.argv[2] || path.join(__dirname, '../../example/custom-highlight-provider-matrix.html')
const html = fs.readFileSync(matrixPath, 'utf8')

const payloadMatch = html.match(/<script type="application\/json" id="pre-highlight-data">([\s\S]*?)<\/script>/)
if (!payloadMatch) {
  throw new Error('pre-highlight-data payload script was not found')
}
const payloadMap = JSON.parse(payloadMatch[1])

const cssHighlightNames = new Set()
for (const m of html.matchAll(/::highlight\(([^)]+)\)\s*\{/g)) {
  cssHighlightNames.add(m[1].trim())
}

const extractHighlightColorMap = (prefix) => {
  const out = {}
  for (const m of html.matchAll(/::highlight\(([^)]+)\)\s*\{([^}]*)\}/g)) {
    const name = String(m[1] || '').trim()
    if (!name.startsWith(prefix)) continue
    const css = String(m[2] || '')
    const colorMatch = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(css)
    if (!colorMatch) continue
    out[name] = String(colorMatch[1] || '').trim().toUpperCase()
  }
  return out
}

const shikiKeywordColorFallback = extractHighlightColorMap('hl-shiki-')

const hljsApiColorFallback = {
  'hl-hljs-addition': '#22863A',
  'hl-hljs-attr': '#005CC5',
  'hl-hljs-attribute': '#005CC5',
  'hl-hljs-built_in': '#E36209',
  'hl-hljs-bullet': '#735C0F',
  'hl-hljs-code': '#6A737D',
  'hl-hljs-comment': '#6A737D',
  'hl-hljs-deletion': '#B31D28',
  'hl-hljs-doctag': '#D73A49',
  'hl-hljs-emphasis': '#24292E',
  'hl-hljs-formula': '#6A737D',
  'hl-hljs-keyword': '#D73A49',
  'hl-hljs-literal': '#005CC5',
  'hl-hljs-meta': '#005CC5',
  'hl-hljs-name': '#22863A',
  'hl-hljs-number': '#005CC5',
  'hl-hljs-operator': '#005CC5',
  'hl-hljs-quote': '#22863A',
  'hl-hljs-regexp': '#032F62',
  'hl-hljs-section': '#005CC5',
  'hl-hljs-selector-attr': '#005CC5',
  'hl-hljs-selector-class': '#005CC5',
  'hl-hljs-selector-id': '#005CC5',
  'hl-hljs-selector-pseudo': '#22863A',
  'hl-hljs-selector-tag': '#22863A',
  'hl-hljs-string': '#032F62',
  'hl-hljs-strong': '#24292E',
  'hl-hljs-subst': '#24292E',
  'hl-hljs-symbol': '#E36209',
  'hl-hljs-template-tag': '#D73A49',
  'hl-hljs-template-variable': '#D73A49',
  'hl-hljs-title': '#6F42C1',
  'hl-hljs-title-class': '#6F42C1',
  'hl-hljs-title-class-inherited': '#6F42C1',
  'hl-hljs-title-function': '#6F42C1',
  'hl-hljs-type': '#D73A49',
  'hl-hljs-variable': '#005CC5',
  'hl-hljs-variable-constant': '#005CC5',
  'hl-hljs-variable-language': '#D73A49',
}

const hljsMarkupClassColor = new Map([
  ['hljs-doctag', '#D73A49'],
  ['hljs-keyword', '#D73A49'],
  ['hljs-template-tag', '#D73A49'],
  ['hljs-template-variable', '#D73A49'],
  ['hljs-type', '#D73A49'],
  ['hljs-variable.language_', '#D73A49'],
  ['hljs-title', '#6F42C1'],
  ['hljs-title.class_', '#6F42C1'],
  ['hljs-title.class_.inherited__', '#6F42C1'],
  ['hljs-title.function_', '#6F42C1'],
  ['hljs-attr', '#005CC5'],
  ['hljs-attribute', '#005CC5'],
  ['hljs-literal', '#005CC5'],
  ['hljs-meta', '#005CC5'],
  ['hljs-number', '#005CC5'],
  ['hljs-operator', '#005CC5'],
  ['hljs-variable', '#005CC5'],
  ['hljs-selector-attr', '#005CC5'],
  ['hljs-selector-class', '#005CC5'],
  ['hljs-selector-id', '#005CC5'],
  ['hljs-regexp', '#032F62'],
  ['hljs-string', '#032F62'],
  ['hljs-built_in', '#E36209'],
  ['hljs-symbol', '#E36209'],
  ['hljs-comment', '#6A737D'],
  ['hljs-code', '#6A737D'],
  ['hljs-formula', '#6A737D'],
  ['hljs-name', '#22863A'],
  ['hljs-quote', '#22863A'],
  ['hljs-selector-tag', '#22863A'],
  ['hljs-selector-pseudo', '#22863A'],
  ['hljs-subst', '#24292E'],
  ['hljs-section', '#005CC5'],
  ['hljs-bullet', '#735C0F'],
  ['hljs-addition', '#22863A'],
  ['hljs-deletion', '#B31D28'],
])

const decodeHtmlEntities = (text) => {
  return text
    .replace(/&(lt|gt|amp|quot|#39|apos);/g, (m) => {
      if (m === '&lt;') return '<'
      if (m === '&gt;') return '>'
      if (m === '&amp;') return '&'
      if (m === '&quot;') return '"'
      if (m === '&#39;' || m === '&apos;') return '\''
      return m
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number.parseInt(num, 10)))
}

const getLangSections = () => {
  const out = []
  for (const m of html.matchAll(/<section class="lang-section" id="([^"]+)">([\s\S]*?)<\/section>/g)) {
    out.push({ lang: m[1], section: m[2] })
  }
  return out
}

const resolvePayloadId = (lang, kind) => {
  const candidates = [
    `ex-${lang}-base-${kind}-1`,
    `ex-${lang}-${kind}-1`,
  ]
  for (const id of candidates) {
    if (payloadMap[id]) return id
  }
  const prefix = `ex-${lang}-`
  const infix = `-${kind}-`
  const found = Object.keys(payloadMap).find((id) => id.startsWith(prefix) && id.includes(infix))
  return found || ''
}

const toColorMapFromPayload = (payloadId, fallbackColorMap) => {
  const payload = payloadMap[payloadId]
  if (!payload) return null
  const map = new Array(payload.textLength).fill('')
  for (const tuple of payload.ranges || []) {
    if (!Array.isArray(tuple) || tuple.length < 3) continue
    const scopeIdx = tuple[0]
    const start = tuple[1]
    const end = tuple[2]
    if (!Number.isSafeInteger(scopeIdx) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) continue
    if (scopeIdx < 0 || scopeIdx >= payload.scopes.length) continue
    const scopeName = payload.scopes[scopeIdx]
    let color = ''
    if (Array.isArray(payload.scopeStyles) && payload.scopeStyles[scopeIdx] && payload.scopeStyles[scopeIdx].color) {
      color = String(payload.scopeStyles[scopeIdx].color).toUpperCase()
    } else if (fallbackColorMap && fallbackColorMap[scopeName]) {
      color = fallbackColorMap[scopeName]
    }
    for (let i = start; i < end && i < map.length; i++) map[i] = color
  }
  return map
}

const toColorMapFromMarkupShikiInside = (sectionHtml) => {
  const m = sectionHtml.match(/<h3>Markup \/ shiki-inside<\/h3>[\s\S]*?<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/)
  if (!m) return null
  const src = m[1]
  const out = []
  let activeColor = ''
  let i = 0
  while (i < src.length) {
    const lt = src.indexOf('<', i)
    const textEnd = lt === -1 ? src.length : lt
    if (textEnd > i) {
      const text = decodeHtmlEntities(src.slice(i, textEnd))
      for (const ch of text) out.push(activeColor)
    }
    if (lt === -1) break
    const gt = src.indexOf('>', lt + 1)
    if (gt === -1) break
    const tag = src.slice(lt + 1, gt)
    if (/^span\b/i.test(tag)) {
      const colorMatch = /style="[^"]*color:\s*([^";]+)[^"]*"/i.exec(tag)
      if (colorMatch) activeColor = colorMatch[1].toUpperCase()
    } else if (/^\/span/i.test(tag)) {
      activeColor = ''
    }
    i = gt + 1
  }
  return out
}

const toColorMapFromMarkupHljs = (sectionHtml) => {
  const m = sectionHtml.match(/<h3>Markup \/ highlight\.js<\/h3>[\s\S]*?<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/)
  if (!m) return null
  const src = m[1]
  const out = []
  const colorStack = ['']
  let i = 0
  while (i < src.length) {
    const lt = src.indexOf('<', i)
    const textEnd = lt === -1 ? src.length : lt
    if (textEnd > i) {
      const text = decodeHtmlEntities(src.slice(i, textEnd))
      const color = colorStack[colorStack.length - 1] || ''
      for (const ch of text) out.push(color)
    }
    if (lt === -1) break
    const gt = src.indexOf('>', lt + 1)
    if (gt === -1) break
    const tag = src.slice(lt + 1, gt)
    if (/^span\b/i.test(tag)) {
      let color = colorStack[colorStack.length - 1] || ''
      const classMatch = /class="([^"]+)"/i.exec(tag)
      if (classMatch) {
        const classes = classMatch[1].trim().split(/\s+/).filter(Boolean)
        for (const cls of classes) {
          if (hljsMarkupClassColor.has(cls)) {
            color = hljsMarkupClassColor.get(cls)
            break
          }
        }
      }
      colorStack.push(color)
    } else if (/^\/span/i.test(tag)) {
      if (colorStack.length > 1) colorStack.pop()
    }
    i = gt + 1
  }
  return out
}

const compareColorMaps = (a, b) => {
  const len = Math.min(a.length, b.length)
  if (len <= 0) return { len: 0, same: 0, ratio: 1 }
  let same = 0
  for (let i = 0; i < len; i++) {
    if ((a[i] || '') === (b[i] || '')) same++
  }
  return { len, same, ratio: same / len }
}

const pad = (v, n = 8) => String(v).padEnd(n, ' ')

const auditMissingCssScopes = () => {
  const issues = []
  for (const [payloadId, payload] of Object.entries(payloadMap)) {
    const hasScopeStyles = Array.isArray(payload.scopeStyles) && payload.scopeStyles.some(Boolean)
    if (hasScopeStyles) continue
    for (const scope of payload.scopes || []) {
      if (!cssHighlightNames.has(scope)) {
        issues.push({ payloadId, scope })
        break
      }
    }
  }
  return issues
}

const printSummary = () => {
  const ids = Object.keys(payloadMap)
  const counts = {
    total: ids.length,
    shikiColor: ids.filter((id) => id.includes('-shiki-color-')).length,
    shikiSemantic: ids.filter((id) => id.includes('-shiki-semantic-')).length,
    shikiKeyword: ids.filter((id) => id.includes('-shiki-keyword-')).length,
    hljsApi: ids.filter((id) => id.includes('-hljs-')).length,
    emptyRanges: ids.filter((id) => (payloadMap[id].ranges || []).length === 0).length,
  }
  console.log('=== Provider Matrix Summary ===')
  console.log(counts)
  const cssIssues = auditMissingCssScopes()
  console.log('missing-css-payloads:', cssIssues.length)
  for (const issue of cssIssues) {
    console.log(`  - ${issue.payloadId}: ${issue.scope}`)
  }
}

const printParity = () => {
  console.log('\n=== Color Parity (ratio) ===')
  console.log('lang      shiki-color  shiki-semantic shiki-keyword    hljs-api')
  const sections = getLangSections()
  for (const item of sections) {
    const lang = item.lang
    const shikiMarkup = toColorMapFromMarkupShikiInside(item.section)
    const hljsMarkup = toColorMapFromMarkupHljs(item.section)
    if (!shikiMarkup || !hljsMarkup) continue

    const shikiColor = toColorMapFromPayload(resolvePayloadId(lang, 'shiki-color'), shikiKeywordColorFallback)
    const shikiSemantic = toColorMapFromPayload(resolvePayloadId(lang, 'shiki-semantic'), shikiKeywordColorFallback)
    const shikiKeyword = toColorMapFromPayload(resolvePayloadId(lang, 'shiki-keyword'), shikiKeywordColorFallback)
    const hljsApi = toColorMapFromPayload(resolvePayloadId(lang, 'hljs'), hljsApiColorFallback)

    if (!shikiColor || !shikiSemantic || !shikiKeyword || !hljsApi) continue

    const rColor = compareColorMaps(shikiColor, shikiMarkup).ratio.toFixed(3)
    const rSemantic = compareColorMaps(shikiSemantic, shikiMarkup).ratio.toFixed(3)
    const rKeyword = compareColorMaps(shikiKeyword, shikiMarkup).ratio.toFixed(3)
    const rHljs = compareColorMaps(hljsApi, hljsMarkup).ratio.toFixed(3)
    console.log(`${pad(lang, 9)} ${pad(rColor, 12)} ${pad(rSemantic, 14)} ${pad(rKeyword, 16)} ${rHljs}`)
  }
}

printSummary()
printParity()
