import {
  classifyShikiScopeKeyword,
  getShikiRawScopeName,
  normalizeShikiKeywordLangAliasMap,
  resolveShikiKeywordLangForFence,
} from '../custom-highlight/shiki-keyword.js'
import {
  escapeHtmlAttr,
  escapeJsonForScript,
  getCustomHighlightPayloadMap,
  renderCustomHighlightPayloadScript as renderPayloadScriptUtil,
} from '../custom-highlight/payload-utils.js'
import {
  collectTextSegments,
  findTextPosition,
  getPayloadMapFromScript,
  styleToHighlightCss,
} from '../custom-highlight/runtime-utils.js'
import {
  validateCustomHighlightOptions,
} from '../custom-highlight/option-validator.js'
import {
  addTimingMs,
  applyLineEndAlias,
  commentLineClass,
  emitFenceDecision,
  finalizeCommonFenceOption,
  finalizeFenceTimings,
  getNowMs,
  normalizeEmphasisRanges,
  orderTokenAttrs,
  preCodeWrapperReg,
  preWrapStyle,
  prepareFenceRenderContext,
  splitFenceBlockToLines,
} from './render-shared.js'
import {
  renderFenceMarkup,
} from './render-markup.js'

const highlightNameUnsafeReg = /[^A-Za-z0-9_-]+/g
const hyphenMultiReg = /-+/g
const fallbackOnDefault = ['api-unsupported', 'provider-error', 'range-invalid', 'apply-error']
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
const customHighlightDataEnvKey = 'rendererFenceCustomHighlights'
const customHighlightSeqEnvKey = '__rendererFenceCHSeq'
const customHighlightPreAttr = 'data-pre-highlight'
const customHighlightAppliedAttr = 'data-pre-highlight-applied'
const customHighlightPreSelector = `pre[${customHighlightPreAttr}]`
const customHighlightCodeSelector = `${customHighlightPreSelector} > code, ${customHighlightPreSelector} > samp`
const customHighlightAppliedSelector = `pre[${customHighlightAppliedAttr}]`
const customHighlightDataScriptId = 'pre-highlight-data'
let fallbackCustomHighlightSeq = 0
const customHighlightStyleTagId = 'pre-highlight-style'
const customHighlightEnvInitRuleName = 'renderer_fence_custom_highlight_env_init'
const runtimeFallbackReasonSet = new Set(['api-unsupported', 'apply-error'])
const globalRuntimeInsertedScopeStyles = new Set()
const runtimeInsertedScopeStylesByDoc = new WeakMap()
const runtimeApplyStateByRoot = new WeakMap()
const customHighlightPayloadSchemaVersion = 1
const customHighlightPayloadSupportedVersions = [customHighlightPayloadSchemaVersion]

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
  const preMatch = html.match(preCodeWrapperReg)
  if (preMatch) html = preMatch[3]
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
  if (rawScope) {
    return 'shiki-' + rawScope
  }
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
      if (scopeStyles) scopeStyles.push(style)
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
  if (scopeStyles && scopeStyles.some(Boolean)) payload.scopeStyles = scopeStyles
  return payload
}

const pushLineFeatureRanges = (entries, content, emphasizeLines, setEmphasizeLines, commentLineValue) => {
  const needsEmphasis = !!(setEmphasizeLines && emphasizeLines && emphasizeLines.length > 0)
  if (!needsEmphasis && !commentLineValue) return
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
  if (commentLineValue) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trimStart().startsWith(commentLineValue)) {
        const [start, end] = offsets[i]
        if (end > start) entries.push({ scope: 'pre-comment-line', start, end })
      }
    }
  }
}

const renderCustomHighlightPayloadScript = (env, scriptId = customHighlightDataScriptId) => {
  return renderPayloadScriptUtil(env, scriptId, customHighlightDataEnvKey)
}

const getCustomHighlightBlockId = (node) => {
  if (!node || typeof node.getAttribute !== 'function') return null
  return node.getAttribute(customHighlightPreAttr)
}

const nextCustomHighlightId = (env, prefix) => {
  if (env && typeof env === 'object') {
    const n = Number.isSafeInteger(env[customHighlightSeqEnvKey]) ? env[customHighlightSeqEnvKey] + 1 : 1
    env[customHighlightSeqEnvKey] = n
    return `${prefix}${n}`
  }
  fallbackCustomHighlightSeq += 1
  return `${prefix}${fallbackCustomHighlightSeq}`
}

