import type {
  DiffLine,
  DiffSegment,
  DiffSegmentType,
  DiffSummary,
  TextDiffOptions,
  TextDiffResult,
} from './types'

interface ComparableLine {
  text: string
  comparableText: string
  lineNumber: number
}

interface Match {
  oldIndex: number
  newIndex: number
}

interface CharacterMatch {
  oldIndex: number
  newIndex: number
}

export const MODIFIED_LINE_SIMILARITY_THRESHOLD = 0.45

const defaultOptions: TextDiffOptions = {
  ignoreTrailingWhitespace: true,
  ignoreBlankLines: false,
}

export function compareTexts(
  oldText: string,
  newText: string,
  options: Partial<TextDiffOptions> = {},
): TextDiffResult {
  const resolvedOptions = { ...defaultOptions, ...options }
  const oldLines = prepareLines(oldText, resolvedOptions)
  const newLines = prepareLines(newText, resolvedOptions)
  const matches = findLineMatches(oldLines, newLines)
  const lines = buildDiffLines(oldLines, newLines, matches)

  return {
    lines,
    summary: summarizeDiff(lines),
  }
}

export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

export function countLines(text: string): number {
  if (text.length === 0) {
    return 0
  }

  return normalizeNewlines(text).split('\n').length
}

export function countCharacters(text: string): number {
  return splitCharacters(text).length
}

export function calculateLineSimilarity(oldText: string, newText: string): number {
  const oldCharacters = splitCharacters(oldText)
  const newCharacters = splitCharacters(newText)

  if (oldCharacters.length === 0 || newCharacters.length === 0) {
    return 0
  }

  const lcsLength = findCharacterMatches(oldCharacters, newCharacters).length
  const lcsSimilarity = (2 * lcsLength) / (oldCharacters.length + newCharacters.length)
  const edgeSimilarity =
    Math.max(
      countCommonPrefix(oldCharacters, newCharacters),
      countCommonSuffix(oldCharacters, newCharacters),
    ) / Math.max(oldCharacters.length, newCharacters.length)

  return (lcsSimilarity + edgeSimilarity) / 2
}

export function formatDiffSummary(summary: DiffSummary): string {
  return [
    '文本对比结果',
    '',
    `相同：${summary.equal} 行`,
    `新增：${summary.added} 行`,
    `删除：${summary.removed} 行`,
    `修改：${summary.modified} 行`,
  ].join('\n')
}

export function formatFullDiff(lines: DiffLine[]): string {
  return lines
    .flatMap((line) => {
      if (line.type === 'equal') {
        return [`  ${line.oldText ?? ''}`]
      }

      if (line.type === 'removed') {
        return [`- ${line.oldText ?? ''}`]
      }

      if (line.type === 'added') {
        return [`+ ${line.newText ?? ''}`]
      }

      return [`- ${line.oldText ?? ''}`, `+ ${line.newText ?? ''}`]
    })
    .join('\n')
}

function prepareLines(text: string, options: TextDiffOptions): ComparableLine[] {
  const normalizedText = normalizeNewlines(text)
  const rawLines = normalizedText.length === 0 ? [] : normalizedText.split('\n')

  return rawLines
    .map((line, index) => ({
      text: line,
      comparableText: options.ignoreTrailingWhitespace ? trimTrailingSpacesAndTabs(line) : line,
      lineNumber: index + 1,
    }))
    .filter((line) => !options.ignoreBlankLines || !/^[\t ]*$/.test(line.text))
}

function trimTrailingSpacesAndTabs(text: string): string {
  return text.replace(/[\t ]+$/u, '')
}

function findLineMatches(oldLines: ComparableLine[], newLines: ComparableLine[]): Match[] {
  const lengths = createLengthMatrix(oldLines.length, newLines.length)

  for (let oldIndex = oldLines.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newLines.length - 1; newIndex >= 0; newIndex -= 1) {
      const currentRow = lengths[oldIndex]!
      const nextRow = lengths[oldIndex + 1]!
      const oldLine = oldLines[oldIndex]!
      const newLine = newLines[newIndex]!

      if (oldLine.comparableText === newLine.comparableText) {
        currentRow[newIndex] = nextRow[newIndex + 1]! + 1
      } else {
        currentRow[newIndex] = Math.max(nextRow[newIndex]!, currentRow[newIndex + 1]!)
      }
    }
  }

  const matches: Match[] = []
  let oldIndex = 0
  let newIndex = 0

  while (oldIndex < oldLines.length && newIndex < newLines.length) {
    const currentRow = lengths[oldIndex]!
    const nextRow = lengths[oldIndex + 1]!

    if (oldLines[oldIndex]!.comparableText === newLines[newIndex]!.comparableText) {
      matches.push({ oldIndex, newIndex })
      oldIndex += 1
      newIndex += 1
    } else if (nextRow[newIndex]! >= currentRow[newIndex + 1]!) {
      oldIndex += 1
    } else {
      newIndex += 1
    }
  }

  return matches
}

function createLengthMatrix(rowCount: number, columnCount: number): number[][] {
  return Array.from({ length: rowCount + 1 }, () => Array.from({ length: columnCount + 1 }, () => 0))
}

function buildDiffLines(oldLines: ComparableLine[], newLines: ComparableLine[], matches: Match[]): DiffLine[] {
  const lines: DiffLine[] = []
  let oldCursor = 0
  let newCursor = 0

  for (const match of matches) {
    lines.push(...buildChangedBlock(oldLines.slice(oldCursor, match.oldIndex), newLines.slice(newCursor, match.newIndex)))
    const oldLine = oldLines[match.oldIndex]!
    const newLine = newLines[match.newIndex]!

    lines.push({
      type: 'equal',
      oldLineNumber: oldLine.lineNumber,
      newLineNumber: newLine.lineNumber,
      oldText: oldLine.text,
      newText: newLine.text,
    })
    oldCursor = match.oldIndex + 1
    newCursor = match.newIndex + 1
  }

  lines.push(...buildChangedBlock(oldLines.slice(oldCursor), newLines.slice(newCursor)))

  return lines
}

