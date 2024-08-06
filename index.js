//import highlightjs from 'highlight.js'

const fenceStartTag = (tagName, sAttr) => {
  let orderedAttrs = [...sAttr.id, ...sAttr.clas, ...sAttr.data, ...sAttr.style, ...sAttr.other]
  //console.log(orderedAttrs)
  let tag = '<' + tagName
  for (let attr of orderedAttrs) {
    if (attr[0]) tag += ' ' + attr[0] + '="' + attr[1] + '"'
  }
  return tag + '>'
}

const splitFenceBlockToLines = (token, content) => {
  const br = content.match(/\r?\n/)
  const lines = content.split(/r?\n/)
  lines.map((line, n) => {
    const lastElementTag = line.match(/<(\w+)( +[^>]*?)>[^>]*?(<\/\1>)?[^>]*?$/)
    if (lastElementTag && !lastElementTag[3]) {
      line += '</span>'
      if (n < lines.length - 2) {
        lines[n + 1] = `<${lastElementTag[1]}${lastElementTag[2]}>` + lines[n + 1]
      }
    }
    if (n < lines.length - 1) {
      lines[n] = '<span class="pre-line">' + line + '</span>'
    }
  })
  return lines.join(br)
}

const setInfoAttr = (infoAttr) => {
  let arr = []
  let attrSets = infoAttr.trim().split(/ +/)
  for (let attrSet of attrSets) {
    const str = attrSet.match(/^(?:([.#])(.+)|(.+?)(?:=("')?(.*?)\1?)?)$/)
    if (str) {
      //console.log(str)
      if (str[1] === '.') str[1] = 'class'
      if (str[1] === '#') str[1] = 'id'
      if (str[3]) {
        str[1] = str[3]
        str[2] = str[5] ? str[5].replace(/^['"]/, '').replace(/['"]$/, '') : ''
      }
      arr.push([str[1], str[2]])
    }
  }
  return arr
}

const getFenceHtml = (tokens, idx, env, slf, md, options) => {
  const opt = {
    setHighlight: true,
    setLineNumber: true,
    langPrefix: 'language-',
    highlight: null,
  }
  if (options) Object.assign(opt, options)

  const token = tokens[idx]
  let content = token.content
  const infoAttr = token.info.trim().match(/{(.*)}$/)
  if(infoAttr) {
    token.attrs = token.attrs ? [...token.attrs, ...setInfoAttr(infoAttr[1])] : setInfoAttr(infoAttr[1])
  }

  let lang = token.info.trim().replace(/ *({.*)?$/, '')
  const langClass = lang && token.info !== 'samp' ? opt.langPrefix + lang : ''
  let sAttr = {id: [], clas: [], data: [], style: [], other: []}
  let hasPreLineStart = false
  let preLineStart = -1
  if (token.attrs) {
    //console.log('start: ' +token.attrs)
    for (let attr of token.attrs) {
      if (attr[0] === 'id') {
        sAttr.id.push(attr)
      } else if (attr[0] === 'class') {
        const sAttrClass = langClass ? langClass + ' ' + attr[1] : attr[1]
        const hasLang = attr[1].match(new RegExp('(?:^| )' + opt.langPrefix + '(.*)(?: |$)'))
        if (hasLang) lang = hasLang[1]
        sAttr.clas.push([attr[0], sAttrClass])
      } else if (attr[0].startsWith('data-') || /^(?:pre-)?start$/.test(attr[0])) {
        if (/^(?:(?:data-)?pre-)?start$/.test(attr[0])) {
          hasPreLineStart = true
          preLineStart = attr[1]
          attr[0] = 'data-pre-start'
        }
        sAttr.data.push(attr)
      } else if (attr[0] === 'style') {
        sAttr.style.push(attr)
      } else {
        sAttr.other.push(attr)
      }
    }
  }
  if (sAttr.clas.length === 0 && langClass !== '') sAttr.clas.push(['class', langClass])
  if (hasPreLineStart && preLineStart !== -1) {
    if (sAttr.style.length === 0) {
      sAttr.style.push(['style', 'counter-set:pre-line-number ' + preLineStart + ';'])
    } else {
      sAttr.style[0][1] = sAttr.style[0][1].replace(/;?$/, '; counter-set:pre-line-number ' + preLineStart + ';')
    }
  }
  //console.log(JSON.stringify(sAttr))
  if (opt.setHighlight && md.options.highlight) {
    if (lang && lang !== 'samp' ) {
      content = md.options.highlight(content, lang)
      /*
      try {
        content = highlightjs.highlight(token.content, {language: lang}).value
      } catch (__) {}
      */
    } else {
      content = md.utils.escapeHtml(token.content)
    }
  } else {
    content = md.utils.escapeHtml(token.content)
  }
  if (opt.setLineNumber && hasPreLineStart) {
    content = splitFenceBlockToLines(token, content)
  }

  let fenceHtml = '<pre>'
  let isSamp = /^(?:samp|shell|console)$/.test(lang)
  if (isSamp) {
    fenceHtml += fenceStartTag('samp', sAttr)
  } else {
    fenceHtml += fenceStartTag('code', sAttr)
  }

  fenceHtml += content
  if (isSamp) {
    fenceHtml += '</samp>'
  } else {
    fenceHtml += '</code>'
  }
  return fenceHtml + '</pre>\n'
}

const mditRendererFence = (md, options) => {
  md.renderer.rules['fence'] = (tokens, idx, env, slf) => {
    return getFenceHtml(tokens, idx, env, slf, md, options)
  }
}

export default mditRendererFence