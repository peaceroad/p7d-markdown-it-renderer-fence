import {
  collectTextSegments,
  findTextPosition,
  getPayloadMapFromScript,
  styleToHighlightCss,
} from '../custom-highlight/runtime-utils.js'
import {
  customHighlightAppliedAttr,
  customHighlightAppliedSelector,
  customHighlightCodeSelector,
  customHighlightDataScriptId,
  customHighlightPayloadSupportedVersions,
  customHighlightPreAttr,
  customHighlightPreSelector,
  customHighlightStyleTagId,
} from './render-api-constants.js'

const globalRuntimeInsertedScopeStyles = new Map()
const runtimeInsertedScopeStylesByDoc = new WeakMap()
const runtimeApplyStateByRoot = new WeakMap()
const validColorSchemeSet = new Set(['light', 'dark', 'auto'])
const highlightNameUnsafeReg = /[^A-Za-z0-9_-]+/g
const hyphenMultiReg = /-+/g

const sanitizeHighlightName = (name) => {
  const raw = String(name || '')
  let safe = raw.replace(highlightNameUnsafeReg, '-').replace(hyphenMultiReg, '-').replace(/^-+|-+$/g, '')
  if (!safe) safe = 'scope'
  if (/^[0-9]/.test(safe)) safe = 'x-' + safe
  if (safe.startsWith('--')) safe = safe.slice(2) || 'scope'
  return safe
}

const getCustomHighlightBlockId = (node) => {
  if (!node || typeof node.getAttribute !== 'function') return null
  return node.getAttribute(customHighlightPreAttr)
}

