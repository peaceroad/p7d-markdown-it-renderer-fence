import mditRendererFenceMarkup from './src/entry/markup-highlight.js'
import mditRendererFenceCustomHighlight, {
  applyCustomHighlights,
  clearCustomHighlights,
  customHighlightPayloadSchemaVersion,
  customHighlightPayloadSupportedVersions,
  getCustomHighlightPayloadMap,
  observeCustomHighlights,
  renderCustomHighlightPayloadScript,
  renderCustomHighlightScopeStyleTag,
  shouldRuntimeFallback,
} from './src/entry/custom-highlight.js'

const mditRendererFence = (md, option) => {
  if (option && option.highlightRenderer === 'api') return mditRendererFenceCustomHighlight(md, option)
  return mditRendererFenceMarkup(md, option)
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

export default mditRendererFence
