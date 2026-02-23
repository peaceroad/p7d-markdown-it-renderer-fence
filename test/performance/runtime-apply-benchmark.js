import { performance } from 'node:perf_hooks'

import { applyCustomHighlights, clearCustomHighlights } from '../../index.js'

const parseArgs = (argv) => {
  const out = {
    samples: 7,
    iterations: 200,
    warmup: 40,
    blocks: 80,
    ranges: 6,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--samples') out.samples = Math.max(1, Number(argv[++i] || out.samples))
    else if (arg === '--iterations') out.iterations = Math.max(1, Number(argv[++i] || out.iterations))
    else if (arg === '--warmup') out.warmup = Math.max(0, Number(argv[++i] || out.warmup))
    else if (arg === '--blocks') out.blocks = Math.max(1, Number(argv[++i] || out.blocks))
    else if (arg === '--ranges') out.ranges = Math.max(1, Number(argv[++i] || out.ranges))
  }
  return out
}

const median = (arr) => {
  if (!arr.length) return 0
  const sorted = arr.slice().sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return (sorted.length % 2) ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const percentile = (arr, p) => {
  if (!arr.length) return 0
  const sorted = arr.slice().sort((a, b) => a - b)
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * (p / 100)) - 1))
  return sorted[idx]
}

const avg = (arr) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1)

const withMockHighlightApi = (run) => {
  const prevCss = globalThis.CSS
  const prevHighlight = globalThis.Highlight
  const prevRange = globalThis.Range
  const highlightStore = new Map()
  globalThis.CSS = {
    highlights: {
      set: (name, value) => {
        highlightStore.set(name, value)
      },
      delete: (name) => {
        highlightStore.delete(name)
      },
    },
  }
  globalThis.Highlight = class MockHighlight {
    constructor(...ranges) {
      this.ranges = ranges
    }
  }
  globalThis.Range = class MockRange {}
  try {
    return run()
  } finally {
    if (prevCss === undefined) delete globalThis.CSS
    else globalThis.CSS = prevCss
    if (prevHighlight === undefined) delete globalThis.Highlight
    else globalThis.Highlight = prevHighlight
    if (prevRange === undefined) delete globalThis.Range
    else globalThis.Range = prevRange
  }
}

const buildText = (idx, variant = 0) => {
  return `const value_${idx} = ${idx + variant} + ${idx + 1 + variant}; // runtime benchmark`
}

const buildRanges = (textLength, rangeCount, scopeCount, seed = 0) => {
  const out = []
  const step = Math.max(1, Math.floor(textLength / (rangeCount + 1)))
  let cursor = seed % 2
  for (let i = 0; i < rangeCount; i++) {
    const start = cursor
    const end = Math.min(textLength, start + step)
    if (end <= start) break
    out.push([i % scopeCount, start, end])
    cursor = end
  }
  if (!out.length) out.push([0, 0, Math.max(1, textLength)])
  return out
}

const createRuntimeRoot = (blockCount) => {
  const blocks = []
  const byId = new Map()
  const doc = {
    head: { appendChild: () => {} },
    documentElement: { appendChild: () => {} },
    getElementById: (id) => byId.get(id) || null,
    createElement: (tag) => ({ tagName: String(tag || '').toUpperCase(), id: '', textContent: '' }),
    createRange: () => ({ setStart: () => {}, setEnd: () => {} }),
    createTreeWalker: (node) => {
      const textNodes = Array.isArray(node.__textNodes) ? node.__textNodes : []
      let idx = 0
      return {
        nextNode: () => (idx < textNodes.length ? textNodes[idx++] : null),
      }
    },
  }

  const root = {
    ownerDocument: doc,
    querySelector: () => null,
    querySelectorAll: (selector) => {
      if (selector.includes('script[type="application/json"][data-pre-highlight]')) return []
      if (selector.includes('pre[data-pre-highlight] > code')) return blocks.map((pre) => pre.codeEl)
      if (selector === 'pre[data-pre-highlight-applied]') return blocks.filter((pre) => pre.getAttribute('data-pre-highlight-applied'))
      return []
    },
  }

  const setBlockText = (index, text) => {
    const pre = blocks[index]
    if (!pre) return
    pre.codeEl.__textNodes = [{ ownerDocument: doc, nodeValue: text }]
  }

  for (let i = 0; i < blockCount; i++) {
    const textNode = { ownerDocument: doc, nodeValue: buildText(i, 0) }
    const codeEl = { ownerDocument: doc, parentElement: null, __textNodes: [textNode] }
    Object.defineProperty(codeEl, 'firstChild', {
      get() {
        return this.__textNodes[0] || null
      },
    })
    Object.defineProperty(codeEl, 'lastChild', {
      get() {
        return this.__textNodes.length ? this.__textNodes[this.__textNodes.length - 1] : null
      },
    })
    Object.defineProperty(codeEl, 'textContent', {
      get() {
        let out = ''
        for (let n = 0; n < this.__textNodes.length; n++) out += this.__textNodes[n].nodeValue || ''
        return out
      },
    })
    const attrs = { 'data-pre-highlight': `hl-${i + 1}` }
    const pre = {
      ownerDocument: doc,
      codeEl,
      attrs,
      getAttribute: (name) => (Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null),
      setAttribute: (name, value) => {
        attrs[name] = String(value)
      },
      removeAttribute: (name) => {
        delete attrs[name]
      },
    }
    codeEl.parentElement = pre
    blocks.push(pre)
  }

  return {
    root,
    blocks,
    setBlockText,
  }
}

