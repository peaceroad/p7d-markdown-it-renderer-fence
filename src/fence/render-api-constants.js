const fallbackOnDefault = ['api-unsupported', 'provider-error', 'range-invalid', 'apply-error']

const customHighlightDataEnvKey = 'rendererFenceCustomHighlights'
const customHighlightSeqEnvKey = '__rendererFenceCHSeq'
const customHighlightPreAttr = 'data-pre-highlight'
const customHighlightAppliedAttr = 'data-pre-highlight-applied'
const customHighlightPreSelector = `pre[${customHighlightPreAttr}]`
const customHighlightCodeSelector = `${customHighlightPreSelector} > code, ${customHighlightPreSelector} > samp`
const customHighlightAppliedSelector = `pre[${customHighlightAppliedAttr}]`
const customHighlightDataScriptId = 'pre-highlight-data'
const customHighlightStyleTagId = 'pre-highlight-style'
const customHighlightEnvInitRuleName = 'renderer_fence_custom_highlight_env_init'

const runtimeFallbackReasonSet = new Set(['api-unsupported', 'apply-error'])

const customHighlightPayloadSchemaVersion = 1
const customHighlightPayloadSupportedVersions = [customHighlightPayloadSchemaVersion]

export {
  customHighlightAppliedAttr,
  customHighlightAppliedSelector,
  customHighlightCodeSelector,
  customHighlightDataEnvKey,
  customHighlightDataScriptId,
  customHighlightEnvInitRuleName,
  customHighlightPayloadSchemaVersion,
  customHighlightPayloadSupportedVersions,
  customHighlightPreAttr,
  customHighlightPreSelector,
  customHighlightSeqEnvKey,
  customHighlightStyleTagId,
  fallbackOnDefault,
  runtimeFallbackReasonSet,
}
