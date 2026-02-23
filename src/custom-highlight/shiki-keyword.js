import {
  applyKeywordV4Rules,
  applyShikiKeywordLegacyPostRules,
} from './shiki-keyword-rules.js'

const shikiKeywordBucketScoreV3 = {
  comment: 210,
  'meta-shebang': 206,
  'tag-delimiter': 202,
  attribute: 200,
  tag: 198,
  keyword: 194,
  'type-primitive': 192,
  'type-name': 190,
  type: 188,
  number: 186,
  literal: 184,
  string: 182,
  'string-unquoted': 180,
  namespace: 176,
  'title-function-builtin': 174,
  'title-function': 172,
  'title-class': 170,
  'variable-this': 168,
  'variable-const': 166,
  'variable-member': 164,
  'variable-parameter': 162,
  'variable-property': 160,
  'variable-plain': 158,
  variable: 156,
  punctuation: 140,
  meta: 70,
  text: 10,
}

const shikiGlobalLiteralTokenSet = new Set(['true', 'false', 'null', 'undefined', 'nan', 'inf', 'none', 'nil'])
const shikiShellKeywordTokenSet = new Set(['case', 'coproc', 'do', 'done', 'elif', 'else', 'esac', 'export', 'fi', 'for', 'function', 'if', 'in', 'local', 'readonly', 'select', 'then', 'time', 'typeset', 'until', 'while'])
const shikiHclKeywordTokenSet = new Set(['terraform', 'resource', 'data', 'module', 'provider', 'variable', 'output', 'locals', 'backend', 'dynamic', 'for_each', 'count', 'provisioner', 'connection', 'if', 'for', 'in'])

