;(function () {
  function sanitizeName(name) {
    return String(name || '')
      .replace(/[^A-Za-z0-9_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  function collectSegments(node) {
    var segments = []
    var walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
    var current = walker.nextNode()
    var cursor = 0
    while (current) {
      var len = current.nodeValue ? current.nodeValue.length : 0
      segments.push({ node: current, start: cursor, end: cursor + len })
      cursor += len
      current = walker.nextNode()
    }
    return segments
  }

  function findPos(segments, offset) {
    var lo = 0
    var hi = segments.length - 1
    while (lo <= hi) {
      var mid = (lo + hi) >> 1
      var seg = segments[mid]
      if (offset < seg.start) {
        hi = mid - 1
        continue
      }
      if (offset > seg.end) {
        lo = mid + 1
        continue
      }
      return { node: seg.node, offset: offset - seg.start }
    }
    if (!segments.length) return null
    var last = segments[segments.length - 1]
    if (offset === last.end) return { node: last.node, offset: last.end - last.start }
    return null
  }

  function ensureStyleTag(styleTagId) {
    var tag = document.getElementById(styleTagId)
    if (tag) return tag
    tag = document.createElement('style')
    tag.id = styleTagId
    document.head.appendChild(tag)
    return tag
  }

  function getStyleRegistry(styleTagId) {
    var key = String(styleTagId || 'pre-highlight-style')
    if (!window.__preHighlightStyleRegistry || typeof window.__preHighlightStyleRegistry !== 'object') {
      window.__preHighlightStyleRegistry = {}
    }
    if (!window.__preHighlightStyleRegistry[key]) {
      window.__preHighlightStyleRegistry[key] = {}
    }
    return window.__preHighlightStyleRegistry[key]
  }

  function getStatusEl(statusId) {
    if (!statusId) return null
    return document.getElementById(statusId)
  }

  function setStatus(statusEl, text) {
    if (!statusEl) return
    statusEl.textContent = text
  }

  function applyPreHighlights(options) {
    var opt = options || {}
    var styleTagId = opt.styleTagId || 'pre-highlight-style'
    var statusEl = getStatusEl(opt.statusId || 'runtime-status')
    if (!window.CSS || !CSS.highlights || typeof Highlight === 'undefined' || typeof Range === 'undefined') {
      setStatus(statusEl, 'Custom Highlight API is not supported in this browser.')
      return { appliedBlocks: 0, appliedRanges: 0, reason: 'api-unsupported' }
    }

    var payloadScript = document.getElementById(opt.dataScriptId || 'pre-highlight-data')
    if (!payloadScript || !payloadScript.textContent) {
      setStatus(statusEl, 'Payload script not found.')
      return { appliedBlocks: 0, appliedRanges: 0, reason: 'payload-not-found' }
    }

    var payloadMap
    try {
      payloadMap = JSON.parse(payloadScript.textContent)
    } catch (e) {
      setStatus(statusEl, 'Payload parse failed.')
      return { appliedBlocks: 0, appliedRanges: 0, reason: 'payload-parse-failed' }
    }

    var styleTag = null
    if (opt.useScopeStyles !== false) {
      styleTag = ensureStyleTag(styleTagId)
    }

    var appliedBlocks = 0
    var appliedRanges = 0
    var globalNames = {}
    var writtenStyles = getStyleRegistry(styleTagId)

    document.querySelectorAll('pre[data-pre-highlight] > code, pre[data-pre-highlight] > samp').forEach(function (codeEl) {
      var pre = codeEl.parentElement
      if (!pre) return
      var id = pre.getAttribute('data-pre-highlight')
      var payload = payloadMap[id]
      if (!payload || !Array.isArray(payload.ranges) || !Array.isArray(payload.scopes)) return

      var segments = collectSegments(codeEl)
      var blockNames = {}

      payload.ranges.forEach(function (tuple) {
        if (!Array.isArray(tuple) || tuple.length < 3) return
        var scopeIdx = tuple[0]
        var start = tuple[1]
        var end = tuple[2]
        if (!Number.isInteger(scopeIdx) || !Number.isInteger(start) || !Number.isInteger(end) || end <= start) return
        var scopeName = payload.scopes[scopeIdx]
        if (!scopeName) return
        var startPos = findPos(segments, start)
        var endPos = findPos(segments, end)
        if (!startPos || !endPos) return

        var runtimeName = sanitizeName(scopeName)
        if (!runtimeName) return
        if (!globalNames[runtimeName]) globalNames[runtimeName] = []
        var range = document.createRange()
        range.setStart(startPos.node, startPos.offset)
        range.setEnd(endPos.node, endPos.offset)
        globalNames[runtimeName].push(range)
        blockNames[runtimeName] = true
        appliedRanges++
      })

      if (styleTag && Array.isArray(payload.scopeStyles)) {
        payload.scopes.forEach(function (scopeName, idx) {
          var style = payload.scopeStyles[idx]
          if (!style || typeof style !== 'object') return
          var runtimeName = sanitizeName(scopeName)
          if (!runtimeName) return
          if (writtenStyles[runtimeName]) return
          var parts = []
          if (typeof style.color === 'string' && style.color) parts.push('color:' + style.color)
          if (typeof style.backgroundColor === 'string' && style.backgroundColor) parts.push('background-color:' + style.backgroundColor)
          if (typeof style.textDecoration === 'string' && style.textDecoration) parts.push('text-decoration:' + style.textDecoration)
          if (typeof style.textShadow === 'string' && style.textShadow) parts.push('text-shadow:' + style.textShadow)
          if (!parts.length) return
          writtenStyles[runtimeName] = true
          styleTag.textContent += '\n::highlight(' + runtimeName + '){' + parts.join(';') + ';}'
        })
      }

      if (Object.keys(blockNames).length > 0) appliedBlocks++
    })

    Object.keys(globalNames).forEach(function (runtimeName) {
      CSS.highlights.set(runtimeName, new Highlight(...globalNames[runtimeName]))
    })

    setStatus(statusEl, 'appliedBlocks=' + appliedBlocks + ', appliedRanges=' + appliedRanges)
    return { appliedBlocks: appliedBlocks, appliedRanges: appliedRanges }
  }

  window.applyPreHighlights = applyPreHighlights
})()
