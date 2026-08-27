import { removeCopyResidue } from '@/shared/text/copyResidue'

export interface PdfTextCleanerOptions {
  removeCjkLatinSpaces: boolean
  cleanCopyResidue?: boolean
}

const cjkCharacter = '[\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff]'
const cjkPunctuation = '[\\u3000-\\u303f\\uff00-\\uffef]'
const cjkToken = `(?:${cjkCharacter}|${cjkPunctuation})`
const listStart = /^(?:[•●]\s*|[-*]\s+|\d+[.)]\s+|（\d+）\s*)/
const technicalLineStart = /^(?:minSdk|compileSdk|targetSdk)\b/
const standaloneTechnicalLine = /^[A-Z][A-Za-z]*(?:\.js)?\s+\d+(?:\.\d+)*$/
const shortLabels = ['谁：', '什么：', '地点：', '原因：']
const standaloneUrl = /^https?:\/\/\S+$/i
const standaloneEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const standaloneCode = /^(?:(?:const|let|var)\s+\w+\s*=.+;|[\w$.]+\s*=.+;)$/
const englishNumberedHeading = /^\d+\.\s+[A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)*$/
const chineseNumberedHeading = /^(?:[一二三四五六七八九十]+、|（[一二三四五六七八九十]+）|\d+、)[\u3400-\u4dbf\u4e00-\u9fff]/
const codeStart = /^(?:(?:const|let|var|function|import|export)\b|[A-Za-z_$][\w$]*(?:\.[\w$]+)*\s*\()/
const codeEnd = /^[)\]};,]+$/

type LineKind =
  | 'blank'
  | 'prose'
  | 'heading-strong'
  | 'heading-weak-candidate'
  | 'heading-weak'
  | 'label-heading'
  | 'list-item'
  | 'url'
  | 'email'
  | 'code'
  | 'symbol'
  | 'technical'

interface LineInfo {
  text: string
  trimmed: string
  kind: LineKind
  indent: number
}

type BoundaryDecision = 'keep-break' | 'merge-with-space' | 'merge-without-space'

interface AssembledLine {
  text: string
  kind: LineKind
}

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

