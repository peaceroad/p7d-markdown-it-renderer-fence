import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const matrixPath = process.argv[2] || path.join(__dirname, '../../example/custom-highlight-provider-matrix.html')

const html = fs.readFileSync(matrixPath, 'utf8')
const payloadMatch = html.match(/<script type="application\/json" id="pre-highlight-data">([\s\S]*?)<\/script>/)
if (!payloadMatch) throw new Error('pre-highlight-data payload script was not found')
const payloadMap = JSON.parse(payloadMatch[1])

const decodeHtml = (text) => {
  return String(text || '')
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

const styleColorMap = {}
for (const m of html.matchAll(/::highlight\(([^)]+)\)\s*\{([^}]*)\}/g)) {
  const name = String(m[1] || '').trim()
  const css = String(m[2] || '')
  const colorMatch = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(css)
  if (!name || !colorMatch) continue
  styleColorMap[name] = String(colorMatch[1] || '').trim().toUpperCase()
}

const codeByPayloadId = {}
for (const m of html.matchAll(/<pre[^>]*data-pre-highlight="([^"]+)"[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/g)) {
  const id = String(m[1] || '').trim()
  if (!id) continue
  codeByPayloadId[id] = decodeHtml(m[2] || '')
}

const getColorForScope = (payload, scopeIdx) => {
  if (!payload || !Array.isArray(payload.scopes) || scopeIdx < 0 || scopeIdx >= payload.scopes.length) return ''
  if (Array.isArray(payload.scopeStyles) && payload.scopeStyles[scopeIdx] && payload.scopeStyles[scopeIdx].color) {
    return String(payload.scopeStyles[scopeIdx].color).toUpperCase()
  }
  const scopeName = payload.scopes[scopeIdx]
  return styleColorMap[scopeName] || ''
}

const fillColorMap = (payload, textLength) => {
  const out = new Array(textLength).fill('')
  if (!payload || !Array.isArray(payload.ranges)) return out
  for (let i = 0; i < payload.ranges.length; i++) {
    const tuple = payload.ranges[i]
    if (!Array.isArray(tuple) || tuple.length < 3) continue
    const scopeIdx = tuple[0]
    const start = tuple[1]
    const end = tuple[2]
    if (!Number.isSafeInteger(scopeIdx) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) continue
    if (end <= start || start < 0 || end > textLength) continue
    const color = getColorForScope(payload, scopeIdx)
    for (let p = start; p < end; p++) out[p] = color
  }
  return out
}

const fillScopeMap = (payload, textLength) => {
  const out = new Array(textLength).fill('')
  if (!payload || !Array.isArray(payload.ranges) || !Array.isArray(payload.scopes)) return out
  for (let i = 0; i < payload.ranges.length; i++) {
    const tuple = payload.ranges[i]
    if (!Array.isArray(tuple) || tuple.length < 3) continue
    const scopeIdx = tuple[0]
    const start = tuple[1]
    const end = tuple[2]
    if (!Number.isSafeInteger(scopeIdx) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) continue
    if (scopeIdx < 0 || scopeIdx >= payload.scopes.length) continue
    if (end <= start || start < 0 || end > textLength) continue
    const scopeName = String(payload.scopes[scopeIdx] || '')
    for (let p = start; p < end; p++) out[p] = scopeName
  }
  return out
}

const isWhitespace = (ch) => ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t'

const sortEntries = (obj, limit = 8) => {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
}

const wantedLang = String(process.argv[3] || '').trim().toLowerCase()
const includeDetail = process.argv.includes('--detail')

