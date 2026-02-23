const warnedOptionIssues = new Set()

const isWarnEnabled = () => {
  if (typeof process === 'undefined' || !process || !process.env) return true
  const mode = process.env.NODE_ENV
  return mode === 'development'
}

const warnOptionIssueOnce = (code, message) => {
  if (!isWarnEnabled()) return
  const key = `${code}:${message}`
  if (warnedOptionIssues.has(key)) return
  warnedOptionIssues.add(key)
  if (typeof console !== 'undefined' && console && typeof console.warn === 'function') {
    console.warn(`[renderer-fence] ${message}`)
  }
}

const validProviderSet = new Set(['shiki', 'hljs', 'custom'])
const validFallbackSet = new Set(['plain', 'markup'])
const validTransportSet = new Set(['env', 'inline-script'])
const validLineFeatureStrategySet = new Set(['hybrid', 'disable'])
const validShikiScopeModeSet = new Set(['auto', 'color', 'semantic', 'keyword'])
const knownCustomHighlightKeys = new Set([
  'provider',
  'getRanges',
  'fallback',
  'fallbackOn',
  'transport',
  'idPrefix',
  'lineFeatureStrategy',
  'scopePrefix',
  'includeScopeStyles',
  'shikiScopeMode',
  'shikiKeywordClassifier',
  'shikiKeywordLangResolver',
  'shikiKeywordLangAliases',
  'highlighter',
  'hljsHighlight',
  'highlight',
  'defaultLang',
  'theme',
])

const validateCustomHighlightOptions = (rawOpt, normalizedOpt) => {
  if (!rawOpt || typeof rawOpt !== 'object') return

  for (const key of Object.keys(rawOpt)) {
    if (!knownCustomHighlightKeys.has(key)) {
      warnOptionIssueOnce(
        'unknown-option',
        `Unknown customHighlight option "${key}" was ignored.`,
      )
    }
  }

  if (rawOpt.provider != null && !validProviderSet.has(normalizedOpt.provider)) {
    warnOptionIssueOnce(
      'provider',
      `Invalid customHighlight.provider "${String(rawOpt.provider)}". Using "${normalizedOpt.provider}".`,
    )
  }
  if (rawOpt.fallback != null && !validFallbackSet.has(normalizedOpt.fallback)) {
    warnOptionIssueOnce(
      'fallback',
      `Invalid customHighlight.fallback "${String(rawOpt.fallback)}". Using "${normalizedOpt.fallback}".`,
    )
  }
  if (rawOpt.transport != null && !validTransportSet.has(normalizedOpt.transport)) {
    warnOptionIssueOnce(
      'transport',
      `Invalid customHighlight.transport "${String(rawOpt.transport)}". Using "${normalizedOpt.transport}".`,
    )
  }
  if (rawOpt.lineFeatureStrategy != null && !validLineFeatureStrategySet.has(normalizedOpt.lineFeatureStrategy)) {
    warnOptionIssueOnce(
      'line-feature-strategy',
      `Invalid customHighlight.lineFeatureStrategy "${String(rawOpt.lineFeatureStrategy)}". Using "${normalizedOpt.lineFeatureStrategy}".`,
    )
  }
  if (rawOpt.shikiScopeMode != null && !validShikiScopeModeSet.has(normalizedOpt.shikiScopeMode)) {
    warnOptionIssueOnce(
      'shiki-scope-mode',
      `Invalid customHighlight.shikiScopeMode "${String(rawOpt.shikiScopeMode)}". Using "${normalizedOpt.shikiScopeMode}".`,
    )
  }
  if (rawOpt.fallbackOn != null && !Array.isArray(rawOpt.fallbackOn)) {
    warnOptionIssueOnce(
      'fallback-on',
      'customHighlight.fallbackOn should be an array; using default fallback reasons.',
    )
  }

  if (rawOpt.theme != null) {
    if (typeof rawOpt.theme !== 'string' && (typeof rawOpt.theme !== 'object' || Array.isArray(rawOpt.theme))) {
      warnOptionIssueOnce(
        'theme-type',
        'customHighlight.theme should be a string or an object { light, dark, default? }.',
      )
    } else if (rawOpt.theme && typeof rawOpt.theme === 'object' && !Array.isArray(rawOpt.theme)) {
      const hasLight = (typeof rawOpt.theme.light === 'string' && rawOpt.theme.light.trim().length > 0)
      const hasDark = (typeof rawOpt.theme.dark === 'string' && rawOpt.theme.dark.trim().length > 0)
      if (rawOpt.theme.light != null && typeof rawOpt.theme.light !== 'string') {
        warnOptionIssueOnce(
          'theme-light-type',
          'customHighlight.theme.light should be a non-empty string when provided.',
        )
      }
      if (rawOpt.theme.dark != null && typeof rawOpt.theme.dark !== 'string') {
        warnOptionIssueOnce(
          'theme-dark-type',
          'customHighlight.theme.dark should be a non-empty string when provided.',
        )
      }
      if (!hasLight && !hasDark) {
        warnOptionIssueOnce(
          'theme-missing-variants',
          'customHighlight.theme object should include at least one of { light, dark }.',
        )
      }
      if (rawOpt.theme.default != null) {
        const key = String(rawOpt.theme.default).trim().toLowerCase()
        if (key !== 'light' && key !== 'dark') {
          warnOptionIssueOnce(
            'theme-default',
            'customHighlight.theme.default should be "light" or "dark".',
          )
        }
      }
    }
  }

  if (normalizedOpt.provider === 'custom' && typeof normalizedOpt.getRanges !== 'function') {
    warnOptionIssueOnce(
      'custom-provider-ranges',
      'customHighlight.provider="custom" requires customHighlight.getRanges(code, lang, context).',
    )
  }
  if (normalizedOpt.provider === 'shiki') {
    const ok = !!(normalizedOpt.highlighter && typeof normalizedOpt.highlighter.codeToTokens === 'function')
    if (!ok) {
      warnOptionIssueOnce(
        'shiki-provider-highlighter',
        'customHighlight.provider="shiki" requires customHighlight.highlighter.codeToTokens().',
      )
    }
  }
}

export {
  validateCustomHighlightOptions,
}
