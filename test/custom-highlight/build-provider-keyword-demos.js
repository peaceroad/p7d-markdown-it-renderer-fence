import fs from 'fs'
import path from 'path'
import mdit from 'markdown-it'
import mditAttrs from 'markdown-it-attrs'
import highlightjs from 'highlight.js'
import { createHighlighter } from 'shiki'

import mditRendererFence, { renderCustomHighlightPayloadScript } from '../../index.js'

const __dirname = path.dirname(new URL(import.meta.url).pathname)
const isWindows = process.platform === 'win32'
const baseDir = isWindows ? __dirname.replace(/^\/+/, '').replace(/\//g, '\\') : __dirname

const fixtures = JSON.parse(fs.readFileSync(path.join(baseDir, 'provider-keyword-fixtures.json'), 'utf-8'))
const langs = Array.from(new Set(fixtures.map((f) => String(f.lang || '').trim()).filter(Boolean)))

const shikiHighlighter = await createHighlighter({
  themes: ['github-light'],
  langs,
})

const markdown = fixtures.map((fixture) => {
  const id = String(fixture.id || fixture.lang || 'sample')
  const lang = String(fixture.lang || '')
  const code = String(fixture.code || '')
  const body = code.endsWith('\n') ? code : code + '\n'
  return `## ${id}\n\`\`\`${lang}\n${body}\`\`\``
}).join('\n\n') + '\n'

const createMdShikiKeyword = () => mdit({ html: true, langPrefix: 'language-' })
  .use(mditAttrs)
  .use(mditRendererFence, {
    highlightRenderer: 'api',
    customHighlight: {
      provider: 'shiki',
      highlighter: shikiHighlighter,
      theme: 'github-light',
      includeScopeStyles: false,
      shikiScopeMode: 'keyword',
    },
  })

const createMdHljs = () => mdit({ html: true, langPrefix: 'language-' })
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

const commonCss = `
    body { margin: 24px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    h1 { margin: 0 0 16px; }
    h2 { margin: 24px 0 8px; font-size: 20px; }
    pre { padding: 12px; border-radius: 8px; background: #f6f8fa; overflow: auto; margin: 0 0 12px; }
`

const shikiBucketCss = `
    ::highlight(hl-shiki-keyword) { color: #D73A49; }
    ::highlight(hl-shiki-number) { color: #005CC5; }
    ::highlight(hl-shiki-string) { color: #032F62; }
    ::highlight(hl-shiki-variable) { color: #24292E; }
    ::highlight(hl-shiki-variable-parameter) { color: #E36209; }
    ::highlight(hl-shiki-title-function) { color: #6F42C1; }
    ::highlight(hl-shiki-title-class) { color: #6F42C1; }
    ::highlight(hl-shiki-literal) { color: #005CC5; }
    ::highlight(hl-shiki-comment) { color: #6A737D; }
    ::highlight(hl-shiki-punctuation) { color: #24292E; }
    ::highlight(hl-shiki-meta) { color: #24292E; }
    ::highlight(hl-shiki-type) { color: #005CC5; }
    ::highlight(hl-shiki-tag) { color: #22863A; }
    ::highlight(hl-shiki-attribute) { color: #6F42C1; }
`

const hljsBucketCss = `
    ::highlight(hl-hljs-keyword) { color: #D73A49; }
    ::highlight(hl-hljs-number) { color: #005CC5; }
    ::highlight(hl-hljs-string) { color: #032F62; }
    ::highlight(hl-hljs-comment) { color: #6A737D; }
    ::highlight(hl-hljs-literal) { color: #005CC5; }
    ::highlight(hl-hljs-title-function) { color: #6F42C1; }
    ::highlight(hl-hljs-title-class) { color: #6F42C1; }
    ::highlight(hl-hljs-variable) { color: #24292E; }
    ::highlight(hl-hljs-variable-language) { color: #24292E; }
    ::highlight(hl-hljs-punctuation) { color: #24292E; }
    ::highlight(hl-hljs-tag) { color: #22863A; }
    ::highlight(hl-hljs-attr) { color: #6F42C1; }
    ::highlight(hl-hljs-attribute) { color: #6F42C1; }
`

const renderDemo = (title, css, md) => {
  const env = {}
  const blocksHtml = md.render(markdown, env)
  const payloadScript = renderCustomHighlightPayloadScript(env)
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
${commonCss}
${css}
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p id="runtime-status"></p>
  ${blocksHtml}
  ${payloadScript}
  <script src="./pre-highlight.js"></script>
  <script>
    window.applyPreHighlights({ useScopeStyles: false })
  </script>
</body>
</html>
`
}

const shikiHtml = renderDemo('Custom Highlight API Demo (Shiki Keyword Coverage)', shikiBucketCss, createMdShikiKeyword())
const hljsHtml = renderDemo('Custom Highlight API Demo (highlight.js Coverage)', hljsBucketCss, createMdHljs())

fs.writeFileSync(path.join(baseDir, 'demo-api-shiki-keyword-major.html'), shikiHtml)
fs.writeFileSync(path.join(baseDir, 'demo-api-hljs-major.html'), hljsHtml)

console.log('Generated demo-api-shiki-keyword-major.html')
console.log('Generated demo-api-hljs-major.html')