const shikiKeywordTokensByLang = {
  javascript: new Set(['await', 'async', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'from', 'function', 'if', 'import', 'in', 'instanceof', 'let', 'new', 'of', 'return', 'static', 'super', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield']),
  typescript: new Set(['abstract', 'as', 'asserts', 'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'declare', 'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'finally', 'for', 'from', 'function', 'if', 'implements', 'import', 'in', 'infer', 'instanceof', 'interface', 'is', 'keyof', 'let', 'namespace', 'new', 'of', 'override', 'private', 'protected', 'public', 'readonly', 'return', 'satisfies', 'static', 'super', 'switch', 'this', 'throw', 'try', 'type', 'typeof', 'var', 'void', 'while', 'with', 'yield']),
  python: new Set(['and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield']),
  bash: shikiShellKeywordTokenSet,
  shellscript: shikiShellKeywordTokenSet,
  sql: new Set(['all', 'alter', 'and', 'as', 'asc', 'between', 'by', 'create', 'delete', 'desc', 'distinct', 'drop', 'from', 'group', 'having', 'in', 'inner', 'insert', 'into', 'join', 'left', 'limit', 'not', 'null', 'offset', 'on', 'or', 'order', 'order by', 'outer', 'right', 'select', 'set', 'table', 'union', 'update', 'values', 'where', 'with']),
  go: new Set(['break', 'case', 'chan', 'const', 'continue', 'default', 'defer', 'else', 'fallthrough', 'for', 'func', 'go', 'goto', 'if', 'import', 'interface', 'map', 'package', 'range', 'return', 'select', 'struct', 'switch', 'type', 'var']),
  rust: new Set(['as', 'async', 'await', 'break', 'const', 'continue', 'crate', 'dyn', 'else', 'enum', 'extern', 'false', 'fn', 'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mod', 'move', 'mut', 'pub', 'ref', 'return', 'self', 'static', 'struct', 'super', 'trait', 'true', 'type', 'unsafe', 'use', 'where', 'while']),
  java: new Set(['abstract', 'assert', 'break', 'case', 'catch', 'class', 'continue', 'default', 'do', 'else', 'enum', 'extends', 'final', 'finally', 'for', 'if', 'implements', 'import', 'instanceof', 'interface', 'native', 'new', 'package', 'private', 'protected', 'public', 'return', 'static', 'strictfp', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws', 'transient', 'try', 'volatile', 'while']),
  ruby: new Set(['alias', 'and', 'begin', 'break', 'case', 'class', 'def', 'defined?', 'do', 'else', 'elsif', 'end', 'ensure', 'for', 'if', 'in', 'module', 'next', 'not', 'or', 'redo', 'rescue', 'retry', 'return', 'self', 'super', 'then', 'undef', 'unless', 'until', 'when', 'while', 'yield']),
  c: new Set(['auto', 'break', 'case', 'const', 'continue', 'default', 'do', 'else', 'enum', 'extern', 'for', 'goto', 'if', 'inline', 'register', 'restrict', 'return', 'sizeof', 'static', 'struct', 'switch', 'typedef', 'union', 'volatile', 'while']),
  cpp: new Set(['alignas', 'alignof', 'auto', 'break', 'case', 'catch', 'class', 'const', 'consteval', 'constexpr', 'constinit', 'continue', 'decltype', 'default', 'delete', 'do', 'else', 'enum', 'explicit', 'export', 'extern', 'final', 'for', 'friend', 'goto', 'if', 'inline', 'mutable', 'namespace', 'new', 'noexcept', 'operator', 'override', 'private', 'protected', 'public', 'return', 'sizeof', 'static', 'struct', 'switch', 'template', 'this', 'throw', 'try', 'typedef', 'typename', 'union', 'using', 'virtual', 'volatile', 'while']),
  csharp: new Set(['abstract', 'as', 'async', 'await', 'base', 'break', 'case', 'catch', 'checked', 'class', 'const', 'continue', 'default', 'delegate', 'do', 'else', 'enum', 'event', 'explicit', 'extern', 'finally', 'fixed', 'for', 'foreach', 'goto', 'if', 'implicit', 'in', 'interface', 'internal', 'is', 'lock', 'namespace', 'new', 'operator', 'out', 'override', 'params', 'private', 'protected', 'public', 'readonly', 'record', 'ref', 'return', 'sealed', 'sizeof', 'stackalloc', 'static', 'struct', 'switch', 'this', 'throw', 'try', 'typeof', 'unchecked', 'unsafe', 'using', 'virtual', 'volatile', 'while', 'var']),
  php: new Set(['abstract', 'and', 'array', 'as', 'break', 'callable', 'case', 'catch', 'class', 'clone', 'const', 'continue', 'declare', 'default', 'do', 'echo', 'else', 'elseif', 'enddeclare', 'endfor', 'endforeach', 'endif', 'endswitch', 'endwhile', 'extends', 'final', 'finally', 'fn', 'for', 'foreach', 'function', 'global', 'goto', 'if', 'implements', 'include', 'include_once', 'instanceof', 'interface', 'match', 'namespace', 'new', 'or', 'print', 'private', 'protected', 'public', 'readonly', 'require', 'require_once', 'return', 'static', 'switch', 'throw', 'trait', 'try', 'use', 'while', 'xor', 'yield']),
  hcl: shikiHclKeywordTokenSet,
  terraform: shikiHclKeywordTokenSet,
  css: new Set(['from', 'to']),
}

const shikiNumberTokenReg = /^(?:0[xob][0-9a-f_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:e[+-]?\d+)?)$/i
const shikiPunctuationTokenReg = /^[()[\]{}<>.,;:!?~`'"@#$%^&*+=|/\\-]+$/
const shikiSimpleIdentifierReg = /^[A-Za-z_$][\w$]*$/
const shikiScopeLangReg = /(?:^|\.)(?:source|text)\.([A-Za-z0-9_#+-]+)/g
const shikiKeywordLangSanitizeReg = /[^a-z0-9#+-]+/g
const hyphenMultiReg = /-+/g
const shikiScopeKeywordSingleV3Cache = new Map()

const normalizeShikiKeywordLangKey = (lang) => {
  let key = String(lang || '').trim().toLowerCase()
  if (!key) return ''
  if (key.startsWith('language-')) key = key.slice('language-'.length)
  key = key.replace(/\s+/g, '-').replace(/[./]+/g, '-').replace(/_+/g, '-')
  key = key.replace(shikiKeywordLangSanitizeReg, '')
  key = key.replace(hyphenMultiReg, '-').replace(/^-+|-+$/g, '')
  return key
}

const normalizeShikiKeywordLangAliasMap = (input) => {
  if (!input || typeof input !== 'object') return null
  const map = {}
  for (const key of Object.keys(input)) {
    const from = normalizeShikiKeywordLangKey(key)
    const to = normalizeShikiKeywordLangKey(input[key])
    if (!from || !to) continue
    map[from] = to
  }
  return Object.keys(map).length ? map : null
}

const getShikiRawScopeName = (tok) => {
  if (Array.isArray(tok.scopes) && tok.scopes.length > 0) return tok.scopes[tok.scopes.length - 1]
  if (typeof tok.scope === 'string' && tok.scope) return tok.scope
  if (Array.isArray(tok.explanation) && tok.explanation.length > 0) {
    for (let i = tok.explanation.length - 1; i >= 0; i--) {
      const exp = tok.explanation[i]
      if (!exp || !Array.isArray(exp.scopes) || exp.scopes.length === 0) continue
      for (let j = exp.scopes.length - 1; j >= 0; j--) {
        const scope = exp.scopes[j]
        if (typeof scope === 'string' && scope) return scope
        if (scope && typeof scope === 'object' && typeof scope.scopeName === 'string' && scope.scopeName) {
          return scope.scopeName
        }
      }
    }
  }
  return null
}

const extractShikiKeywordLangCandidatesFromScope = (scope) => {
  const out = []
  const text = String(scope || '')
  if (!text) return out
  shikiScopeLangReg.lastIndex = 0
  let m
  while ((m = shikiScopeLangReg.exec(text)) !== null) {
    const raw = m[1]
    if (raw) out.push(raw)
  }
  return out
}

const getShikiScopeCandidates = (tok, rawScope) => {
  const out = []
  const seen = new Set()
  const push = (scope) => {
    if (typeof scope !== 'string' || !scope || seen.has(scope)) return
    seen.add(scope)
    out.push(scope)
  }
  push(rawScope)
  if (Array.isArray(tok.scopes)) {
    for (let i = tok.scopes.length - 1; i >= 0; i--) push(tok.scopes[i])
  }
  if (typeof tok.scope === 'string' && tok.scope) push(tok.scope)
  if (Array.isArray(tok.explanation)) {
    for (let i = 0; i < tok.explanation.length; i++) {
      const exp = tok.explanation[i]
      if (!exp || !Array.isArray(exp.scopes)) continue
      for (let j = exp.scopes.length - 1; j >= 0; j--) {
        const scope = exp.scopes[j]
        if (typeof scope === 'string' && scope) push(scope)
        else if (scope && typeof scope.scopeName === 'string' && scope.scopeName) push(scope.scopeName)
      }
    }
  }
  return out
}

const toLowerScopeCandidates = (scopeCandidates) => {
  if (!Array.isArray(scopeCandidates)) return []
  const out = new Array(scopeCandidates.length)
  for (let i = 0; i < scopeCandidates.length; i++) out[i] = String(scopeCandidates[i] || '').toLowerCase()
  return out
}

const hasAnyScopePattern = (lowerScopeCandidates, patterns) => {
  if (!Array.isArray(lowerScopeCandidates) || lowerScopeCandidates.length === 0 || !Array.isArray(patterns) || patterns.length === 0) return false
  for (let i = 0; i < lowerScopeCandidates.length; i++) {
    const s = lowerScopeCandidates[i]
    if (!s) continue
    for (let j = 0; j < patterns.length; j++) {
      if (s.includes(patterns[j])) return true
    }
  }
  return false
}

const createScopePatternMatcher = (lowerScopeCandidates) => {
  const cache = new Map()
  return (patterns) => {
    if (!Array.isArray(patterns) || patterns.length === 0) return false
    const key = patterns.length === 1 ? patterns[0] : patterns.join('\u0001')
    if (cache.has(key)) return cache.get(key)
    const hit = hasAnyScopePattern(lowerScopeCandidates, patterns)
    cache.set(key, hit)
    return hit
  }
}

const classifyShikiScopeKeywordSingleV3 = (scope) => {
  const s = String(scope || '').toLowerCase()
  if (!s) return 'text'
  const cached = shikiScopeKeywordSingleV3Cache.get(s)
  if (cached) return cached
  let bucket = 'text'
  if (s.includes('comment')) return 'comment'
  if (s.includes('meta.shebang')) return 'meta-shebang'
  if (s.includes('punctuation.definition.tag.begin') || s.includes('punctuation.definition.tag.end') || s.includes('punctuation.separator.key-value.html')) return 'tag-delimiter'
  if (s.includes('entity.other.attribute-name') || s.includes('attribute-name')) return 'attribute'
  if (s.includes('entity.name.tag')) return 'tag'
  if (s.includes('string.unquoted')) return 'string-unquoted'
  if (s.includes('regexp') || s.includes('regex') || s.includes('string') || s.includes('punctuation.definition.string')) return 'string'
  if (s.includes('constant.other.color') || s.includes('support.constant.property-value')) return 'number'
  if (s.includes('constant.numeric') || s.includes('number')) return 'number'
  if (s.includes('constant.language') || s.includes('boolean') || s.includes('null') || s.includes('undefined') || s.includes('none')) return 'literal'
  if (s.includes('entity.name.scope-resolution') || s.includes('entity.name.namespace')) return 'namespace'
  if (s.includes('storage.type.function.arrow') || s.includes('keyword.operator')) return 'keyword'
  if (s.includes('variable.language.this')) return 'variable-this'
  if (s.includes('constant.other.php') || s.includes('variable.other.constant') || s.includes('variable.other.enummember')) return 'variable-const'
  if (s.includes('variable.object.property') || s.includes('variable.other.property') || s.includes('variable.other.member') || s.includes('variable.object.c') || s.includes('variable.ruby')) return 'variable-member'
  if (s.includes('variable.parameter') || s.includes('entity.name.variable.parameter')) return 'variable-parameter'
  if (s.includes('entity.name.variable.local') || s.includes('variable.other.readwrite') || s.includes('variable.other.normal') || s.includes('variable.other.php') || (s.includes('variable.other.') && !s.includes('variable.other.property') && !s.includes('variable.other.member'))) return 'variable-plain'
  if (s.includes('support.function.builtin') || s.includes('support.function.kernel') || s.includes('support.function.construct')) return 'title-function-builtin'
  if (s.includes('entity.name.function.macro')) return 'title-function'
  if (s.includes('meta.function') && !s.includes('entity.name.function') && !s.includes('support.function')) return 'meta'
  if (s.includes('entity.name.function') || s.includes('support.function')) return 'title-function'
  if (s.includes('entity.name.class') || s.includes('entity.name.type.class')) return 'title-class'
  if (s.includes('storage.type.built-in.primitive')) return 'type-primitive'
  if (s.includes('entity.name.type.namespace') || s.includes('entity.name.type') || s.includes('support.class')) return 'type-name'
  if (s.includes('support.type') || s.includes('storage.modifier') || s.includes('keyword.type')) return 'type'
  if (s.includes('storage') || s.includes('keyword') || s.includes('operator') || s.includes('control') || s.includes('modifier')) return 'keyword'
  if (s.includes('variable')) return 'variable'
  if (s.includes('punctuation')) return 'punctuation'
  if (s.includes('source.')) bucket = 'text'
  else if (s.includes('meta')) bucket = 'meta'
  shikiScopeKeywordSingleV3Cache.set(s, bucket)
  if (shikiScopeKeywordSingleV3Cache.size > 8192) shikiScopeKeywordSingleV3Cache.clear()
  return bucket
}

const hasJsonYamlPropertyNameScope = (scopeCandidates) => {
  if (!Array.isArray(scopeCandidates)) return false
  for (let i = 0; i < scopeCandidates.length; i++) {
    const s = String(scopeCandidates[i] || '').toLowerCase()
    if (!s.includes('property-name') && !s.includes('dictionary-key')) continue
    if (s.includes('.json') || s.includes('-json') || s.includes('.yaml') || s.includes('-yaml')) return true
  }
  return false
}

const classifyShikiHclKeywordBucketV3 = (lowerScopeCandidates, hasAnyPattern) => {
  const hasAny = (typeof hasAnyPattern === 'function') ? hasAnyPattern : (patterns) => hasAnyScopePattern(lowerScopeCandidates, patterns)
  if (!Array.isArray(lowerScopeCandidates) || lowerScopeCandidates.length === 0) return null
  if (hasAny(['entity.name.type.hcl', 'entity-name-type-hcl'])) return 'title-class'
  if (hasAny(['variable.other.enummember.hcl', 'variable-other-enummember-hcl'])) return 'variable-const'
  if (hasAny(['variable.declaration.hcl', 'variable-declaration-hcl'])) return 'variable-parameter'
  if (hasAny(['variable.other.readwrite.hcl', 'variable-other-readwrite-hcl'])) return 'variable-plain'
  if (hasAny(['storage-type-hcl', 'keyword-operator-assignment-hcl'])) return 'keyword'
  if (hasAny(['constant-numeric', 'number'])) return 'number'
  if (hasAny(['string'])) return 'string'
  if (hasAny(['punctuation'])) return 'punctuation'
  if (hasAny(['meta-block-hcl'])) return 'text'
  return null
}

const resolveShikiKeywordLang = (lang, scopeCandidates, tok, opt) => {
  const queue = []
  const seen = new Set()
  const customAliasMap = opt && opt.shikiKeywordLangAliases
  const shikiInternalAliasMap = opt && opt._shikiInternalLangAliasMap
  const resolveAlias = (key) => {
    if (customAliasMap && customAliasMap[key]) return customAliasMap[key]
    if (shikiInternalAliasMap && shikiInternalAliasMap[key]) return shikiInternalAliasMap[key]
    return ''
  }
  const pushCandidate = (value) => {
    const key = normalizeShikiKeywordLangKey(value)
    if (!key || seen.has(key)) return
    seen.add(key)
    queue.push(key)
  }
  if (opt && typeof opt.shikiKeywordLangResolver === 'function') {
    try {
      const resolved = opt.shikiKeywordLangResolver(lang, scopeCandidates, tok)
      if (resolved != null && resolved !== '') pushCandidate(resolved)
    } catch (e) {}
  }
  pushCandidate(lang)
  if (Array.isArray(scopeCandidates)) {
    for (let i = 0; i < scopeCandidates.length; i++) {
      const candidates = extractShikiKeywordLangCandidatesFromScope(scopeCandidates[i])
      for (let j = 0; j < candidates.length; j++) pushCandidate(candidates[j])
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const key = queue[i]
    if (shikiKeywordTokensByLang[key]) return key
    const aliased = resolveAlias(key)
    if (aliased) {
      if (shikiKeywordTokensByLang[aliased]) return aliased
      pushCandidate(aliased)
    }
    const compact = key.replace(/-/g, '')
    if (shikiKeywordTokensByLang[compact]) return compact
    const compactAliased = resolveAlias(compact)
    if (compactAliased) {
      if (shikiKeywordTokensByLang[compactAliased]) return compactAliased
      pushCandidate(compactAliased)
    }
    const parts = key.split('-')
    for (let n = parts.length - 1; n >= 1; n--) {
      const head = parts.slice(0, n).join('-')
      if (shikiKeywordTokensByLang[head]) return head
      const headAliased = resolveAlias(head)
      if (headAliased) {
        if (shikiKeywordTokensByLang[headAliased]) return headAliased
        pushCandidate(headAliased)
      }
    }
  }
  return ''
}

const classifyShikiKeywordByToken = (content, langKey) => {
  const text = String(content || '')
  const trimmed = text.trim()
  if (!trimmed) return 'text'
  const lower = trimmed.toLowerCase().replace(/\s+/g, ' ')
  if (lower.startsWith('#!')) return 'meta'
  if (langKey !== 'sql' && shikiGlobalLiteralTokenSet.has(lower)) return 'literal'
  if (shikiNumberTokenReg.test(lower)) return 'number'
  const set = shikiKeywordTokensByLang[langKey]
  if (set && set.has(lower)) return 'keyword'
  if (langKey === 'css' && lower.startsWith('@')) return 'keyword'
  if (shikiPunctuationTokenReg.test(trimmed)) return 'punctuation'
  return null
}

const buildShikiKeywordContext = (rawScope, tok, lang, opt, preResolvedLangKey = '') => {
  const token = (tok && typeof tok === 'object') ? tok : {}
  const tokenContent = String(token.content || '')
  const tokenTrim = tokenContent.trim()
  const scopeCandidates = getShikiScopeCandidates(token, rawScope)
  const langKey = preResolvedLangKey || resolveShikiKeywordLang(lang, scopeCandidates, token, opt)
  const lowerScopeCandidates = toLowerScopeCandidates(scopeCandidates)
  const hasAnyScopePatternCached = createScopePatternMatcher(lowerScopeCandidates)
  return {
    rawScope,
    token,
    lang: String(lang || ''),
    langKey,
    scopeCandidates,
    lowerScopeCandidates,
    tokenContent,
    tokenTrim,
    tokenLower: tokenTrim.toLowerCase(),
    isIdentifier: shikiSimpleIdentifierReg.test(tokenTrim),
    isPunctuation: shikiPunctuationTokenReg.test(tokenTrim),
    hasAnyScopePattern: hasAnyScopePatternCached,
    hasScopePattern: (pattern) => hasAnyScopePatternCached([pattern]),
  }
}

const classifyShikiScopeKeywordBaseFromContext = (context) => {
  if (!context || typeof context !== 'object') return 'text'
  let best = 'text'
  let bestScore = shikiKeywordBucketScoreV3.text
  const candidates = Array.isArray(context.scopeCandidates) ? context.scopeCandidates : []
  const lowerScopeCandidates = Array.isArray(context.lowerScopeCandidates) ? context.lowerScopeCandidates : []
  const hasAnyPattern = (context && typeof context.hasAnyScopePattern === 'function')
    ? context.hasAnyScopePattern
    : (patterns) => hasAnyScopePattern(lowerScopeCandidates, patterns)
  const hasScope = (context && typeof context.hasScopePattern === 'function')
    ? context.hasScopePattern
    : (pattern) => hasAnyPattern([pattern])
  const langKey = String(context.langKey || '')
  const tokenContent = context.tokenContent
  if (langKey === 'hcl' || langKey === 'terraform') {
    const hclBucket = classifyShikiHclKeywordBucketV3(lowerScopeCandidates, hasAnyPattern)
    if (hclBucket) return hclBucket
  }
  if (hasJsonYamlPropertyNameScope(candidates)) return 'type'
  if (langKey === 'yaml' && hasScope('entity.name.tag.yaml')) return 'tag'
  for (let i = 0; i < lowerScopeCandidates.length; i++) {
    const bucket = classifyShikiScopeKeywordSingleV3(lowerScopeCandidates[i])
    const score = shikiKeywordBucketScoreV3[bucket] || shikiKeywordBucketScoreV3.text
    if (score > bestScore) {
      best = bucket
      bestScore = score
    }
  }
  const tokenBucket = classifyShikiKeywordByToken(tokenContent, langKey)
  if (tokenBucket) {
    const tokenScore = (shikiKeywordBucketScoreV3[tokenBucket] || shikiKeywordBucketScoreV3.text) + 1
    if (tokenScore > bestScore) best = tokenBucket
  }
  return best
}

const resolveShikiKeywordLangForFence = (lang, opt) => {
  return resolveShikiKeywordLang(lang, null, null, opt)
}

const classifyShikiScopeKeyword = (rawScope, tok, lang, opt, preResolvedKeywordLang = '') => {
  const tokenContent = String((tok && tok.content) || '')
  if (!tokenContent.trim()) return 'text'
  const context = buildShikiKeywordContext(rawScope, tok, lang, opt, preResolvedKeywordLang)
  const baseBucket = classifyShikiScopeKeywordBaseFromContext(context)
  const postHelpers = {
    classifyToken: classifyShikiKeywordByToken,
    hasAnyScopePattern: context.hasAnyScopePattern,
    hasScopePattern: context.hasScopePattern,
  }
  const postBucket = applyShikiKeywordLegacyPostRules(baseBucket, context, postHelpers)
  const finalBucket = applyKeywordV4Rules(postBucket, context)
  return finalBucket || postBucket || baseBucket
}

export {
  classifyShikiScopeKeyword,
  getShikiRawScopeName,
  normalizeShikiKeywordLangAliasMap,
  resolveShikiKeywordLangForFence,
}
