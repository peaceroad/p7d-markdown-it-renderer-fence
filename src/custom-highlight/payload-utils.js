const escapeJsonForScript = (data) => {
  return JSON.stringify(data)
    .replace(/</g, '\\u003C')
    .replace(/>/g, '\\u003E')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

const escapeHtmlAttr = (value) => {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const getCustomHighlightPayloadMap = (env, envKey = 'rendererFenceCustomHighlights') => {
  if (!env || typeof env !== 'object') return {}
  const map = env[envKey]
  if (!map || typeof map !== 'object') return {}
  return map
}

const renderCustomHighlightPayloadScript = (
  env,
  scriptId = 'pre-highlight-data',
  envKey = 'rendererFenceCustomHighlights',
) => {
  const map = getCustomHighlightPayloadMap(env, envKey)
  const keys = Object.keys(map)
  if (!keys.length) return ''
  const id = escapeHtmlAttr(scriptId || 'pre-highlight-data')
  return `<script type="application/json" id="${id}">${escapeJsonForScript(map)}</script>`
}

export {
  escapeHtmlAttr,
  escapeJsonForScript,
  getCustomHighlightPayloadMap,
  renderCustomHighlightPayloadScript,
}
