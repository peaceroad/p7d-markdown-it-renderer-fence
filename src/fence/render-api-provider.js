import {
  classifyShikiScopeKeyword,
  getShikiRawScopeName,
  normalizeShikiKeywordLangAliasMap,
  resolveShikiKeywordLangForFence,
} from '../custom-highlight/shiki-keyword.js'
import {
  escapeHtmlAttr,
  getCustomHighlightPayloadMap,
  renderCustomHighlightPayloadScript as renderPayloadScriptUtil,
} from '../custom-highlight/payload-utils.js'
import {
  styleToHighlightCss,
} from '../custom-highlight/runtime-utils.js'
import {
  validateCustomHighlightOptions,
} from '../custom-highlight/option-validator.js'
import {
  commentLineClass,
  normalizeEmphasisRanges,
} from './render-shared.js'
import {
  parsePreCodeWrapper,
} from '../utils/pre-code-wrapper-parser.js'
import {
  customHighlightDataEnvKey,
  customHighlightDataScriptId,
  customHighlightPayloadSchemaVersion,
  customHighlightPayloadSupportedVersions,
  fallbackOnDefault,
} from './render-api-constants.js'

const highlightNameUnsafeReg = /[^A-Za-z0-9_-]+/g
const hyphenMultiReg = /-+/g

const defaultCustomHighlightOpt = {
  provider: 'shiki',
  getRanges: null,
  fallback: 'plain',
  fallbackOn: fallbackOnDefault,
  transport: 'env',
  idPrefix: 'hl-',
  lineFeatureStrategy: 'hybrid',
  scopePrefix: 'hl',
  includeScopeStyles: true,
  shikiScopeMode: 'auto',
  shikiKeywordClassifier: null,
  shikiKeywordLangResolver: null,
  shikiKeywordLangAliases: null,
}

const normalizeCustomHighlightProvider = (provider) => {
  if (provider === 'custom') return 'custom'
  if (provider === 'hljs') return 'hljs'
  return 'shiki'
}

const normalizeShikiScopeMode = (mode) => {
  const key = String(mode || '').trim().toLowerCase()
  if (!key) return null
  if (key === 'keyword') return 'keyword'
  if (key === 'semantic') return 'semantic'
  if (key === 'color') return 'color'
  if (key === 'auto') return 'auto'
  return null
}

const normalizeThemeName = (name) => {
  if (typeof name !== 'string') return ''
  return name.trim()
}

const normalizeCustomHighlightTheme = (theme) => {
  const singleTheme = normalizeThemeName(theme)
  if (singleTheme) {
    return {
      singleTheme,
      themeVariants: null,
      defaultVariant: '',
    }
  }
  if (!theme || typeof theme !== 'object' || Array.isArray(theme)) {
    return {
      singleTheme: '',
      themeVariants: null,
      defaultVariant: '',
    }
  }
  const lightTheme = normalizeThemeName(theme.light)
  const darkTheme = normalizeThemeName(theme.dark)
  if (!lightTheme && !darkTheme) {
    return {
      singleTheme: '',
      themeVariants: null,
      defaultVariant: '',
    }
  }
  if (!lightTheme || !darkTheme) {
    return {
      singleTheme: lightTheme || darkTheme,
      themeVariants: null,
      defaultVariant: '',
    }
  }
  let defaultVariant = String(theme.default || '').trim().toLowerCase()
  if (defaultVariant !== 'light' && defaultVariant !== 'dark') defaultVariant = 'light'
  return {
    singleTheme: '',
    themeVariants: { light: lightTheme, dark: darkTheme },
    defaultVariant,
  }
}

const buildShikiInternalLangAliasMap = (highlighter) => {
  if (!highlighter || typeof highlighter.getLoadedLanguages !== 'function' || typeof highlighter.getLanguage !== 'function') {
    return null
  }
  let loaded
  try {
    loaded = highlighter.getLoadedLanguages()
  } catch (e) {
    return null
  }
  if (!Array.isArray(loaded) || loaded.length === 0) return null
  const rawMap = {}
  for (let i = 0; i < loaded.length; i++) {
    const rawName = String(loaded[i] || '')
    if (!rawName) continue
    let canonical = rawName
    try {
      const langDef = highlighter.getLanguage(rawName)
      if (langDef && typeof langDef.name === 'string' && langDef.name) canonical = langDef.name
    } catch (e) {}
    rawMap[rawName] = canonical
  }
  return normalizeShikiKeywordLangAliasMap(rawMap)
}