const getRuntimeInsertedScopeStyles = (doc) => {
  if (!doc || typeof doc !== 'object') return globalRuntimeInsertedScopeStyles
  let map = runtimeInsertedScopeStylesByDoc.get(doc)
  if (!map) {
    map = new Map()
    runtimeInsertedScopeStylesByDoc.set(doc, map)
  }
  return map
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

const getCachedPayloadString = (payload, cache) => {
  if (!cache || payload == null || (typeof payload !== 'object' && typeof payload !== 'function')) {
    return JSON.stringify(payload)
  }
  if (cache.has(payload)) return cache.get(payload)
  const text = JSON.stringify(payload)
  cache.set(payload, text)
  return text
}

const createPayloadDigest = (payloadMap, cache) => {
  const keys = Object.keys(payloadMap || {}).sort()
  const parts = new Array(keys.length)
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const payload = payloadMap[key]
    parts[i] = key + '=' + getCachedPayloadString(payload, cache) + ';'
  }
  return parts.join('')
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

const addMediaQueryChangeListener = (queryList, listener) => {
  if (!queryList || typeof listener !== 'function') return null
  if (typeof queryList.addEventListener === 'function' && typeof queryList.removeEventListener === 'function') {
    queryList.addEventListener('change', listener)
    return () => {
      try {
        queryList.removeEventListener('change', listener)
      } catch (e) {}
    }
  }
  if (typeof queryList.addListener === 'function' && typeof queryList.removeListener === 'function') {
    queryList.addListener(listener)
    return () => {
      try {
        queryList.removeListener(listener)
      } catch (e) {}
    }
  }
  return null
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

const resolveRuntimeColorScheme = (options = {}, doc) => {
  const raw = String(options.colorScheme || 'auto').trim().toLowerCase()
  const mode = validColorSchemeSet.has(raw) ? raw : 'auto'
  if (mode === 'light' || mode === 'dark') return mode
  const view = doc && doc.defaultView
  const matchMediaFn = (options.matchMedia && typeof options.matchMedia === 'function')
    ? options.matchMedia
    : (view && typeof view.matchMedia === 'function' ? view.matchMedia.bind(view) : null)
  if (!matchMediaFn) return 'light'
  try {
    return matchMediaFn('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch (e) {
    return 'light'
  }
}

const resolvePayloadVariantView = (payload, colorScheme) => {
  const baseScopes = Array.isArray(payload && payload.scopes) ? payload.scopes : []
  const baseRanges = Array.isArray(payload && payload.ranges) ? payload.ranges : []
  const baseScopeStyles = Array.isArray(payload && payload.scopeStyles) ? payload.scopeStyles : null
  const variants = payload && payload.variants && typeof payload.variants === 'object' ? payload.variants : null
  if (!variants) {
    return {
      scopes: baseScopes,
      ranges: baseRanges,
      scopeStyles: baseScopeStyles,
      variantKey: '',
    }
  }
  const availableKeys = Object.keys(variants)
  if (!availableKeys.length) {
    return {
      scopes: baseScopes,
      ranges: baseRanges,
      scopeStyles: baseScopeStyles,
      variantKey: '',
    }
  }
  let key = ''
  if (colorScheme && variants[colorScheme]) key = colorScheme
  if (!key && typeof payload.defaultVariant === 'string' && variants[payload.defaultVariant]) key = payload.defaultVariant
  if (!key) key = availableKeys[0]
  const variant = variants[key] && typeof variants[key] === 'object' ? variants[key] : {}
  const scopes = Array.isArray(variant.scopes) ? variant.scopes : baseScopes
  const ranges = Array.isArray(variant.ranges) ? variant.ranges : baseRanges
  const scopeStyles = Array.isArray(variant.scopeStyles) ? variant.scopeStyles : baseScopeStyles
  return {
    scopes,
    ranges,
    scopeStyles,
    variantKey: key || '',
  }
}

const getRuntimeScopeName = (scopeName, variantKey) => {
  const base = sanitizeHighlightName(scopeName)
  if (!variantKey) return base
  const suffix = sanitizeHighlightName(variantKey)
  return `${base}-v-${suffix}`
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

const createSegmentPositionResolver = (segments) => {
  const count = Array.isArray(segments) ? segments.length : 0
  let hint = 0
  let lastOffset = -1
  return (offset) => {
    if (!Number.isSafeInteger(offset) || count === 0) return null
    if (offset >= lastOffset && hint < count) {
      let i = hint
      while (i < count) {
        const seg = segments[i]
        if (offset < seg.start) break
        if (offset <= seg.end) {
          hint = i
          lastOffset = offset
          return { node: seg.node, offset: offset - seg.start }
        }
        i++
      }
    }
    const pos = findTextPosition(segments, offset)
    if (pos) lastOffset = offset
    return pos
  }
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
  const resolvedColorScheme = resolveRuntimeColorScheme(options, doc)
  const supportedVersions = getRuntimeSupportedPayloadVersions(options)
  const incremental = options.incremental === true
  const payloadDigestByBlock = incremental ? new Map() : null
  const payloadStringifyCache = incremental ? new Map() : null
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
    digest = (options.payloadDigest || createPayloadDigest(payloadMap, payloadStringifyCache)) + '|ids=' + Array.from(blockRefs.keys()).sort().join(',') + `|scheme=${resolvedColorScheme}`
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
  let insertedScopeStyleMap = null
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
    const activePayload = resolvePayloadVariantView(payload, resolvedColorScheme)
    if (activePayload.ranges.length === 0 || activePayload.scopes.length === 0) {
      pre.removeAttribute(customHighlightAppliedAttr)
      if (emitDiag) emitDiag({ type: 'block-skip', blockId, reason: 'empty-payload' })
      continue
    }

    let blockPayloadDigest = ''
    if (payloadDigestByBlock) {
      blockPayloadDigest = payloadDigestByBlock.get(blockId)
      if (blockPayloadDigest === undefined) {
        const prevCached = prevBlockCache ? prevBlockCache.get(blockId) : null
        if (prevCached && prevCached.payloadRef === payload && prevCached.variantKey === activePayload.variantKey) {
          blockPayloadDigest = prevCached.payloadDigest || ''
        } else {
          blockPayloadDigest = getCachedPayloadString(payload, payloadStringifyCache) + `|variant=${activePayload.variantKey || ''}`
        }
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
        let target = allScopeRanges.get(runtimeName)
        if (!target) {
          target = []
          allScopeRanges.set(runtimeName, target)
        }
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
    const resolveTextPos = createSegmentPositionResolver(segments)
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
    const appliedNameList = []
    const scopeRuntimeNames = new Array(activePayload.scopes.length)
    const scopeStyles = Array.isArray(activePayload.scopeStyles) ? activePayload.scopeStyles : null
    const blockScopeRanges = nextBlockCache ? new Map() : null
    const blockScopeMetaParts = nextBlockCache ? new Map() : null
    let blockAppliedRangeCount = 0

    for (let tupleIdx = 0; tupleIdx < activePayload.ranges.length; tupleIdx++) {
      const tuple = activePayload.ranges[tupleIdx]
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
      if (scopeIdx < 0 || scopeIdx >= activePayload.scopes.length) {
        if (emitDiag) emitDiag({ type: 'range-skip', blockId, reason: 'invalid-scope-index', tupleIndex: tupleIdx, scopeIdx })
        continue
      }
      const scopeName = activePayload.scopes[scopeIdx]
      if (!scopeName) {
        if (emitDiag) emitDiag({ type: 'range-skip', blockId, reason: 'missing-scope', tupleIndex: tupleIdx, scopeIdx })
        continue
      }
      const startPos = resolveTextPos(start)
      const endPos = resolveTextPos(end)
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
        runtimeName = getRuntimeScopeName(scopeName, activePayload.variantKey)
        scopeRuntimeNames[scopeIdx] = runtimeName
        if (scopeStyles) {
          const css = styleToHighlightCss(scopeStyles[scopeIdx])
          if (css) {
            if (!insertedScopeStyleMap) insertedScopeStyleMap = getRuntimeInsertedScopeStyles(doc)
            if (insertedScopeStyleMap.get(runtimeName) !== css) {
              if (!styleTag) styleTag = ensureHighlightStyleTag(doc)
              if (styleTag) {
                pendingCss += `\n::highlight(${runtimeName}){${css};}`
                insertedScopeStyleMap.set(runtimeName, css)
              }
            }
          }
        }
      }
      let scopeRanges = allScopeRanges.get(runtimeName)
      if (!scopeRanges) {
        scopeRanges = []
        allScopeRanges.set(runtimeName, scopeRanges)
      }
      scopeRanges.push(range)
      if (blockScopeRanges) {
        let blockRanges = blockScopeRanges.get(runtimeName)
        if (!blockRanges) {
          blockRanges = []
          blockScopeRanges.set(runtimeName, blockRanges)
        }
        blockRanges.push(range)
      }
      if (blockScopeMetaParts) {
        let rangeMeta = blockScopeMetaParts.get(runtimeName)
        if (!rangeMeta) {
          rangeMeta = []
          blockScopeMetaParts.set(runtimeName, rangeMeta)
        }
        rangeMeta.push(`${start}-${end}`)
      }
      appliedRanges++
      blockAppliedRangeCount++
      if (!appliedNames.has(runtimeName)) {
        appliedNames.add(runtimeName)
        appliedNameList.push(runtimeName)
      }
    }

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
        payloadRef: payload,
        variantKey: activePayload.variantKey || '',
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
  const runtimeApplyOptions = (typeof options.matchMedia === 'function' && typeof applyOptions.matchMedia !== 'function')
    ? Object.assign({}, applyOptions, { matchMedia: options.matchMedia })
    : applyOptions
  const once = options.once !== false
  let isDisposed = false
  let isObserverStopped = false
  let hasApplied = false
  let removeColorSchemeListener = null
  const applyNow = () => {
    const result = applyCustomHighlights(queryRoot, runtimeApplyOptions)
    hasApplied = true
    return result
  }

  const observer = new ObserverCtor((entries) => {
    if (isDisposed || !Array.isArray(entries)) return
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
      isObserverStopped = true
    }
  }, {
    root: options.root || null,
    rootMargin: options.rootMargin || '200px 0px',
    threshold: options.threshold == null ? 0 : options.threshold,
  })

  const observe = () => {
    if (isDisposed || isObserverStopped) return 0
    const targets = queryRoot.querySelectorAll(selector)
    for (const target of targets) observer.observe(target)
    return targets.length
  }
  const disconnect = () => {
    if (isDisposed) return
    if (removeColorSchemeListener) {
      removeColorSchemeListener()
      removeColorSchemeListener = null
    }
    observer.disconnect()
    isObserverStopped = true
    isDisposed = true
  }

  const watchColorScheme = options.watchColorScheme === true
  const autoMode = String(applyOptions.colorScheme || 'auto').trim().toLowerCase() === 'auto'
  if (watchColorScheme && autoMode) {
    const doc = queryRoot.ownerDocument || (typeof queryRoot.createElement === 'function' ? queryRoot : null)
    const view = doc && doc.defaultView
    const matchMediaFn = (options.matchMedia && typeof options.matchMedia === 'function')
      ? options.matchMedia
      : (view && typeof view.matchMedia === 'function' ? view.matchMedia.bind(view) : null)
    if (matchMediaFn) {
      let queryList = null
      try {
        queryList = matchMediaFn('(prefers-color-scheme: dark)')
      } catch (e) {
        queryList = null
      }
      if (queryList) {
        removeColorSchemeListener = addMediaQueryChangeListener(queryList, () => {
          if (isDisposed || !hasApplied) return
          applyNow()
        })
      }
    }
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

export {
  applyCustomHighlights,
  clearCustomHighlights,
  observeCustomHighlights,
}
