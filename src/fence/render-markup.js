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
  normalizeEmphasisRanges,
  orderTokenAttrs,
  preWrapStyle,
  resolveAdvancedLineNumberPlan,
  resolveLineNotesPlan,
  splitFenceBlockToLines,
  wrapFencePreWithLineNotes,
} from './render-shared.js'
import {
  parsePreCodeWrapper,
} from '../utils/pre-code-wrapper-parser.js'

const markupPassthroughDisabledFeatures = Object.freeze(['setLineNumber', 'line-number-skip', 'line-number-set', 'setEmphasizeLines', 'lineEndSpanThreshold', 'comment-mark', 'line-notes', 'samp'])

const renderFenceMarkup = (context, md, opt, slf) => {
  const token = context.token
  const lang = context.lang
  const timingEnabled = context.timingEnabled
  const timings = context.timings
  const fenceStartedAt = context.fenceStartedAt
  const startNumber = context.startNumber
  const emphasizeLines = context.emphasizeLines
  const lineNumberSkipValue = context.lineNumberSkipValue
  const lineNumberSetValue = context.lineNumberSetValue
  const wrapEnabled = context.wrapEnabled
  const preWrapValue = context.preWrapValue
  const commentMarkValue = context.commentMarkValue
  const lineNotes = context.lineNotes
  const lineNoteIdPrefix = context.lineNoteIdPrefix

  const isSamp = opt._sampReg.test(lang)
  const sourceContent = token.content
  let content = sourceContent
  let commentLines
  let needComment = false

  if (opt.setHighlight && md.options.highlight) {
    const highlightStartedAt = timingEnabled ? getNowMs() : 0
    if (lang && lang !== 'samp') {
      content = md.options.highlight(content, lang)
    } else {
      content = md.utils.escapeHtml(sourceContent)
    }
    if (timingEnabled) addTimingMs(timings, 'highlightMs', getNowMs() - highlightStartedAt)
  } else {
    content = md.utils.escapeHtml(sourceContent)
  }

  let preAttrsFromHighlight
  let hasHighlightPre = false
  const hasPreTag = (content.indexOf('<pre') !== -1 || content.indexOf('<PRE') !== -1)
  if (hasPreTag) {
    const preMatch = parsePreCodeWrapper(content)
    if (preMatch) {
      hasHighlightPre = true
      preAttrsFromHighlight = parseHtmlAttrs(preMatch.preAttrsText)
      const codeAttrsFromHighlight = parseHtmlAttrs(preMatch.codeAttrsText)
      content = preMatch.content
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
      passthroughReason: 'pre-code-parse-failed',
      hasHighlightPre: false,
      disabledFeatures: markupPassthroughDisabledFeatures,
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

  const useHighlightPre = opt.useHighlightPre && hasHighlightPre
  const needLineNumber = !useHighlightPre && opt.setLineNumber && startNumber >= 0
  let sourceLogicalLineCount = -1
  let highlightedLogicalLineCount = -1
  const ensureLogicalLineCounts = () => {
    if (sourceLogicalLineCount === -1) sourceLogicalLineCount = getLogicalLineCount(sourceContent)
    if (highlightedLogicalLineCount === -1) highlightedLogicalLineCount = getLogicalLineCount(content)
  }
  let normalizedEmphasis = []
  if (!useHighlightPre && opt.setEmphasizeLines && emphasizeLines.length > 0) {
    ensureLogicalLineCounts()
    normalizedEmphasis = normalizeEmphasisRanges(emphasizeLines, highlightedLogicalLineCount)
  }
  let lineNumberPlan = null
  if (needLineNumber && (lineNumberSkipValue !== undefined || lineNumberSetValue !== undefined)) {
    ensureLogicalLineCounts()
    lineNumberPlan = resolveAdvancedLineNumberPlan(lineNumberSkipValue, lineNumberSetValue, sourceLogicalLineCount, highlightedLogicalLineCount)
  }
  let lineNotePlan = null
  if (!useHighlightPre && lineNotes && lineNotes.length) {
    ensureLogicalLineCounts()
    lineNotePlan = resolveLineNotesPlan(lineNotes, sourceLogicalLineCount, highlightedLogicalLineCount, lineNoteIdPrefix)
  }
  const needEmphasis = normalizedEmphasis.length > 0
  const needEndSpan = opt.lineEndSpanThreshold > 0

  if (!useHighlightPre && commentMarkValue && sourceContent.indexOf(commentMarkValue) !== -1) {
    ensureLogicalLineCounts()
    if (highlightedLogicalLineCount === sourceLogicalLineCount) {
      const rawLines = sourceContent.split('\n')
      for (let i = 0; i < rawLines.length; i++) {
        if (rawLines[i].trimStart().startsWith(commentMarkValue)) {
          if (!commentLines) commentLines = []
          commentLines[i] = true
          needComment = true
        }
      }
    }
  }

  if (!useHighlightPre && (needLineNumber || needEmphasis || needEndSpan || needComment || lineNotePlan)) {
    const splitStartedAt = timingEnabled ? getNowMs() : 0
    const nlIndex = content.indexOf('\n')
    const br = nlIndex > 0 && content[nlIndex - 1] === '\r' ? '\r\n' : '\n'
    content = splitFenceBlockToLines(
      content,
      normalizedEmphasis,
      needLineNumber,
      needEmphasis,
      needEndSpan,
      opt.lineEndSpanThreshold,
      opt.lineEndSpanClass,
      br,
      commentLines,
      commentLineClass,
      lineNumberPlan,
      lineNotePlan,
    )
    if (timingEnabled) addTimingMs(timings, 'lineSplitMs', getNowMs() - splitStartedAt)
  }

  const tag = isSamp ? 'samp' : 'code'
  const decision = {
    renderer: 'markup',
    useHighlightPre,
    hasHighlightPre,
    disabledFeatures: useHighlightPre ? markupPassthroughDisabledFeatures : [],
  }
  if (timingEnabled) decision.timings = finalizeFenceTimings(timings, fenceStartedAt)
  emitFenceDecision(opt, decision)
  const preHtml = `<pre${preAttrsText}><${tag}${slf.renderAttrs(token)}>${content}</${tag}></pre>`
  return wrapFencePreWithLineNotes(preHtml, lineNotePlan)
}

export {
  renderFenceMarkup,
}
