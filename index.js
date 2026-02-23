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

const normalizeHighlightRenderer = (value) => {
  const key = String(value || '').trim().toLowerCase()
  if (key === 'api' || key === 'custom-highlight-api') return 'api'
  return 'markup'
}

const mditRendererFence = (md, option) => {
  if (normalizeHighlightRenderer(option && option.highlightRenderer) === 'api') {
    return mditRendererFenceCustomHighlight(md, option)
  }
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
