import assert from 'assert'
import fs from 'fs'
import path from 'path'
import mdit from 'markdown-it'

import mditFigureWithPCaption from '@peaceroad/markdown-it-figure-with-p-caption'
import mditRendererFence from '../index.js'
import mditAttrs from 'markdown-it-attrs'
import highlightjs from 'highlight.js'


let opt = {}

const md = mdit({ html: true }).use(mditRendererFence).use(mditAttrs)
const mdHighlightJs = mdit({
  html: true,
  langPrefix: 'language-',
  typographer: false,
  highlight: (str, lang) => {
    if (lang && highlightjs.getLanguage(lang)) {
      try {
        return highlightjs.highlight(str, { language: lang }).value
      } catch (__) {}
    }
    return str
  }
}).use(mditRendererFence, opt).use(mditAttrs)
const mdLinesEmphasis = mdit({ html: true }).use(mditRendererFence).use(mditAttrs)
const mdLIneEndSpan = mdit({ html: true }).use(mditRendererFence, {setLineEndSpan: 8}).use(mditAttrs)

let __dirname = path.dirname(new URL(import.meta.url).pathname)
const isWindows = (process.platform === 'win32')
if (isWindows) {
  __dirname = __dirname.replace(/^\/+/, '').replace(/\//g, '\\')
}

const testData = {
  noOption: __dirname + path.sep +  'examples.txt',
  highlightjs: __dirname + path.sep +  'examples-highlightjs.txt',
  linesEmphasis: __dirname + path.sep +  'example-lines-emphasis.txt',
  lineEndSpan: __dirname + path.sep +  'example-line-end-span.txt',
}

const getTestData = (pat) => {
  let ms = [];
  if(!fs.existsSync(pat)) {
    console.log('No exist: ' + pat)
    return ms
  }
  const exampleCont = fs.readFileSync(pat, 'utf-8').trim();

  let ms0 = exampleCont.split(/\n*\[Markdown\]\n/);
  let n = 1;
  while(n < ms0.length) {
    let mhs = ms0[n].split(/\n+\[HTML[^\]]*?\]\n/);
    let i = 1;
    while (i < 2) {
      if (mhs[i] === undefined) {
        mhs[i] = '';
      } else {
        mhs[i] = mhs[i].replace(/$/,'\n');
      }
      i++;
    }
    ms[n] = {
      "markdown": mhs[0],
      "html": mhs[1],
    };
    n++;
  }
  return ms
}

const runTest = (process, pat, pass, testId) => {
  console.log('===========================================================')
  console.log(pat)
  let ms = getTestData(pat)
  if (ms.length === 0) return
  let n = 1;
  let end = ms.length - 1
  if(testId) {
    if (testId[0]) n = testId[0]
    if (testId[1]) {
      if (ms.length >= testId[1]) {
        end = testId[1]
      }
    }
  }
  //console.log(n, end)

  while(n <= end) {
    if (!ms[n]
    //|| n != 14
    ) {
      n++
      continue
    }

    const m = ms[n].markdown;
    const h = process.render(m)
    console.log('Test: ' + n + ' >>>');
    try {
      assert.strictEqual(h, ms[n].html);
    } catch(e) {
      pass = false
      //console.log('Test: ' + n + ' >>>');
      //console.log(opt);
      console.log(ms[n].markdown);
      console.log('incorrect:');
      console.log('H: ' + h +'C: ' + ms[n].html);
    }
    n++;
  }
  return pass
}

let pass = true
pass = runTest(md, testData.noOption, pass)
pass = runTest(mdHighlightJs, testData.highlightjs, pass)
pass = runTest(mdLinesEmphasis, testData.linesEmphasis, pass)
pass = runTest(mdLIneEndSpan, testData.lineEndSpan, pass)

if (pass) console.log('Passed all test.')