const buildApiPreAttrs = (preWrapValue, wrapEnabled, opt) => {
  const preAttrs = []
  if (preWrapValue !== undefined) preAttrs.push(['data-pre-wrap', preWrapValue])
  if (wrapEnabled && opt.setPreWrapStyle !== false) preAttrs.push(['style', preWrapStyle])
  return preAttrs
}

const getApiProviderEntries = (token, lang, chOpt, md, env) => {
  const context = { token, md, env, option: chOpt }
  if (chOpt.provider === 'custom') {
    const getRanges = chOpt._customGetRanges || chOpt.getRanges
    if (typeof getRanges !== 'function') throw new Error('customHighlight.getRanges must be a function')
    const result = getRanges(token.content, lang, context)
    if (result && typeof result.then === 'function') throw new Error('customHighlight.getRanges must be synchronous')
    return normalizeCustomProviderRanges(result)
  }
  if (chOpt.provider === 'hljs') {
    const highlightFn = chOpt._hljsHighlightFn || (
      (typeof chOpt.hljsHighlight === 'function')
        ? chOpt.hljsHighlight
        : ((typeof chOpt.highlight === 'function')
          ? chOpt.highlight
          : ((md && md.options && typeof md.options.highlight === 'function') ? md.options.highlight : null))
    )
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
  const shikiTokenOptionBase = chOpt._shikiTokenOptionBase || null
  const buildShikiTokenOption = (targetLang) => {
    const option = shikiTokenOptionBase ? Object.assign({ lang: targetLang }, shikiTokenOptionBase) : { lang: targetLang }
    return option
  }
  let tokenResult
  try {
    tokenResult = chOpt.highlighter.codeToTokens(token.content, buildShikiTokenOption(resolvedLang))
  } catch (err) {
    if (resolvedLang !== 'text') {
      tokenResult = chOpt.highlighter.codeToTokens(token.content, buildShikiTokenOption('text'))
    } else {
      throw err
    }
  }
  if (tokenResult && typeof tokenResult.then === 'function') throw new Error('customHighlight highlighter provider must be synchronous')
  const tokenLines = toShikiTokenLines(tokenResult)
  return createRangesFromShikiTokens(resolvedLang, tokenLines, chOpt)
}

const createApiPayloadForFence = (token, lang, opt, md, env, emphasizeLines, commentLineValue) => {
  const chOpt = opt.customHighlight
  const entries = getApiProviderEntries(token, lang, chOpt, md, env)
  if (chOpt.lineFeatureStrategy !== 'disable') {
    pushLineFeatureRanges(entries, token.content, emphasizeLines, opt.setEmphasizeLines, commentLineValue)
  }
  return buildApiPayload(entries, token.content, lang, chOpt.provider, chOpt.scopePrefix, chOpt.includeScopeStyles)
}

const renderFenceApiOrPlain = (token, lang, md, opt, slf, env, startNumber, emphasizeLines, wrapEnabled, preWrapValue, commentLineValue, includePayload, timings) => {
  const isSamp = opt._sampReg.test(lang)
  const tag = isSamp ? 'samp' : 'code'
  let content = md.utils.escapeHtml(token.content)
  const lineStrategy = opt.customHighlight.lineFeatureStrategy
  const needLineNumber = lineStrategy === 'hybrid' && opt.setLineNumber && startNumber >= 0
  const needEndSpan = lineStrategy === 'hybrid' && opt.lineEndSpanThreshold > 0
  if (needLineNumber || needEndSpan) {
    const splitStartedAt = timings ? getNowMs() : 0
    const nlIndex = content.indexOf('\n')
    const br = nlIndex > 0 && content[nlIndex - 1] === '\r' ? '\r\n' : '\n'
    content = splitFenceBlockToLines(content, [], needLineNumber, false, needEndSpan, opt.lineEndSpanThreshold, opt.lineEndSpanClass, br, undefined, commentLineClass)
    if (timings) addTimingMs(timings, 'lineSplitMs', getNowMs() - splitStartedAt)
  }

  orderTokenAttrs(token, opt)
  const preAttrs = buildApiPreAttrs(preWrapValue, wrapEnabled, opt)
  let inlinePayloadScript = ''

  if (includePayload) {
    const providerStartedAt = timings ? getNowMs() : 0
    const payload = createApiPayloadForFence(token, lang, opt, md, env, emphasizeLines, commentLineValue)
    if (timings) addTimingMs(timings, 'providerMs', getNowMs() - providerStartedAt)
    const id = nextCustomHighlightId(env, opt.customHighlight.idPrefix)
    preAttrs.push([customHighlightPreAttr, id])

    if (opt.customHighlight.transport === 'env' && env && typeof env === 'object') {
      if (!env[customHighlightDataEnvKey] || typeof env[customHighlightDataEnvKey] !== 'object') env[customHighlightDataEnvKey] = {}
      env[customHighlightDataEnvKey][id] = payload
    } else {
      const payloadJson = escapeJsonForScript(payload)
      const scriptId = `pre-highlight-data-${id}`
      inlinePayloadScript = `<script type="application/json" id="${scriptId}" ${customHighlightPreAttr}="${id}">${payloadJson}</script>\n`
    }
  }

  if (preAttrs.length) orderTokenAttrs({ attrs: preAttrs }, opt)
  const preAttrsText = preAttrs.length ? slf.renderAttrs({ attrs: preAttrs }) : ''
  const html = `<pre${preAttrsText}><${tag}${slf.renderAttrs(token)}>${content}</${tag}></pre>\n`
  return inlinePayloadScript ? html + inlinePayloadScript : html
}

const getFenceHtml = (tokens, idx, md, opt, slf, env) => {
  const context = prepareFenceRenderContext(tokens, idx, opt)
  const token = context.token
  const lang = context.lang
  const timingEnabled = context.timingEnabled
  const timings = context.timings
  const fenceStartedAt = context.fenceStartedAt
  const startNumber = context.startNumber
  const emphasizeLines = context.emphasizeLines
  const wrapEnabled = context.wrapEnabled
  const preWrapValue = context.preWrapValue
  const commentLineValue = context.commentLineValue

  const apiDecisionBase = {
    renderer: 'api',
    includePayload: true,
    fallbackUsed: false,
    lineFeatureStrategy: opt.customHighlight.lineFeatureStrategy,
    disabledFeatures: opt.customHighlight.lineFeatureStrategy === 'disable'
      ? ['setLineNumber', 'lineEndSpanThreshold']
      : [],
  }
  try {
    const html = renderFenceApiOrPlain(token, lang, md, opt, slf, env, startNumber, emphasizeLines, wrapEnabled, preWrapValue, commentLineValue, true, timings)
    if (timingEnabled) apiDecisionBase.timings = finalizeFenceTimings(timings, fenceStartedAt)
    emitFenceDecision(opt, apiDecisionBase)
    return html
  } catch (err) {
    if (opt.customHighlight.fallback === 'plain' && shouldApplyApiFallbackForReason(opt.customHighlight, 'provider-error')) {
      const fallbackDecision = {
        renderer: 'api',
        includePayload: false,
        fallbackUsed: true,
        fallback: 'plain',
        reason: 'provider-error',
        lineFeatureStrategy: opt.customHighlight.lineFeatureStrategy,
      }
      const html = renderFenceApiOrPlain(token, lang, md, opt, slf, env, startNumber, emphasizeLines, wrapEnabled, preWrapValue, commentLineValue, false, timings)
      if (timingEnabled) fallbackDecision.timings = finalizeFenceTimings(timings, fenceStartedAt)
      emitFenceDecision(opt, fallbackDecision)
      return html
    }
  }

  return renderFenceMarkup(context, md, opt, slf)
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

const getRuntimeInsertedScopeStyles = (doc) => {
  if (!doc || typeof doc !== 'object') return globalRuntimeInsertedScopeStyles
  let set = runtimeInsertedScopeStylesByDoc.get(doc)
  if (!set) {
    set = new Set()
    runtimeInsertedScopeStylesByDoc.set(doc, set)
  }
  return set
}

const ensureHighlightStyleTag = (doc) => {
  if (!doc || typeof doc.getElementById !== 'function' || typeof doc.createElement !== 'function') return null
  let styleTag = doc.getElementById(customHighlightStyleTagId)
  if (styleTag) return styleTag
  styleTag = doc.createElement('style')
  styleTag.id = customHighlightStyleTagId
  if (doc.head) doc.head.appendChild(styleTag)
  else if (doc.documentElement) doc.documentElement.appendChild(styleTag)
  else return null
  return styleTag
}

const clearAppliedHighlightNames = (queryRoot) => {
  if (!queryRoot || typeof queryRoot.querySelectorAll !== 'function') return 0
  if (typeof CSS === 'undefined' || !CSS.highlights) return 0
  const nodes = queryRoot.querySelectorAll(customHighlightAppliedSelector)
  const removed = new Set()
  for (const pre of nodes) {
    const names = String(pre.getAttribute(customHighlightAppliedAttr) || '').split(/\s+/).filter(Boolean)
    for (const name of names) {
      if (removed.has(name)) continue
      CSS.highlights.delete(name)
      removed.add(name)
    }
    pre.removeAttribute(customHighlightAppliedAttr)
  }
  return removed.size
}

const createPayloadDigest = (payloadMap) => {
  const keys = Object.keys(payloadMap || {}).sort()
  let digest = ''
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const payload = payloadMap[key]
    digest += key + '=' + JSON.stringify(payload) + ';'
  }
  return digest
}

const getRuntimeApplyState = (queryRoot) => {
  if (!queryRoot || typeof queryRoot !== 'object') return null
  return runtimeApplyStateByRoot.get(queryRoot) || null
}

const setRuntimeApplyState = (queryRoot, state) => {
  if (!queryRoot || typeof queryRoot !== 'object') return
  runtimeApplyStateByRoot.set(queryRoot, state)
}

const clearRuntimeApplyState = (queryRoot) => {
  if (!queryRoot || typeof queryRoot !== 'object') return
  runtimeApplyStateByRoot.delete(queryRoot)
}

const getRuntimeSupportedPayloadVersions = (options = {}) => {
  const set = new Set()
  if (options.strictVersion === true) {
    for (const v of customHighlightPayloadSupportedVersions) set.add(v)
  }
  if (Number.isSafeInteger(options.supportedVersion)) set.add(options.supportedVersion)
  if (Array.isArray(options.supportedVersions)) {
    for (const v of options.supportedVersions) {
      if (Number.isSafeInteger(v)) set.add(v)
    }
  }
  if (set.size === 0) return null
  return set
}

const getCodeBoundaryRefs = (codeEl) => {
  if (!codeEl || typeof codeEl !== 'object') return { first: null, last: null }
  if ('firstChild' in codeEl || 'lastChild' in codeEl) {
    return { first: codeEl.firstChild || null, last: codeEl.lastChild || null }
  }
  const textNodes = Array.isArray(codeEl.__textNodes) ? codeEl.__textNodes : null
  if (!textNodes || textNodes.length === 0) return { first: null, last: null }
  return { first: textNodes[0], last: textNodes[textNodes.length - 1] }
}

const applyCustomHighlights = (root, options = {}) => {
  const scopeRoot = root || (typeof document !== 'undefined' ? document : null)
  if (!scopeRoot) return { appliedBlocks: 0, appliedRanges: 0, reason: 'no-document' }
  if (typeof CSS === 'undefined' || !CSS.highlights || typeof Highlight === 'undefined' || typeof Range === 'undefined') {
    return { appliedBlocks: 0, appliedRanges: 0, reason: 'api-unsupported' }
  }

  const queryRoot = scopeRoot.querySelectorAll ? scopeRoot : (scopeRoot.ownerDocument || document)
  const doc = queryRoot.ownerDocument || (typeof queryRoot.createElement === 'function' ? queryRoot : (typeof document !== 'undefined' ? document : null))
  if (!doc) return { appliedBlocks: 0, appliedRanges: 0, reason: 'no-document' }
  const onRuntimeDiagnostic = (typeof options.onRuntimeDiagnostic === 'function') ? options.onRuntimeDiagnostic : null
  const emitDiag = onRuntimeDiagnostic
    ? (data) => {
        try {
          onRuntimeDiagnostic(data)
        } catch (e) {}
      }
    : null
  const codeNodes = queryRoot.querySelectorAll(customHighlightCodeSelector)
  if (!codeNodes || codeNodes.length === 0) {
    clearRuntimeApplyState(queryRoot)
    return { appliedBlocks: 0, appliedRanges: 0 }
  }
  const payloadMap = options.payloadMap && typeof options.payloadMap === 'object'
    ? options.payloadMap
    : getPayloadMapFromScript(queryRoot, options.dataScriptId || customHighlightDataScriptId)
  const supportedVersions = getRuntimeSupportedPayloadVersions(options)
  const incremental = options.incremental === true
  const payloadDigestByBlock = incremental ? new Map() : null
  let blockRefs = null
  let digest = null
  let prevBlockCache = null
  let prevScopeMetaMap = null
  let nextBlockCache = null
  let nextScopeMetaMap = null
  if (incremental) {
    blockRefs = new Map()
    for (const codeEl of codeNodes) {
      const pre = codeEl.parentElement
      if (!pre) continue
      const blockId = getCustomHighlightBlockId(pre)
      if (!blockId) continue
      blockRefs.set(blockId, codeEl)
    }
    digest = (options.payloadDigest || createPayloadDigest(payloadMap)) + '|ids=' + Array.from(blockRefs.keys()).sort().join(',')
    const prevState = getRuntimeApplyState(queryRoot)
    if (prevState && prevState.blockCache instanceof Map) prevBlockCache = prevState.blockCache
    if (prevState && prevState.scopeMetaMap instanceof Map) prevScopeMetaMap = prevState.scopeMetaMap
    nextBlockCache = new Map()
    nextScopeMetaMap = new Map()
    if (prevState && prevState.digest === digest) {
      const prevRefs = prevState.refs
      if (prevRefs && prevRefs.size === blockRefs.size) {
        let sameRefs = true
        for (const [blockId, codeEl] of blockRefs) {
          if (prevRefs.get(blockId) !== codeEl) {
            sameRefs = false
            break
          }
        }
        if (sameRefs) {
          if (emitDiag) emitDiag({ type: 'runtime-skip', reason: 'unchanged' })
          return { appliedBlocks: 0, appliedRanges: 0, skipped: true, reason: 'unchanged' }
        }
      }
    }
  }
  let styleTag = null
  let insertedStyleNames = null
  if (!incremental) clearAppliedHighlightNames(queryRoot)
  const allScopeRanges = new Map()
  let appliedBlocks = 0
  let appliedRanges = 0
  let pendingCss = ''

  for (const codeEl of codeNodes) {
    const pre = codeEl.parentElement
    if (!pre) continue
    const blockId = getCustomHighlightBlockId(pre)
    if (!blockId) {
      if (emitDiag) emitDiag({ type: 'block-skip', reason: 'missing-block-id' })
      continue
    }
    const payload = payloadMap[blockId]
    if (!payload || !Array.isArray(payload.ranges) || !Array.isArray(payload.scopes)) {
      pre.removeAttribute(customHighlightAppliedAttr)
      if (emitDiag) emitDiag({ type: 'block-skip', blockId, reason: 'missing-payload' })
      continue
    }
    if (supportedVersions && !supportedVersions.has(payload.v)) {
      pre.removeAttribute(customHighlightAppliedAttr)
      if (emitDiag) emitDiag({ type: 'block-skip', blockId, reason: 'unsupported-version', version: payload.v })
      continue
    }
    if (payload.ranges.length === 0 || payload.scopes.length === 0) {
      pre.removeAttribute(customHighlightAppliedAttr)
      if (emitDiag) emitDiag({ type: 'block-skip', blockId, reason: 'empty-payload' })
      continue
    }

    let blockPayloadDigest = ''
    if (payloadDigestByBlock) {
      blockPayloadDigest = payloadDigestByBlock.get(blockId)
      if (blockPayloadDigest === undefined) {
        blockPayloadDigest = JSON.stringify(payload)
        payloadDigestByBlock.set(blockId, blockPayloadDigest)
      }
    }
    const textSnapshot = typeof codeEl.textContent === 'string' ? codeEl.textContent : null
    const boundaryRefs = getCodeBoundaryRefs(codeEl)
    const cached = prevBlockCache ? prevBlockCache.get(blockId) : null
    if (cached &&
      cached.codeEl === codeEl &&
      cached.payloadDigest === blockPayloadDigest &&
      cached.textSnapshot === textSnapshot &&
      cached.firstRef === boundaryRefs.first &&
      cached.lastRef === boundaryRefs.last &&
      cached.scopeRanges instanceof Map) {
      for (const [runtimeName, ranges] of cached.scopeRanges) {
        if (!allScopeRanges.has(runtimeName)) allScopeRanges.set(runtimeName, [])
        const target = allScopeRanges.get(runtimeName)
        for (let i = 0; i < ranges.length; i++) target.push(ranges[i])
      }
      if (cached.appliedAttrText) {
        pre.setAttribute(customHighlightAppliedAttr, cached.appliedAttrText)
        appliedBlocks++
      } else {
        pre.removeAttribute(customHighlightAppliedAttr)
      }
      appliedRanges += cached.appliedRangeCount || 0
      if (nextScopeMetaMap && cached.scopeMeta instanceof Map) {
        for (const [runtimeName, scopeMeta] of cached.scopeMeta) {
          nextScopeMetaMap.set(runtimeName, (nextScopeMetaMap.get(runtimeName) || '') + `|${blockId}:${scopeMeta}`)
        }
      }
      if (nextBlockCache) nextBlockCache.set(blockId, cached)
      continue
    }

    const segments = collectTextSegments(codeEl)
    const textLength = segments.length ? segments[segments.length - 1].end : 0
    if (Number.isSafeInteger(payload.textLength) && payload.textLength !== textLength) {
      pre.removeAttribute(customHighlightAppliedAttr)
      if (emitDiag) {
        emitDiag({
          type: 'block-skip',
          blockId,
          reason: 'text-length-mismatch',
          payloadTextLength: payload.textLength,
          actualTextLength: textLength,
        })
      }
      continue
    }
    const appliedNames = new Set()
    const scopeRuntimeNames = new Array(payload.scopes.length)
    const scopeStyles = Array.isArray(payload.scopeStyles) ? payload.scopeStyles : null
    const blockScopeRanges = nextBlockCache ? new Map() : null
    const blockScopeMetaParts = nextBlockCache ? new Map() : null
    let blockAppliedRangeCount = 0

    for (let tupleIdx = 0; tupleIdx < payload.ranges.length; tupleIdx++) {
      const tuple = payload.ranges[tupleIdx]
      if (!Array.isArray(tuple) || tuple.length < 3) {
        if (emitDiag) emitDiag({ type: 'range-skip', blockId, reason: 'invalid-tuple', tupleIndex: tupleIdx })
        continue
      }
      const scopeIdx = tuple[0]
      const start = tuple[1]
      const end = tuple[2]
      if (!Number.isSafeInteger(scopeIdx) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end <= start) {
        if (emitDiag) emitDiag({ type: 'range-skip', blockId, reason: 'invalid-range', tupleIndex: tupleIdx })
        continue
      }
      if (scopeIdx < 0 || scopeIdx >= payload.scopes.length) {
        if (emitDiag) emitDiag({ type: 'range-skip', blockId, reason: 'invalid-scope-index', tupleIndex: tupleIdx, scopeIdx })
        continue
      }
      const scopeName = payload.scopes[scopeIdx]
      if (!scopeName) {
        if (emitDiag) emitDiag({ type: 'range-skip', blockId, reason: 'missing-scope', tupleIndex: tupleIdx, scopeIdx })
        continue
      }
      const startPos = findTextPosition(segments, start)
      const endPos = findTextPosition(segments, end)
      if (!startPos || !endPos) {
        if (emitDiag) emitDiag({ type: 'range-skip', blockId, reason: 'range-out-of-bounds', tupleIndex: tupleIdx, start, end })
        continue
      }
      let range
      try {
        range = doc.createRange()
        range.setStart(startPos.node, startPos.offset)
        range.setEnd(endPos.node, endPos.offset)
      } catch (e) {
        if (emitDiag) emitDiag({ type: 'range-skip', blockId, reason: 'range-create-failed', tupleIndex: tupleIdx })
        continue
      }
      let runtimeName = scopeRuntimeNames[scopeIdx]
      if (!runtimeName) {
        runtimeName = sanitizeHighlightName(scopeName)
        scopeRuntimeNames[scopeIdx] = runtimeName
        if (scopeStyles) {
          const css = styleToHighlightCss(scopeStyles[scopeIdx])
          if (css) {
            if (!insertedStyleNames) insertedStyleNames = getRuntimeInsertedScopeStyles(doc)
            if (!insertedStyleNames.has(runtimeName)) {
              if (!styleTag) styleTag = ensureHighlightStyleTag(doc)
              if (styleTag) {
                pendingCss += `\n::highlight(${runtimeName}){${css};}`
                insertedStyleNames.add(runtimeName)
              }
            }
          }
        }
      }
      if (!allScopeRanges.has(runtimeName)) allScopeRanges.set(runtimeName, [])
      allScopeRanges.get(runtimeName).push(range)
      if (blockScopeRanges) {
        if (!blockScopeRanges.has(runtimeName)) blockScopeRanges.set(runtimeName, [])
        blockScopeRanges.get(runtimeName).push(range)
      }
      if (blockScopeMetaParts) {
        if (!blockScopeMetaParts.has(runtimeName)) blockScopeMetaParts.set(runtimeName, [])
        blockScopeMetaParts.get(runtimeName).push(`${start}-${end}`)
      }
      appliedRanges++
      blockAppliedRangeCount++
      appliedNames.add(runtimeName)
    }

    const appliedNameList = Array.from(appliedNames)
    const appliedAttrText = appliedNameList.join(' ')
    if (appliedNames.size > 0) {
      pre.setAttribute(customHighlightAppliedAttr, appliedAttrText)
      appliedBlocks++
    } else {
      pre.removeAttribute(customHighlightAppliedAttr)
      if (emitDiag) emitDiag({ type: 'block-skip', blockId, reason: 'no-valid-ranges' })
    }
    let blockScopeMeta = null
    if (blockScopeMetaParts) {
      blockScopeMeta = new Map()
      for (const [runtimeName, parts] of blockScopeMetaParts) {
        const scopeMeta = parts.join(',')
        blockScopeMeta.set(runtimeName, scopeMeta)
        if (nextScopeMetaMap) nextScopeMetaMap.set(runtimeName, (nextScopeMetaMap.get(runtimeName) || '') + `|${blockId}:${scopeMeta}`)
      }
    }
    if (nextBlockCache) {
      nextBlockCache.set(blockId, {
        codeEl,
        payloadDigest: blockPayloadDigest,
        textSnapshot,
        firstRef: boundaryRefs.first,
        lastRef: boundaryRefs.last,
        scopeRanges: blockScopeRanges || new Map(),
        scopeMeta: blockScopeMeta || new Map(),
        appliedRangeCount: blockAppliedRangeCount,
        appliedAttrText,
      })
    }
  }
  if (incremental) {
    const prevMap = prevScopeMetaMap || new Map()
    const nextMap = nextScopeMetaMap || new Map()
    const names = new Set()
    for (const name of prevMap.keys()) names.add(name)
    for (const name of nextMap.keys()) names.add(name)
    for (const runtimeName of names) {
      const prevMeta = prevMap.get(runtimeName)
      const nextMeta = nextMap.get(runtimeName)
      if (nextMeta == null) {
        CSS.highlights.delete(runtimeName)
        continue
      }
      if (nextMeta === prevMeta) continue
      const scopeRanges = allScopeRanges.get(runtimeName)
      if (!scopeRanges || scopeRanges.length === 0) {
        CSS.highlights.delete(runtimeName)
        continue
      }
      CSS.highlights.set(runtimeName, new Highlight(...scopeRanges))
    }
  } else {
    for (const [runtimeName, scopeRanges] of allScopeRanges) {
      if (!scopeRanges.length) continue
      CSS.highlights.set(runtimeName, new Highlight(...scopeRanges))
    }
  }
  if (pendingCss && styleTag) styleTag.textContent += pendingCss
  if (incremental) {
    setRuntimeApplyState(queryRoot, { digest, refs: blockRefs, blockCache: nextBlockCache, scopeMetaMap: nextScopeMetaMap })
  } else {
    clearRuntimeApplyState(queryRoot)
  }
  return { appliedBlocks, appliedRanges }
}

const observeCustomHighlights = (root, options = {}) => {
  const scopeRoot = root || (typeof document !== 'undefined' ? document : null)
  if (!scopeRoot) {
    return {
      supported: false,
      reason: 'no-document',
      observe: () => 0,
      disconnect: () => {},
      applyNow: () => ({ appliedBlocks: 0, appliedRanges: 0, reason: 'no-document' }),
    }
  }

  const ObserverCtor =
    (typeof options.IntersectionObserver === 'function' && options.IntersectionObserver) ||
    ((typeof IntersectionObserver !== 'undefined') ? IntersectionObserver : null)
  if (typeof ObserverCtor !== 'function') {
    return {
      supported: false,
      reason: 'observer-unsupported',
      observe: () => 0,
      disconnect: () => {},
      applyNow: () => applyCustomHighlights(scopeRoot, options.applyOptions || {}),
    }
  }

  const queryRoot = scopeRoot.querySelectorAll ? scopeRoot : (scopeRoot.ownerDocument || document)
  if (!queryRoot || typeof queryRoot.querySelectorAll !== 'function') {
    return {
      supported: false,
      reason: 'invalid-root',
      observe: () => 0,
      disconnect: () => {},
      applyNow: () => ({ appliedBlocks: 0, appliedRanges: 0, reason: 'invalid-root' }),
    }
  }

  const selector = String(options.selector || customHighlightPreSelector)
  const applyOptions = options.applyOptions && typeof options.applyOptions === 'object' ? options.applyOptions : {}
  const once = options.once !== false
  let isDisconnected = false
  const applyNow = () => applyCustomHighlights(queryRoot, applyOptions)

  const observer = new ObserverCtor((entries) => {
    if (isDisconnected || !Array.isArray(entries)) return
    let shouldApply = false
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      if (entry && (entry.isIntersecting || entry.intersectionRatio > 0)) {
        shouldApply = true
        break
      }
    }
    if (!shouldApply) return
    applyNow()
    if (once) {
      observer.disconnect()
      isDisconnected = true
    }
  }, {
    root: options.root || null,
    rootMargin: options.rootMargin || '200px 0px',
    threshold: options.threshold == null ? 0 : options.threshold,
  })

  const observe = () => {
    if (isDisconnected) return 0
    const targets = queryRoot.querySelectorAll(selector)
    for (const target of targets) observer.observe(target)
    return targets.length
  }
  const disconnect = () => {
    if (isDisconnected) return
    observer.disconnect()
    isDisconnected = true
  }

  if (options.autoStart !== false) observe()
  return {
    supported: true,
    observe,
    disconnect,
    applyNow,
    observer,
  }
}

