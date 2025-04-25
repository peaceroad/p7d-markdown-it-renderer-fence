const infoReg = /^([^{\s]*)(?:\s*\{(.*)\})?$/
const startReg = /^(?:(?:data-)?pre-)?start$/
const startFilterReg = /^(?:pre-)?start$/
const emphasisReg = /^em(?:phasize)?-lines$/

const attrReg = /^(?:([.#])(.+)|(.+?)(?:=(["'])?(.*?)\1)?)$/
const interAttrsSpaceReg = / +/
const tagReg = /<\/?([A-Za-z][A-Za-z0-9-]*)(?:\s+[^>]*?)?\/?\s*>/g
const preLineTag = '<span class="pre-line">'
const emphOpenTag = '<span class="pre-lines-emphasis">'
const closeTag = '</span>'
const closeTagLen = closeTag.length

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
  const endSpanTag = `<span class="${lineEndSpanClass}"></span>`
  let emIdx = 0
  let [emStart, emEnd] = emphasizeLines[0] || []
  for (let n = 0; n < len; n++) {
    let line = lines[n]

    if (needEndSpan) {
      let lineLen = 0
      for (let i = 0, L = line.length; i < L; i++) {
        lineLen += line.charCodeAt(i) > 255 ? 2 : 1
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
  const match = token.info.trim().match(infoReg)
  let lang = match ? match[1] : ''

  if (match && match[2]) {
    getInfoAttr(match[2]).forEach(([name, val]) => token.attrJoin(name, val))
  }
  let langClass = ''
  if (lang  && lang !== 'samp') {
    langClass = opt.langPrefix + lang
    token.attrSet('class', langClass + (token.attrGet('class') ? ' ' + token.attrGet('class') : ''))
  }

  let startNumber = -1
  let emphasizeLines = []

  if (token.attrs) {
    for (let attr of token.attrs) {
      if (attr[0] === 'class') {
        const hasClassLang = attr[1].match(opt._langReg)
        if (hasClassLang) lang = hasClassLang[1]
      }
      if (startReg.test(attr[0])) {
        startNumber = +attr[1]
        if (attr[0] !== 'data-pre-start') {
          token.attrSet('data-pre-start', attr[1])
          token.attrs = token.attrs.filter(attr => !startFilterReg.test(attr[0]))
        }
      }
      if (emphasisReg.test(attr[0])) {
        emphasizeLines = getEmphasizeLines(attr[1])
        token.attrSet('data-pre-emphasis', attr[1])
        token.attrs = token.attrs.filter(attr => !emphasisReg.test(attr[0]))
      }
    }
  }
  if (startNumber !== -1) {
    token.attrJoin('style', 'counter-set:pre-line-number ' + startNumber + ';')
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
    const brMatch = content.match(/\r?\n/)
    const br = brMatch ? brMatch[0] : '\n'
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