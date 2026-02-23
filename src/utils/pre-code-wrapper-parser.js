const isSpaceCode = (code) => {
  return code === 9 || code === 10 || code === 12 || code === 13 || code === 32
}

const isTagNameCharCode = (code) => {
  return (
    (code >= 48 && code <= 57) || // 0-9
    (code >= 65 && code <= 90) || // A-Z
    (code >= 97 && code <= 122) || // a-z
    code === 45 || // -
    code === 58 // :
  )
}

const skipSpace = (source, start) => {
  let i = start
  const len = source.length
  while (i < len && isSpaceCode(source.charCodeAt(i))) i++
  return i
}

const parseOpenTag = (source, start) => {
  if (source.charCodeAt(start) !== 60) return null // <
  let i = start + 1
  if (i >= source.length || source.charCodeAt(i) === 47) return null // /

  const nameStart = i
  while (i < source.length && isTagNameCharCode(source.charCodeAt(i))) i++
  if (i === nameStart) return null
  const name = source.slice(nameStart, i).toLowerCase()

  const attrStart = i
  let quote = 0
  while (i < source.length) {
    const ch = source.charCodeAt(i)
    if (quote !== 0) {
      if (ch === quote) quote = 0
      i++
      continue
    }
    if (ch === 34 || ch === 39) { // " or '
      quote = ch
      i++
      continue
    }
    if (ch === 62) break // >
    i++
  }
  if (i >= source.length) return null

  let tail = i - 1
  while (tail >= attrStart && isSpaceCode(source.charCodeAt(tail))) tail--
  const selfClosing = tail >= attrStart && source.charCodeAt(tail) === 47 // /
  const attrsText = source.slice(attrStart, i).trim()
  return { name, attrsText, selfClosing, start, end: i + 1 }
}

const parseCloseTag = (source, start) => {
  if (source.charCodeAt(start) !== 60) return null // <
  let i = start + 1
  if (i >= source.length || source.charCodeAt(i) !== 47) return null // /
  i++
  i = skipSpace(source, i)
  const nameStart = i
  while (i < source.length && isTagNameCharCode(source.charCodeAt(i))) i++
  if (i === nameStart) return null
  const name = source.slice(nameStart, i).toLowerCase()
  i = skipSpace(source, i)
  if (i >= source.length || source.charCodeAt(i) !== 62) return null // >
  return { name, start, end: i + 1 }
}

const findCloseTag = (source, start, targetName) => {
  const len = source.length
  for (let i = start; i < len; i++) {
    if (source.charCodeAt(i) !== 60) continue
    const close = parseCloseTag(source, i)
    if (!close) continue
    if (close.name === targetName) return close
  }
  return null
}

const parsePreCodeWrapper = (html) => {
  const source = String(html || '')
  if (!source) return null
  let i = skipSpace(source, 0)
  const preOpen = parseOpenTag(source, i)
  if (!preOpen || preOpen.selfClosing || preOpen.name !== 'pre') return null
  i = skipSpace(source, preOpen.end)
  const codeOpen = parseOpenTag(source, i)
  if (!codeOpen || codeOpen.selfClosing || codeOpen.name !== 'code') return null

  const codeClose = findCloseTag(source, codeOpen.end, 'code')
  if (!codeClose) return null
  const content = source.slice(codeOpen.end, codeClose.start)

  i = skipSpace(source, codeClose.end)
  const preClose = parseCloseTag(source, i)
  if (!preClose || preClose.name !== 'pre') return null

  i = skipSpace(source, preClose.end)
  if (i !== source.length) return null

  return {
    preAttrsText: preOpen.attrsText,
    codeAttrsText: codeOpen.attrsText,
    content,
  }
}

export {
  parsePreCodeWrapper,
}
