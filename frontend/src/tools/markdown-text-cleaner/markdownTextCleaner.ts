export interface MarkdownTextCleanerOptions {
  preserveLinkUrls: boolean
  numberHeadings?: boolean
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

function protectEscapedMarkdown(value: string, fragments: string[]): string {
  return value.replace(escapedCharacter, (_match, characters: string) => {
    fragments.push(characters)
    return `${escapedPlaceholderStart}${fragments.length - 1}${escapedPlaceholderEnd}`
  })
}

function restoreEscapedMarkdown(value: string, fragments: string[]): string {
  return value.replace(/\uE100(\d+)\uE101/g, (_match, index: string) => fragments[Number(index)] ?? '')
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

function cleanInlineMarkdown(value: string, options: MarkdownTextCleanerOptions): string {
  const protectedFragments: string[] = []
  const protect = (content: string) => {
    protectedFragments.push(content)
    return `\uE000${protectedFragments.length - 1}\uE001`
  }
  const protectedEscapes = value.replace(escapedCharacter, (_match, characters: string) => protect(characters))
  const protectedCode = protectedEscapes.replace(/`([^`]+)`/g, (_match, content: string) => protect(content))
  const withImages = protectedCode.replace(image, '$1')
  const withLinks = replaceInlineLinks(withImages, options, protect)

  const withoutFormatting = withLinks
    .replace(referenceLink, '$1')
    .replace(autoLink, (_match, url: string) => protect(url))

  return removeEmphasisMarkers(withoutFormatting)
    .replace(/\uE000(\d+)\uE001/g, (_match, index: string) => protectedFragments[Number(index)] ?? '')
}

function isOrdinarySetextText(line: string): boolean {
  return Boolean(line.trim()) && !atxHeading.test(line) && !blockquote.test(line) && !unorderedList.test(line) && !taskList.test(line)
}

function formatHeading(level: number, content: string, counters: number[], numberHeadings: boolean): string {
  if (!numberHeadings) return content

  for (let index = 0; index < level - 1; index += 1) {
    if (counters[index] === 0) counters[index] = 1
  }
  const currentIndex = level - 1
  counters[currentIndex] = (counters[currentIndex] ?? 0) + 1
  for (let index = level; index < counters.length; index += 1) {
    counters[index] = 0
  }

  const number = counters.slice(0, level).join('.')
  return `${level === 1 ? `${number}.` : number} ${content}`
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

export function cleanMarkdownText(input: string, options: MarkdownTextCleanerOptions): string {
  const lines = input.replace(/\r\n?/g, '\n').split('\n')
  const output: string[] = []
  const headingCounters = [0, 0, 0, 0, 0, 0]
  let inCodeBlock = false

  for (let index = 0; index < lines.length; index += 1) {
    const sourceLine = lines[index] ?? ''
    const nextLine = lines[index + 1]

    if (/^\s*```/.test(sourceLine) || /^\s*~~~/.test(sourceLine)) {
      inCodeBlock = !inCodeBlock
      continue
    }

    if (inCodeBlock) {
      output.push(sourceLine)
      continue
    }

    const escapedFragments: string[] = []
    const line = protectEscapedMarkdown(sourceLine, escapedFragments)
    const restoreLine = (value: string) => restoreEscapedMarkdown(value, escapedFragments)

    const atx = line.match(atxHeading)
    if (atx) {
      const marker = atx[1] ?? ''
      const content = atx[2] ?? ''
      output.push(
        restoreLine(formatHeading(marker.length, cleanInlineMarkdown(content, options), headingCounters, options.numberHeadings ?? false)),
      )
      continue
    }

    const setext = nextLine?.match(setextHeading)
    if (setext && isOrdinarySetextText(line)) {
      const marker = setext[1] ?? ''
      const level = marker.startsWith('=') ? 1 : 2
      output.push(
        restoreLine(formatHeading(level, cleanInlineMarkdown(line.trim(), options), headingCounters, options.numberHeadings ?? false)),
      )
      index += 1
      continue
    }

    if (horizontalRule.test(line)) {
      continue
    }

    output.push(restoreLine(cleanNormalLine(line, options)))
  }

  return output
    .join('\n')
    .replace(/\n[ \t]+\n/g, '\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
