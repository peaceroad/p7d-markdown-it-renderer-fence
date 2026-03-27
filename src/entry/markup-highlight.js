import {
  applyLineEndAlias,
  createCommonFenceOptionDefaults,
  finalizeCommonFenceOption,
  prepareFenceRenderContext,
} from '../fence/render-shared.js'
import {
  installLineNotesCoreRule,
} from '../fence/line-notes.js'
import {
  renderFenceMarkup,
} from '../fence/render-markup.js'

const mditRendererFenceMarkup = (md, option) => {
  const opt = createCommonFenceOptionDefaults(md)

  if (option) {
    Object.assign(opt, option)
    applyLineEndAlias(opt, option)
  }

  finalizeCommonFenceOption(opt)
  installLineNotesCoreRule(md)

  md.renderer.rules.fence = (tokens, idx, options, env, slf) => {
    const context = prepareFenceRenderContext(tokens, idx, opt)
    return renderFenceMarkup(context, md, opt, slf)
  }
}

export default mditRendererFenceMarkup