const normalizeCustomHighlightOpt = (opt = {}) => {
  const rawOpt = (opt && typeof opt === 'object') ? opt : {}
  const next = Object.assign({}, defaultCustomHighlightOpt, rawOpt)
  next.provider = normalizeCustomHighlightProvider(next.provider)
  next.fallback = (next.fallback === 'markup') ? 'markup' : 'plain'
  next.transport = (next.transport === 'inline-script') ? 'inline-script' : 'env'
  next.lineFeatureStrategy = (next.lineFeatureStrategy === 'disable') ? 'disable' : 'hybrid'
  next.idPrefix = String(next.idPrefix || 'hl-')
  next.scopePrefix = next.scopePrefix == null ? 'hl' : String(next.scopePrefix)
  next.includeScopeStyles = next.includeScopeStyles !== false
  next.shikiScopeMode = normalizeShikiScopeMode(next.shikiScopeMode) || 'auto'
  const normalizedTheme = normalizeCustomHighlightTheme(next.theme)
  next._singleTheme = normalizedTheme.singleTheme
  next._themeVariants = normalizedTheme.themeVariants
  next._themeVariantDefault = normalizedTheme.defaultVariant
  if (normalizedTheme.themeVariants) {
    next.theme = {
      light: normalizedTheme.themeVariants.light,
      dark: normalizedTheme.themeVariants.dark,
      default: normalizedTheme.defaultVariant,
    }
  } else {
    next.theme = normalizedTheme.singleTheme || null
  }
  if (typeof next.shikiKeywordClassifier !== 'function') next.shikiKeywordClassifier = null
  if (typeof next.shikiKeywordLangResolver !== 'function') next.shikiKeywordLangResolver = null
  next.shikiKeywordLangAliases = normalizeShikiKeywordLangAliasMap(next.shikiKeywordLangAliases)
  next._shikiInternalLangAliasMap =
    (next.provider === 'shiki' && next.shikiScopeMode === 'keyword')
      ? buildShikiInternalLangAliasMap(next.highlighter)
      : null
  const fallbackOn = Array.isArray(next.fallbackOn) ? next.fallbackOn : fallbackOnDefault
  next._fallbackOnSet = new Set(fallbackOn)
  validateCustomHighlightOptions(rawOpt, next)
  return next
}

const isNormalizedCustomHighlightOpt = (opt) => {
  return !!(opt && typeof opt === 'object' && opt._fallbackOnSet instanceof Set)
}

const shouldApplyApiFallbackForReason = (chOpt, reason) => {
  if (!reason) return true
  if (!chOpt || !chOpt._fallbackOnSet) return true
  return chOpt._fallbackOnSet.has(reason)
}

const sanitizeHighlightName = (name, prefix = '') => {
  const prefixBase = String(prefix == null ? '' : prefix).replace(highlightNameUnsafeReg, '-').replace(hyphenMultiReg, '-').replace(/^-+|-+$/g, '')
  const raw = String(name || '')
  let safe = raw.replace(highlightNameUnsafeReg, '-').replace(hyphenMultiReg, '-').replace(/^-+|-+$/g, '')
  if (!safe) safe = 'scope'
  if (/^[0-9]/.test(safe)) safe = 'x-' + safe
  if (safe.startsWith('--')) safe = safe.slice(2) || 'scope'
  return prefixBase ? `${prefixBase}-${safe}` : safe
}

const uniqueHighlightName = (base, usedMap) => {
  if (!usedMap.has(base)) {
    usedMap.set(base, 1)
    return base
  }
  let seq = usedMap.get(base) + 1
  usedMap.set(base, seq)
  return `${base}-${seq}`
}

