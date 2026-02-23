import {
  appendStyleValue,
  createAttrOrderIndexGetter,
  getInfoAttr,
  getLangFromClassAttr,
} from '../utils/attr-utils.js'

const infoReg = /^([^{\s]*)(?:\s*\{(.*)\})?$/
const tagReg = /<\/?([A-Za-z][A-Za-z0-9-]*)(?:\s+[^>]*?)?\/?\s*>/g
const preLineTag = '<span class="pre-line">'
const emphOpenTag = '<span class="pre-lines-emphasis">'
const commentLineClass = 'pre-comment-line'
const closeTag = '</span>'
const closeTagLen = closeTag.length
const preWrapStyle = 'white-space: pre-wrap; overflow-wrap: anywhere;'
const preCodeWrapperReg = /^\s*<pre\b((?:[^>"']|"[^"]*"|'[^']*')*)>\s*<code\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/code>\s*<\/pre>\s*$/i
const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
const nonNegativeIntReg = /^\d+$/
const lineBreakReg = /\r\n|\n|\r/

const getNowMs = () => {
  if (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') return performance.now()
  return Date.now()
}

const roundTimingMs = (value) => {
  return Math.round(value * 1000) / 1000
}

const addTimingMs = (timings, key, value) => {
  if (!timings || !key || !Number.isFinite(value) || value <= 0) return
  timings[key] = (timings[key] || 0) + value
}

const finalizeFenceTimings = (timings, startedAtMs) => {
  if (!timings || !Number.isFinite(startedAtMs)) return null
  const totalMs = getNowMs() - startedAtMs
  const out = {}
  if (timings.attrNormalizeMs) out.attrNormalizeMs = roundTimingMs(timings.attrNormalizeMs)
  if (timings.highlightMs) out.highlightMs = roundTimingMs(timings.highlightMs)
  if (timings.providerMs) out.providerMs = roundTimingMs(timings.providerMs)
  if (timings.lineSplitMs) out.lineSplitMs = roundTimingMs(timings.lineSplitMs)
  out.totalMs = roundTimingMs(totalMs > 0 ? totalMs : 0)
  return out
}

const applyLineEndAlias = (opt, sourceOption) => {
  if (sourceOption && sourceOption.lineEndSpanThreshold == null && sourceOption.setLineEndSpan != null) {
    opt.lineEndSpanThreshold = sourceOption.setLineEndSpan
  }
}

const finalizeCommonFenceOption = (opt) => {
  opt._sampReg = new RegExp('^(?:samp|' + opt.sampLang.split(',').join('|') + ')$')
  opt._attrOrderIndex = createAttrOrderIndexGetter(opt.attrsOrder || [])
  return opt
}

const emitFenceDecision = (opt, data) => {
  if (!opt || typeof opt.onFenceDecision !== 'function') return
  try {
    opt.onFenceDecision(data)
  } catch (e) {}
}

const parseStartNumber = (val) => {
  const str = String(val ?? '')
  if (!nonNegativeIntReg.test(str)) return null
  const num = Number(str)
  if (!Number.isSafeInteger(num) || num < 0) return null
  return num
}

const getLogicalLineCount = (text) => {
  const str = String(text ?? '')
  if (!str) return 0
  let count = 1
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    if (ch !== 10 && ch !== 13) continue
    if (ch === 13 && i + 1 < str.length && str.charCodeAt(i + 1) === 10) i++
    count++
  }
  const last = str.charCodeAt(str.length - 1)
  if (last === 10 || last === 13) count--
  return count
}

const getEmphasizeLines = (attrVal) => {
  const str = String(attrVal ?? '')
  if (!str) return []
  const result = []
  for (const partRaw of str.split(',')) {
    const part = partRaw.trim()
    if (!part) continue
    const hyphen = part.indexOf('-')
    if (hyphen === -1) {
      const n = Number(part)
      if (Number.isFinite(n) && n > 0) result.push([n, n])
      continue
    }
    const start = part.slice(0, hyphen).trim()
    const end = part.slice(hyphen + 1).trim()
    const s = Number(start)
    const e = Number(end)
    if (!Number.isFinite(s) || !Number.isFinite(e)) continue
    if (s > 0 && e > 0) result.push([s, e])
  }
  return result
}

const normalizeEmphasisRanges = (emphasizeLines, maxLine) => {
  const normalized = []
  if (!emphasizeLines || !emphasizeLines.length || maxLine <= 0) return normalized
  for (const range of emphasizeLines) {
    let s = range[0]
    let e = range[1]
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
  return normalized
}

const splitFenceBlockToLines = (content, emphasizeLines, needLineNumber, needEmphasis, needEndSpan, threshold, lineEndSpanClass, br, commentLines, commentClass) => {
  const lines = content.split(br)
  const max = lines.length
  let emIdx = 0
  let emStart = -1
  let emEnd = -1
  if (needEmphasis && emphasizeLines && emphasizeLines.length) {
    emStart = emphasizeLines[0][0]
    emEnd = emphasizeLines[0][1]
  } else {
    needEmphasis = false
  }

  const endSpanTag = needEndSpan ? `<span class="${lineEndSpanClass}"></span>` : ''

  for (let n = 0; n < max; n++) {
    let line = lines[n]
    const notLastLine = n < max - 1
    const doEmphasis = needEmphasis && emIdx < emphasizeLines.length && n + 1 >= emStart && n + 1 <= emEnd
    const doComment = commentLines && commentLines[n]

    if (needEndSpan && threshold > 0) {
      let lineLen = 0
      if (line.indexOf('<') === -1) {
        lineLen = line.length
      } else {
        const plain = line.replace(/<[^>]*>/g, '')
        if (/[^\x00-\xff]/.test(plain)) {
          for (let i = 0, L = plain.length; i < L; i++) {
            lineLen += plain.charCodeAt(i) > 255 ? 2 : 1
            if (lineLen >= threshold) break
          }
        } else {
          lineLen = plain.length
        }
      }
      if (lineLen >= threshold) {
        if (line.endsWith(closeTag)) {
          line = line.slice(0, -closeTagLen) + endSpanTag + closeTag
        } else {
          line = line + endSpanTag
        }
      }
    }

    if (needLineNumber && notLastLine) {
      if (line.indexOf('<') !== -1 && line.indexOf('>') !== -1) {
        const tagStack = []
        tagReg.lastIndex = 0
        let match
        while ((match = tagReg.exec(line)) !== null) {
          const fullMatch = match[0]
          const tagNameLower = match[1].toLowerCase()
          if (fullMatch.startsWith('</')) {
            if (tagStack[tagStack.length - 1] === tagNameLower) tagStack.pop()
          } else if (!fullMatch.endsWith('/>') && !voidTags.has(tagNameLower)) {
            tagStack.push(tagNameLower)
          }
        }
        for (let i = tagStack.length - 1; i >= 0; i--) {
          const tagName = tagStack[i]
          line += `</${tagName}>`
          lines[n + 1] = `<${tagName}>` + lines[n + 1]
        }
      }
    }

    if (doComment) {
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

const prepareFenceRenderContext = (tokens, idx, opt) => {
  const token = tokens[idx]
  const match = token.info.trim().match(infoReg)
  let lang = match ? match[1] : ''
  const timingEnabled = !!(opt.onFenceDecisionTiming && typeof opt.onFenceDecision === 'function')
  const fenceStartedAt = timingEnabled ? getNowMs() : 0
  const timings = timingEnabled ? {} : null

  if (match && match[2]) {
    getInfoAttr(match[2]).forEach(([name, val]) => token.attrJoin(name, val))
  }
  if (lang && lang !== 'samp') {
    const langClass = opt.langPrefix + lang
    const existingClass = token.attrGet('class')
    token.attrSet('class', existingClass ? langClass + ' ' + existingClass : langClass)
  }

  let startNumber = -1
  let emphasizeLines = []
  let wrapEnabled = false
  let preWrapValue
  let commentLineValue
  const attrNormalizeStartedAt = timingEnabled ? getNowMs() : 0

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
          const classLang = getLangFromClassAttr(val, opt.langPrefix)
          if (classLang) lang = classLang
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
          if (val === '' || val === 'true') wrapEnabled = true
          break
        default:
          newAttrs.push(attr)
      }
    }

    if (startValue !== undefined && dataPreStartIndex >= 0) newAttrs[dataPreStartIndex][1] = startValue
    if (emphasisValue !== undefined && dataPreEmphasisIndex >= 0) newAttrs[dataPreEmphasisIndex][1] = emphasisValue
    if (commentLineValue !== undefined && dataPreCommentIndex >= 0) newAttrs[dataPreCommentIndex][1] = commentLineValue

    for (const kind of appendOrder) {
      if (kind === 'start' && dataPreStartIndex === -1 && startValue !== undefined) {
        newAttrs.push(['data-pre-start', startValue])
      } else if (kind === 'emphasis' && dataPreEmphasisIndex === -1 && emphasisValue !== undefined) {
        newAttrs.push(['data-pre-emphasis', emphasisValue])
      } else if (kind === 'comment' && dataPreCommentIndex === -1 && commentLineValue !== undefined) {
        newAttrs.push(['data-pre-comment-line', commentLineValue])
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

  if (timingEnabled) addTimingMs(timings, 'attrNormalizeMs', getNowMs() - attrNormalizeStartedAt)

  return {
    token,
    lang,
    startNumber,
    emphasizeLines,
    wrapEnabled,
    preWrapValue,
    commentLineValue,
    timingEnabled,
    timings,
    fenceStartedAt,
  }
}

export {
  addTimingMs,
  applyLineEndAlias,
  commentLineClass,
  emitFenceDecision,
  finalizeCommonFenceOption,
  finalizeFenceTimings,
  getLogicalLineCount,
  getNowMs,
  getEmphasizeLines,
  lineBreakReg,
  normalizeEmphasisRanges,
  orderTokenAttrs,
  preCodeWrapperReg,
  preWrapStyle,
  prepareFenceRenderContext,
  splitFenceBlockToLines,
}
