import {
  appendStyleValue,
  createAttrOrderIndexGetter,
  getInfoAttr,
  getLangFromClassAttr,
} from '../utils/attr-utils.js'

const infoReg = /^([^{\s]*)(?:\s*\{(.*)\})?$/
const tagReg = /<\/?([A-Za-z][A-Za-z0-9-]*)(?:\s+[^>]*?)?\/?\s*>/g
const preLineTag = '<span class="pre-line">'
const preLineNoNumberClass = 'pre-line-no-number'
const emphOpenTag = '<span class="pre-lines-emphasis">'
const commentLineClass = 'pre-line-comment'
const closeTag = '</span>'
const closeTagLen = closeTag.length
const preWrapStyle = 'white-space: pre-wrap; overflow-wrap: anywhere;'
const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
const nonNegativeIntReg = /^\d+$/
const positiveIntReg = /^[1-9]\d*$/

const getLineVisualLengthIgnoringTags = (line, threshold) => {
  let len = 0
  let inTag = false
  for (let i = 0; i < line.length; i++) {
    const code = line.charCodeAt(i)
    if (inTag) {
      if (code === 62) inTag = false // >
      continue
    }
    if (code === 60) { // <
      inTag = true
      continue
    }
    len += code > 255 ? 2 : 1
    if (len >= threshold) return len
  }
  return len
}

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

const createCommonFenceOptionDefaults = (md) => {
  return {
    attrsOrder: ['class', 'id', 'data-*', 'style'],
    setHighlight: true,
    setLineNumber: true,
    setEmphasizeLines: true,
    lineEndSpanThreshold: 0,
    lineEndSpanClass: 'pre-lineend-spacer',
    setPreWrapStyle: true,
    useHighlightPre: false,
    onFenceDecision: null,
    onFenceDecisionTiming: false,
    sampLang: 'shell,console',
    langPrefix: md.options.langPrefix || 'language-',
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

const parsePositiveLineIndex = (val) => {
  const str = String(val ?? '').trim()
  if (!positiveIntReg.test(str)) return null
  const num = Number(str)
  if (!Number.isSafeInteger(num) || num <= 0) return null
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

const parseLineRangeList = (attrVal, parseValue) => {
  const str = String(attrVal ?? '')
  if (!str) return []
  const result = []
  for (const partRaw of str.split(',')) {
    const part = partRaw.trim()
    if (!part) continue
    const hyphen = part.indexOf('-')
    if (hyphen === -1) {
      const n = parseValue(part)
      if (n != null) result.push([n, n])
      continue
    }
    const start = part.slice(0, hyphen).trim()
    const end = part.slice(hyphen + 1).trim()
    const s = start ? parseValue(start) : null
    const e = end ? parseValue(end) : null
    if (s == null && e == null) continue
    if (start && s == null) continue
    if (end && e == null) continue
    result.push([s, e])
  }
  return result
}

const parsePositiveLineNumber = (val) => {
  const num = Number(val)
  if (!Number.isFinite(num) || num <= 0) return null
  return num
}

const getEmphasizeLines = (attrVal) => {
  return parseLineRangeList(attrVal, parsePositiveLineNumber)
}

const getLineNumberSkipRanges = (attrVal) => {
  return parseLineRangeList(attrVal, parsePositiveLineIndex)
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

const getLineNumberResetEntries = (attrVal) => {
  const str = String(attrVal ?? '')
  if (!str) return []
  const result = []
  for (const partRaw of str.split(',')) {
    const part = partRaw.trim()
    if (!part) continue
    const colon = part.indexOf(':')
    if (colon === -1) continue
    const lineNumber = parsePositiveLineIndex(part.slice(0, colon).trim())
    const resetNumber = parseStartNumber(part.slice(colon + 1).trim())
    if (lineNumber == null || resetNumber == null) continue
    result.push([lineNumber, resetNumber])
  }
  return result
}

const createSparseLineFlagMap = (ranges, maxLine) => {
  const normalized = normalizeEmphasisRanges(ranges, maxLine)
  if (!normalized.length) return null
  const flags = []
  for (let i = 0; i < normalized.length; i++) {
    const range = normalized[i]
    for (let line = range[0]; line <= range[1]; line++) flags[line - 1] = true
  }
  return flags
}

const createSparseLineResetMap = (entries, maxLine) => {
  if (!entries || !entries.length || maxLine <= 0) return null
  const resets = []
  let hasValue = false
  for (let i = 0; i < entries.length; i++) {
    const line = entries[i][0]
    const value = entries[i][1]
    if (!Number.isSafeInteger(line) || line <= 0 || line > maxLine) continue
    resets[line - 1] = value
    hasValue = true
  }
  return hasValue ? resets : null
}

const buildAdvancedLineNumberPlan = (skipRanges, resetEntries, sourceLineCount, renderedLineCount) => {
  const hasSkip = !!(skipRanges && skipRanges.length)
  const hasReset = !!(resetEntries && resetEntries.length)
  if (!hasSkip && !hasReset) return null
  if (!Number.isSafeInteger(sourceLineCount) || sourceLineCount <= 0) return null
  if (sourceLineCount !== renderedLineCount) return null
  const hidden = hasSkip ? createSparseLineFlagMap(skipRanges, sourceLineCount) : null
  const resets = hasReset ? createSparseLineResetMap(resetEntries, sourceLineCount) : null
  if (!hidden && !resets) return null
  return { hidden, resets }
}

const resolveAdvancedLineNumberPlan = (lineNumberSkipValue, lineNumberResetValue, sourceLineCount, renderedLineCount) => {
  const hasSkipValue = lineNumberSkipValue !== undefined
  const hasResetValue = lineNumberResetValue !== undefined
  if (!hasSkipValue && !hasResetValue) return null
  if (!Number.isSafeInteger(sourceLineCount) || sourceLineCount <= 0) return null
  if (sourceLineCount !== renderedLineCount) return null
  const skipRanges = hasSkipValue ? getLineNumberSkipRanges(lineNumberSkipValue) : null
  const resetEntries = hasResetValue ? getLineNumberResetEntries(lineNumberResetValue) : null
  return buildAdvancedLineNumberPlan(skipRanges, resetEntries, sourceLineCount, renderedLineCount)
}

const getPreLineOpenTag = (lineNumberPlan, lineIndex) => {
  if (!lineNumberPlan) return preLineTag
  const hidden = !!(lineNumberPlan.hidden && lineNumberPlan.hidden[lineIndex])
  const resetNumber = lineNumberPlan.resets ? lineNumberPlan.resets[lineIndex] : undefined
  if (!hidden && resetNumber == null) return preLineTag
  let tag = '<span class="pre-line'
  if (hidden) tag += ' ' + preLineNoNumberClass
  tag += '"'
  if (resetNumber != null) tag += ` style="counter-set:pre-line-number ${resetNumber};"`
  return tag + '>'
}

const splitFenceBlockToLines = (content, emphasizeLines, needLineNumber, needEmphasis, needEndSpan, threshold, lineEndSpanClass, br, commentLines, commentClass, lineNumberPlan) => {
  const lines = content.split(br)
  const max = lines.length
  const hasDynamicLineNumberPlan = !!lineNumberPlan
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
    const doComment = commentLines && commentLines[n]
    let hasLt = false
    let hasLtChecked = false

    if (needEndSpan && threshold > 0) {
      if (!hasLtChecked) {
        hasLt = line.indexOf('<') !== -1
        hasLtChecked = true
      }
      let lineLen = 0
      if (!hasLt) {
        lineLen = line.length
      } else {
        lineLen = getLineVisualLengthIgnoringTags(line, threshold)
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
      if (!hasLtChecked) {
        hasLt = line.indexOf('<') !== -1
        hasLtChecked = true
      }
      if (hasLt && line.indexOf('>') !== -1) {
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
      line = (hasDynamicLineNumberPlan ? getPreLineOpenTag(lineNumberPlan, n) : preLineTag) + line + closeTag
    }

    if (needEmphasis && emIdx < emphasizeLines.length && emStart === n + 1) {
      line = emphOpenTag + line
    }
    if (needEmphasis && emIdx < emphasizeLines.length && emEnd === n) {
      line = closeTag + line
      emIdx++
      const nextEmphasis = emphasizeLines[emIdx] || []
      emStart = nextEmphasis[0]
      emEnd = nextEmphasis[1]
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
    const infoAttrs = getInfoAttr(match[2])
    for (let i = 0; i < infoAttrs.length; i++) {
      const attr = infoAttrs[i]
      token.attrJoin(attr[0], attr[1])
    }
  }
  if (lang && lang !== 'samp') {
    const langClass = opt.langPrefix + lang
    const existingClass = token.attrGet('class')
    token.attrSet('class', existingClass ? langClass + ' ' + existingClass : langClass)
  }

  let startNumber = -1
  let emphasizeLines = []
  let lineNumberSkipValue
  let lineNumberResetValue
  let wrapEnabled = false
  let preWrapValue
  let commentMarkValue
  const attrNormalizeStartedAt = timingEnabled ? getNowMs() : 0

  if (token.attrs) {
    const newAttrs = []
    let dataPreStartIndex = -1
    let dataPreEmphasisIndex = -1
    let styleIndex = -1
    let dataPreCommentIndex = -1
    let dataPreLineNumberSkipIndex = -1
    let dataPreLineNumberResetIndex = -1
    let startValue
    let emphasisValue
    let styleValue
    let sawCommentMark = false
    let sawStartAttr = false
    let sawEmphasisAttr = false
    let sawLineNumberSkipAttr = false
    let sawLineNumberResetAttr = false
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
        case 'line-number-start':
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
        case 'data-pre-comment-mark':
          dataPreCommentIndex = newAttrs.length
          commentMarkValue = val
          newAttrs.push(attr)
          break
        case 'data-pre-line-number-skip':
          dataPreLineNumberSkipIndex = newAttrs.length
          lineNumberSkipValue = val
          newAttrs.push(attr)
          break
        case 'data-pre-line-number-reset':
          dataPreLineNumberResetIndex = newAttrs.length
          lineNumberResetValue = val
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
        case 'comment-mark':
          commentMarkValue = val
          if (!sawCommentMark) {
            appendOrder.push('comment')
            sawCommentMark = true
          }
          break
        case 'line-number-skip':
        case 'pre-line-number-skip':
          lineNumberSkipValue = val
          if (!sawLineNumberSkipAttr) {
            appendOrder.push('line-number-skip')
            sawLineNumberSkipAttr = true
          }
          break
        case 'line-number-reset':
        case 'pre-line-number-reset':
          lineNumberResetValue = val
          if (!sawLineNumberResetAttr) {
            appendOrder.push('line-number-reset')
            sawLineNumberResetAttr = true
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
    if (commentMarkValue !== undefined && dataPreCommentIndex >= 0) newAttrs[dataPreCommentIndex][1] = commentMarkValue
    if (lineNumberSkipValue !== undefined && dataPreLineNumberSkipIndex >= 0) newAttrs[dataPreLineNumberSkipIndex][1] = lineNumberSkipValue
    if (lineNumberResetValue !== undefined && dataPreLineNumberResetIndex >= 0) newAttrs[dataPreLineNumberResetIndex][1] = lineNumberResetValue

    for (const kind of appendOrder) {
      if (kind === 'start' && dataPreStartIndex === -1 && startValue !== undefined) {
        newAttrs.push(['data-pre-start', startValue])
      } else if (kind === 'emphasis' && dataPreEmphasisIndex === -1 && emphasisValue !== undefined) {
        newAttrs.push(['data-pre-emphasis', emphasisValue])
      } else if (kind === 'comment' && dataPreCommentIndex === -1 && commentMarkValue !== undefined) {
        newAttrs.push(['data-pre-comment-mark', commentMarkValue])
      } else if (kind === 'line-number-skip' && dataPreLineNumberSkipIndex === -1 && lineNumberSkipValue !== undefined) {
        newAttrs.push(['data-pre-line-number-skip', lineNumberSkipValue])
      } else if (kind === 'line-number-reset' && dataPreLineNumberResetIndex === -1 && lineNumberResetValue !== undefined) {
        newAttrs.push(['data-pre-line-number-reset', lineNumberResetValue])
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
    lineNumberSkipValue,
    lineNumberResetValue,
    wrapEnabled,
    preWrapValue,
    commentMarkValue,
    timingEnabled,
    timings,
    fenceStartedAt,
  }
}

export {
  addTimingMs,
  applyLineEndAlias,
  commentLineClass,
  createCommonFenceOptionDefaults,
  emitFenceDecision,
  finalizeCommonFenceOption,
  finalizeFenceTimings,
  getLogicalLineCount,
  getNowMs,
  getEmphasizeLines,
  normalizeEmphasisRanges,
  orderTokenAttrs,
  preWrapStyle,
  prepareFenceRenderContext,
  resolveAdvancedLineNumberPlan,
  splitFenceBlockToLines,
}