const normalizeScopeStyle = (style) => {
  if (!style || typeof style !== 'object') return null
  const next = {}
  let hasValue = false
  if (typeof style.color === 'string' && style.color) {
    next.color = style.color
    hasValue = true
  }
  if (typeof style.backgroundColor === 'string' && style.backgroundColor) {
    next.backgroundColor = style.backgroundColor
    hasValue = true
  }
  if (typeof style.textDecoration === 'string' && style.textDecoration) {
    next.textDecoration = style.textDecoration
    hasValue = true
  }
  if (typeof style.textShadow === 'string' && style.textShadow) {
    next.textShadow = style.textShadow
    hasValue = true
  }
  return hasValue ? next : null
}

const getScopeStyleKey = (style) => {
  if (!style) return ''
  let key = ''
  if (style.color) key += `c:${style.color};`
  if (style.backgroundColor) key += `bg:${style.backgroundColor};`
  if (style.textDecoration) key += `td:${style.textDecoration};`
  if (style.textShadow) key += `ts:${style.textShadow};`
  return key
}

const sameStringArray = (a, b) => {
  if (a === b) return true
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

const sameRangeTuples = (a, b) => {
  if (a === b) return true
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const left = a[i]
    const right = b[i]
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false
    for (let j = 0; j < left.length; j++) {
      if (left[j] !== right[j]) return false
    }
  }
  return true
}

const sameScopeStyles = (a, b) => {
  const left = Array.isArray(a) ? a : null
  const right = Array.isArray(b) ? b : null
  if (left === right) return true
  if (!left || !right || left.length !== right.length) return false
  for (let i = 0; i < left.length; i++) {
    const lv = left[i]
    const rv = right[i]
    if (lv === rv) continue
    if (!lv || !rv || typeof lv !== 'object' || typeof rv !== 'object') return false
    const lk = Object.keys(lv)
    const rk = Object.keys(rv)
    if (lk.length !== rk.length) return false
    for (let j = 0; j < lk.length; j++) {
      const key = lk[j]
      if (lv[key] !== rv[key]) return false
    }
  }
  return true
}

const getLogicalLinesAndOffsets = (text) => {
  const rawLines = text.split('\n')
  const logicalLineCount = rawLines.length > 0 && rawLines[rawLines.length - 1] === '' ? rawLines.length - 1 : rawLines.length
  const lines = new Array(logicalLineCount)
  const offsets = new Array(logicalLineCount)
  let cursor = 0
  for (let i = 0; i < logicalLineCount; i++) {
    const line = rawLines[i]
    lines[i] = line
    offsets[i] = [cursor, cursor + line.length]
    cursor += line.length + 1
  }
  return { lines, offsets }
}

const getShikiTokenStyle = (token) => {
  const style = {}
  if (typeof token.color === 'string' && token.color) style.color = token.color
  const fontStyle = Number.isFinite(token.fontStyle) ? token.fontStyle : 0
  if (fontStyle & 1) style.fontStyle = 'italic'
  if (fontStyle & 2) style.fontWeight = '700'
  if (fontStyle & 4) style.textDecoration = 'underline'
  return normalizeScopeStyle(style)
}

const toShikiTokenLines = (result) => {
  if (!result) return null
  if (Array.isArray(result)) return result
  if (Array.isArray(result.tokens)) return result.tokens
  return null
}

const highlightClassReg = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i

const decodeHtmlEntity = (entity) => {
  if (entity === '&lt;') return '<'
  if (entity === '&gt;') return '>'
  if (entity === '&amp;') return '&'
  if (entity === '&quot;') return '"'
  if (entity === '&#39;' || entity === '&apos;') return '\''
  if (entity.startsWith('&#x') || entity.startsWith('&#X')) {
    const n = Number.parseInt(entity.slice(3, -1), 16)
    if (!Number.isFinite(n)) return entity
    try {
      return String.fromCodePoint(n)
    } catch (e) {
      return entity
    }
  }
  if (entity.startsWith('&#')) {
    const n = Number.parseInt(entity.slice(2, -1), 10)
    if (!Number.isFinite(n)) return entity
    try {
      return String.fromCodePoint(n)
    } catch (e) {
      return entity
    }
  }
  return entity
}

