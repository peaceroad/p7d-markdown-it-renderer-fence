const attrReg = /^(?:([.#])(.+)|(.+?)(?:=(["'])?(.*?)\1)?)$/
const interAttrsSpaceReg = / +/
const htmlAttrReg = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

const createAttrOrderIndexGetter = (order) => {
  const exact = new Map()
  const prefixes = []
  for (let i = 0; i < order.length; i++) {
    const key = order[i]
    if (key.endsWith('*')) {
      prefixes.push([key.slice(0, -1), i])
    } else if (!exact.has(key)) {
      exact.set(key, i)
    }
  }
  const fallback = order.length
  return (name) => {
    const exactIndex = exact.get(name)
    if (exactIndex !== undefined) return exactIndex
    for (let i = 0; i < prefixes.length; i++) {
      if (name.startsWith(prefixes[i][0])) return prefixes[i][1]
    }
    return fallback
  }
}

const appendStyleValue = (style, addition) => {
  if (!addition) return style
  let next = addition.trim()
  if (!next) return style
  if (!next.endsWith(';')) next += ';'
  if (!style) return next
  const base = style.trimEnd()
  const separator = base.endsWith(';') ? ' ' : '; '
  return base + separator + next
}

const parseHtmlAttrs = (attrText) => {
  const attrs = []
  if (!attrText) return attrs
  htmlAttrReg.lastIndex = 0
  let match
  while ((match = htmlAttrReg.exec(attrText)) !== null) {
    const name = match[1]
    const val = match[2] ?? match[3] ?? match[4] ?? ''
    attrs.push([name, val])
  }
  return attrs
}

const mergeAttrSets = (target, source) => {
  if (!source || source.length === 0) return
  const index = new Map()
  for (let i = 0; i < target.length; i++) index.set(target[i][0], i)
  for (const [name, val] of source) {
    const idx = index.get(name)
    if (name === 'class') {
      if (idx === undefined) {
        target.push([name, val])
        index.set(name, target.length - 1)
      } else if (val) {
        const existing = target[idx][1]
        target[idx][1] = existing ? existing + ' ' + val : val
      }
      continue
    }
    if (name === 'style') {
      if (idx === undefined) {
        target.push([name, val])
        index.set(name, target.length - 1)
      } else {
        target[idx][1] = appendStyleValue(target[idx][1], val)
      }
      continue
    }
    if (idx === undefined) {
      target.push([name, val])
      index.set(name, target.length - 1)
    }
  }
}

const getInfoAttr = (infoAttr) => {
  const attrSets = infoAttr.trim().split(interAttrsSpaceReg)
  const out = []
  for (let attrSet of attrSets) {
    const str = attrReg.exec(attrSet)
    if (!str) continue
    if (str[1] === '.') str[1] = 'class'
    if (str[1] === '#') str[1] = 'id'
    if (str[3]) {
      str[1] = str[3]
      str[2] = str[5] ? str[5].replace(/^['"]/, '').replace(/['"]$/, '') : ''
    }
    out.push([str[1], str[2]])
  }
  return out
}

const getLangFromClassAttr = (classText, langPrefix) => {
  const value = String(classText || '')
  if (!value || !langPrefix || value.indexOf(langPrefix) === -1) return ''
  const list = value.trim().split(/\s+/)
  for (let i = 0; i < list.length; i++) {
    const name = list[i]
    if (name.startsWith(langPrefix) && name.length > langPrefix.length) {
      return name.slice(langPrefix.length)
    }
  }
  return ''
}

export {
  appendStyleValue,
  createAttrOrderIndexGetter,
  getInfoAttr,
  getLangFromClassAttr,
  mergeAttrSets,
  parseHtmlAttrs,
}
