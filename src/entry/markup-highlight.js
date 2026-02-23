import {
  applyLineEndAlias,
  finalizeCommonFenceOption,
  prepareFenceRenderContext,
} from '../fence/render-shared.js'
import {
  renderFenceMarkup,
} from '../fence/render-markup.js'

const mditRendererFenceMarkup = (md, option) => {
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
  }

  if (option) {
    Object.assign(opt, option)
    applyLineEndAlias(opt, option)
  }

  delete opt.customHighlight
  finalizeCommonFenceOption(opt)

  md.renderer.rules.fence = (tokens, idx, options, env, slf) => {
    const context = prepareFenceRenderContext(tokens, idx, opt)
    return renderFenceMarkup(context, md, opt, slf)
  }
}

export default mditRendererFenceMarkup