const decodeHtmlEntities = (text) => {
  if (!text || text.indexOf('&') === -1) return text
  return text.replace(/&(?:#x[0-9a-fA-F]+|#\d+|[A-Za-z][A-Za-z0-9]+);/g, decodeHtmlEntity)
}

const hljsScopeToName = (scope, lang) => {
  const raw = String(scope || '').trim()
  if (raw) {
    if (raw.startsWith('hljs-')) return raw
    return 'hljs-' + raw.replace(/\./g, '-')
  }
  return `hljs-${lang || 'plain'}`
}

const getHljsScopeFromClassText = (classText, lang) => {
  if (!classText) return null
  const classes = String(classText).trim().split(/\s+/).filter(Boolean)
  if (!classes.length) return null
  for (let i = 0; i < classes.length; i++) {
    const name = classes[i]
    if (name.startsWith('hljs-') && name !== 'hljs') return name
  }
  if (classes[0] && classes[0] !== 'hljs') return hljsScopeToName(classes[0], lang)
  return hljsScopeToName('', lang)
}

const createRangesFromHighlightHtml = (lang, html) => {
  const entries = []
  if (!html) return entries
  const stack = []
  const source = String(html)
  let cursor = 0
  let i = 0
  while (i < source.length) {
    const lt = source.indexOf('<', i)
    const textEnd = lt === -1 ? source.length : lt
    if (textEnd > i) {
      const rawText = source.slice(i, textEnd)
      const decoded = decodeHtmlEntities(rawText)
      const len = decoded.length
      if (len > 0) {
        const scope = stack.length ? stack[stack.length - 1] : null
        if (scope) entries.push({ scope, start: cursor, end: cursor + len })
        cursor += len
      }
    }
    if (lt === -1) break
    const gt = source.indexOf('>', lt + 1)
    if (gt === -1) {
      const rest = decodeHtmlEntities(source.slice(lt))
      const len = rest.length
      if (len > 0) {
        const scope = stack.length ? stack[stack.length - 1] : null
        if (scope) entries.push({ scope, start: cursor, end: cursor + len })
        cursor += len
      }
      break
    }
    const body = source.slice(lt + 1, gt).trim()
    if (body.startsWith('/')) {
      if (body.slice(1).trim().toLowerCase().startsWith('span') && stack.length) stack.pop()
    } else {
      const space = body.indexOf(' ')
      const name = (space === -1 ? body : body.slice(0, space)).replace(/\/$/, '').toLowerCase()
      if (name === 'span') {
        const classMatch = highlightClassReg.exec(body)
        const classText = classMatch ? (classMatch[1] ?? classMatch[2] ?? classMatch[3] ?? '') : ''
        stack.push(getHljsScopeFromClassText(classText, lang))
      } else if (name === 'br') {
        const scope = stack.length ? stack[stack.length - 1] : null
        if (scope) entries.push({ scope, start: cursor, end: cursor + 1 })
        cursor += 1
      }
    }
    i = gt + 1
  }
  return entries
}

const walkHljsEmitterNode = (node, activeScope, cursorRef, entries, lang) => {
  if (typeof node === 'string') {
    const len = node.length
    if (len > 0 && activeScope) entries.push({ scope: activeScope, start: cursorRef.value, end: cursorRef.value + len })
    cursorRef.value += len
    return
  }
  if (!node || typeof node !== 'object' || !Array.isArray(node.children)) return
  const nextScope = (typeof node.scope === 'string' && node.scope)
    ? hljsScopeToName(node.scope, lang)
    : activeScope
  for (let i = 0; i < node.children.length; i++) {
    walkHljsEmitterNode(node.children[i], nextScope, cursorRef, entries, lang)
  }
}

const createRangesFromHljsResult = (lang, result) => {
  if (Array.isArray(result) || (result && Array.isArray(result.ranges))) {
    return normalizeCustomProviderRanges(result)
  }
  if (result && result._emitter && result._emitter.rootNode) {
    const entries = []
    const cursorRef = { value: 0 }
    walkHljsEmitterNode(result._emitter.rootNode, null, cursorRef, entries, lang)
    return entries
  }
  let html = ''
  if (typeof result === 'string') html = result
  else if (result && typeof result.value === 'string') html = result.value
  if (!html) return []
  const preMatch = parsePreCodeWrapper(html)
  if (preMatch) html = preMatch.content
  return createRangesFromHighlightHtml(lang, html)
}

const hasShikiOffsets = (tokenLines) => {
  for (let i = 0; i < tokenLines.length; i++) {
    const line = tokenLines[i]
    if (!Array.isArray(line)) continue
    for (let t = 0; t < line.length; t++) {
      const tok = line[t]
      if (tok && Number.isFinite(tok.offset)) return true
    }
  }
  return false
}

const getShikiScopeName = (tok, lang, style, opt, preResolvedKeywordLang = '') => {
  const scopeMode = (opt && opt.shikiScopeMode) || 'auto'
  const rawScope = getShikiRawScopeName(tok)
  let customKeywordName = null
  const isKeywordScopeMode = scopeMode === 'keyword'
  if (isKeywordScopeMode && opt && typeof opt.shikiKeywordClassifier === 'function') {
    try {
      const customName = opt.shikiKeywordClassifier(rawScope, tok, { lang, style, scopeMode })
      if (customName != null && customName !== '') customKeywordName = String(customName)
    } catch (e) {}
  }
  if (isKeywordScopeMode) {
    if (customKeywordName) return 'shiki-' + customKeywordName
    const bucket = classifyShikiScopeKeyword(rawScope, tok, lang, opt, preResolvedKeywordLang)
    return 'shiki-' + bucket
  }
  if (scopeMode === 'semantic') {
    if (rawScope) return 'shiki-' + rawScope
    if (style && style.color) {
      const colorKey = style.color.toLowerCase().replace(highlightNameUnsafeReg, '-')
      const fs = Number.isFinite(tok.fontStyle) ? `-f${tok.fontStyle}` : ''
      return `shiki-${colorKey}${fs}`
    }
    return `shiki-${lang || 'plain'}`
  }
  if (scopeMode === 'auto') {
    if (rawScope) return 'shiki-' + rawScope
  }
  if (scopeMode === 'color') {
    if (style && style.color) {
      const colorKey = style.color.toLowerCase().replace(highlightNameUnsafeReg, '-')
      const fs = Number.isFinite(tok.fontStyle) ? `-f${tok.fontStyle}` : ''
      return `shiki-${colorKey}${fs}`
    }
    if (rawScope) return 'shiki-' + rawScope
    return `shiki-${lang || 'plain'}`
  }
  if (rawScope) return 'shiki-' + rawScope
  if (style && style.color) {
    const colorKey = style.color.toLowerCase().replace(highlightNameUnsafeReg, '-')
    const fs = Number.isFinite(tok.fontStyle) ? `-f${tok.fontStyle}` : ''
    return `shiki-${colorKey}${fs}`
  }
  return `shiki-${lang || 'plain'}`
}

const createRangesFromShikiTokens = (lang, tokenLines, opt) => {
  if (!Array.isArray(tokenLines)) throw new Error('Invalid shiki token payload')
  const entries = []
  const hasOffsets = hasShikiOffsets(tokenLines)
  const scopeMode = (opt && opt.shikiScopeMode) || 'auto'
  const includeScopeStyles = !opt || opt.includeScopeStyles !== false
  const needStyleForScopeName =
    scopeMode === 'auto' ||
    scopeMode === 'color' ||
    scopeMode === 'semantic' ||
    (scopeMode === 'keyword' && !!(opt && typeof opt.shikiKeywordClassifier === 'function'))
  const needTokenStyle = includeScopeStyles || needStyleForScopeName
  let preResolvedKeywordLang = ''
  if (scopeMode === 'keyword' && (!opt || typeof opt.shikiKeywordLangResolver !== 'function')) {
    preResolvedKeywordLang = resolveShikiKeywordLangForFence(lang, opt)
  }
  let cursor = 0
  for (let i = 0; i < tokenLines.length; i++) {
    const line = tokenLines[i]
    if (!Array.isArray(line)) throw new Error('Invalid shiki token line')
    for (let t = 0; t < line.length; t++) {
      const tok = line[t]
      if (!tok || typeof tok !== 'object') continue
      const content = String(tok.content || '')
      if (!content) continue
      const hasOffset = Number.isFinite(tok.offset)
      const start = hasOffset ? tok.offset : cursor
      const end = start + content.length
      const style = needTokenStyle ? getShikiTokenStyle(tok) : null
      const scope = getShikiScopeName(tok, lang, style, opt, preResolvedKeywordLang)
      entries.push({ scope, start, end, style })
      cursor = end
    }
    if (!hasOffsets && i < tokenLines.length - 1) cursor += 1
  }
  return entries
}

const normalizeCustomProviderRanges = (result) => {
  const source = Array.isArray(result) ? { ranges: result } : result
  if (!source || !Array.isArray(source.ranges)) throw new Error('custom getRanges must return ranges')
  const scopes = Array.isArray(source.scopes) ? source.scopes : null
  const scopeStyles = source.scopeStyles && typeof source.scopeStyles === 'object' ? source.scopeStyles : null
  const entries = []
  for (const range of source.ranges) {
    let scope
    let start
    let end
    let style
    if (Array.isArray(range)) {
      scope = range[0]
      start = range[1]
      end = range[2]
      style = range[3]
    } else if (range && typeof range === 'object') {
      scope = range.scope
      start = range.start
      end = range.end
      style = range.style
    } else {
      continue
    }
    if (typeof scope === 'number' && scopes && scopes[scope] != null) scope = scopes[scope]
    if (scope == null) continue
    if (!style && scopeStyles) {
      if (typeof scope === 'number' && Array.isArray(scopeStyles)) style = scopeStyles[scope]
      else style = scopeStyles[String(scope)]
    }
    entries.push({ scope: String(scope), start, end, style: normalizeScopeStyle(style) })
  }
  return entries
}

const buildApiPayload = (entries, text, lang, engine, scopePrefix, includeScopeStyles = true) => {
  const scopes = []
  const ranges = []
  const scopeStyles = includeScopeStyles ? [] : null
  let hasScopeStyles = false
  const scopeKeyToIndex = new Map()
  const usedScopeNames = new Map()
  const textLength = text.length
  for (const entry of entries) {
    if (!entry) continue
    const start = Number(entry.start)
    const end = Number(entry.end)
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start || end > textLength) {
      throw new Error(`Invalid range [${entry.start}, ${entry.end}]`)
    }
    const style = includeScopeStyles ? normalizeScopeStyle(entry.style) : null
    const key = includeScopeStyles
      ? `${String(entry.scope)}\u0001${getScopeStyleKey(style)}`
      : String(entry.scope)
    let scopeIndex = scopeKeyToIndex.get(key)
    if (scopeIndex === undefined) {
      const baseName = sanitizeHighlightName(entry.scope, scopePrefix)
      const scopeName = uniqueHighlightName(baseName, usedScopeNames)
      scopeIndex = scopes.length
      scopes.push(scopeName)
      if (scopeStyles) {
        scopeStyles.push(style)
        if (style) hasScopeStyles = true
      }
      scopeKeyToIndex.set(key, scopeIndex)
    }
    ranges.push([scopeIndex, start, end])
  }
  const payload = {
    v: customHighlightPayloadSchemaVersion,
    engine,
    lang: lang || '',
    offsetEncoding: 'utf16',
    newline: 'lf',
    textLength,
    scopes,
    ranges,
  }
  if (scopeStyles && hasScopeStyles) payload.scopeStyles = scopeStyles
  return payload
}

const pushLineFeatureRanges = (entries, content, emphasizeLines, setEmphasizeLines, commentMarkValue) => {
  const needsEmphasis = !!(setEmphasizeLines && emphasizeLines && emphasizeLines.length > 0)
  const needsCommentScan = !!(commentMarkValue && content.indexOf(commentMarkValue) !== -1)
  if (!needsEmphasis && !needsCommentScan) return
  const { lines, offsets } = getLogicalLinesAndOffsets(content)
  const maxLine = lines.length
  if (needsEmphasis) {
    const normalized = normalizeEmphasisRanges(emphasizeLines, maxLine)
    for (const [s, e] of normalized) {
      const start = offsets[s - 1][0]
      const end = offsets[e - 1][1]
      if (end > start) entries.push({ scope: 'pre-lines-emphasis', start, end })
    }
  }
  if (needsCommentScan) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trimStart().startsWith(commentMarkValue)) {
        const [start, end] = offsets[i]
        if (end > start) entries.push({ scope: commentLineClass, start, end })
      }
    }
  }
}

