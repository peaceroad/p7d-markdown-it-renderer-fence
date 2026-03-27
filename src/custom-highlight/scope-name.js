const highlightNameUnsafeReg = /[^A-Za-z0-9_-]+/g
const hyphenMultiReg = /-+/g

const sanitizeHighlightNamePart = (value, fallback = '') => {
  let safe = String(value == null ? '' : value)
    .replace(highlightNameUnsafeReg, '-')
    .replace(hyphenMultiReg, '-')
    .replace(/^-+|-+$/g, '')
  if (!safe) safe = fallback
  if (/^[0-9]/.test(safe)) safe = 'x-' + safe
  if (safe.startsWith('--')) safe = safe.slice(2) || fallback
  return safe
}

const sanitizeHighlightName = (name, prefix = '') => {
  const safe = sanitizeHighlightNamePart(name, 'scope')
  const prefixBase = sanitizeHighlightNamePart(prefix, '')
  return prefixBase ? `${prefixBase}-${safe}` : safe
}

export {
  sanitizeHighlightName,
}