function buildChangedBlock(oldBlock: ComparableLine[], newBlock: ComparableLine[]): DiffLine[] {
  const lines: DiffLine[] = []
  const pairedCount = Math.min(oldBlock.length, newBlock.length)

  for (let index = 0; index < pairedCount; index += 1) {
    const oldLine = oldBlock[index]!
    const newLine = newBlock[index]!

    if (shouldPairAsModified(oldLine.text, newLine.text)) {
      const characterDiff = diffCharacters(oldLine.text, newLine.text)

      lines.push({
        type: 'modified',
        oldLineNumber: oldLine.lineNumber,
        newLineNumber: newLine.lineNumber,
        oldText: oldLine.text,
        newText: newLine.text,
        oldSegments: characterDiff.oldSegments,
        newSegments: characterDiff.newSegments,
      })
    } else {
      lines.push(createRemovedLine(oldLine))
      lines.push(createAddedLine(newLine))
    }
  }

  for (const oldLine of oldBlock.slice(pairedCount)) {
    lines.push(createRemovedLine(oldLine))
  }

  for (const newLine of newBlock.slice(pairedCount)) {
    lines.push(createAddedLine(newLine))
  }

  return lines
}

function shouldPairAsModified(oldText: string, newText: string): boolean {
  return calculateLineSimilarity(oldText, newText) >= MODIFIED_LINE_SIMILARITY_THRESHOLD
}

function createRemovedLine(oldLine: ComparableLine): DiffLine {
  return {
    type: 'removed',
    oldLineNumber: oldLine.lineNumber,
    oldText: oldLine.text,
  }
}

function createAddedLine(newLine: ComparableLine): DiffLine {
  return {
    type: 'added',
    newLineNumber: newLine.lineNumber,
    newText: newLine.text,
  }
}

function diffCharacters(oldText: string, newText: string): { oldSegments: DiffSegment[]; newSegments: DiffSegment[] } {
  const oldCharacters = splitCharacters(oldText)
  const newCharacters = splitCharacters(newText)
  const matches = findCharacterMatches(oldCharacters, newCharacters)

  return {
    oldSegments: buildCharacterSegments(oldCharacters, matches.map((match) => match.oldIndex), 'removed'),
    newSegments: buildCharacterSegments(newCharacters, matches.map((match) => match.newIndex), 'added'),
  }
}

function splitCharacters(text: string): string[] {
  return Array.from(text)
}

function countCommonPrefix(oldCharacters: string[], newCharacters: string[]): number {
  const maxLength = Math.min(oldCharacters.length, newCharacters.length)
  let count = 0

  while (count < maxLength && oldCharacters[count] === newCharacters[count]) {
    count += 1
  }

  return count
}

function countCommonSuffix(oldCharacters: string[], newCharacters: string[]): number {
  const maxLength = Math.min(oldCharacters.length, newCharacters.length)
  let count = 0

  while (
    count < maxLength &&
    oldCharacters[oldCharacters.length - 1 - count] === newCharacters[newCharacters.length - 1 - count]
  ) {
    count += 1
  }

  return count
}

function findCharacterMatches(oldCharacters: string[], newCharacters: string[]): CharacterMatch[] {
  const lengths = createLengthMatrix(oldCharacters.length, newCharacters.length)

  for (let oldIndex = oldCharacters.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newCharacters.length - 1; newIndex >= 0; newIndex -= 1) {
      const currentRow = lengths[oldIndex]!
      const nextRow = lengths[oldIndex + 1]!

      if (oldCharacters[oldIndex] === newCharacters[newIndex]) {
        currentRow[newIndex] = nextRow[newIndex + 1]! + 1
      } else {
        currentRow[newIndex] = Math.max(nextRow[newIndex]!, currentRow[newIndex + 1]!)
      }
    }
  }

  const matches: CharacterMatch[] = []
  let oldIndex = 0
  let newIndex = 0

  while (oldIndex < oldCharacters.length && newIndex < newCharacters.length) {
    const currentRow = lengths[oldIndex]!
    const nextRow = lengths[oldIndex + 1]!

    if (oldCharacters[oldIndex] === newCharacters[newIndex]) {
      matches.push({ oldIndex, newIndex })
      oldIndex += 1
      newIndex += 1
    } else if (nextRow[newIndex]! >= currentRow[newIndex + 1]!) {
      oldIndex += 1
    } else {
      newIndex += 1
    }
  }

  return matches
}

function buildCharacterSegments(
  characters: string[],
  equalIndexes: number[],
  changedType: Exclude<DiffSegmentType, 'equal'>,
): DiffSegment[] {
  const equalIndexSet = new Set(equalIndexes)
  const segments: DiffSegment[] = []

  for (let index = 0; index < characters.length; index += 1) {
    const type = equalIndexSet.has(index) ? 'equal' : changedType
    const previousSegment = segments.at(-1)

    if (previousSegment?.type === type) {
      previousSegment.text += characters[index]!
    } else {
      segments.push({ type, text: characters[index]! })
    }
  }

  return segments
}

function summarizeDiff(lines: DiffLine[]): DiffSummary {
  return lines.reduce<DiffSummary>(
    (summary, line) => {
      summary[line.type] += 1
      return summary
    },
    {
      equal: 0,
      added: 0,
      removed: 0,
      modified: 0,
    },
  )
}