const buildShikiTokenOption = (chOpt, targetLang, themeOverride = '') => {
  const base = chOpt && chOpt._shikiTokenOptionBase
  const option = base ? Object.assign({ lang: targetLang }, base) : { lang: targetLang }
  if (themeOverride) option.theme = themeOverride
  return option
}

const getApiProviderEntries = (token, lang, chOpt, md, env, override) => {
  const context = { token, md, env, option: chOpt }
  if (chOpt.provider === 'custom') {
    const getRanges = chOpt._customGetRanges
    if (typeof getRanges !== 'function') throw new Error('customHighlight.getRanges must be a function')
    const result = getRanges(token.content, lang, context)
    if (result && typeof result.then === 'function') throw new Error('customHighlight.getRanges must be synchronous')
    return normalizeCustomProviderRanges(result)
  }
  if (chOpt.provider === 'hljs') {
    const highlightFn = chOpt._hljsHighlightFn
    if (typeof highlightFn !== 'function') {
      throw new Error('customHighlight.hljsHighlight (or customHighlight.highlight / md.options.highlight) must be a function when provider=hljs')
    }
    const resolvedLang = lang || chOpt.defaultLang || ''
    let result
    try {
      result = highlightFn(token.content, resolvedLang, context)
    } catch (err) {
      if (resolvedLang && resolvedLang !== 'plaintext') {
        result = highlightFn(token.content, 'plaintext', context)
      } else {
        throw err
      }
    }
    if (result && typeof result.then === 'function') throw new Error('customHighlight hljs provider must be synchronous')
    return createRangesFromHljsResult(resolvedLang, result)
  }

  if (chOpt._hasShikiHighlighter === false || !chOpt.highlighter || typeof chOpt.highlighter.codeToTokens !== 'function') {
    throw new Error('customHighlight.highlighter.codeToTokens must be a function when provider=shiki')
  }

  const resolvedLang = lang || chOpt.defaultLang || 'text'
  const overrideTheme = normalizeThemeName(override && override.theme)
  const themeForPass = overrideTheme || chOpt._singleTheme
  let tokenResult
  try {
    tokenResult = chOpt.highlighter.codeToTokens(token.content, buildShikiTokenOption(chOpt, resolvedLang, themeForPass))
  } catch (err) {
    if (resolvedLang !== 'text') {
      tokenResult = chOpt.highlighter.codeToTokens(token.content, buildShikiTokenOption(chOpt, 'text', themeForPass))
    } else {
      throw err
    }
  }
  if (tokenResult && typeof tokenResult.then === 'function') throw new Error('customHighlight highlighter provider must be synchronous')
  const tokenLines = toShikiTokenLines(tokenResult)
  return createRangesFromShikiTokens(resolvedLang, tokenLines, chOpt)
}

