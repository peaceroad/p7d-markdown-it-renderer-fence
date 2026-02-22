const infoReg = /^([^{\s]*)(?:\s*\{(.*)\})?$/

const attrReg = /^(?:([.#])(.+)|(.+?)(?:=(["'])?(.*?)\1)?)$/
const interAttrsSpaceReg = / +/
const tagReg = /<\/?([A-Za-z][A-Za-z0-9-]*)(?:\s+[^>]*?)?\/?\s*>/g
const preLineTag = '<span class="pre-line">'
const emphOpenTag = '<span class="pre-lines-emphasis">'
const commentLineClass = 'pre-comment-line'
const closeTag = '</span>'
const closeTagLen = closeTag.length
const preWrapStyle = 'white-space: pre-wrap; overflow-wrap: anywhere;'
const preCodeWrapperReg = /^\s*<pre\b([^>]*)>\s*<code\b([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>\s*$/i
const htmlAttrReg = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
const nonNegativeIntReg = /^\d+$/
const lineBreakReg = /\r\n|\n|\r/

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

const parseStartNumber = (val) => {
  if (val == null) return null
  const text = String(val).trim()
  if (!nonNegativeIntReg.test(text)) return null
  const n = Number(text)
  if (!Number.isSafeInteger(n)) return null
  return n
}

const getLogicalLineCount = (text) => {
  if (!text) return 0
  const len = text.length
  let count = 1
  for (let i = 0; i < len; i++) {
    const code = text.charCodeAt(i)
    if (code === 10) {
      count++
      continue
    }
    if (code === 13) {
      count++
      if (i + 1 < len && text.charCodeAt(i + 1) === 10) i++
    }
  }
  const last = text.charCodeAt(len - 1)
  if (last === 10 || last === 13) count--
  return count
}

const getEmphasizeLines = (attrVal) => {
  const lines = []
  for (const range of attrVal.split(',')) {
    const part = range.trim()
    if (!part) continue
    const dash = part.indexOf('-')
    if (dash > -1) {
      const left = part.slice(0, dash).trim()
      const right = part.slice(dash + 1).trim()
      const s = left ? parseInt(left, 10) : null
      const e = right ? parseInt(right, 10) : null
      if (s !== null && (!Number.isFinite(s) || s <= 0)) continue
      if (e !== null && (!Number.isFinite(e) || e <= 0)) continue
      if (s === null && e === null) {
        lines.push([null, null])
      } else {
        lines.push([s, e])
      }
    } else {
      const s = parseInt(part, 10)
      if (!Number.isFinite(s) || s <= 0) continue
      lines.push([s, s])
    }
  }
  return lines
}

const splitFenceBlockToLines = (content, emphasizeLines, needLineNumber, needEmphasis, needEndSpan, threshold, lineEndSpanClass, br, commentLines, commentClass) => {
  const lines = content.split(lineBreakReg)
  const len = lines.length
  const lastLine = len - 1
  const endSpanTag = needEndSpan ? `<span class="${lineEndSpanClass}"></span>` : ''
  const needComment = !!(commentLines && commentClass)
  const maxLine = len - (lines[lastLine] === '' ? 1 : 0)
  let emIdx = 0
  let emStart
  let emEnd
  let doEmphasis = false
  if (needEmphasis && maxLine > 0) {
    const normalized = []
    for (const range of emphasizeLines) {
      let [s, e] = range
      if (s == null) s = 1
      if (e == null) e = maxLine
      if (!Number.isFinite(s) || !Number.isFinite(e) || s <= 0 || e <= 0) continue
      if (s > e) {
        const tmp = s
        s = e
        e = tmp
      }
      if (s > maxLine || e < 1) continue
      if (e > maxLine) e = maxLine
      normalized.push([s, e])
    }
    if (normalized.length > 0) {
      doEmphasis = true
      emphasizeLines = normalized
      ;[emStart, emEnd] = emphasizeLines[0]
    }
  }
  for (let n = 0; n < len; n++) {
    const notLastLine = n !== lastLine
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

    if (needLineNumber && notLastLine) {
      if (line.indexOf('<') !== -1) {
        const tagStack = []
        tagReg.lastIndex = 0
        let match
        while ((match = tagReg.exec(line)) !== null) {
          const [fullMatch, tagName] = match
          const tagNameLower = tagName.toLowerCase()
          if (fullMatch.startsWith('</')) {
            if (tagStack[tagStack.length-1] === tagNameLower) tagStack.pop()
          } else if (!fullMatch.endsWith('/>') && !voidTags.has(tagNameLower)) {
            tagStack.push(tagNameLower)
          }
        }
        for (let i = tagStack.length-1; i >= 0; i--) {
          const tagName = tagStack[i]
          line += `</${tagName}>`
          lines[n + 1] = `<${tagName}>` + lines[n + 1]
        }
      }
    }

    if (needComment && commentLines[n]) {
      line = `<span class="${commentClass}">` + line + closeTag
    }

    if (needLineNumber && notLastLine) {
      line = preLineTag + line + closeTag
    }

    if (doEmphasis) {
      if (emStart === n + 1) line = emphOpenTag + line
      if (emEnd === n) {
        line = closeTag + line
        emIdx++
        const nextEmphasis = emphasizeLines[emIdx] || []
        emStart = nextEmphasis[0]
        emEnd = nextEmphasis[1]
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
  const attrs = token.attrs
  if (!attrs || attrs.length < 2) return
  const rankCache = new Map()
  const getRank = (name) => {
    let rank = rankCache.get(name)
    if (rank === undefined) {
      rank = opt._attrOrderIndex(name)
      rankCache.set(name, rank)
    }
    return rank
  }
  attrs.sort((a, b) => getRank(a[0]) - getRank(b[0]))
}

const getFenceHtml = (tokens, idx, md, opt, slf) => {
  const token = tokens[idx]
  let content = token.content
  const match = token.info.trim().match(infoReg)
  let lang = match ? match[1] : ''

  if (match && match[2]) {
    getInfoAttr(match[2]).forEach(([name, val]) => token.attrJoin(name, val))
  }
  if (lang  && lang !== 'samp') {
    const langClass = opt.langPrefix + lang
    const existingClass = token.attrGet('class')
    token.attrSet('class', existingClass ? langClass + ' ' + existingClass : langClass)
  }

  let startNumber = -1
  let emphasizeLines = []
  let wrapEnabled = false
  let preWrapValue
  let commentLineValue

  if (token.attrs) {
    const newAttrs = []
    let dataPreStartIndex = -1
    let dataPreEmphasisIndex = -1
    let styleIndex = -1
    let dataPreCommentIndex = -1
    let startValue
    let emphasisValue
    let styleValue
    let sawCommentLine = false
    let sawStartAttr = false
    let sawEmphasisAttr = false
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
          startNumber = parseStartNumber(val) ?? -1
          startValue = val
          dataPreStartIndex = newAttrs.length
          newAttrs.push(attr)
          break
        case 'start':
        case 'pre-start':
          startNumber = parseStartNumber(val) ?? -1
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
        case 'data-pre-comment-line':
          dataPreCommentIndex = newAttrs.length
          commentLineValue = val
          newAttrs.push(attr)
          break
        case 'em-lines':
        case 'emphasize-lines':
          if (opt.setEmphasizeLines) emphasizeLines = getEmphasizeLines(val)
          emphasisValue = val
          if (!sawEmphasisAttr) {
            appendOrder.push('emphasis')
            sawEmphasisAttr = true
          }
          break
        case 'comment-line':
          commentLineValue = val
          if (!sawCommentLine) {
            appendOrder.push('comment')
            sawCommentLine = true
          }
          break
        case 'data-pre-wrap':
          preWrapValue = val
          if (val === '' || val === 'true') wrapEnabled = true
          break
        case 'wrap':
        case 'pre-wrap':
          if (val === '' || val === 'true') {
            wrapEnabled = true
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
    if (commentLineValue !== undefined && dataPreCommentIndex >= 0) {
      newAttrs[dataPreCommentIndex][1] = commentLineValue
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
      } else if (kind === 'comment') {
        if (dataPreCommentIndex === -1 && commentLineValue !== undefined) {
          newAttrs.push(['data-pre-comment-line', commentLineValue])
        }
      }
    }
    if (startNumber !== -1) {
      styleValue = appendStyleValue(styleValue, 'counter-set:pre-line-number ' + startNumber + ';')
    }
    if (styleIndex >= 0) {
      if (styleValue !== undefined) newAttrs[styleIndex][1] = styleValue
    } else if (styleValue) {
      newAttrs.push(['style', styleValue])
    }
    if (wrapEnabled) preWrapValue = 'true'
    token.attrs = newAttrs
  }

  const isSamp = opt._sampReg.test(lang)
  let commentLines
  let needComment = false

  if (opt.setHighlight && md.options.highlight) {
    if (lang && lang !== 'samp' ) {
      content = md.options.highlight(content, lang)
    } else {
      content = md.utils.escapeHtml(token.content)
    }
  } else {
    content = md.utils.escapeHtml(token.content)
  }

  let preAttrsFromHighlight
  let hasHighlightPre = false
  const hasPreTag = (content.indexOf('<pre') !== -1 || content.indexOf('<PRE') !== -1)
  if (hasPreTag) {
    const preMatch = content.match(preCodeWrapperReg)
    if (preMatch) {
      hasHighlightPre = true
      preAttrsFromHighlight = parseHtmlAttrs(preMatch[1])
      const codeAttrsFromHighlight = parseHtmlAttrs(preMatch[2])
      content = preMatch[3]
      if (codeAttrsFromHighlight.length) {
        if (!token.attrs) token.attrs = []
        mergeAttrSets(token.attrs, codeAttrsFromHighlight)
      }
    }
  }
  if (opt.useHighlightPre && hasPreTag && !hasHighlightPre) {
    return content.endsWith('\n') ? content : content + '\n'
  }
  orderTokenAttrs(token, opt)

  let preAttrs = preAttrsFromHighlight ? preAttrsFromHighlight.slice() : []
  if (preWrapValue !== undefined) {
    const idx = preAttrs.findIndex(attr => attr[0] === 'data-pre-wrap')
    if (idx === -1) {
      preAttrs.push(['data-pre-wrap', preWrapValue])
    } else {
      preAttrs[idx][1] = preWrapValue
    }
  }
  if (wrapEnabled && opt.setPreWrapStyle !== false) {
    const idx = preAttrs.findIndex(attr => attr[0] === 'style')
    if (idx === -1) {
      preAttrs.push(['style', preWrapStyle])
    } else {
      preAttrs[idx][1] = appendStyleValue(preAttrs[idx][1], preWrapStyle)
    }
  }
  if (preAttrs.length) orderTokenAttrs({ attrs: preAttrs }, opt)
  const preAttrsText = preAttrs.length ? slf.renderAttrs({ attrs: preAttrs }) : ''

  const needLineNumber = opt.setLineNumber && startNumber >= 0
  const needEmphasis = opt.setEmphasizeLines && emphasizeLines.length > 0
  const needEndSpan = opt.lineEndSpanThreshold > 0
  const useHighlightPre = opt.useHighlightPre && hasHighlightPre
  if (!useHighlightPre && commentLineValue) {
    const sourceLogicalLineCount = getLogicalLineCount(token.content)
    const highlightedLogicalLineCount = getLogicalLineCount(content)
    if (highlightedLogicalLineCount === sourceLogicalLineCount) {
      const rawLines = token.content.split(lineBreakReg)
      for (let i = 0; i < rawLines.length; i++) {
        if (rawLines[i].trimStart().startsWith(commentLineValue)) {
          if (!commentLines) commentLines = []
          commentLines[i] = true
          needComment = true
        }
      }
    }
  }
  if (!useHighlightPre && (needLineNumber || needEmphasis || needEndSpan || needComment)) {
    const nlIndex = content.indexOf('\n')
    const br = nlIndex > 0 && content[nlIndex - 1] === '\r' ? '\r\n' : '\n'
    content = splitFenceBlockToLines(content, emphasizeLines, needLineNumber, needEmphasis, needEndSpan, opt.lineEndSpanThreshold, opt.lineEndSpanClass, br, commentLines, commentLineClass)
  }

  const tag = isSamp ? 'samp' : 'code'
  return `<pre${preAttrsText}><${tag}${slf.renderAttrs(token)}>${content}</${tag}></pre>\n`
}

const mditRendererFence = (md, option) => {
  const opt = {
    attrsOrder: ['class', 'id', 'data-*', 'style'],
    setHighlight: true,
    setLineNumber: true,
    setEmphasizeLines: true,
    lineEndSpanThreshold: 0,
    lineEndSpanClass: 'pre-lineend-spacer',
    setPreWrapStyle: true,
    useHighlightPre: false,
    sampLang: 'shell,console',
    langPrefix: md.options.langPrefix || 'language-',
  }
  if (option) {
    Object.assign(opt, option)
    if (option.lineEndSpanThreshold == null && option.setLineEndSpan != null) {
      opt.lineEndSpanThreshold = option.setLineEndSpan
    }
  }

  opt._sampReg = new RegExp('^(?:samp|' + opt.sampLang.split(',').join('|') + ')$')
  opt._langReg = new RegExp(opt.langPrefix + '([A-Za-z0-9-]+)')
  opt._attrOrderIndex = createAttrOrderIndexGetter(opt.attrsOrder || [])

  md.renderer.rules['fence'] = (tokens, idx, options, env, slf)  => {
    return getFenceHtml(tokens, idx, md, opt, slf)
  }
}

export default mditRendererFence
