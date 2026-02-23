import {
  getCustomHighlightPayloadMap,
} from '../custom-highlight/payload-utils.js'
import {
  applyLineEndAlias,
  finalizeCommonFenceOption,
  prepareFenceRenderContext,
} from './render-shared.js'
import {
  customHighlightDataEnvKey,
  customHighlightEnvInitRuleName,
  customHighlightPayloadSchemaVersion,
  customHighlightPayloadSupportedVersions,
  runtimeFallbackReasonSet,
  customHighlightSeqEnvKey,
} from './render-api-constants.js'
import {
  isNormalizedCustomHighlightOpt,
  normalizeCustomHighlightOpt,
  renderCustomHighlightPayloadScript,
  renderCustomHighlightScopeStyleTag,
  shouldApplyApiFallbackForReason,
} from './render-api-provider.js'
import {
  getFenceHtml,
} from './render-api-renderer.js'
import {
  applyCustomHighlights,
  clearCustomHighlights,
  observeCustomHighlights,
} from './render-api-runtime.js'

const shouldRuntimeFallback = (reason, opt = {}) => {
  const chOpt = isNormalizedCustomHighlightOpt(opt) ? opt : normalizeCustomHighlightOpt(opt)
  if (!runtimeFallbackReasonSet.has(reason)) return false
  return shouldApplyApiFallbackForReason(chOpt, reason)
}

const mditRendererFenceCustomHighlight = (md, option) => {
  const opt = {
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
    customHighlight: null,
  }
  if (option) {
    Object.assign(opt, option)
    applyLineEndAlias(opt, option)
  }

  const rawCustomHighlightOpt = (opt.customHighlight && typeof opt.customHighlight === 'object')
    ? opt.customHighlight
    : {}
  opt.customHighlight = normalizeCustomHighlightOpt(rawCustomHighlightOpt)
  if (opt.customHighlight.provider === 'custom') {
    opt.customHighlight._customGetRanges = (typeof opt.customHighlight.getRanges === 'function')
      ? opt.customHighlight.getRanges
      : null
  } else if (opt.customHighlight.provider === 'hljs') {
    opt.customHighlight._hljsHighlightFn =
      (typeof opt.customHighlight.hljsHighlight === 'function')
        ? opt.customHighlight.hljsHighlight
        : ((typeof opt.customHighlight.highlight === 'function')
          ? opt.customHighlight.highlight
          : ((md && md.options && typeof md.options.highlight === 'function') ? md.options.highlight : null))
  } else if (opt.customHighlight.provider === 'shiki') {
    opt.customHighlight._hasShikiHighlighter = !!(opt.customHighlight.highlighter && typeof opt.customHighlight.highlighter.codeToTokens === 'function')
    const tokenOptionBase = {}
    if (opt.customHighlight._singleTheme) tokenOptionBase.theme = opt.customHighlight._singleTheme
    if (opt.customHighlight.shikiScopeMode === 'semantic' || opt.customHighlight.shikiScopeMode === 'keyword') {
      tokenOptionBase.includeExplanation = 'scopeName'
    }
    opt.customHighlight._shikiTokenOptionBase = Object.keys(tokenOptionBase).length ? tokenOptionBase : null
  }

  finalizeCommonFenceOption(opt)

  md.core.ruler.before('block', customHighlightEnvInitRuleName, (state) => {
    const env = state && state.env
    if (!env || typeof env !== 'object') return
    if (opt.customHighlight.transport === 'env') {
      env[customHighlightDataEnvKey] = {}
      env[customHighlightSeqEnvKey] = 0
      return
    }
    delete env[customHighlightDataEnvKey]
    delete env[customHighlightSeqEnvKey]
  })

  md.renderer.rules.fence = (tokens, idx, options, env, slf) => {
    const context = prepareFenceRenderContext(tokens, idx, opt)
    return getFenceHtml(context, md, opt, slf, env)
  }
}

export {
  applyCustomHighlights,
  clearCustomHighlights,
  customHighlightPayloadSchemaVersion,
  customHighlightPayloadSupportedVersions,
  getCustomHighlightPayloadMap,
  observeCustomHighlights,
  renderCustomHighlightPayloadScript,
  renderCustomHighlightScopeStyleTag,
  shouldRuntimeFallback,
}

export default mditRendererFenceCustomHighlight
