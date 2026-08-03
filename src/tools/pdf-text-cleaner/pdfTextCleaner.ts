export interface PdfTextCleanerOptions {
  removeCjkLatinSpaces: boolean
}

const cjkCharacter = '[\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff]'
const cjkPunctuation = '[\\u3000-\\u303f\\uff00-\\uffef]'
const cjkToken = `(?:${cjkCharacter}|${cjkPunctuation})`
const listStart = /^(?:[•●]\s*|[-*]\s+|\d+[.)]\s+|（\d+）\s*)/
const technicalLineStart = /^(?:minSdk|compileSdk|targetSdk)\b/
const shortLabels = ['谁：', '什么：', '地点：', '原因：']
const standaloneUrl = /^https?:\/\/\S+$/i
const standaloneEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const standaloneCode = /^(?:(?:const|let|var)\s+\w+\s*=.+;|[\w$.]+\s*=.+;)$/
const englishNumberedHeading = /^\d+\.\s+[A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)*$/
const chineseNumberedHeading = /^(?:[一二三四五六七八九十]+、|（[一二三四五六七八九十]+）|\d+、)[\u3400-\u4dbf\u4e00-\u9fff]/
const codeStart = /^(?:(?:const|let|var|function|import|export)\b|[A-Za-z_$][\w$]*(?:\.[\w$]+)*\s*\()/
const codeEnd = /^[)\]};,]+$/

type LineType =
  | 'blank'
  | 'numbered-heading'
  | 'heading'
  | 'label-heading'
  | 'list-item'
  | 'standalone-url'
  | 'standalone-email'
  | 'code-line'
  | 'prose'

function isCjkToken(value: string): boolean {
  return new RegExp(`^${cjkToken}$`).test(value)
}

function shouldKeepListItemSeparate(value: string): boolean {
  const content = value.replace(listStart, '').replace(/[ \t]+/g, '')
  return content.length > 0 && content.length <= 4 && /^[\u3400-\u4dbf\u4e00-\u9fff]+$/.test(content)
}

function isNumberedHeading(line: string): boolean {
  return englishNumberedHeading.test(line) || chineseNumberedHeading.test(line)
}

function isListItem(line: string): boolean {
  return listStart.test(line) && !isNumberedHeading(line) && !/^\d{4}\.\s+/.test(line)
}

function isLabelHeading(line: string): boolean {
  return (
    line.length > 0 &&
    line.length <= 24 &&
    /\S+[:：]$/.test(line) &&
    !standaloneUrl.test(line) &&
    !standaloneEmail.test(line) &&
    !standaloneCode.test(line)
  )
}