const buildPayloadMap = (runtime, rangeCount) => {
  const payloadMap = {}
  for (let i = 0; i < runtime.blocks.length; i++) {
    const pre = runtime.blocks[i]
    const id = pre.getAttribute('data-pre-highlight')
    const text = pre.codeEl.textContent || ''
    const scopes = ['hl-keyword', 'hl-variable', 'hl-number']
    payloadMap[id] = {
      v: 1,
      engine: 'custom',
      lang: 'js',
      offsetEncoding: 'utf16',
      newline: 'lf',
      textLength: text.length,
      scopes,
      ranges: buildRanges(text.length, rangeCount, scopes.length, 0),
    }
  }
  return payloadMap
}

const runScenario = (name, config, setup) => {
  const msSamples = []
  const appliedBlocksSamples = []
  const appliedRangesSamples = []
  const skippedSamples = []

  for (let s = 0; s < config.samples; s++) {
    const scenario = setup()
    for (let w = 0; w < config.warmup; w++) scenario.iteration(w, true)
    const t0 = performance.now()
    for (let i = 0; i < config.iterations; i++) {
      const result = scenario.iteration(i, false) || {}
      appliedBlocksSamples.push(Number(result.appliedBlocks || 0))
      appliedRangesSamples.push(Number(result.appliedRanges || 0))
      skippedSamples.push(result.skipped === true ? 1 : 0)
    }
    const t1 = performance.now()
    msSamples.push((t1 - t0) / config.iterations)
  }

  return {
    name,
    medianMs: median(msSamples),
    p95Ms: percentile(msSamples, 95),
    avgAppliedBlocks: avg(appliedBlocksSamples),
    avgAppliedRanges: avg(appliedRangesSamples),
    skipRate: avg(skippedSamples),
  }
}

const main = () => {
  const cfg = parseArgs(process.argv.slice(2))
  withMockHighlightApi(() => {
    const initial = runScenario('initial-apply', cfg, () => {
      const runtime = createRuntimeRoot(cfg.blocks)
      const payloadMap = buildPayloadMap(runtime, cfg.ranges)
      return {
        iteration: () => {
          clearCustomHighlights(runtime.root)
          return applyCustomHighlights(runtime.root, { payloadMap })
        },
      }
    })

    const unchanged = runScenario('reapply-unchanged-incremental', cfg, () => {
      const runtime = createRuntimeRoot(cfg.blocks)
      const payloadMap = buildPayloadMap(runtime, cfg.ranges)
      applyCustomHighlights(runtime.root, { payloadMap, incremental: true })
      return {
        iteration: () => applyCustomHighlights(runtime.root, { payloadMap, incremental: true }),
      }
    })

    const partial = runScenario('partial-update-incremental', cfg, () => {
      const runtime = createRuntimeRoot(cfg.blocks)
      const payloadMap = buildPayloadMap(runtime, cfg.ranges)
      const variants = new Array(runtime.blocks.length).fill(0)
      applyCustomHighlights(runtime.root, { payloadMap, incremental: true })
      return {
        iteration: (index) => {
          const blockIdx = index % runtime.blocks.length
          variants[blockIdx] = variants[blockIdx] ? 0 : 1
          const nextText = buildText(blockIdx, variants[blockIdx] ? 10 : 0)
          runtime.setBlockText(blockIdx, nextText)
          const id = `hl-${blockIdx + 1}`
          payloadMap[id] = {
            v: 1,
            engine: 'custom',
            lang: 'js',
            offsetEncoding: 'utf16',
            newline: 'lf',
            textLength: nextText.length,
            scopes: ['hl-keyword', 'hl-variable', 'hl-number'],
            ranges: buildRanges(nextText.length, cfg.ranges, 3, variants[blockIdx]),
          }
          return applyCustomHighlights(runtime.root, { payloadMap, incremental: true })
        },
      }
    })

    const rows = [initial, unchanged, partial]
    console.log('===========================================================')
    console.log('runtime-apply-benchmark')
    console.log(`blocks=${cfg.blocks} ranges/block=${cfg.ranges} samples=${cfg.samples} warmup=${cfg.warmup} iterations=${cfg.iterations}`)
    for (const row of rows) {
      console.log(
        `${row.name.padEnd(30)} median=${row.medianMs.toFixed(4)}ms p95=${row.p95Ms.toFixed(4)}ms` +
        ` avgBlocks=${row.avgAppliedBlocks.toFixed(2)} avgRanges=${row.avgAppliedRanges.toFixed(2)} skipRate=${(row.skipRate * 100).toFixed(1)}%`,
      )
    }
  })
}

main()
