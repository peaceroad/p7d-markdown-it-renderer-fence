import fs from 'node:fs'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import mdit from 'markdown-it'
import mditAttrs from 'markdown-it-attrs'
import highlightjs from 'highlight.js'
import { createHighlighter } from 'shiki'

import mditRendererFence from '../../index.js'

const parseArgs = (argv) => {
  const out = {
    fixtures: 0,
    warmup: 2,
    rounds: 5,
    iterations: 20,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--fixtures') out.fixtures = Math.max(0, Number(argv[++i] || out.fixtures))
    else if (arg === '--warmup') out.warmup = Math.max(0, Number(argv[++i] || out.warmup))
    else if (arg === '--rounds') out.rounds = Math.max(1, Number(argv[++i] || out.rounds))
    else if (arg === '--iterations') out.iterations = Math.max(1, Number(argv[++i] || out.iterations))
  }
  return out
}

const avg = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1)
const median = (xs) => {
  if (!xs.length) return 0
  const sorted = xs.slice().sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return (sorted.length % 2) ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
const p95 = (xs) => {
  if (!xs.length) return 0
  const sorted = xs.slice().sort((a, b) => a - b)
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1))
  return sorted[idx]
}

const fixturePaths = [
  path.join(process.cwd(), 'test', 'custom-highlight', 'provider-keyword-fixtures.json'),
  path.join(process.cwd(), 'test', 'custom-highlight', 'provider-keyword-holdout-fixtures.json'),
]

const readFixtures = () => {
  const list = []
  for (const p of fixturePaths) {
    const rows = JSON.parse(fs.readFileSync(p, 'utf8'))
    if (Array.isArray(rows)) list.push(...rows)
  }
  return list
}

const toMarkdownBlock = (lang, code) => {
  const text = String(code || '')
  const normalized = text.endsWith('\n') ? text : `${text}\n`
  return `\`\`\`${lang || ''}\n${normalized}\`\`\`\n`
}

const createMarkupShikiInside = (highlighter) => {
  return mdit({
    html: true,
    langPrefix: 'language-',
    highlight: (code, lang) => {
      const target = (lang && String(lang).trim()) || 'text'
      const html = highlighter.codeToHtml(code, {
        lang: target,
        theme: 'github-light',
        structure: 'inline',
      })
      return html.replace(/<br\s*\/?>/g, '\n')
    },
  }).use(mditRendererFence).use(mditAttrs)
}

const createMarkupHljs = () => {
  return mdit({
    html: true,
    langPrefix: 'language-',
    highlight: (code, lang) => {
      const target = (lang && highlightjs.getLanguage(lang)) ? lang : 'plaintext'
      const result = highlightjs.highlight(code, { language: target })
      return `<span class="hljs">${result.value}</span>`
    },
  }).use(mditRendererFence).use(mditAttrs)
}

const createApiShiki = (highlighter, shikiScopeMode) => {
  return mdit({ html: true, langPrefix: 'language-' })
    .use(mditAttrs)
    .use(mditRendererFence, {
      highlightRenderer: 'api',
      customHighlight: {
        provider: 'shiki',
        highlighter,
        theme: 'github-light',
        includeScopeStyles: false,
        shikiScopeMode,
      },
    })
}

const createApiHljs = () => {
  return mdit({ html: true, langPrefix: 'language-' })
    .use(mditAttrs)
    .use(mditRendererFence, {
      highlightRenderer: 'api',
      customHighlight: {
        provider: 'hljs',
        includeScopeStyles: false,
        hljsHighlight: (code, lang) => {
          const target = (lang && highlightjs.getLanguage(lang)) ? lang : 'plaintext'
          return highlightjs.highlight(code, { language: target })
        },
      },
    })
}

const runOne = (md, markdownBlocks, iterations) => {
  const env = {}
  const t0 = performance.now()
  for (let i = 0; i < iterations; i++) {
    for (let j = 0; j < markdownBlocks.length; j++) {
      md.render(markdownBlocks[j], env)
    }
  }
  const t1 = performance.now()
  const renderCount = iterations * markdownBlocks.length
  return (t1 - t0) / renderCount
}

const main = async () => {
  const cfg = parseArgs(process.argv.slice(2))
  const fixtures = readFixtures()
  const selected = cfg.fixtures > 0 ? fixtures.slice(0, cfg.fixtures) : fixtures
  const langs = Array.from(new Set(selected.map((f) => String(f.lang || '').trim()).filter(Boolean)))
  const markdownBlocks = selected.map((f) => toMarkdownBlock(f.lang, f.code))

  const shiki = await createHighlighter({
    themes: ['github-light'],
    langs,
  })

  const targets = [
    { id: 'markup-shiki-inside', label: 'Markup / shiki-inside', md: createMarkupShikiInside(shiki) },
    { id: 'api-shiki-json', label: 'API / Shiki / json', md: createApiShiki(shiki, 'color') },
    { id: 'api-shiki-keyword', label: 'API / Shiki / keyword', md: createApiShiki(shiki, 'keyword') },
    { id: 'markup-hljs', label: 'Markup / highlight.js', md: createMarkupHljs() },
    { id: 'api-hljs', label: 'API / highlight.js provider', md: createApiHljs() },
  ]

  for (let w = 0; w < cfg.warmup; w++) {
    for (const target of targets) runOne(target.md, markdownBlocks, 1)
  }

  const samplesById = new Map(targets.map((t) => [t.id, []]))
  for (let r = 0; r < cfg.rounds; r++) {
    const ordered = (r % 2 === 0) ? targets : targets.slice().reverse()
    for (const target of ordered) {
      const msPerRender = runOne(target.md, markdownBlocks, cfg.iterations)
      samplesById.get(target.id).push(msPerRender)
    }
  }

  console.log('===========================================================')
  console.log('provider-mode-benchmark')
  console.log(`fixtures=${selected.length} warmup=${cfg.warmup} rounds=${cfg.rounds} iterations=${cfg.iterations}`)
  for (const target of targets) {
    const samples = samplesById.get(target.id) || []
    const med = median(samples)
    const avgMs = avg(samples)
    const p95Ms = p95(samples)
    const rps = med > 0 ? Math.round(1000 / med) : 0
    console.log(`${target.label.padEnd(30)} median=${med.toFixed(4)}ms avg=${avgMs.toFixed(4)}ms p95=${p95Ms.toFixed(4)}ms ${rps} rps`)
  }

  await shiki.dispose()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