function isCodeLine(line: string, sourceLine: string, inCodeBlock: boolean): boolean {
  if (standaloneCode.test(line) || codeStart.test(line) || codeEnd.test(line)) {
    return true
  }

  if (!inCodeBlock) {
    return false
  }

  return (
    /^\s+/.test(sourceLine) ||
    /^(?:["'].*[;)]|[A-Za-z_$][\w$]*[),;]?)$/.test(line)
  )
}

function isLikelyHeading(line: string, nextLine: string | undefined): boolean {
  if (!nextLine || line.length > 40 || /[.!?。！？；;]$/.test(line)) {
    return false
  }

  const next = nextLine.trim()
  if (!next || isListItem(next) || standaloneUrl.test(next) || standaloneEmail.test(next) || standaloneCode.test(next)) {
    return false
  }

  return (
    (/^[\u3400-\u4dbf\u4e00-\u9fff]{2,8}$/.test(line) || /^[A-Z][A-Za-z0-9&' -]{0,39}$/.test(line)) &&
    !technicalLineStart.test(line)
  )
}

function classifyLine(line: string, nextLine: string | undefined, sourceLine: string, inCodeBlock: boolean): LineType {
  if (!line) return 'blank'
  if (isNumberedHeading(line)) return 'numbered-heading'
  if (isLabelHeading(line)) return 'label-heading'
  if (standaloneUrl.test(line)) return 'standalone-url'
  if (standaloneEmail.test(line)) return 'standalone-email'
  if (isCodeLine(line, sourceLine, inCodeBlock)) return 'code-line'
  if (isListItem(line)) return 'list-item'
  if (isLikelyHeading(line, nextLine)) return 'heading'
  return 'prose'
}

function isStandaloneStructure(type: LineType): boolean {
  return (
    type === 'numbered-heading' ||
    type === 'heading' ||
    type === 'label-heading' ||
    type === 'standalone-url' ||
    type === 'standalone-email'
  )
}

function hasCjkContent(value: string): boolean {
  return /[\u3400-\u4dbf\u4e00-\u9fff]/.test(value)
}

function endsWithSentencePunctuation(value: string): boolean {
  return /(?:[。！？]|……|[.!?])\s*(?:[”’」』])?$/.test(value)
}

function looksLikeIndependentSentence(value: string): boolean {
  return (
    (isNegativeSentence(value) || isMathExpression(value) || /^\d+\.\d+\s+.+[.!?]$/.test(value)) ||
    (hasCjkContent(value) && endsWithSentencePunctuation(value) && value.length <= 80) ||
    (/^[A-Z].*[.!?]$/.test(value) && value.length <= 60)
  )
}

function isNegativeSentence(value: string): boolean {
  return /^-\d+(?:\.\d+)?\s+.+[.!?]$/.test(value)
}

function isMathExpression(value: string): boolean {
  return /^\d+(?:\.\d+)?\s*[+\-*/]\s*\d+(?:\.\d+)?\s*=\s*.+[.!?]?$/.test(value)
}

function isStandaloneSymbolLine(value: string): boolean {
  return (
    /^\$\s*\d+(?:\.\d+)?$/.test(value) ||
    /^\d+(?:\.\d+)?\s*%$/.test(value) ||
    /^\d+\s*:\s*\d+$/.test(value) ||
    /^[vV]\s*\d+(?:\.\d+)+$/.test(value)
  )
}

function shouldPreserveShortSentenceBreak(current: string, currentType: LineType, next: string): boolean {
  return (
    currentType === 'prose' &&
    current.length <= 100 &&
    endsWithSentencePunctuation(current) &&
    looksLikeIndependentSentence(next)
  )
}

function joinLines(previous: string, next: string): string {
  const left = previous.trimEnd()
  const right = next.trimStart()
  const lastCharacter = left.at(-1) ?? ''
  const firstCharacter = right[0] ?? ''

  if (
    isCjkToken(lastCharacter) ||
    isCjkToken(firstCharacter) ||
    /^[,.;:!?)}\]，。；：？！、】【）》]/.test(firstCharacter) ||
    /[([{（【《]$/.test(lastCharacter)
  ) {
    return `${left}${right}`
  }

  return `${left} ${right}`
}

function cleanLineSpacing(value: string, removeCjkLatinSpaces: boolean): string {
  let cleaned = value.replace(/[ \t]+/g, ' ').replace(/(\d)\s*\.\s*(\d)/g, '$1.$2')
  const cjkSpacePattern = new RegExp(`(${cjkToken})[ \\t]+(${cjkToken})`, 'g')

  while (cjkSpacePattern.test(cleaned)) {
    cleaned = cleaned.replace(cjkSpacePattern, '$1$2')
  }

  if (removeCjkLatinSpaces) {
    const latinToken = '[A-Za-z0-9]'
    cleaned = cleaned
      .replace(new RegExp(`(${cjkToken})[ \\t]+(${latinToken})`, 'g'), '$1$2')
      .replace(new RegExp(`(${latinToken})[ \\t]+(${cjkToken})`, 'g'), '$1$2')
  }

  return cleaned
    .replace(/\$[ \t]+(?=\d)/g, '$')
    .replace(/(\d)[ \t]+%/g, '$1%')
    .replace(/(\d)[ \t]*:[ \t]*(\d)/g, '$1:$2')
    .replace(/\b([vV])[ \t]+(?=\d+(?:\.\d+)+)/g, '$1')
    .replace(/[ \t]+(?=[，。！？；：、）】》」』])/g, '')
    .replace(/[ \t]+(?=[“‘「『])/g, '')
    .replace(/([“‘「『])[ \t]+/g, '$1')
    .replace(/[ \t]+(?=[”’」』])/g, '')
    .replace(/\s+([,.;:!?)}\]])/g, '$1')
}

function cleanSpacing(value: string, removeCjkLatinSpaces: boolean): string {
  let inCodeBlock = false

  return value
    .split('\n')
    .map((line) => {
      const isCode = isCodeLine(line.trim(), line, inCodeBlock)
      if (isCode) {
        inCodeBlock = true
        return line
      }

      inCodeBlock = false
      return standaloneUrl.test(line) || standaloneEmail.test(line) ? line : cleanLineSpacing(line, removeCjkLatinSpaces)
    })
    .join('\n')
}

function restoreShortLabels(value: string): string {
  const labels = shortLabels.join('|')
  return value.replace(new RegExp(`([^\\n])(${labels})`, 'g'), '$1\n$2')
}

function restoreChineseStructure(value: string): string {
  const chineseChapter = /(^|\n)((?:[一二三四五六七八九十]+、|（[一二三四五六七八九十]+）)[\u3400-\u4dbf\u4e00-\u9fff]{4})(?=[\u3400-\u4dbf\u4e00-\u9fff])/g
  const inlineChineseLabel = /(^|\n|[A-Za-z0-9])([\u3400-\u4dbf\u4e00-\u9fff]{2,8}[：:])/g
  let restored = restoreShortLabels(value)
    .replace(chineseChapter, '$1$2\n')
    .replace(/([^\n])(?=\d+、)/g, '$1\n')
    .replace(inlineChineseLabel, (match, prefix, label, offset, source) => {
      const nextCharacter = source[offset + match.length]
      if (prefix === '' || prefix === '\n' || /^[“‘「『]/.test(nextCharacter ?? '')) {
        return `${prefix}${label}`
      }
      return `${prefix}\n${label}`
    })

  const restoredLines = restored.split('\n')
  restored = restoredLines
    .flatMap((line, index) => {
      const match = line.match(/^([\u3400-\u4dbf\u4e00-\u9fff]{2,6}[：:])([\u3400-\u4dbf\u4e00-\u9fff].*[。！？])$/)
      const nextLine = restoredLines[index + 1] ?? ''
      const nextIsProseLabel = /^[\u3400-\u4dbf\u4e00-\u9fff]{2,6}[：:][\u3400-\u4dbf\u4e00-\u9fff].*[。！？]$/.test(nextLine)
      return match ? (nextIsProseLabel ? [match[1], match[2], ''] : [match[1], match[2]]) : [line]
    })
    .join('\n')

  return restored
}

export function cleanPdfText(input: string, options: PdfTextCleanerOptions): string {
  const normalized = input.replace(/\r\n?|\n/g, '\n')
  const lines = normalized.split('\n')
  const output: string[] = []
  let current = ''
  let currentType: LineType = 'blank'
  let preserveFollowingLineBreak = false

  function flushCurrent() {
    if (current) {
      output.push(current)
      current = ''
      currentType = 'blank'
      preserveFollowingLineBreak = false
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const sourceLine = lines[index] ?? ''
    const trimmedLine = sourceLine.trim()
    const type = classifyLine(trimmedLine, lines[index + 1], sourceLine, currentType === 'code-line')
    const line = type === 'code-line' ? sourceLine.trimEnd() : trimmedLine

    if (type === 'blank') {
      flushCurrent()
      if (output.length > 0 && output.at(-1) !== '') {
        output.push('')
      }
      continue
    }

    if (!current) {
      current = line
      currentType = type
      continue
    }

    if (currentType === 'code-line') {
      if (type === 'code-line') {
        current = `${current}\n${line}`
        continue
      }

      flushCurrent()
      current = line
      currentType = type
      continue
    }

    if (preserveFollowingLineBreak) {
      flushCurrent()
      current = line
      currentType = type
      continue
    }

    if (isStandaloneStructure(currentType) || (currentType !== 'list-item' && current.endsWith('-'))) {
      flushCurrent()
      current = line
      currentType = type
      preserveFollowingLineBreak = true
      continue
    }

    if (type === 'code-line' || type === 'list-item' || isStandaloneStructure(type)) {
      flushCurrent()
      current = line
      currentType = type
      continue
    }

    if (isStandaloneSymbolLine(current) || isStandaloneSymbolLine(line)) {
      flushCurrent()
      current = line
      currentType = type
      continue
    }

    if (currentType === 'list-item' && line.endsWith('-')) {
      flushCurrent()
      current = line
      currentType = type
      continue
    }

    if (
      currentType === 'list-item' &&
      (isNegativeSentence(line) || isMathExpression(line) || (!/^\s+/.test(sourceLine) && looksLikeIndependentSentence(line)))
    ) {
      flushCurrent()
      current = line
      currentType = type
      continue
    }

    if (currentType === 'list-item' && shouldKeepListItemSeparate(current)) {
      flushCurrent()
      current = line
      currentType = type
      continue
    }

    if (technicalLineStart.test(line)) {
      flushCurrent()
      current = line
      currentType = type
      continue
    }

    if (shouldPreserveShortSentenceBreak(current, currentType, line)) {
      flushCurrent()
      current = line
      currentType = type
      continue
    }

    current = joinLines(current, line)
  }

  flushCurrent()

  return restoreChineseStructure(cleanSpacing(output.join('\n'), options.removeCjkLatinSpaces)).trim()
}
