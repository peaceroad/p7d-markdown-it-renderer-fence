import { performance } from 'node:perf_hooks'
import mdit from 'markdown-it'
import mditAttrs from 'markdown-it-attrs'
import highlightjs from 'highlight.js'
import { createHighlighter } from 'shiki'
import mditRendererFence from '../../index.js'

const parseArgs = (argv) => {
  const out = {
    lines: 220,
    warmup: 30,
    loops: 260,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--lines') out.lines = Math.max(1, Number(argv[++i] || out.lines))
    else if (arg === '--warmup') out.warmup = Math.max(0, Number(argv[++i] || out.warmup))
    else if (arg === '--loops') out.loops = Math.max(1, Number(argv[++i] || out.loops))
  }
  return out
}

const makeCode = (lines) => {
  const rows = []
  for (let i = 0; i < lines; i++) rows.push(`const v${i} = Math.max(${i}, ${i + 1})`)
  return rows.join('\n')
}

const runTimed = (name, warmup, loops, fn) => {
  for (let i = 0; i < warmup; i++) fn()
  const t0 = performance.now()
  for (let i = 0; i < loops; i++) fn()
  const t1 = performance.now()
  const msPerRun = (t1 - t0) / loops
  console.log(`${name.padEnd(28)} ${msPerRun.toFixed(3)} ms`)
}

const main = async () => {
  const cfg = parseArgs(process.argv.slice(2))
  const code = makeCode(cfg.lines)
  const markdown = `\`\`\`javascript {start="1"}\n${code}\n\`\`\`\n`

  const tInit0 = performance.now()
  const shiki = await createHighlighter({
    themes: ['github-light'],
    langs: ['javascript'],
  })
  const tInit1 = performance.now()

  const hljsHighlight = (str, lang) => {
    if (lang && highlightjs.getLanguage(lang)) {
      try {
        return highlightjs.highlight(str, { language: lang }).value
      } catch {}
    }
    return str
  }
  const shikiInlineHighlight = (str, lang) => {
    if (lang === 'javascript') {
      const html = shiki.codeToHtml(str, {
        lang: 'javascript',
        theme: 'github-light',
        structure: 'inline',
      })
      return html.replace(/<br\s*\/?>/g, '\n')
    }
    return str
  }
  const shikiClassicHighlight = (str, lang) => {
    if (lang === 'javascript') {
      return shiki.codeToHtml(str, {
        lang: 'javascript',
        theme: 'github-light',
        structure: 'classic',
      })
    }
    return str
  }

  const mdHljs = mdit({
    html: true,
    langPrefix: 'language-',
    highlight: hljsHighlight,
  }).use(mditRendererFence).use(mditAttrs)

  const mdShikiInline = mdit({
    html: true,
    langPrefix: 'language-',
    highlight: shikiInlineHighlight,
  }).use(mditRendererFence).use(mditAttrs)

  const mdShikiClassicPass = mdit({
    html: true,
    langPrefix: 'language-',
    highlight: shikiClassicHighlight,
  }).use(mditRendererFence, { useHighlightPre: true }).use(mditAttrs)

  console.log('Highlighter benchmark')
  console.log(`lines=${cfg.lines} warmup=${cfg.warmup} loops=${cfg.loops}`)
  console.log(`shiki init                     ${(tInit1 - tInit0).toFixed(1)} ms`)
  console.log('')
  console.log('highlighter-only:')
  runTimed('highlight.js', cfg.warmup, cfg.loops, () => hljsHighlight(code, 'javascript'))
  runTimed('shiki inline', cfg.warmup, cfg.loops, () => shikiInlineHighlight(code, 'javascript'))
  runTimed('shiki classic', cfg.warmup, cfg.loops, () => shikiClassicHighlight(code, 'javascript'))
  console.log('')
  console.log('markdown-it render:')
  runTimed('hljs + renderer-fence', cfg.warmup, cfg.loops, () => mdHljs.render(markdown))
  runTimed('shiki inline + renderer-fence', cfg.warmup, cfg.loops, () => mdShikiInline.render(markdown))
  runTimed('shiki classic + useHighlightPre', cfg.warmup, cfg.loops, () => mdShikiClassicPass.render(markdown))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