const run = () => {
  const ids = Object.keys(payloadMap)
  const targets = ids
    .map((id) => {
      const m = id.match(/^ex-(.+?)-([a-z0-9-]+)-shiki-keyword-1$/i)
      if (!m) return null
      return { id, lang: m[1], block: m[2] }
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.lang === b.lang) return a.block.localeCompare(b.block)
      return a.lang.localeCompare(b.lang)
    })

  if (targets.length === 0) {
    console.log('no shiki-keyword payloads found')
    return
  }

  for (const t of targets) {
    if (wantedLang && t.lang !== wantedLang) continue
    const colorId = `ex-${t.lang}-${t.block}-shiki-color-1`
    const semanticId = `ex-${t.lang}-${t.block}-shiki-semantic-1`
    const keywordId = t.id
    const text = codeByPayloadId[keywordId] || ''
    const colorPayload = payloadMap[colorId]
    const semanticPayload = payloadMap[semanticId]
    const keywordPayload = payloadMap[keywordId]
    if (!colorPayload || !semanticPayload || !keywordPayload || !text) continue
    const textLength = text.length
    const colorMapRef = fillColorMap(colorPayload, textLength)
    const colorMapV4 = fillColorMap(keywordPayload, textLength)
    const semanticScopeMap = fillScopeMap(semanticPayload, textLength)
    const keywordScopeMap = fillScopeMap(keywordPayload, textLength)

    let nonWs = 0
    let mismatchNonWs = 0
    const semanticMismatch = {}
    const keywordMismatch = {}
    const colorPairMismatch = {}

    const detailRows = []
    for (let i = 0; i < textLength; i++) {
      const ch = text[i]
      if (isWhitespace(ch)) continue
      nonWs++
      const ref = colorMapRef[i] || ''
      const got = colorMapV4[i] || ''
      if (ref === got) continue
      mismatchNonWs++
      const semanticScope = semanticScopeMap[i] || '(none)'
      const keywordScope = keywordScopeMap[i] || '(none)'
      const pair = `${ref || '(none)'} -> ${got || '(none)'}`
      semanticMismatch[semanticScope] = (semanticMismatch[semanticScope] || 0) + 1
      keywordMismatch[keywordScope] = (keywordMismatch[keywordScope] || 0) + 1
      colorPairMismatch[pair] = (colorPairMismatch[pair] || 0) + 1
      if (includeDetail && detailRows.length < 80) {
        detailRows.push({
          pos: i,
          semanticScope,
          keywordScope,
          pair,
          ch,
        })
      }
    }

    const ratio = nonWs ? (100 * (1 - mismatchNonWs / nonWs)) : 100
    console.log(`\n[${t.lang}/${t.block}] non-ws parity=${ratio.toFixed(2)}% (${nonWs - mismatchNonWs}/${nonWs})`)
    const topColorPairs = sortEntries(colorPairMismatch)
    const topSemantic = sortEntries(semanticMismatch)
    const topKeyword = sortEntries(keywordMismatch)
    console.log('  top color pairs:')
    for (const [name, count] of topColorPairs) console.log(`    - ${name}: ${count}`)
    console.log('  top semantic scopes:')
    for (const [name, count] of topSemantic) console.log(`    - ${name}: ${count}`)
    console.log('  top keyword buckets:')
    for (const [name, count] of topKeyword) console.log(`    - ${name}: ${count}`)
    if (includeDetail && detailRows.length > 0) {
      const merged = []
      let start = detailRows[0]
      let prev = detailRows[0]
      let token = start.ch
      for (let i = 1; i < detailRows.length; i++) {
        const cur = detailRows[i]
        const canMerge =
          cur.pos === prev.pos + 1 &&
          cur.semanticScope === prev.semanticScope &&
          cur.keywordScope === prev.keywordScope &&
          cur.pair === prev.pair
        if (canMerge) {
          token += cur.ch
          prev = cur
          continue
        }
        merged.push({ start: start.pos, end: prev.pos + 1, token, semanticScope: start.semanticScope, keywordScope: start.keywordScope, pair: start.pair })
        start = cur
        prev = cur
        token = cur.ch
      }
      merged.push({ start: start.pos, end: prev.pos + 1, token, semanticScope: start.semanticScope, keywordScope: start.keywordScope, pair: start.pair })
      console.log('  mismatch examples:')
      for (let i = 0; i < merged.length && i < 16; i++) {
        const row = merged[i]
        console.log(`    - [${row.start},${row.end}) "${row.token}" :: ${row.semanticScope} -> ${row.keywordScope} (${row.pair})`)
      }
    }
  }
}

run()
