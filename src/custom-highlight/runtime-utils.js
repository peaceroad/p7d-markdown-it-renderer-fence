const styleValueSafeReg = /^[#(),.%\w\s-]+$/

const getPayloadMapFromScript = (root, scriptId = 'pre-highlight-data', inlineAttrName = 'data-pre-highlight') => {
  if (!root || typeof root.querySelector !== 'function') return {}
  const map = {}
  const safeScriptId = scriptId || 'pre-highlight-data'
  const script = root.querySelector(`#${safeScriptId}`)
  if (script && script.textContent) {
    try {
      const parsed = JSON.parse(script.textContent)
      if (parsed && typeof parsed === 'object') Object.assign(map, parsed)
    } catch (e) {}
  }
  const inlineScripts = root.querySelectorAll(`script[type="application/json"][${inlineAttrName}]`)
  for (const item of inlineScripts) {
    const id = item && typeof item.getAttribute === 'function' ? item.getAttribute(inlineAttrName) : null
    if (!id || !item.textContent) continue
    try {
      map[id] = JSON.parse(item.textContent)
    } catch (e) {}
  }
  return map
}

const collectTextSegments = (node) => {
  const segments = []
  const doc = node && (node.ownerDocument || (typeof document !== 'undefined' ? document : null))
  if (!doc || typeof doc.createTreeWalker !== 'function') return segments
  const textMask = typeof NodeFilter !== 'undefined' ? NodeFilter.SHOW_TEXT : 4
  const walker = doc.createTreeWalker(node, textMask)
  let current = walker.nextNode()
  let cursor = 0
  while (current) {
    const len = current.nodeValue ? current.nodeValue.length : 0
    segments.push({ node: current, start: cursor, end: cursor + len })
    cursor += len
    current = walker.nextNode()
  }
  return segments
}

const findTextPosition = (segments, offset) => {
  let lo = 0
  let hi = segments.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const seg = segments[mid]
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
  if (segments.length === 0) return null
  const last = segments[segments.length - 1]
  if (offset === last.end) return { node: last.node, offset: last.end - last.start }
  return null
}

const styleValueSafe = (val) => {
  return typeof val === 'string' && styleValueSafeReg.test(val)
}

const styleToHighlightCss = (style) => {
  if (!style || typeof style !== 'object') return ''
  const parts = []
  if (styleValueSafe(style.color)) parts.push(`color:${style.color}`)
  if (styleValueSafe(style.backgroundColor)) parts.push(`background-color:${style.backgroundColor}`)
  if (styleValueSafe(style.textDecoration)) parts.push(`text-decoration:${style.textDecoration}`)
  if (styleValueSafe(style.textShadow)) parts.push(`text-shadow:${style.textShadow}`)
  return parts.join(';')
}

export {
  collectTextSegments,
  findTextPosition,
  getPayloadMapFromScript,
  styleToHighlightCss,
}
