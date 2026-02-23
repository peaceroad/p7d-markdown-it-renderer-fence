import {
  appendStyleValue,
  mergeAttrSets,
  parseHtmlAttrs,
} from '../utils/attr-utils.js'
import {
  addTimingMs,
  commentLineClass,
  emitFenceDecision,
  finalizeFenceTimings,
  getLogicalLineCount,
  getNowMs,
  lineBreakReg,
  orderTokenAttrs,
  preCodeWrapperReg,
  preWrapStyle,
  splitFenceBlockToLines,
} from './render-shared.js'

const renderFenceMarkup = (context, md, opt, slf) => {
  const token = context.token
  const lang = context.lang
  const timingEnabled = context.timingEnabled
  const timings = context.timings
  const fenceStartedAt = context.fenceStartedAt
  const startNumber = context.startNumber
  const emphasizeLines = context.emphasizeLines
  const wrapEnabled = context.wrapEnabled
  const preWrapValue = context.preWrapValue
  const commentLineValue = context.commentLineValue

  const isSamp = opt._sampReg.test(lang)
  let content = token.content
  let commentLines
  let needComment = false

  if (opt.setHighlight && md.options.highlight) {
    const highlightStartedAt = timingEnabled ? getNowMs() : 0
    if (lang && lang !== 'samp') {
      content = md.options.highlight(content, lang)
    } else {
      content = md.utils.escapeHtml(token.content)
    }
    if (timingEnabled) addTimingMs(timings, 'highlightMs', getNowMs() - highlightStartedAt)
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
    const decision = {
      renderer: 'markup',
      useHighlightPre: true,
      passthrough: true,
      hasHighlightPre: false,
      disabledFeatures: ['setLineNumber', 'setEmphasizeLines', 'lineEndSpanThreshold', 'comment-line', 'samp'],
    }
    if (timingEnabled) decision.timings = finalizeFenceTimings(timings, fenceStartedAt)
    emitFenceDecision(opt, decision)
    return content.endsWith('\n') ? content : content + '\n'
  }

  orderTokenAttrs(token, opt)

  const preAttrs = preAttrsFromHighlight ? preAttrsFromHighlight.slice() : []
  if (preWrapValue !== undefined) {
    const idx = preAttrs.findIndex((attr) => attr[0] === 'data-pre-wrap')
    if (idx === -1) {
      preAttrs.push(['data-pre-wrap', preWrapValue])
    } else {
      preAttrs[idx][1] = preWrapValue
    }
  }
  if (wrapEnabled && opt.setPreWrapStyle !== false) {
    const idx = preAttrs.findIndex((attr) => attr[0] === 'style')
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
      const rawLines = token.content.indexOf('\r') === -1 ? token.content.split('\n') : token.content.split(lineBreakReg)
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
    const splitStartedAt = timingEnabled ? getNowMs() : 0
    const nlIndex = content.indexOf('\n')
    const br = nlIndex > 0 && content[nlIndex - 1] === '\r' ? '\r\n' : '\n'
    content = splitFenceBlockToLines(
      content,
      emphasizeLines,
      needLineNumber,
      needEmphasis,
      needEndSpan,
      opt.lineEndSpanThreshold,
      opt.lineEndSpanClass,
      br,
      commentLines,
      commentLineClass,
    )
    if (timingEnabled) addTimingMs(timings, 'lineSplitMs', getNowMs() - splitStartedAt)
  }

  const tag = isSamp ? 'samp' : 'code'
  const decision = {
    renderer: 'markup',
    useHighlightPre,
    hasHighlightPre,
    disabledFeatures: useHighlightPre ? ['setLineNumber', 'setEmphasizeLines', 'lineEndSpanThreshold', 'comment-line', 'samp'] : [],
  }
  if (timingEnabled) decision.timings = finalizeFenceTimings(timings, fenceStartedAt)
  emitFenceDecision(opt, decision)
  return `<pre${preAttrsText}><${tag}${slf.renderAttrs(token)}>${content}</${tag}></pre>\n`
}

export {
  renderFenceMarkup,
}
