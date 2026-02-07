import { performance } from 'node:perf_hooks'
import mdit from 'markdown-it'
import mditAttrs from 'markdown-it-attrs'
import highlightjs from 'highlight.js'
import mditRendererFence from '../../index.js'

const parseArgs = (argv) => {
  const out = {
    samples: 7,
    iterations: 120,
    warmup: 20,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--samples') out.samples = Math.max(1, Number(argv[++i] || out.samples))
    else if (arg === '--iterations') out.iterations = Math.max(1, Number(argv[++i] || out.iterations))
    else if (arg === '--warmup') out.warmup = Math.max(0, Number(argv[++i] || out.warmup))
  }
  return out
}

const median = (arr) => {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2
  return sorted[mid]
}

const percentile = (arr, p) => {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[idx]
}

const repeatLines = (count, prefix = 'line') => {
  const rows = []
  for (let i = 1; i <= count; i++) rows.push(`${prefix}${i}`)
  return rows.join('\n')
}

const longCode = repeatLines(220, 'const value')
const commentCode = repeatLines(160, '# comment')

const cases = [
  {
    name: 'plain-short',
    mode: 'plain',
    opt: {},
    batch: 200,
    source: '```\nalpha\nbeta\ngamma\n```\n',
  },
  {
    name: 'line-number-short',
    mode: 'plain',
    opt: {},
    batch: 160,
    source: '```js {start="1"}\nconst a = 1\nconst b = 2\nconsole.log(a + b)\n```\n',
  },
  {
    name: 'line-number-highlight',
    mode: 'hljs',
    opt: {},
    batch: 80,
    source: `\`\`\`javascript {start="1"}\n${longCode}\n\`\`\`\n`,
  },
  {
    name: 'emphasis-comment',
    mode: 'plain',
    opt: {},
    batch: 80,
    source: `\`\`\`samp {em-lines="30-120" comment-line="#"}\n${commentCode}\n\`\`\`\n`,
  },
  {
    name: 'highlight-pre-pass',
    mode: 'prepass',
    opt: { useHighlightPre: true },
    batch: 120,
    source: `\`\`\`javascript {start="1" comment-line="#"}\n${longCode}\n\`\`\`\n`,
  },
]

const makeMd = (mode, opt) => {
  const mdOpt = { html: true, langPrefix: 'language-' }
  if (mode === 'hljs') {
    mdOpt.highlight = (str, lang) => {
      if (lang && highlightjs.getLanguage(lang)) {
        try {
          return highlightjs.highlight(str, { language: lang }).value
        } catch {}
      }
      return str
    }
  } else if (mode === 'prepass') {
    mdOpt.highlight = (str, lang) => {
      if (!lang) return str
      const body = str.split('\n').map((line) => `<span class="tok">${line}</span>`).join('\n')
      return `<pre class="hl"><code class="hl-code">${body}</code></pre>`
    }
  }
  return mdit(mdOpt).use(mditRendererFence, opt).use(mditAttrs)
}

const benchCase = (targetCase, config) => {
  const md = makeMd(targetCase.mode, targetCase.opt)
  const perRenderMs = []
  const batch = targetCase.batch

  for (let w = 0; w < config.warmup; w++) {
    for (let i = 0; i < batch; i++) md.render(targetCase.source)
  }

  for (let s = 0; s < config.samples; s++) {
    const t0 = performance.now()
    for (let i = 0; i < config.iterations; i++) {
      for (let j = 0; j < batch; j++) md.render(targetCase.source)
    }
    const t1 = performance.now()
    const renders = config.iterations * batch
    perRenderMs.push((t1 - t0) / renders)
  }

  const med = median(perRenderMs)
  const p95 = percentile(perRenderMs, 95)
  return {
    name: targetCase.name,
    medianMsPerRender: med,
    p95MsPerRender: p95,
    rendersPerSec: med > 0 ? 1000 / med : 0,
  }
}

const main = () => {
  const config = parseArgs(process.argv.slice(2))
  console.log('Renderer fence performance benchmark')
  console.log(`samples=${config.samples} iterations=${config.iterations}`)
  console.log('')
  for (const targetCase of cases) {
    const result = benchCase(targetCase, config)
    const med = result.medianMsPerRender.toFixed(4)
    const p95 = result.p95MsPerRender.toFixed(4)
    const rps = Math.round(result.rendersPerSec)
    console.log(`${result.name.padEnd(22)} median=${med}ms  p95=${p95}ms  ${rps} renders/s`)
  }
}

main()
