interface PublicationSegment {
  text: string
  protected: boolean
}

const hanCharacter = /\p{Script=Han}/u
const asciiPunctuation = /[,.;:!?]/
const englishIslandDelimiters = new Map([
  ['“', '”'],
  ['‘', '’'],
  ['「', '」'],
  ['『', '』'],
  ['（', '）'],
])
const protectedTechnicalFragment =
  /https?:\/\/[^\s\p{Script=Han}]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|[A-Z]:\\[^\s\p{Script=Han}]+|\/(?:[A-Z0-9._-]+\/)+[A-Z0-9._-]+|\$\d+(?:\.\d+)?|\b\d+:\d+\b|\b\d{4}-\d{2}-\d{2}\b|\bv\d+(?:\.\d+)+\b|\b\d+\.\d+\b|\b(?:[A-Z][A-Z0-9]*-\d+|[A-Z][A-Z0-9]*\.(?:JS|TS)|[A-Z]+\d+)\b|(?:\b[A-Z]\.){2,}|C\+\+|C#/giu

const punctuationMap: Record<string, string> = {
  ',': '，',
  '.': '。',
  ';': '；',
  ':': '：',
  '!': '！',
  '?': '？',
}

function normalizeFullWidthDigits(text: string): string {
  return text.replace(/[０-９]/g, (character) =>
    String.fromCodePoint(character.codePointAt(0)! - 0xfee0),
  )
}

function isClearEnglishIsland(text: string): boolean {
  return /[A-Za-z]/.test(text) && !hanCharacter.test(text)
}

function segmentEnglishIslands(text: string): PublicationSegment[] {
  const segments: PublicationSegment[] = []
  let cursor = 0

  while (cursor < text.length) {
    const openerIndex = Array.from(englishIslandDelimiters.keys()).reduce((nearest, opener) => {
      const index = text.indexOf(opener, cursor)
      return index !== -1 && (nearest === -1 || index < nearest) ? index : nearest
    }, -1)

    if (openerIndex === -1) {
      segments.push({ text: text.slice(cursor), protected: false })
      break
    }

    const opener = text[openerIndex]!
    const closer = englishIslandDelimiters.get(opener)!
    const closerIndex = text.indexOf(closer, openerIndex + 1)
    if (closerIndex === -1) {
      segments.push({ text: text.slice(cursor), protected: false })
      break
    }

    const content = text.slice(openerIndex + 1, closerIndex)
    if (!isClearEnglishIsland(content)) {
      segments.push({ text: text.slice(cursor, openerIndex + 1), protected: false })
      cursor = openerIndex + 1
      continue
    }

    if (openerIndex > cursor) {
      segments.push({ text: text.slice(cursor, openerIndex), protected: false })
    }
    segments.push({ text: opener, protected: false })
    segments.push({ text: content, protected: true })
    segments.push({ text: closer, protected: false })
    cursor = closerIndex + 1
  }

  return segments.length > 0 ? segments : [{ text, protected: false }]
}

function segmentTechnicalFragments(text: string): PublicationSegment[] {
  const segments: PublicationSegment[] = []
  let cursor = 0

  for (const match of text.matchAll(protectedTechnicalFragment)) {
    const index = match.index
    if (index > cursor) segments.push({ text: text.slice(cursor, index), protected: false })
    const matchedText = match[0]
    const remainder = text.slice(index + matchedText.length)
    const nextCharacter = remainder.match(/^[ \t]*(.)/)?.[1]
    const hasPrecedingHan = hanCharacter.test(text.slice(0, index))
    const punctuationIsOuter =
      (nextCharacter && hanCharacter.test(nextCharacter)) || (!nextCharacter && hasPrecedingHan)
    const outerPunctuation = punctuationIsOuter ? matchedText.match(/[,.;:!?]+$/)?.[0] : undefined
    const protectedText = outerPunctuation ? matchedText.slice(0, -outerPunctuation.length) : matchedText

    if (protectedText) segments.push({ text: protectedText, protected: true })
    if (outerPunctuation) segments.push({ text: outerPunctuation, protected: false })
    cursor = index + matchedText.length
  }

  if (cursor < text.length) segments.push({ text: text.slice(cursor), protected: false })
  return segments.length > 0 ? segments : [{ text, protected: false }]
}

function protectPublicationFragments(text: string): PublicationSegment[] {
  return segmentEnglishIslands(text).flatMap((segment) =>
    segment.protected ? [segment] : segmentTechnicalFragments(segment.text),
  )
}

function findNeighbor(
  segments: PublicationSegment[],
  segmentIndex: number,
  characterIndex: number,
  direction: -1 | 1,
): string | undefined {
  let currentSegmentIndex = segmentIndex
  let currentCharacterIndex = characterIndex + direction

  while (currentSegmentIndex >= 0 && currentSegmentIndex < segments.length) {
    const characters = Array.from(segments[currentSegmentIndex]!.text)
    while (currentCharacterIndex >= 0 && currentCharacterIndex < characters.length) {
      const character = characters[currentCharacterIndex]!
      if (!/[ \t]/.test(character)) return character
      currentCharacterIndex += direction
    }

    currentSegmentIndex += direction
    if (currentSegmentIndex < 0 || currentSegmentIndex >= segments.length) return undefined
    currentCharacterIndex =
      direction === 1 ? 0 : Array.from(segments[currentSegmentIndex]!.text).length - 1
  }

  return undefined
}

function normalizeOuterPunctuation(segments: PublicationSegment[]): PublicationSegment[] {
  const hasOuterHan = segments.some((segment) => !segment.protected && hanCharacter.test(segment.text))
  if (!hasOuterHan) return segments

  return segments.map((segment, segmentIndex) => {
    if (segment.protected) return segment

    const characters = Array.from(segment.text)
    const normalized = characters.map((character, characterIndex) => {
      if (!asciiPunctuation.test(character)) return character

      const previous = findNeighbor(segments, segmentIndex, characterIndex, -1)
      const next = findNeighbor(segments, segmentIndex, characterIndex, 1)
      if (previous && next && /[A-Za-z]/.test(previous) && /[A-Za-z]/.test(next)) {
        return character
      }

      return punctuationMap[character] ?? character
    })

    return { ...segment, text: normalized.join('') }
  })
}

function removeChinesePunctuationSpacing(text: string): string {
  return text
    .replace(/[ \t]+(?=[，。；：！？、）》】」』])/g, '')
    .replace(/([（【《「『“‘])[ \t]+/g, '$1')
    .replace(/([，。；：！？、（【《「『“‘])[ \t]+(?=[A-Za-z0-9$])/g, '$1')
}

function normalizePublicationLine(line: string): string {
  const digitNormalized = normalizeFullWidthDigits(line)
  const segments = protectPublicationFragments(digitNormalized)
  const punctuationNormalized = normalizeOuterPunctuation(segments)
  return removeChinesePunctuationSpacing(punctuationNormalized.map((segment) => segment.text).join(''))
}

export function normalizeChinesePublicationText(input: string): string {
  return input.replace(/[^\r\n]+/g, normalizePublicationLine)
}