function isCodeLine(line: string, sourceLine: string): boolean {
  if (standaloneCode.test(line) || codeStart.test(line) || codeEnd.test(line)) {
    return true
  }

  if (getIndent(sourceLine) < 2) {
    return false
  }

  return /^(?:["'].*[;),]?|[A-Za-z_$][\w$]*(?:\s*:\s*.+[,]?|[),;]?))$/.test(line)
}

function isWeakHeadingCandidate(line: string): boolean {
  return (
    (/^[\u3400-\u4dbf\u4e00-\u9fff]{2,8}$/.test(line) || /^[A-Z][A-Za-z0-9&' -]{0,39}$/.test(line)) &&
    !/[.!?。！？；;]$/.test(line) &&
    !technicalLineStart.test(line)
  )
}

function getIndent(sourceLine: string): number {
  return (sourceLine.match(/^[ \t]*/)?.[0] ?? '').replace(/\t/g, '    ').length
}

function classifyLine(sourceLine: string): LineInfo {
  const trimmed = sourceLine.trim()
  const protectedDetectionText = removeCopyResidue(trimmed)
  let kind: LineKind = 'prose'

  if (!trimmed) kind = 'blank'
  else if (isNumberedHeading(trimmed)) kind = 'heading-strong'
  else if (isLabelHeading(trimmed)) kind = 'label-heading'
  else if (standaloneUrl.test(protectedDetectionText)) kind = 'url'
  else if (standaloneEmail.test(protectedDetectionText)) kind = 'email'
  else if (isCodeLine(protectedDetectionText, sourceLine)) kind = 'code'
  else if (isListItem(trimmed)) kind = 'list-item'
  else if (isStandaloneSymbolLine(trimmed)) kind = 'symbol'
  else if (technicalLineStart.test(trimmed) || standaloneTechnicalLine.test(trimmed)) kind = 'technical'
  else if (isWeakHeadingCandidate(trimmed)) kind = 'heading-weak-candidate'

  return {
    text: kind === 'code' ? sourceLine.trimEnd() : trimmed,
    trimmed,
    kind,
    indent: getIndent(sourceLine),
  }
}

function isEnglishTitleLike(value: string): boolean {
  if (!/^[A-Z][A-Za-z0-9&' -]*$/.test(value)) return false

  const connectorWords = new Set(['a', 'an', 'and', 'for', 'in', 'of', 'or', 'the', 'to'])
  const words = value.split(/[ -]+/)
  return words.every((word, index) => (index > 0 && connectorWords.has(word)) || /^[A-Z][A-Za-z0-9&']*$/.test(word))
}

function isChineseTitleLike(value: string): boolean {
  return (
    /^[\u3400-\u4dbf\u4e00-\u9fff]{2,8}$/.test(value) &&
    !/^(?:这是|这段|这个|那是|正文|下一行|本段|该段|我们|其中|以及|并且|但是|然后)/.test(value)
  )
}

function resolveWeakHeading(line: LineInfo, index: number, lines: LineInfo[]): LineKind {
  if (line.kind !== 'heading-weak-candidate') return line.kind

  const previous = lines[index - 1]
  const beforePrevious = lines[index - 2]
  const next = lines[index + 1]
  const nextCanBeBody =
    next &&
    (next.kind === 'prose' ||
      (next.kind === 'heading-weak-candidate' &&
        !isEnglishTitleLike(next.trimmed) &&
        !isChineseTitleLike(next.trimmed)))
  const englishTitle = isEnglishTitleLike(line.trimmed)
  const titleLike = englishTitle || isChineseTitleLike(line.trimmed)
  const followsClearListContinuation =
    previous?.kind === 'list-item' ||
    (beforePrevious?.kind === 'list-item' && previous?.kind === 'prose' && /^[a-z]/.test(previous.trimmed))

  if (!titleLike) return 'prose'
  if (englishTitle && /^[a-z]/.test(next?.trimmed ?? '')) return 'prose'
  if (englishTitle && followsClearListContinuation) return 'prose'
  if (!nextCanBeBody) return 'heading-weak-candidate'

  return 'heading-weak'
}

function resolveLineKinds(lines: LineInfo[]): LineInfo[] {
  return lines.map((line, index) => ({ ...line, kind: resolveWeakHeading(line, index, lines) }))
}

function isHardStructure(kind: LineKind): boolean {
  return (
    kind === 'heading-strong' ||
    kind === 'heading-weak' ||
    kind === 'label-heading' ||
    kind === 'url' ||
    kind === 'email' ||
    kind === 'code' ||
    kind === 'symbol' ||
    kind === 'technical'
  )
}

function hasCjkContent(value: string): boolean {
  return /[\u3400-\u4dbf\u4e00-\u9fff]/.test(value)
}

function endsWithSentencePunctuation(value: string): boolean {
  return /(?:[。！？]|……|[.!?])\s*(?:[”’」』])?$/.test(value)
}

function isIndependentSentence(value: string): boolean {
  return (
    (isNegativeSentence(value) || isMathExpression(value) || /^\d+\.\d+\s+.+[.!?]$/.test(value)) ||
    (hasCjkContent(value) && endsWithSentencePunctuation(value)) ||
    /^[A-Z].*[.!?]$/.test(value)
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

function shouldMergeWithoutSpace(previous: string, next: string): boolean {
  const left = previous.trimEnd()
  const right = next.trimStart()
  const lastCharacter = left.at(-1) ?? ''
  const firstCharacter = right[0] ?? ''

  return (
    isCjkToken(lastCharacter) ||
    isCjkToken(firstCharacter) ||
    /^[,.;:!?)}\]，。；：？！、】【）》]/.test(firstCharacter) ||
    /[([{（【《]$/.test(lastCharacter)
  )
}

function isClearlyListContinuation(current: LineInfo, next: LineInfo): boolean {
  if (next.kind !== 'prose') return false
  if (next.indent > current.indent) return true
  if (shouldKeepListItemSeparate(current.trimmed) || isIndependentSentence(next.trimmed)) return false
  if (/^[a-z]/.test(next.trimmed)) return true

  const listContent = current.trimmed.replace(listStart, '').trim()
  return listContent.length > 4 && /^[A-Z][A-Za-z0-9&'-]*$/.test(next.trimmed)
}

function isShortLatinToken(value: string): boolean {
  const detectionText = removeCopyResidue(value)
  return detectionText.length <= 40 && /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(detectionText)
}

function decideBoundary(current: LineInfo, next: LineInfo, previous: LineInfo | undefined): BoundaryDecision {
  if (next.kind === 'list-item') return 'keep-break'
  if ((isHardStructure(current.kind) && current.kind !== 'technical') || isHardStructure(next.kind)) return 'keep-break'
  if (current.kind === 'heading-weak-candidate' || next.kind === 'heading-weak-candidate') return 'keep-break'

  if (current.kind === 'list-item') {
    if (next.trimmed.endsWith('-')) return 'keep-break'
    if (!isClearlyListContinuation(current, next)) return 'keep-break'
  }

  if (current.trimmed.endsWith('-') || next.trimmed.endsWith('-') || previous?.trimmed.endsWith('-')) return 'keep-break'

  if (!previous && isShortLatinToken(current.trimmed) && isShortLatinToken(next.trimmed)) return 'keep-break'

  if (
    current.kind === 'prose' &&
    next.kind === 'prose' &&
    endsWithSentencePunctuation(current.trimmed) &&
    isIndependentSentence(next.trimmed)
  ) {
    return 'keep-break'
  }

  return shouldMergeWithoutSpace(current.text, next.text) ? 'merge-without-space' : 'merge-with-space'
}

function mergeLines(previous: string, next: string, decision: BoundaryDecision): string {
  const left = previous.trimEnd()
  const right = next.trimStart()
  return decision === 'merge-without-space' ? `${left}${right}` : `${left} ${right}`
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

function cleanSpacing(lines: AssembledLine[], removeCjkLatinSpaces: boolean, cleanCopyResidue: boolean): string {
  return lines
    .map((line) => {
      if (line.kind === 'code' || line.kind === 'url' || line.kind === 'email') return line.text

      const eligibleText = cleanCopyResidue ? removeCopyResidue(line.text) : line.text
      return cleanLineSpacing(eligibleText, removeCjkLatinSpaces)
    })
    .join('\n')
}

function restoreShortLabels(value: string): string {
  const labels = shortLabels.join('|')
  return value.replace(new RegExp(`([^\\n])(${labels})`, 'g'), '$1\n$2')
}

function restoreCollapsedChineseStructure(value: string): string {
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

function assembleLines(lines: LineInfo[]): AssembledLine[] {
  const output: AssembledLine[] = []
  let current: AssembledLine | undefined
  let previous: LineInfo | undefined
  let beforePrevious: LineInfo | undefined

  function flushCurrent() {
    if (current) output.push(current)
    current = undefined
  }

  for (const line of lines) {
    if (line.kind === 'blank') {
      flushCurrent()
      if (output.length > 0 && output.at(-1)?.kind !== 'blank') {
        output.push({ text: '', kind: 'blank' })
      }
      beforePrevious = undefined
      previous = undefined
      continue
    }

    if (!current || !previous) {
      current = { text: line.text, kind: line.kind }
      beforePrevious = undefined
      previous = line
      continue
    }

    const decision = decideBoundary(previous, line, beforePrevious)
    if (decision === 'keep-break') {
      flushCurrent()
      current = { text: line.text, kind: line.kind }
    } else {
      current.text = mergeLines(current.text, line.text, decision)
    }
    beforePrevious = previous
    previous = line
  }

  flushCurrent()
  return output
}

export function cleanPdfText(input: string, options: PdfTextCleanerOptions): string {
  const withoutLeadingBom = input.startsWith('\uFEFF') ? input.slice(1) : input
  const normalized = withoutLeadingBom.replace(/\r\n?|\n/g, '\n')
  const classifiedLines = normalized.split('\n').map(classifyLine)
  const resolvedLines = resolveLineKinds(classifiedLines)
  const assembledLines = assembleLines(resolvedLines)
  const cleaned = cleanSpacing(assembledLines, options.removeCjkLatinSpaces, options.cleanCopyResidue ?? false)

  return restoreCollapsedChineseStructure(cleaned).trim()
}
