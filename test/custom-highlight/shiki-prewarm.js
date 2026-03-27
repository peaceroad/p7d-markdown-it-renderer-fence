const prewarmShikiHighlighter = (highlighter, samples, theme, options = {}) => {
  if (!highlighter || typeof highlighter.codeToTokens !== 'function') return
  if (!Array.isArray(samples) || !samples.length) return

  const seen = new Set()
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i]
    const lang = String(sample && sample.lang || '').trim()
    if (!lang || seen.has(lang)) continue
    seen.add(lang)
    let code = String(sample && sample.code || '').trimEnd()
    if (!code) code = 'x'
    if (!code.endsWith('\n')) code += '\n'
    const tokenOption = { lang, theme }
    if (options.includeExplanation) tokenOption.includeExplanation = 'scopeName'
    highlighter.codeToTokens(code, tokenOption)
  }
}

export {
  prewarmShikiHighlighter,
}
