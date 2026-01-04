const infoReg = /^([^{\s]*)(?:\s*\{(.*)\})?$/

const attrReg = /^(?:([.#])(.+)|(.+?)(?:=(["'])?(.*?)\1)?)$/
const interAttrsSpaceReg = / +/
const tagReg = /<\/?([A-Za-z][A-Za-z0-9-]*)(?:\s+[^>]*?)?\/?\s*>/g
const preLineTag = '<span class="pre-line">'
const emphOpenTag = '<span class="pre-lines-emphasis">'
const closeTag = '</span>'
const closeTagLen = closeTag.length
const preWrapStyleReg = /(?:^|;)\s*white-space\s*:\s*pre-wrap\s*(?:;|$)/i

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

const getEmphasizeLines = (attrVal) => {
  const lines = []
  let s, e
  attrVal.split(',').forEach(range => {
    if (range.indexOf('-') > -1) {
      [s, e] = range.split('-').map(n => parseInt(n.trim(), 10))
      lines.push([s, e])
    } else {
      s = parseInt(range.trim(), 10)
      lines.push([s, s])
    }
  })
  return lines
}

const splitFenceBlockToLines = (content, emphasizeLines, needLineNumber, needEmphasis, needEndSpan, threshold, lineEndSpanClass, br) => {
  const lines = content.split(br)
  const len = lines.length
  const endSpanTag = needEndSpan ? `<span class="${lineEndSpanClass}"></span>` : ''
  let emIdx = 0
  let [emStart, emEnd] = emphasizeLines[0] || []
  for (let n = 0; n < len; n++) {
    let line = lines[n]

    if (needEndSpan) {
      let lineLen = line.length
      if (lineLen < threshold) {
        lineLen = 0
        for (let i = 0, L = line.length; i < L; i++) {
          lineLen += line.charCodeAt(i) > 255 ? 2 : 1
          if (lineLen >= threshold) break
        }
      }
      if (lineLen >= threshold) {
        if (line.slice(-closeTagLen) === closeTag) {
          line = line.slice(0, -closeTagLen) + endSpanTag + closeTag
        } else {
          line = line + endSpanTag
        }
      }
    }

    if (needLineNumber && n !== len - 1) {
      if (line.indexOf('<') !== -1) {
        const tagStack = []
        tagReg.lastIndex = 0
        let match
        while ((match = tagReg.exec(line)) !== null) {
          const [fullMatch, tagName] = match
          if (fullMatch.startsWith('</')) {
            if (tagStack[tagStack.length-1] === tagName) tagStack.pop()
          } else if (!fullMatch.endsWith('/>')) {
            tagStack.push(tagName)
          }
        }
        for (let i = tagStack.length-1; i >= 0; i--) {
          const tagName = tagStack[i]
          line += `</${tagName}>`
          lines[n+1] = `<${tagName}>` + (lines[n+1]||'')
        }
      }
      line = preLineTag + line + closeTag
    }

    if (needEmphasis) {
      if (emStart === n + 1) line = emphOpenTag + line
      if (emEnd === n) {
        line = closeTag + line
        emIdx++
        [emStart, emEnd] = emphasizeLines[emIdx] || []
      }
    }
    lines[n] = line
  }
  return lines.join(br)
}

const getInfoAttr = (infoAttr) => {
  let attrSets = infoAttr.trim().split(interAttrsSpaceReg)
  let arr = []
  for (let attrSet of attrSets) {
    const str = attrReg.exec(attrSet)
    if (str) {
      if (str[1] === '.') str[1] = 'class'
      if (str[1] === '#') str[1] = 'id'
      if (str[3]) {
        str[1] = str[3]
        str[2] = str[5] ? str[5].replace(/^['"]/, '').replace(/['"]$/, '') : ''
      }
      arr.push([str[1], str[2]])
    }
  }
  return arr
}

const orderTokenAttrs = (token, opt) => {
  if (!token.attrs) return
  const order = opt.attrsOrder || []
  token.attrs.sort((a, b) => {
    const idx = (name) => {
      for (let i = 0; i < order.length; i++) {
        const key = order[i]
        if (key.endsWith('*')) {
          const prefix = key.slice(0, -1)
          if (name.startsWith(prefix)) return i
        } else if (name === key) {
          return i
        }
      }
      return order.length
    }
    return idx(a[0]) - idx(b[0])
  })
}

const getFenceHtml = (tokens, idx, md, opt, slf) => {
  const token = tokens[idx]
  let content = token.content
  const info = token.info.trim()
  const match = info.match(infoReg)
  let lang = match ? match[1] : ''

  if (match && match[2]) {
    getInfoAttr(match[2]).forEach(([name, val]) => token.attrJoin(name, val))
  }
  let langClass = ''
  if (lang  && lang !== 'samp') {
    langClass = opt.langPrefix + lang
    const existingClass = token.attrGet('class')
    token.attrSet('class', existingClass ? langClass + ' ' + existingClass : langClass)
  }

  let startNumber = -1
  let emphasizeLines = []

  if (token.attrs) {
    const newAttrs = []
    let dataPreStartIndex = -1
    let dataPreEmphasisIndex = -1
    let dataPreWrapIndex = -1
    let styleIndex = -1
    let startValue
    let emphasisValue
    let styleValue
    let sawStartAttr = false
    let sawEmphasisAttr = false
    let sawWrapAttr = false
    let wrapEnabled = false
    const appendOrder = []

    for (const attr of token.attrs) {
      const name = attr[0]
      const val = attr[1]

      switch (name) {
        case 'class': {
          if (val.indexOf(opt.langPrefix) !== -1) {
            const hasClassLang = opt._langReg.exec(val)
            if (hasClassLang) lang = hasClassLang[1]
          }
          newAttrs.push(attr)
          break
        }
        case 'style':
          styleIndex = newAttrs.length
          styleValue = val
          newAttrs.push(attr)
          break
        case 'data-pre-start':
          startNumber = +val
          startValue = val
          dataPreStartIndex = newAttrs.length
          newAttrs.push(attr)
          break
        case 'start':
        case 'pre-start':
          startNumber = +val
          startValue = val
          if (!sawStartAttr) {
            appendOrder.push('start')
            sawStartAttr = true
          }
          break
        case 'data-pre-emphasis':
          dataPreEmphasisIndex = newAttrs.length
          newAttrs.push(attr)
          break
        case 'em-lines':
        case 'emphasize-lines':
          emphasizeLines = getEmphasizeLines(val)
          emphasisValue = val
          if (!sawEmphasisAttr) {
            appendOrder.push('emphasis')
            sawEmphasisAttr = true
          }
          break
        case 'data-pre-wrap':
          dataPreWrapIndex = newAttrs.length
          newAttrs.push(attr)
          if (val === '' || val === 'true') wrapEnabled = true
          break
        case 'wrap':
        case 'pre-wrap':
          if (val === '' || val === 'true') {
            wrapEnabled = true
            if (!sawWrapAttr) {
              appendOrder.push('wrap')
              sawWrapAttr = true
            }
          }
          break
        default:
          newAttrs.push(attr)
      }
    }

    if (startValue !== undefined && dataPreStartIndex >= 0) {
      newAttrs[dataPreStartIndex][1] = startValue
    }
    if (emphasisValue !== undefined && dataPreEmphasisIndex >= 0) {
      newAttrs[dataPreEmphasisIndex][1] = emphasisValue
    }
    if (wrapEnabled && dataPreWrapIndex >= 0) {
      newAttrs[dataPreWrapIndex][1] = 'true'
    }
    for (const kind of appendOrder) {
      if (kind === 'start') {
        if (dataPreStartIndex === -1 && startValue !== undefined) {
          newAttrs.push(['data-pre-start', startValue])
        }
      } else if (kind === 'emphasis') {
        if (dataPreEmphasisIndex === -1 && emphasisValue !== undefined) {
          newAttrs.push(['data-pre-emphasis', emphasisValue])
        }
      } else if (kind === 'wrap') {
        if (dataPreWrapIndex === -1 && wrapEnabled) {
          newAttrs.push(['data-pre-wrap', 'true'])
        }
      }
    }
    if (wrapEnabled && (!styleValue || !preWrapStyleReg.test(styleValue))) {
      styleValue = appendStyleValue(styleValue, 'white-space: pre-wrap;')
    }
    if (startNumber !== -1) {
      styleValue = appendStyleValue(styleValue, 'counter-set:pre-line-number ' + startNumber + ';')
    }
    if (styleIndex >= 0) {
      if (styleValue !== undefined) newAttrs[styleIndex][1] = styleValue
    } else if (styleValue) {
      newAttrs.push(['style', styleValue])
    }
    token.attrs = newAttrs
  }
  orderTokenAttrs(token, opt)

  if (opt.setHighlight && md.options.highlight) {
    if (lang && lang !== 'samp' ) {
      content = md.options.highlight(content, lang)
    } else {
      content = md.utils.escapeHtml(token.content)
    }
  } else {
    content = md.utils.escapeHtml(token.content)
  }

  const needLineNumber = opt.setLineNumber && startNumber >= 0
  const needEmphasis = opt.setEmphasizeLines && emphasizeLines.length > 0
  const needEndSpan = opt.setLineEndSpan > 0
  if (needLineNumber || needEmphasis || needEndSpan) {
    const nlIndex = content.indexOf('\n')
    const br = nlIndex > 0 && content[nlIndex - 1] === '\r' ? '\r\n' : '\n'
    content = splitFenceBlockToLines(content, emphasizeLines, needLineNumber, needEmphasis, needEndSpan, opt.setLineEndSpan, opt.lineEndSpanClass, br)
  }

  const tag = opt._sampReg.test(lang) ? 'samp' : 'code'
  return `<pre><${tag}${slf.renderAttrs(token)}>${content}</${tag}></pre>\n`
}

const mditRendererFence = (md, option) => {
  const opt = {
    attrsOrder: ['class', 'id', 'data-*', 'style'],
    setHighlight: true,
    setLineNumber: true,
    setEmphasizeLines: true,
    setLineEndSpan: 0,
    lineEndSpanClass: 'pre-lineend-spacer',
    sampLang: 'shell,console',
    langPrefix: md.options.langPrefix || 'language-',
  }
  if (option) Object.assign(opt, option)

  opt._sampReg = new RegExp('^(?:samp|' + opt.sampLang.split(',').join('|') + ')$')
  opt._langReg = new RegExp(opt.langPrefix + '([A-Za-z0-9-]+)')

  md.renderer.rules['fence'] = (tokens, idx, options, env, slf)  => {
    return getFenceHtml(tokens, idx, md, opt, slf)
  }
}

export default mditRendererFence
