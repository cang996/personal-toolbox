import { countCharacters, countLines } from './textDiff'
import type { DiffLine, DiffSegment } from './types'

export const LONG_TEXT_CHARACTER_WARNING_THRESHOLD = 20_000
export const LONG_TEXT_LINE_WARNING_THRESHOLD = 1_000
export const EXTREME_TEXT_CHARACTER_LIMIT = 100_000
export const EXTREME_TEXT_LINE_LIMIT = 5_000

export interface TextSizeCheck {
  characterCount: number
  lineCount: number
  isLong: boolean
  isExtreme: boolean
}

export type DisplayDiffItem =
  | { type: 'line'; line: DiffLine }
  | { type: 'omitted-equal'; count: number }

export function checkTextSize(text: string): TextSizeCheck {
  const characterCount = countCharacters(text)
  const lineCount = countLines(text)

  return {
    characterCount,
    lineCount,
    isLong:
      characterCount > LONG_TEXT_CHARACTER_WARNING_THRESHOLD || lineCount > LONG_TEXT_LINE_WARNING_THRESHOLD,
    isExtreme:
      characterCount > EXTREME_TEXT_CHARACTER_LIMIT || lineCount > EXTREME_TEXT_LINE_LIMIT,
  }
}

export function longTextMessage(oldText: string, newText: string): string | null {
  const oldIsLong = checkTextSize(oldText).isLong
  const newIsLong = checkTextSize(newText).isLong

  if (!oldIsLong && !newIsLong) {
    return null
  }

  const side = oldIsLong && newIsLong ? '两侧文本都较长' : oldIsLong ? '旧文本较长' : '新文本较长'
  return `${side}，对比可能需要一些时间。建议按章节分批比较。`
}

export function extremeTextMessage(oldText: string, newText: string): string | null {
  const oldIsExtreme = checkTextSize(oldText).isExtreme
  const newIsExtreme = checkTextSize(newText).isExtreme

  if (!oldIsExtreme && !newIsExtreme) {
    return null
  }

  const side = oldIsExtreme && newIsExtreme ? '旧文本和新文本都超出限制' : oldIsExtreme ? '旧文本超出限制' : '新文本超出限制'
  return `${side}。文本过长，当前版本暂不建议一次处理。请按章节或段落拆分后再比较。`
}

export function createDisplayDiffItems(lines: DiffLine[], differencesOnly: boolean): DisplayDiffItem[] {
  if (!differencesOnly) {
    return lines.map((line) => ({ type: 'line', line }))
  }

  const items: DisplayDiffItem[] = []
  let omittedEqualCount = 0

  const appendOmission = () => {
    if (omittedEqualCount > 0) {
      items.push({ type: 'omitted-equal', count: omittedEqualCount })
      omittedEqualCount = 0
    }
  }

  for (const line of lines) {
    if (line.type === 'equal') {
      omittedEqualCount += 1
    } else {
      appendOmission()
      items.push({ type: 'line', line })
    }
  }

  appendOmission()
  return items
}

export function splitSegmentsByLine(segments: DiffSegment[] | undefined, lineCount: number): DiffSegment[][] {
  const result = Array.from({ length: Math.max(lineCount, 1) }, () => [] as DiffSegment[])
  let lineIndex = 0

  for (const segment of segments ?? []) {
    const parts = segment.text.split('\n')

    parts.forEach((part, index) => {
      if (lineIndex < result.length && part.length > 0) {
        result[lineIndex]!.push({ type: segment.type, text: part })
      }

      if (index < parts.length - 1 && lineIndex < result.length - 1) {
        lineIndex += 1
      }
    })
  }

  return result
}