const buildApiPayloadVariantRecord = (variantPayload, basePayload) => {
  const record = {}
  if (!sameStringArray(variantPayload.scopes, basePayload.scopes)) record.scopes = variantPayload.scopes
  if (!sameRangeTuples(variantPayload.ranges, basePayload.ranges)) record.ranges = variantPayload.ranges
  const baseStyles = Array.isArray(basePayload.scopeStyles) ? basePayload.scopeStyles : null
  const variantStyles = Array.isArray(variantPayload.scopeStyles) ? variantPayload.scopeStyles : null
  if (!sameScopeStyles(variantStyles, baseStyles)) {
    if (variantStyles) record.scopeStyles = variantStyles
    else if (baseStyles) record.scopeStyles = []
  }
  return record
}

const createShikiDualThemePayloadForFence = (token, lang, opt, md, env, emphasizeLines, commentMarkValue) => {
  const chOpt = opt.customHighlight
  const themeVariants = chOpt._themeVariants
  const lineFeatureEntries = []
  if (chOpt.lineFeatureStrategy !== 'disable') {
    pushLineFeatureRanges(lineFeatureEntries, token.content, emphasizeLines, opt.setEmphasizeLines, commentMarkValue)
  }
  const buildVariantPayload = (themeName) => {
    const entries = getApiProviderEntries(token, lang, chOpt, md, env, { theme: themeName })
    if (lineFeatureEntries.length) entries.push(...lineFeatureEntries)
    return buildApiPayload(entries, token.content, lang, chOpt.provider, chOpt.scopePrefix, true)
  }
  const variants = {
    light: buildVariantPayload(themeVariants.light),
    dark: buildVariantPayload(themeVariants.dark),
  }
  const defaultVariant = chOpt._themeVariantDefault === 'dark' ? 'dark' : 'light'
  const otherVariant = defaultVariant === 'dark' ? 'light' : 'dark'
  const basePayload = variants[defaultVariant]
  const payload = Object.assign({}, basePayload)
  payload.defaultVariant = defaultVariant
  payload.variants = {
    [defaultVariant]: {},
    [otherVariant]: buildApiPayloadVariantRecord(variants[otherVariant], basePayload),
  }
  return payload
}

