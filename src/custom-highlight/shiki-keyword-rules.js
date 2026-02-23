const shikiSimpleIdentifierReg = /^[A-Za-z_$][\w$]*$/
const shikiPunctuationTokenReg = /^[()[\]{}<>.,;:!?~`'"@#$%^&*+=|/\\-]+$/
const shikiFunctionLikeIdentifierReg = /^[A-Za-z_$][\w$]*[!?]?$/
const shikiShellOptionTokenReg = /^-[A-Za-z0-9][A-Za-z0-9-]*$/
const shikiShellTestOperatorSet = new Set(['-n', '-z', '-gt', '-lt', '-ge', '-le', '-eq', '-ne'])

const keywordV4GlobalRules = [
  {
    id: 'css-color-name-to-number',
    priority: 2100,
    scopeIncludesAny: ['support.constant.color.w3c-standard-color-name.css'],
    setBucket: 'number',
  },
  {
    id: 'rust-lifetime-to-type-name',
    priority: 2050,
    lang: ['rust'],
    scopeIncludesAny: ['entity.name.type.lifetime.rust'],
    setBucket: 'type-name',
  },
  {
    id: 'regex-alternative-operator-keyword',
    priority: 2040,
    scopeIncludesAny: ['keyword.operator.or.regexp'],
    tokenEquals: ['|'],
    setBucket: 'keyword',
  },
]

const keywordV4LangRules = {
  sql: [
    {
      id: 'sql-window-function-blue',
      priority: 2000,
      scopeIncludesAny: ['support.function.ranking.sql'],
      setBucket: 'type',
    },
    {
      id: 'sql-table-database-name-blue',
      priority: 1980,
      scopeIncludesAny: ['constant.other.table-name.sql', 'constant.other.database-name.sql'],
      setBucket: 'type',
    },
  ],
  java: [
    {
      id: 'java-record-signature-neutral',
      priority: 1995,
      scopeIncludesAny: ['meta.record.identifier.java'],
      tokenRegex: /[(),]/,
      setBucket: 'text',
    },
    {
      id: 'java-package-separator-neutral',
      priority: 1980,
      scopeIncludesAny: ['punctuation.separator.java'],
      setBucket: 'text',
    },
    {
      id: 'java-generic-bracket-neutral',
      priority: 1970,
      scopeIncludesAny: ['punctuation.bracket.angle.java'],
      setBucket: 'text',
    },
    {
      id: 'java-record-keyword',
      priority: 1960,
      scopeIncludesAny: ['storage.modifier.java'],
      tokenKind: 'identifier',
      tokenEquals: ['record'],
      setBucket: 'keyword',
    },
    {
      id: 'java-record-type-name',
      priority: 1950,
      scopeIncludesAny: ['entity.name.type.record.java'],
      tokenKind: 'identifier',
      setBucket: 'type-name',
    },
    {
      id: 'java-primitive-keyword',
      priority: 1940,
      scopeIncludesAny: ['storage.type.primitive.java'],
      tokenKind: 'identifier',
      setBucket: 'keyword',
    },
  ],
  php: [
    {
      id: 'php-array-func-builtin',
      priority: 2000,
      scopeIncludesAny: ['support.function.array.php'],
      setBucket: 'title-function-builtin',
    },
    {
      id: 'php-core-const-blue',
      priority: 1980,
      scopeIncludesAny: ['support.constant.core.php', 'constant.other.php'],
      setBucket: 'variable-const',
    },
    {
      id: 'php-enum-const-blue',
      priority: 1970,
      scopeIncludesAny: ['constant.enum.php', 'constant.other.class.php'],
      setBucket: 'variable-const',
    },
  ],
  ruby: [
    {
      id: 'ruby-entity-function-title',
      priority: 2000,
      scopeIncludesAny: ['entity.name.function.ruby'],
      setBucket: 'title-function',
    },
    {
      id: 'ruby-variable-accent',
      priority: 1980,
      scopeIncludesAny: ['variable.ruby'],
      baseIn: ['variable-member'],
      tokenKind: 'identifier',
      setBucket: 'variable',
    },
  ],
  typescript: [
    {
      id: 'ts-support-property-blue',
      priority: 1950,
      scopeIncludesAny: ['support.variable.property.ts'],
      setBucket: 'variable-const',
    },
  ],
  javascript: [
    {
      id: 'js-support-class-blue',
      priority: 1960,
      scopeIncludesAny: ['support.class.'],
      setBucket: 'type',
    },
  ],
  go: [
    {
      id: 'go-storage-type-keyword',
      priority: 1960,
      scopeIncludesAny: ['storage.type.string.go', 'storage.type.boolean.go'],
      setBucket: 'keyword',
    },
    {
      id: 'go-format-placeholder-blue',
      priority: 1940,
      scopeIncludesAny: ['constant.other.placeholder.go'],
      setBucket: 'literal',
    },
  ],
  csharp: [
    {
      id: 'csharp-keyword-type-keyword',
      priority: 1960,
      scopeIncludesAny: ['keyword.type.string.cs'],
      setBucket: 'keyword',
    },
  ],
  c: [
    {
      id: 'c-array-bracket-keyword',
      priority: 1960,
      scopeIncludesAny: ['storage.modifier.array.bracket.square.c', 'storage-modifier-array-bracket-square-c'],
      setBucket: 'keyword',
    },
    {
      id: 'c-array-bracket-token-keyword',
      priority: 1955,
      baseIn: ['type'],
      tokenEquals: ['[]'],
      setBucket: 'keyword',
    },
    {
      id: 'c-placeholder-blue',
      priority: 1950,
      scopeIncludesAny: ['constant.other.placeholder.c'],
      setBucket: 'literal',
    },
  ],
  cpp: [
    {
      id: 'cpp-reference-modifier-keyword',
      priority: 1960,
      scopeIncludesAny: ['storage.modifier.reference.cpp'],
      setBucket: 'keyword',
    },
  ],
  python: [
    {
      id: 'python-fstring-conversion-neutral',
      priority: 1900,
      baseIn: ['string'],
      scopeIncludesAny: ['meta.fstring.python'],
      tokenEquals: ['s', 'r', 'a'],
      setBucket: 'text',
    },
    {
      id: 'python-fstring-identifier-neutral',
      priority: 1890,
      baseIn: ['string'],
      scopeIncludesAny: ['meta.fstring.python'],
      tokenKind: 'identifier',
      setBucket: 'text',
    },
  ],
  css: [
    {
      id: 'css-function-type-blue',
      priority: 1940,
      scopeIncludesAny: ['support.function.calc.css', 'support.function.gradient.css'],
      setBucket: 'type',
    },
  ],
}

const keywordV4SortedGlobalRules = keywordV4GlobalRules.slice().sort((a, b) => (b.priority || 0) - (a.priority || 0))
const keywordV4SortedLangRules = new Map(
  Object.keys(keywordV4LangRules).map((lang) => [
    lang,
    keywordV4LangRules[lang].slice().sort((a, b) => (b.priority || 0) - (a.priority || 0)),
  ]),
)

const applyShikiKeywordLegacyPostRules = (currentBucket, ctx, helper) => {
  const postHelper = helper && typeof helper === 'object' ? helper : {}
  const hasAnyScopePattern = typeof postHelper.hasAnyScopePattern === 'function'
    ? postHelper.hasAnyScopePattern
    : () => false
  const hasScopePattern = typeof postHelper.hasScopePattern === 'function'
    ? postHelper.hasScopePattern
    : (pattern) => hasAnyScopePattern([pattern])
  const classifyToken = typeof postHelper.classifyToken === 'function'
    ? postHelper.classifyToken
    : () => null

  const bucket = String(currentBucket || 'text')
  const langKey = String(ctx && ctx.langKey || '')
  const lowerScopeCandidates = Array.isArray(ctx && ctx.lowerScopeCandidates) ? ctx.lowerScopeCandidates : []
  const tokenContent = String(ctx && ctx.tokenContent || '')
  const trimmed = String(ctx && ctx.tokenTrim || '')
  const tokenLower = (ctx && typeof ctx.tokenLower === 'string') ? ctx.tokenLower : trimmed.toLowerCase()
  if (!trimmed) return 'text'

  if ((langKey === 'bash' || langKey === 'shellscript') && shikiShellOptionTokenReg.test(trimmed)) {
    return shikiShellTestOperatorSet.has(tokenLower) ? 'keyword' : 'literal'
  }
  if ((langKey === 'hcl' || langKey === 'terraform') && trimmed === '=') return 'keyword'
  if (bucket === 'comment' && trimmed.startsWith('#!')) return 'meta-shebang'
  if (bucket === 'string') {
    if (
      (langKey === 'bash' || langKey === 'shellscript') &&
      hasAnyScopePattern(['entity.name.function.shell', 'entity.name.command.shell'])
    ) return 'title-function'
    if (
      (langKey === 'bash' || langKey === 'shellscript') &&
      (
        hasAnyScopePattern(['variable.parameter.positional.shell', 'variable.language.special.shell']) ||
        shikiShellOptionTokenReg.test(trimmed) ||
        trimmed.startsWith('${') ||
        trimmed === '}'
      )
    ) return 'literal'
    if (
      (langKey === 'bash' || langKey === 'shellscript') &&
      hasAnyScopePattern(['constant.other.option'])
    ) return shikiShellTestOperatorSet.has(tokenLower) ? 'keyword' : 'literal'
    if (langKey === 'python' && hasAnyScopePattern(['storage.type.string.python'])) return 'keyword'
    if (langKey === 'go' && hasAnyScopePattern(['entity.name.import.go'])) return 'type-name'
    if (hasAnyScopePattern(['keyword.operator.string'])) return 'keyword'
    if (hasAnyScopePattern(['constant.character.escape', 'constant.character.format.placeholder'])) return 'number'
    if (hasAnyScopePattern(['variable.other.', 'variable.ruby', 'meta.attribute.python'])) return 'variable-plain'
  }
  if (bucket === 'string-unquoted') {
    if (
      (langKey === 'bash' || langKey === 'shellscript') &&
      hasAnyScopePattern(['entity.name.function.shell', 'entity.name.command.shell'])
    ) return 'title-function'
    if (
      (langKey === 'bash' || langKey === 'shellscript') &&
      (
        hasAnyScopePattern(['variable.parameter.positional.shell', 'variable.language.special.shell']) ||
        shikiShellOptionTokenReg.test(trimmed) ||
        trimmed.startsWith('${') ||
        trimmed === '}'
      )
    ) return 'literal'
    if (
      (langKey === 'bash' || langKey === 'shellscript') &&
      hasAnyScopePattern(['constant.other.option'])
    ) return shikiShellTestOperatorSet.has(tokenLower) ? 'keyword' : 'literal'
    if (hasAnyScopePattern(['entity.name.tag.yaml'])) return 'tag'
    return 'string'
  }
  if (bucket === 'title-function') {
    if (langKey === 'css' && hasAnyScopePattern(['support.function.misc.css'])) return 'type'
    if (hasAnyScopePattern(['support.function.builtin', 'support.function.kernel', 'support.function.construct'])) return 'title-function-builtin'
    if (hasAnyScopePattern(['storage.type.function.arrow', 'keyword.operator'])) return 'keyword'
    if (hasAnyScopePattern(['punctuation.section.function', 'punctuation.definition.arguments', 'meta.function-call.arguments'])) return 'punctuation'
    if (hasAnyScopePattern(['meta.function']) && !hasAnyScopePattern(['entity.name.function', 'support.function'])) return 'meta'
    if (hasAnyScopePattern(['punctuation.accessor'])) return 'text'
    if (!shikiFunctionLikeIdentifierReg.test(trimmed)) {
      if (shikiPunctuationTokenReg.test(trimmed)) return 'punctuation'
      if (/[.\[\](){}:]/.test(trimmed)) return 'text'
    }
  }
  if (bucket === 'title-function-builtin' && hasAnyScopePattern(['entity.name.function.macro'])) return 'title-function'
  if (bucket === 'type' && langKey === 'csharp' && hasScopePattern('keyword.type.')) return 'keyword'
  if (bucket === 'type' && langKey === 'rust' && hasAnyScopePattern(['entity.name.type.numeric.rust'])) return 'type-name'
  if (bucket === 'type-name' && langKey === 'php' && hasScopePattern('support.class.php')) return 'type'
  if (bucket === 'type-name' && langKey === 'ruby' && hasScopePattern('support.class.ruby')) return 'type'
  if (bucket === 'meta') {
    if (trimmed.startsWith('#!') || hasAnyScopePattern(['meta.shebang'])) return 'meta-shebang'
    if (hasAnyScopePattern(['entity.name.scope-resolution', 'entity.name.namespace'])) return 'namespace'
    if (hasAnyScopePattern(['source.sql', 'source.python', 'source.ruby', 'source.rust'])) return 'text'
    if (hasAnyScopePattern(['punctuation.terminator.statement', 'punctuation.section.block', 'punctuation.brackets.curly', 'meta.body.function.definition'])) return 'punctuation'
  }
  if (bucket === 'variable') {
    if (
      hasAnyScopePattern(['meta.type.annotation']) &&
      shikiPunctuationTokenReg.test(trimmed)
    ) return 'punctuation'
    if (hasAnyScopePattern(['variable.language.this'])) return 'variable-this'
    if (hasAnyScopePattern(['variable.other.constant', 'constant.other.php', 'variable.other.enummember'])) return 'variable-const'
    if (hasAnyScopePattern(['variable.object.property', 'variable.other.property', 'variable.other.member', 'variable.object.c', 'variable.ruby'])) return 'variable-member'
    if (!hasAnyScopePattern(['variable.', 'entity.name.variable']) && hasAnyScopePattern(['source.'])) return 'text'
    if (hasAnyScopePattern(['variable.other.readwrite', 'variable.other.normal', 'variable.other.php', 'entity.name.variable.local'])) return 'variable-plain'
  }
  if (bucket === 'variable-plain') {
    if (hasAnyScopePattern(['variable.other.constant', 'constant.other.php', 'variable.other.enummember'])) return 'variable-const'
    if (hasAnyScopePattern(['entity.name.variable.local.cs'])) return 'type-name'
    if (hasAnyScopePattern(['source.sql', 'source.python', 'source.ruby'])) return 'text'
    if (!shikiSimpleIdentifierReg.test(trimmed) && hasAnyScopePattern(['punctuation.'])) return 'punctuation'
  }
  if (bucket === 'variable-member') {
    if (hasAnyScopePattern(['variable.object.property.ts', 'variable-object-property-ts', 'variable.object.property.js', 'variable-object-property-js'])) return 'variable-property'
    if (hasAnyScopePattern(['variable.object.c'])) return 'variable-parameter'
  }
  if (bucket === 'variable-parameter') {
    if (langKey === 'csharp' && hasAnyScopePattern(['entity.name.variable.parameter.cs'])) return 'type-name'
    if (hasAnyScopePattern(['variable.other.constant', 'constant.other.php', 'variable.other.enummember'])) return 'variable-const'
    if (hasAnyScopePattern(['variable.object.property', 'variable.other.property', 'variable.other.member', 'variable.object.c', 'variable.ruby'])) return 'variable-member'
    if (hasAnyScopePattern(['variable.other.readwrite.hcl', 'variable.other.normal.shell', 'meta.block.hcl'])) return 'variable-plain'
    if (hasAnyScopePattern(['storage.type.built-in.primitive', 'keyword.operator.type.annotation', 'keyword.operator.type'])) return 'keyword'
    if (hasAnyScopePattern(['entity.name.type', 'support.type'])) return 'type-name'
    if (!shikiSimpleIdentifierReg.test(trimmed)) return 'punctuation'
  }
  if (bucket === 'variable-property') {
    if (hasAnyScopePattern(['variable.object.property', 'variable.other.property'])) return 'variable-parameter'
  }
  if (bucket === 'keyword' && langKey === 'php' && hasAnyScopePattern(['support.function.construct.output.php'])) return 'title-function-builtin'
  if (bucket === 'keyword' && hasAnyScopePattern(['variable.language.this'])) return 'variable-this'
  if (bucket === 'literal' && langKey === 'sql') return 'text'
  if (bucket === 'text') {
    const tokenBucket = classifyToken(tokenContent, langKey)
    if (tokenBucket) return tokenBucket
    if (shikiSimpleIdentifierReg.test(trimmed)) return 'variable-plain'
  }
  if (!shikiSimpleIdentifierReg.test(trimmed) && (bucket === 'text' || bucket === 'meta')) {
    const tokenBucket = classifyToken(tokenContent, langKey)
    if (tokenBucket) return tokenBucket
  }
  return bucket
}

const matchKeywordV4Rule = (rule, currentBucket, ctx) => {
  const hasAnyScopePattern = (ctx && typeof ctx.hasAnyScopePattern === 'function')
    ? ctx.hasAnyScopePattern
    : (() => false)
  if (!rule) return false
  if (Array.isArray(rule.baseIn) && rule.baseIn.length > 0 && !rule.baseIn.includes(currentBucket)) return false
  if (Array.isArray(rule.lang) && rule.lang.length > 0 && !rule.lang.includes(ctx.langKey)) return false
  if (Array.isArray(rule.scopeIncludesAny) && rule.scopeIncludesAny.length > 0 && !hasAnyScopePattern(rule.scopeIncludesAny)) return false
  if (Array.isArray(rule.scopeExcludesAny) && rule.scopeExcludesAny.length > 0 && hasAnyScopePattern(rule.scopeExcludesAny)) return false
  if (Array.isArray(rule.tokenEquals) && rule.tokenEquals.length > 0 && !rule.tokenEquals.includes(ctx.tokenLower)) return false
  if (rule.tokenRegex instanceof RegExp && !rule.tokenRegex.test(ctx.tokenTrim)) return false
  if (rule.tokenKind === 'identifier' && !ctx.isIdentifier) return false
  if (rule.tokenKind === 'punctuation' && !ctx.isPunctuation) return false
  return true
}

const applyRuleSet = (currentBucket, rules, ctx) => {
  if (!Array.isArray(rules) || rules.length === 0) return currentBucket
  let next = currentBucket
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i]
    if (!matchKeywordV4Rule(rule, next, ctx)) continue
    next = rule.setBucket || next
    if (rule.stop !== false) break
  }
  return next
}

const applyKeywordV4Rules = (currentBucket, ctx) => {
  let next = applyRuleSet(currentBucket, keywordV4SortedGlobalRules, ctx)
  const langRules = keywordV4SortedLangRules.get(ctx.langKey)
  next = applyRuleSet(next, langRules, ctx)
  return next
}

export {
  applyKeywordV4Rules,
  applyShikiKeywordLegacyPostRules,
}

