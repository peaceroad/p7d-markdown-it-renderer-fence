import {
  getInfoAttr,
} from '../utils/attr-utils.js'

const lineNotesRuleName = 'renderer_fence_line_notes'
const lineNotesMetaKey = '__rendererFenceLineNotes'
const lineNotesInstalledKey = '__rendererFenceLineNotesInstalled'
const fenceInfoNameReg = /^([^{\s]*)/
const lineNoteHeaderReg = /^\s*([1-9]\d*)(?:\s*-\s*([1-9]\d*))?\s*[:：]\s*(.*)$/
const lineNoteContinuationReg = /^(?: {2,}|\t)/
const lineNoteFenceNameSet = new Set(['line-notes', 'notes'])
const lineNoteAttrsReg = /^(.*?)(?:\s+\{([^{}]+)\})\s*$/
const lineNoteAttrsOnlyReg = /^\{([^{}]+)\}\s*$/
const lineNoteWidthReg = /^(?:\d+(?:\.\d+)?|\.\d+)(?:px|em|rem|ch|vw|svw|lvw|dvw|%)$/

const getFenceInfoName = (info) => {
  const match = String(info ?? '').trim().match(fenceInfoNameReg)
  return match ? match[1] : ''
}

const stripContinuationIndent = (line) => {
  if (!line) return ''
  if (line[0] === '\t') return line.slice(1)
  if (line.startsWith('  ')) return line.slice(2)
  return line
}

const parseValidatedLineNoteWidth = (attrText) => {
  if (!attrText || attrText.indexOf('width') === -1) return ''
  const attrs = getInfoAttr(attrText)
  if (!attrs.length) return ''
  for (let i = 0; i < attrs.length; i++) {
    const name = attrs[i][0]
    const value = String(attrs[i][1] || '').trim()
    if (name !== 'width') continue
    if (lineNoteWidthReg.test(value)) return value
  }
  return ''
}

const parseLineNoteHeaderText = (text) => {
  const str = String(text ?? '')
  if (str.indexOf('{') === -1 || str.indexOf('}') === -1) {
    return { text: str, width: '' }
  }
  const match = str.match(lineNoteAttrsReg)
  if (!match) return { text: str, width: '' }
  return {
    text: match[1].trimEnd(),
    width: parseValidatedLineNoteWidth(match[2]),
  }
}

const parseLineNoteAttrsOnlyText = (text) => {
  const str = String(text ?? '').trim()
  if (str[0] !== '{' || str[str.length - 1] !== '}') return null
  const match = str.match(lineNoteAttrsOnlyReg)
  if (!match) return null
  const width = parseValidatedLineNoteWidth(match[1])
  return width ? { width } : null
}

const parseLineNotesContent = (content) => {
  const raw = String(content ?? '')
  if (!raw || (raw.indexOf(':') === -1 && raw.indexOf('：') === -1)) return []
  const lines = raw.split('\n')
  const notes = []
  const seenStarts = new Set()
  let current = null

  const pushCurrent = () => {
    if (!current) return true
    if (!current.lines.length) return false
    notes.push({
      from: current.from,
      to: current.to,
      text: current.lines.join('\n'),
      lineCount: current.lines.length,
      width: current.width || '',
    })
    seenStarts.add(current.from)
    current = null
    return true
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const header = line.match(lineNoteHeaderReg)
    if (header) {
      if (!pushCurrent()) return null
      let from = Number(header[1])
      let to = header[2] ? Number(header[2]) : from
      if (from > to) {
        const swap = from
        from = to
        to = swap
      }
      if (seenStarts.has(from)) return null
      current = {
        from,
        to,
        lines: [],
        width: '',
      }
      const parsed = parseLineNoteHeaderText(header[3])
      current.width = parsed.width
      if (parsed.text) current.lines.push(parsed.text)
      continue
    }

    if (current && lineNoteContinuationReg.test(line)) {
      const stripped = stripContinuationIndent(line)
      const attrsOnly = parseLineNoteAttrsOnlyText(stripped)
      if (attrsOnly) {
        if (attrsOnly.width) current.width = attrsOnly.width
        continue
      }
      current.lines.push(stripped)
      continue
    }

    if (!line.trim()) {
      continue
    }

    return null
  }

  if (!pushCurrent()) return null
  return notes
}

const getTokenLineNotes = (token) => {
  if (!token || !token.meta || typeof token.meta !== 'object') return null
  const notes = token.meta[lineNotesMetaKey]
  return Array.isArray(notes) && notes.length ? notes : null
}

const setTokenLineNotes = (token, notes) => {
  if (!token || !notes || !notes.length) return
  if (!token.meta || typeof token.meta !== 'object') token.meta = {}
  token.meta[lineNotesMetaKey] = notes
}

const extendTokenMapWithImmediateFollower = (token, next) => {
  if (!token || !Array.isArray(token.map) || token.map.length !== 2) return
  if (!next || !Array.isArray(next.map) || next.map.length !== 2) return
  const start = token.map[0]
  const end = next.map[1]
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return
  if (end > token.map[1]) token.map = [start, end]
}

const installLineNotesCoreRule = (md) => {
  if (!md || md[lineNotesInstalledKey]) return
  md[lineNotesInstalledKey] = true
  md.core.ruler.after('block', lineNotesRuleName, (state) => {
    const tokens = state && state.tokens
    if (!Array.isArray(tokens) || tokens.length < 2) return

    for (let i = 0; i < tokens.length - 1; i++) {
      const token = tokens[i]
      const next = tokens[i + 1]
      if (!token || token.type !== 'fence' || !next || next.type !== 'fence') continue
      const nextName = getFenceInfoName(next.info)
      if (!lineNoteFenceNameSet.has(nextName)) continue
      const currentName = getFenceInfoName(token.info)
      if (lineNoteFenceNameSet.has(currentName)) continue
      const notes = parseLineNotesContent(next.content)
      if (!notes || !notes.length) continue
      setTokenLineNotes(token, notes)
      extendTokenMapWithImmediateFollower(token, next)
      tokens.splice(i + 1, 1)
    }
  })
}

export {
  getTokenLineNotes,
  installLineNotesCoreRule,
}