const createApiPayloadForFence = (token, lang, opt, md, env, emphasizeLines, commentMarkValue) => {
  const chOpt = opt.customHighlight
  if (chOpt.provider === 'shiki' && chOpt.includeScopeStyles !== false && chOpt._themeVariants) {
    return createShikiDualThemePayloadForFence(token, lang, opt, md, env, emphasizeLines, commentMarkValue)
  }
  const entries = getApiProviderEntries(token, lang, chOpt, md, env)
  if (chOpt.lineFeatureStrategy !== 'disable') {
    pushLineFeatureRanges(entries, token.content, emphasizeLines, opt.setEmphasizeLines, commentMarkValue)
  }
  return buildApiPayload(entries, token.content, lang, chOpt.provider, chOpt.scopePrefix, chOpt.includeScopeStyles)
}

const renderCustomHighlightPayloadScript = (env, scriptId = customHighlightDataScriptId) => {
  return renderPayloadScriptUtil(env, scriptId, customHighlightDataEnvKey)
}

const renderCustomHighlightScopeStyleTag = (env, styleTagId = 'pre-highlight-scope-style') => {
  const map = getCustomHighlightPayloadMap(env, customHighlightDataEnvKey)
  const keys = Object.keys(map)
  if (!keys.length) return ''
  const styleId = escapeHtmlAttr(styleTagId || 'pre-highlight-scope-style')
  const used = new Set()
  const cssLines = []
  for (const blockId of keys) {
    const payload = map[blockId]
    if (!payload || !Array.isArray(payload.scopes) || !Array.isArray(payload.scopeStyles)) continue
    for (let i = 0; i < payload.scopes.length; i++) {
      const scopeName = payload.scopes[i]
      if (!scopeName) continue
      const runtimeName = sanitizeHighlightName(scopeName)
      if (used.has(runtimeName)) continue
      const css = styleToHighlightCss(payload.scopeStyles[i])
      if (!css) continue
      used.add(runtimeName)
      cssLines.push(`::highlight(${runtimeName}){${css};}`)
    }
  }
  if (!cssLines.length) return ''
  return `<style id="${styleId}">\n${cssLines.join('\n')}\n</style>`
}

export {
  createApiPayloadForFence,
  customHighlightPayloadSchemaVersion,
  customHighlightPayloadSupportedVersions,
  isNormalizedCustomHighlightOpt,
  normalizeCustomHighlightOpt,
  renderCustomHighlightPayloadScript,
  renderCustomHighlightScopeStyleTag,
  sanitizeHighlightName,
  shouldApplyApiFallbackForReason,
}