const clearCustomHighlights = (root) => {
  const scopeRoot = root || (typeof document !== 'undefined' ? document : null)
  if (!scopeRoot) return { cleared: 0, reason: 'no-document' }
  if (typeof CSS === 'undefined' || !CSS.highlights) return { cleared: 0, reason: 'api-unsupported' }
  const queryRoot = scopeRoot.querySelectorAll ? scopeRoot : (scopeRoot.ownerDocument || document)
  clearRuntimeApplyState(queryRoot)
  return { cleared: clearAppliedHighlightNames(queryRoot) }
}

const shouldRuntimeFallback = (reason, opt = {}) => {
  const chOpt = isNormalizedCustomHighlightOpt(opt) ? opt : normalizeCustomHighlightOpt(opt)
  if (!runtimeFallbackReasonSet.has(reason)) return false
  return shouldApplyApiFallbackForReason(chOpt, reason)
}

const mditRendererFenceCustomHighlight = (md, option) => {
  const opt = {
    attrsOrder: ['class', 'id', 'data-*', 'style'],
    setHighlight: true,
    setLineNumber: true,
    setEmphasizeLines: true,
    lineEndSpanThreshold: 0,
    lineEndSpanClass: 'pre-lineend-spacer',
    setPreWrapStyle: true,
    useHighlightPre: false,
    onFenceDecision: null,
    onFenceDecisionTiming: false,
    sampLang: 'shell,console',
    langPrefix: md.options.langPrefix || 'language-',
    customHighlight: null,
  }
  let rawCustomHighlightOpt = null
  if (option) {
    if (option.customHighlight && typeof option.customHighlight === 'object') rawCustomHighlightOpt = option.customHighlight
    Object.assign(opt, option)
    applyLineEndAlias(opt, option)
  }

  const mergedCustomHighlight = Object.assign({}, defaultCustomHighlightOpt)
  if (rawCustomHighlightOpt) Object.assign(mergedCustomHighlight, rawCustomHighlightOpt)
  opt.customHighlight = normalizeCustomHighlightOpt(mergedCustomHighlight)
  if (opt.customHighlight.provider === 'custom') {
    opt.customHighlight._customGetRanges = (typeof opt.customHighlight.getRanges === 'function')
      ? opt.customHighlight.getRanges
      : null
  } else if (opt.customHighlight.provider === 'hljs') {
    opt.customHighlight._hljsHighlightFn =
      (typeof opt.customHighlight.hljsHighlight === 'function')
        ? opt.customHighlight.hljsHighlight
        : ((typeof opt.customHighlight.highlight === 'function')
          ? opt.customHighlight.highlight
          : ((md && md.options && typeof md.options.highlight === 'function') ? md.options.highlight : null))
  } else if (opt.customHighlight.provider === 'shiki') {
    opt.customHighlight._hasShikiHighlighter = !!(opt.customHighlight.highlighter && typeof opt.customHighlight.highlighter.codeToTokens === 'function')
    const tokenOptionBase = {}
    if (opt.customHighlight.theme) tokenOptionBase.theme = opt.customHighlight.theme
    if (opt.customHighlight.shikiScopeMode === 'semantic' || opt.customHighlight.shikiScopeMode === 'keyword') {
      tokenOptionBase.includeExplanation = 'scopeName'
    }
    opt.customHighlight._shikiTokenOptionBase = Object.keys(tokenOptionBase).length ? tokenOptionBase : null
  }

  finalizeCommonFenceOption(opt)

  md.core.ruler.before('block', customHighlightEnvInitRuleName, (state) => {
    const env = state && state.env
    if (!env || typeof env !== 'object') return
    if (opt.customHighlight.transport === 'env') {
      env[customHighlightDataEnvKey] = {}
      env[customHighlightSeqEnvKey] = 0
      return
    }
    delete env[customHighlightDataEnvKey]
    delete env[customHighlightSeqEnvKey]
  })

  md.renderer.rules['fence'] = (tokens, idx, options, env, slf)  => {
    return getFenceHtml(tokens, idx, md, opt, slf, env)
  }
}

export {
  applyCustomHighlights,
  clearCustomHighlights,
  customHighlightPayloadSchemaVersion,
  customHighlightPayloadSupportedVersions,
  getCustomHighlightPayloadMap,
  observeCustomHighlights,
  renderCustomHighlightPayloadScript,
  renderCustomHighlightScopeStyleTag,
  shouldRuntimeFallback,
}

export default mditRendererFenceCustomHighlight
