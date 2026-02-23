import {
  escapeJsonForScript,
} from '../custom-highlight/payload-utils.js'
import {
  addTimingMs,
  commentLineClass,
  emitFenceDecision,
  finalizeFenceTimings,
  getNowMs,
  orderTokenAttrs,
  preWrapStyle,
  splitFenceBlockToLines,
} from './render-shared.js'
import {
  createApiPayloadForFence,
  shouldApplyApiFallbackForReason,
} from './render-api-provider.js'
import {
  customHighlightDataEnvKey,
  customHighlightPreAttr,
  customHighlightSeqEnvKey,
} from './render-api-constants.js'
import {
  renderFenceMarkup,
} from './render-markup.js'

let fallbackCustomHighlightSeq = 0

const nextCustomHighlightId = (env, prefix) => {
  if (env && typeof env === 'object') {
    const n = Number.isSafeInteger(env[customHighlightSeqEnvKey]) ? env[customHighlightSeqEnvKey] + 1 : 1
    env[customHighlightSeqEnvKey] = n
    return `${prefix}${n}`
  }
  fallbackCustomHighlightSeq += 1
  return `${prefix}${fallbackCustomHighlightSeq}`
}

const buildApiPreAttrs = (preWrapValue, wrapEnabled, opt) => {
  const preAttrs = []
  if (preWrapValue !== undefined) preAttrs.push(['data-pre-wrap', preWrapValue])
  if (wrapEnabled && opt.setPreWrapStyle !== false) preAttrs.push(['style', preWrapStyle])
  return preAttrs
}

const renderFenceApiOrPlain = (token, lang, md, opt, slf, env, startNumber, emphasizeLines, wrapEnabled, preWrapValue, commentMarkValue, includePayload, timings) => {
  const isSamp = opt._sampReg.test(lang)
  const tag = isSamp ? 'samp' : 'code'
  let content = md.utils.escapeHtml(token.content)
  const lineStrategy = opt.customHighlight.lineFeatureStrategy
  const needLineNumber = lineStrategy === 'hybrid' && opt.setLineNumber && startNumber >= 0
  const needEndSpan = lineStrategy === 'hybrid' && opt.lineEndSpanThreshold > 0
  if (needLineNumber || needEndSpan) {
    const splitStartedAt = timings ? getNowMs() : 0
    const nlIndex = content.indexOf('\n')
    const br = nlIndex > 0 && content[nlIndex - 1] === '\r' ? '\r\n' : '\n'
    content = splitFenceBlockToLines(content, [], needLineNumber, false, needEndSpan, opt.lineEndSpanThreshold, opt.lineEndSpanClass, br, undefined, commentLineClass)
    if (timings) addTimingMs(timings, 'lineSplitMs', getNowMs() - splitStartedAt)
  }

  orderTokenAttrs(token, opt)
  const preAttrs = buildApiPreAttrs(preWrapValue, wrapEnabled, opt)
  let inlinePayloadScript = ''

  if (includePayload) {
    const providerStartedAt = timings ? getNowMs() : 0
    const payload = createApiPayloadForFence(token, lang, opt, md, env, emphasizeLines, commentMarkValue)
    if (timings) addTimingMs(timings, 'providerMs', getNowMs() - providerStartedAt)
    const id = nextCustomHighlightId(env, opt.customHighlight.idPrefix)
    preAttrs.push([customHighlightPreAttr, id])

    if (opt.customHighlight.transport === 'env' && env && typeof env === 'object') {
      if (!env[customHighlightDataEnvKey] || typeof env[customHighlightDataEnvKey] !== 'object') env[customHighlightDataEnvKey] = {}
      env[customHighlightDataEnvKey][id] = payload
    } else {
      const payloadJson = escapeJsonForScript(payload)
      const scriptId = `pre-highlight-data-${id}`
      inlinePayloadScript = `<script type="application/json" id="${scriptId}" ${customHighlightPreAttr}="${id}">${payloadJson}</script>\n`
    }
  }

  if (preAttrs.length) orderTokenAttrs({ attrs: preAttrs }, opt)
  const preAttrsText = preAttrs.length ? slf.renderAttrs({ attrs: preAttrs }) : ''
  const html = `<pre${preAttrsText}><${tag}${slf.renderAttrs(token)}>${content}</${tag}></pre>\n`
  return inlinePayloadScript ? html + inlinePayloadScript : html
}

const getFenceHtml = (context, md, opt, slf, env) => {
  const token = context.token
  const lang = context.lang
  const timingEnabled = context.timingEnabled
  const timings = context.timings
  const fenceStartedAt = context.fenceStartedAt
  const startNumber = context.startNumber
  const emphasizeLines = context.emphasizeLines
  const wrapEnabled = context.wrapEnabled
  const preWrapValue = context.preWrapValue
  const commentMarkValue = context.commentMarkValue

  const apiDecisionBase = {
    renderer: 'api',
    includePayload: true,
    fallbackUsed: false,
    lineFeatureStrategy: opt.customHighlight.lineFeatureStrategy,
    disabledFeatures: opt.customHighlight.lineFeatureStrategy === 'disable'
      ? ['setLineNumber', 'lineEndSpanThreshold']
      : [],
  }
  try {
    const html = renderFenceApiOrPlain(token, lang, md, opt, slf, env, startNumber, emphasizeLines, wrapEnabled, preWrapValue, commentMarkValue, true, timings)
    if (timingEnabled) apiDecisionBase.timings = finalizeFenceTimings(timings, fenceStartedAt)
    emitFenceDecision(opt, apiDecisionBase)
    return html
  } catch (err) {
    if (opt.customHighlight.fallback === 'plain' && shouldApplyApiFallbackForReason(opt.customHighlight, 'provider-error')) {
      const fallbackDecision = {
        renderer: 'api',
        includePayload: false,
        fallbackUsed: true,
        fallback: 'plain',
        reason: 'provider-error',
        lineFeatureStrategy: opt.customHighlight.lineFeatureStrategy,
      }
      const html = renderFenceApiOrPlain(token, lang, md, opt, slf, env, startNumber, emphasizeLines, wrapEnabled, preWrapValue, commentMarkValue, false, timings)
      if (timingEnabled) fallbackDecision.timings = finalizeFenceTimings(timings, fenceStartedAt)
      emitFenceDecision(opt, fallbackDecision)
      return html
    }
  }

  return renderFenceMarkup(context, md, opt, slf)
}

export {
  getFenceHtml,
}
