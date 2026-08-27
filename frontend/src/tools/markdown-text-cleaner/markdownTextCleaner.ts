export interface MarkdownTextCleanerOptions {
  preserveLinkUrls: boolean
  numberHeadings?: boolean
  cleanCopyResidue?: boolean
}

interface FenceDelimiter {
  marker: '`' | '~'
  length: number
}

interface OutputLine {
  text: string
  protected: boolean
}

interface HeadingNumberingContext {
  counters: number[]
  depthOffset: number
}

const horizontalRule = /^\s{0,3}(?:[-*_]\s*){3,}$/
const atxHeading = /^\s{0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+[ \t]*)?$/
const setextHeading = /^\s{0,3}(=+|-+)[ \t]*$/
const taskList = /^(\s*)[-+*]\s+\[([ xX])\]\s*(.*)$/
const unorderedList = /^(\s*)[-+*]\s+(.*)$/
const blockquote = /^\s{0,3}(?:>\s*)+/
const image = /!\[([^\]]*)\]\((?:[^)]+)\)/g
const referenceLink = /(?<!!)(?<!\\)\[([^\]]+)\]\[[^\]]*\]/g
const autoLink = /<(https?:\/\/[^\s>]+|[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)>/gi
const escapedCharacter = /\\(\*+|_+|~+|[!"#$%&'()+,\-./:;<=>?@[\\\]^`{|}])/g
const cjkCharacter = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/
const escapedPlaceholderStart = '\uE100'
const escapedPlaceholderEnd = '\uE101'
const existingHeadingNumber = /^((?:\d+\.)|(?:\d+(?:\.\d+)+\.?))[ \t]+(?=\S)/

function protectEscapedMarkdown(value: string, fragments: string[]): string {
  return value.replace(escapedCharacter, (_match, characters: string) => {
    fragments.push(characters)
    return `${escapedPlaceholderStart}${fragments.length - 1}${escapedPlaceholderEnd}`
  })
}

function restoreEscapedMarkdown(value: string, fragments: string[]): string {
  return value.replace(/\uE100(\d+)\uE101/g, (_match, index: string) => fragments[Number(index)] ?? '')
}

function findFenceOpener(line: string): FenceDelimiter | null {
  const match = line.match(/^\s{0,3}(`{3,}|~{3,})/)
  const delimiter = match?.[1]
  if (!delimiter) return null

  const marker = delimiter[0]
  if (marker !== '`' && marker !== '~') return null

  return { marker, length: delimiter.length }
}

function isFenceCloser(line: string, opener: FenceDelimiter): boolean {
  const match = line.match(/^\s{0,3}(`+|~+)[ \t]*$/)
  const delimiter = match?.[1]
  return Boolean(delimiter && delimiter[0] === opener.marker && delimiter.length >= opener.length)
}

function replaceInlineLinks(
  value: string,
  options: MarkdownTextCleanerOptions,
  protect: (content: string) => string,
): string {
  let result = ''
  let cursor = 0

  while (cursor < value.length) {
    const labelStart = value.indexOf('[', cursor)
    if (labelStart === -1 || value[labelStart - 1] === '!') {
      return result + value.slice(cursor)
    }

    const labelEnd = value.indexOf('](', labelStart + 1)
    if (labelEnd === -1) {
      return result + value.slice(cursor)
    }

    let index = labelEnd + 2
    let depth = 0
    let urlEnd = -1
    let closingIndex = -1

    for (; index < value.length; index += 1) {
      const character = value[index]
      if (character === '(') {
        depth += 1
      } else if (character === ')') {
        if (depth === 0) {
          closingIndex = index
          break
        }
        depth -= 1
      } else if (/\s/.test(character ?? '') && depth === 0 && urlEnd === -1) {
        urlEnd = index
      }
    }

    if (closingIndex === -1 || depth !== 0) {
      result += value.slice(cursor, labelEnd + 2)
      cursor = labelEnd + 2
      continue
    }

    const label = value.slice(labelStart + 1, labelEnd)
    const url = value.slice(labelEnd + 2, urlEnd === -1 ? closingIndex : urlEnd)
    if (!url) {
      result += value.slice(cursor, closingIndex + 1)
      cursor = closingIndex + 1
      continue
    }

    result += value.slice(cursor, labelStart)
    result += options.preserveLinkUrls ? `${label}（${protect(url)}）` : label
    cursor = closingIndex + 1
  }

  return result
}

function removeEmphasisMarkers(value: string): string {
  const withoutCjkMarkerSpacing = value.replace(
    new RegExp(`(${cjkCharacter.source})[ \\t]+((?:\\*{1,3}|_{1,2}|~~)(?=${cjkCharacter.source}))`, 'g'),
    '$1$2',
  )

  return withoutCjkMarkerSpacing
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
    .replace(/___(.+?)___/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2')
    .replace(/(^|[^_])_([^_\n]+)_/g, '$1$2')
}

function protectInlineCode(value: string, protect: (content: string) => string): string {
  let result = ''
  let cursor = 0

  while (cursor < value.length) {
    const openerStart = value.indexOf('`', cursor)
    if (openerStart === -1) return result + value.slice(cursor)

    let openerEnd = openerStart
    while (value[openerEnd] === '`') openerEnd += 1
    const delimiterLength = openerEnd - openerStart
    let closerStart = openerEnd

    while (closerStart < value.length) {
      closerStart = value.indexOf('`', closerStart)
      if (closerStart === -1) return result + value.slice(cursor)

      let closerEnd = closerStart
      while (value[closerEnd] === '`') closerEnd += 1
      if (closerEnd - closerStart === delimiterLength) {
        result += value.slice(cursor, openerStart)
        result += protect(value.slice(openerEnd, closerStart))
        cursor = closerEnd
        break
      }

      closerStart = closerEnd
    }
  }

  return result
}

function removeCopyResidue(value: string): string {
  return value.replace(/[\u200B\u00AD\uFEFF]/g, '').replace(/\u00A0/g, ' ')
}

function cleanInlineMarkdown(value: string, options: MarkdownTextCleanerOptions): string {
  const protectedFragments: string[] = []
  const protect = (content: string) => {
    protectedFragments.push(content)
    return `\uE000${protectedFragments.length - 1}\uE001`
  }
  const protectedEscapes = value.replace(escapedCharacter, (_match, characters: string) => protect(characters))
  const protectedCode = protectInlineCode(protectedEscapes, protect)
  const withImages = protectedCode.replace(image, '$1')
  const withLinks = replaceInlineLinks(withImages, options, protect)

  const withoutFormatting = withLinks
    .replace(referenceLink, '$1')
    .replace(autoLink, (_match, url: string) => protect(url))
  const normalizedProse = options.cleanCopyResidue ? removeCopyResidue(withoutFormatting) : withoutFormatting

  return removeEmphasisMarkers(normalizedProse)
    .replace(/\uE000(\d+)\uE001/g, (_match, index: string) => protectedFragments[Number(index)] ?? '')
}

function isOrdinarySetextText(line: string): boolean {
  return Boolean(line.trim()) && !atxHeading.test(line) && !blockquote.test(line) && !unorderedList.test(line) && !taskList.test(line)
}

function formatHeading(
  level: number,
  content: string,
  context: HeadingNumberingContext,
  numberHeadings: boolean,
): string {
  if (!numberHeadings) return content

  const existingNumber = content.match(existingHeadingNumber)?.[1]
  if (existingNumber) {
    const components = existingNumber
      .replace(/\.$/, '')
      .split('.')
      .map(Number)

    for (let index = 0; index < context.counters.length; index += 1) {
      context.counters[index] = components[index] ?? 0
    }
    context.depthOffset = components.length - level
    return content
  }

  const numberingDepth = Math.min(Math.max(level + context.depthOffset, 1), context.counters.length)
  for (let index = 0; index < numberingDepth - 1; index += 1) {
    if (context.counters[index] === 0) context.counters[index] = 1
  }
  const currentIndex = numberingDepth - 1
  context.counters[currentIndex] = (context.counters[currentIndex] ?? 0) + 1
  for (let index = numberingDepth; index < context.counters.length; index += 1) {
    context.counters[index] = 0
  }

  const number = context.counters.slice(0, numberingDepth).join('.')
  return `${numberingDepth === 1 ? `${number}.` : number} ${content}`
}

function cleanNormalLine(line: string, options: MarkdownTextCleanerOptions): string {
  const withoutQuotes = line.replace(blockquote, '')
  const task = withoutQuotes.match(taskList)
  if (task) {
    const indentation = task[1] ?? ''
    const state = task[2] ?? ''
    const content = task[3] ?? ''
    return `${indentation}${state.toLowerCase() === 'x' ? '☑' : '☐'} ${cleanInlineMarkdown(content, options)}`.replace(/[ \t]+$/g, '')
  }

  const list = withoutQuotes.match(unorderedList)
  if (list) {
    const indentation = list[1] ?? ''
    const content = list[2] ?? ''
    return `${indentation}• ${cleanInlineMarkdown(content, options)}`.replace(/[ \t]+$/g, '')
  }

  return cleanInlineMarkdown(withoutQuotes, options).replace(/[ \t]+$/g, '')
}

function normalizeOutput(lines: OutputLine[]): string {
  const normalized: OutputLine[] = []

  for (const line of lines) {
    const previous = normalized.at(-1)
    if (!line.protected && line.text === '' && previous && !previous.protected && previous.text === '') {
      continue
    }
    normalized.push(line)
  }

  while (normalized[0] && !normalized[0].protected && normalized[0].text === '') normalized.shift()
  while (normalized.at(-1) && !normalized.at(-1)!.protected && normalized.at(-1)!.text === '') normalized.pop()

  if (normalized[0] && !normalized[0].protected) normalized[0].text = normalized[0].text.trimStart()
  if (normalized.at(-1) && !normalized.at(-1)!.protected) normalized.at(-1)!.text = normalized.at(-1)!.text.trimEnd()

  return normalized.map((line) => line.text).join('\n')
}

export function cleanMarkdownText(input: string, options: MarkdownTextCleanerOptions): string {
  const withoutLeadingBom = input.startsWith('\uFEFF') ? input.slice(1) : input
  const lines = withoutLeadingBom.replace(/\r\n?/g, '\n').split('\n')
  const output: OutputLine[] = []
  const headingNumberingContext: HeadingNumberingContext = {
    counters: [0, 0, 0, 0, 0, 0],
    depthOffset: 0,
  }
  let activeFence: FenceDelimiter | null = null

  for (let index = 0; index < lines.length; index += 1) {
    const sourceLine = lines[index] ?? ''
    const nextLine = lines[index + 1]

    if (activeFence) {
      if (isFenceCloser(sourceLine, activeFence)) {
        activeFence = null
      } else {
        output.push({ text: sourceLine, protected: true })
      }
      continue
    }

    const opener = findFenceOpener(sourceLine)
    if (opener) {
      activeFence = opener
      continue
    }

    const escapedFragments: string[] = []
    const line = protectEscapedMarkdown(sourceLine, escapedFragments)
    const restoreLine = (value: string) => restoreEscapedMarkdown(value, escapedFragments)

    const atx = line.match(atxHeading)
    if (atx) {
      const marker = atx[1] ?? ''
      const content = atx[2] ?? ''
      output.push({
        text: restoreLine(
          formatHeading(
            marker.length,
            cleanInlineMarkdown(content, options),
            headingNumberingContext,
            options.numberHeadings ?? false,
          ),
        ),
        protected: false,
      })
      continue
    }

    const setext = nextLine?.match(setextHeading)
    if (setext && isOrdinarySetextText(line)) {
      const marker = setext[1] ?? ''
      const level = marker.startsWith('=') ? 1 : 2
      output.push({
        text: restoreLine(
          formatHeading(
            level,
            cleanInlineMarkdown(line.trim(), options),
            headingNumberingContext,
            options.numberHeadings ?? false,
          ),
        ),
        protected: false,
      })
      index += 1
      continue
    }

    if (horizontalRule.test(line)) {
      continue
    }

    output.push({ text: restoreLine(cleanNormalLine(line, options)), protected: false })
  }

  return normalizeOutput(output)
}
