const fenceStartTag = (token, tagName, opt) => {
  let idAttr = [], classAttr = [], dataAttrs = [], styleAttr = [], otherAttrs = []
  let hasClass = false
  if (token.attrs) {
    //console.log('start: ' +token.attrs)
    for (let attr of token.attrs) {
      if (attr[0] === 'id') {
        idAttr.push(attr)
      } else if (attr[0] === 'class') {
        hasClass = true
        classAttr.push([attr[0], opt.langPrefix + token.info + ' ' + attr[1]])
      } else if (attr[0].startsWith('data-')) {
        dataAttrs.push(attr)
      } else if (attr[0] === 'style') {
        styleAttr.push(attr)
      } else {
        otherAttrs.push(attr)
      }
    }
  }
  if (!hasClass) classAttr.push(['class', opt.langPrefix + token.info])
  let orderedAttrs = [...idAttr, ...classAttr, ...dataAttrs, ...styleAttr, ...otherAttrs]
  //console.log(orderedAttrs)
  let tag = '<' + tagName
  for (let attr of orderedAttrs) {
    tag += ' ' + attr[0] + '="' + attr[1] + '"'
  }
  return tag + '>'
};

const splitFenceBlockToLines = (token, content) => {
  const br = content.match(/\r?\n/)
  const lines = content.split(/r?\n/)
  let hasCodeLineStart = false
  let styleIndex = -1
  let dataIndex = -1
  let setNumber = -1
  if (token.attrs) {
    token.attrs.forEach((attr, i) => {
      if (attr[i][0] === 'style') styleIndex = i
      hasCodeLineStart = (/^(?:(?:data-)?pre-)?start$/.test(attr[0]))
      if (hasCodeLineStart) dataIndex = i
    })
  }
  if (!hasCodeLineStart && setNumber === -1) return content
  token.attrs[dataIndex][0] = 'data-pre-start'
  setNumber = token.attrs[dataIndex][1]

  if (styleIndex === -1) {
    token.attrs.push(['style', 'counter-set:pre-line-number ' + setNumber + ';'])
  } else {
    token.attrs[styleIndex][1] = token.attrs[styleIndex][1].replace(/;?$/, '; counter-set:pre-line-number ' + setNumber + ';')
  }
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

const getFenceHtml = (tokens, idx, env, slf, md, options) => {
  const opt = {
    setHighlight: true,
    setLineNumber: true,
    langPrefix: 'language-',
    highlight: null,
  }
  if (options) Object.assign(opt, options)

  const token = tokens[idx]
  //console.log(token)
  let content = token.content
  if (md.options.highlight) {
    if (token.info !== 'samp' && opt.setHighlight) {
      content = md.options.highlight(token.content, token.info)
    } else {
      content = md.utils.escapeHtml(token.content)
    }
  } else {
    content = md.utils.escapeHtml(token.content)
  }
  if (opt.setLineNumber) {
    content = splitFenceBlockToLines(token, content)
  }

  let fenceHtml = '<pre>'
  if (token.info === 'samp') {
    fenceHtml += '<samp>'
  } else if (token.info === 'shell' || token.info === 'console') {
    fenceHtml += fenceStartTag(token, 'samp', opt);
  } else {
    fenceHtml += fenceStartTag(token, 'code', opt);
  }
  fenceHtml += content
  if (token.info === 'samp') {
    fenceHtml += '</samp>'
  } else if (token.info === 'shell' || token.info === 'console') {
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