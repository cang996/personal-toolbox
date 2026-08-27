import { removeCopyResidue } from '@/shared/text/copyResidue'

export interface TextNormalizerOptions {
  cleanCopyResidue: boolean
  normalizeWhitespace: boolean
  addCjkLatinSpacing: boolean
  normalizePunctuationSpacing: boolean
  normalizeFullWidthAlphanumeric: boolean
}

interface TextSegment {
  text: string
  protected: boolean
}

const hanCharacter = /\p{Script=Han}/u
const protectedFragment =
  /https?:\/\/[^\s\p{Script=Han}]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|[A-Z]:\\[^\s\p{Script=Han}]+|\/(?:[A-Z0-9._-]+\/)+[A-Z0-9._-]+|\b\d{4}-\d{2}-\d{2}\b|\bv\d+(?:\.\d+)+\b|\b\d+\.\d+\b|\b(?:[A-Z][A-Z0-9]*-\d+|[A-Z][A-Z0-9]*\.(?:JS|TS)|[A-Z]+\d+)\b|C\+\+|C#/giu

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, '\n')
}

function normalizeFullWidthAlphanumeric(text: string): string {
  return text.replace(/[０-９Ａ-Ｚａ-ｚ]/g, (character) =>
    String.fromCodePoint(character.codePointAt(0)! - 0xfee0),
  )
}

function normalizeOrdinaryWhitespace(text: string): string {
  return text
    .split('\n')
    .map((line) =>
      line
        .replace(/[\u3000\u00a0\t]/g, ' ')
        .replace(/ {2,}/g, ' ')
        .replace(/ +$/g, ''),
    )
    .join('\n')
}

function createSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = []
  let cursor = 0

  for (const match of text.matchAll(protectedFragment)) {
    const index = match.index
    if (index > cursor) {
      segments.push({ text: text.slice(cursor, index), protected: false })
    }
    segments.push({ text: match[0], protected: true })
    cursor = index + match[0].length
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), protected: false })
  }

  return segments.length > 0 ? segments : [{ text, protected: false }]
}

function normalizePunctuationSpacing(text: string): string {
  return text
    .replace(/[ \t]+(?=[,.;:!?%)}\]，。！？；：、）》】」』])/g, '')
    .replace(/([([{（【《「『“‘])[ \t]+/g, '$1')
}

function normalizeTechnicalPunctuationSpacing(text: string): string {
  return text
    .replace(/(\d)[ \t]*\.[ \t]*(\d)/g, '$1.$2')
    .replace(/\$[ \t]+(?=\d)/g, '$')
    .replace(/(\d)[ \t]+%/g, '$1%')
    .replace(/(\d)[ \t]*:[ \t]*(\d)/g, '$1:$2')
    .replace(/\b([vV])[ \t]+(?=\d+(?:\.\d+)+)/g, '$1')
}

function normalizeInternalCjkLatinSpacing(text: string): string {
  return text
    .replace(/(\p{Script=Han})[ \t]*([A-Za-z0-9])/gu, '$1 $2')
    .replace(/([A-Za-z0-9])[ \t]*(\p{Script=Han})/gu, '$1 $2')
}

function boundaryKind(segment: TextSegment, edge: 'start' | 'end'): 'han' | 'latin' | null {
  const value = edge === 'start' ? segment.text.replace(/^[ \t]+/, '') : segment.text.replace(/[ \t]+$/, '')
  const character = edge === 'start' ? value[0] : value.at(-1)

  if (character && hanCharacter.test(character)) return 'han'
  if (character && /[A-Za-z0-9]/.test(character)) return 'latin'
  if (segment.protected && /[A-Za-z0-9]/.test(segment.text)) return 'latin'
  return null
}

function normalizeCjkLatinSpacing(segments: TextSegment[]): TextSegment[] {
  const normalized = segments.map((segment) => ({
    ...segment,
    text: segment.protected ? segment.text : normalizeInternalCjkLatinSpacing(segment.text),
  }))

  for (let index = 1; index < normalized.length; index += 1) {
    const previous = normalized[index - 1]!
    const current = normalized[index]!
    const previousKind = boundaryKind(previous, 'end')
    const currentKind = boundaryKind(current, 'start')

    if (
      (previousKind === 'han' && currentKind === 'latin') ||
      (previousKind === 'latin' && currentKind === 'han')
    ) {
      previous.text = `${previous.text.replace(/[ \t]+$/, '')} `
      current.text = current.text.replace(/^[ \t]+/, '')
    }
  }

  return normalized
}

export function normalizeText(input: string, options: TextNormalizerOptions): string {
  const normalizedNewlines = normalizeNewlines(input)
  let value = normalizedNewlines.startsWith('\uFEFF') ? normalizedNewlines.slice(1) : normalizedNewlines

  if (options.cleanCopyResidue) value = removeCopyResidue(value)
  if (options.normalizeFullWidthAlphanumeric) value = normalizeFullWidthAlphanumeric(value)
  if (options.normalizeWhitespace) value = normalizeOrdinaryWhitespace(value)

  if (options.normalizePunctuationSpacing) value = normalizeTechnicalPunctuationSpacing(value)

  let segments = createSegments(value)
  if (options.normalizePunctuationSpacing) {
    segments = segments.map((segment) => ({
      ...segment,
      text: segment.protected ? segment.text : normalizePunctuationSpacing(segment.text),
    }))
  }
  if (options.addCjkLatinSpacing) segments = normalizeCjkLatinSpacing(segments)

  return segments.map((segment) => segment.text).join('')
}
