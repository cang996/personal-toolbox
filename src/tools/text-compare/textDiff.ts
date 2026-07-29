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

interface ModifiedMatch extends Match {
  oldLineCount: number
  newLineCount: number
}

export const MODIFIED_LINE_SIMILARITY_THRESHOLD = 0.45
const LONG_TEXT_SIMILARITY_LENGTH = 40
const STRONG_EDGE_MINIMUM_LENGTH = 20
const STRONG_EDGE_MINIMUM_SHORTER_TEXT_RATIO = 0.3

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

  if (Math.max(oldCharacters.length, newCharacters.length) > LONG_TEXT_SIMILARITY_LENGTH) {
    return lcsSimilarity
  }

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
  const matches = findModifiedMatches(oldBlock, newBlock)
  let oldCursor = 0
  let newCursor = 0

  for (const match of matches) {
    lines.push(...oldBlock.slice(oldCursor, match.oldIndex).map(createRemovedLine))
    lines.push(...newBlock.slice(newCursor, match.newIndex).map(createAddedLine))
    lines.push(
      createModifiedLine(
        oldBlock.slice(match.oldIndex, match.oldIndex + match.oldLineCount),
        newBlock.slice(match.newIndex, match.newIndex + match.newLineCount),
      ),
    )
    oldCursor = match.oldIndex + match.oldLineCount
    newCursor = match.newIndex + match.newLineCount
  }

  lines.push(...oldBlock.slice(oldCursor).map(createRemovedLine))
  lines.push(...newBlock.slice(newCursor).map(createAddedLine))

  return lines
}

function findModifiedMatches(oldBlock: ComparableLine[], newBlock: ComparableLine[]): ModifiedMatch[] {
  const scores = createLengthMatrix(oldBlock.length, newBlock.length)

  for (let oldIndex = oldBlock.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newBlock.length - 1; newIndex >= 0; newIndex -= 1) {
      const candidateScores = findModifiedCandidates(oldBlock, newBlock, oldIndex, newIndex).map(
        (candidate) =>
          candidate.score + scores[oldIndex + candidate.oldLineCount]![newIndex + candidate.newLineCount]!,
      )

      scores[oldIndex]![newIndex] = Math.max(
        scores[oldIndex + 1]![newIndex]!,
        scores[oldIndex]![newIndex + 1]!,
        ...candidateScores,
      )
    }
  }

  const matches: ModifiedMatch[] = []
  let oldIndex = 0
  let newIndex = 0

  while (oldIndex < oldBlock.length && newIndex < newBlock.length) {
    const candidates = findModifiedCandidates(oldBlock, newBlock, oldIndex, newIndex)
    const candidate = candidates.find(
      (item) =>
        item.score + scores[oldIndex + item.oldLineCount]![newIndex + item.newLineCount]! ===
        scores[oldIndex]![newIndex],
    )

    if (candidate) {
      matches.push(candidate)
      oldIndex += candidate.oldLineCount
      newIndex += candidate.newLineCount
    } else if (scores[oldIndex + 1]![newIndex]! >= scores[oldIndex]![newIndex + 1]!) {
      oldIndex += 1
    } else {
      newIndex += 1
    }
  }

  return matches
}

function findModifiedCandidates(
  oldBlock: ComparableLine[],
  newBlock: ComparableLine[],
  oldIndex: number,
  newIndex: number,
): Array<ModifiedMatch & { similarity: number; score: number }> {
  const candidates: Array<ModifiedMatch & { similarity: number; score: number }> = []

  for (const [oldLineCount, newLineCount] of [[1, 1], [1, 2], [1, 3], [2, 1], [3, 1]] as const) {
    const oldLines = oldBlock.slice(oldIndex, oldIndex + oldLineCount)
    const newLines = newBlock.slice(newIndex, newIndex + newLineCount)

    if (oldLines.length !== oldLineCount || newLines.length !== newLineCount) {
      continue
    }

    const oldText = joinLineTexts(oldLines)
    const newText = joinLineTexts(newLines)
    const similarity = calculateLineSimilarity(oldText, newText)

    if (
      similarity >= MODIFIED_LINE_SIMILARITY_THRESHOLD ||
      (oldLineCount === 1 && newLineCount === 1 && hasStrongCommonEdge(oldText, newText))
    ) {
      candidates.push({
        oldIndex,
        newIndex,
        oldLineCount,
        newLineCount,
        similarity,
        score: similarity * Math.min(countCharacters(oldText), countCharacters(newText)),
      })
    }
  }

  return candidates.sort((left, right) => right.similarity - left.similarity)
}

function createModifiedLine(oldLines: ComparableLine[], newLines: ComparableLine[]): DiffLine {
  const oldText = joinLineTexts(oldLines)
  const newText = joinLineTexts(newLines)
  const characterDiff = diffCharacters(oldText, newText)

  return {
    type: 'modified',
    oldLineNumber: oldLines[0]!.lineNumber,
    newLineNumber: newLines[0]!.lineNumber,
    oldLineNumbers: oldLines.map((line) => line.lineNumber),
    newLineNumbers: newLines.map((line) => line.lineNumber),
    oldText,
    newText,
    oldTexts: oldLines.map((line) => line.text),
    newTexts: newLines.map((line) => line.text),
    oldSegments: characterDiff.oldSegments,
    newSegments: characterDiff.newSegments,
  }
}

function joinLineTexts(lines: ComparableLine[]): string {
  return lines.map((line) => line.text).join('\n')
}

function hasStrongCommonEdge(oldText: string, newText: string): boolean {
  const oldCharacters = splitCharacters(oldText)
  const newCharacters = splitCharacters(newText)
  const commonEdgeLength = Math.max(
    countCommonPrefix(oldCharacters, newCharacters),
    countCommonSuffix(oldCharacters, newCharacters),
  )

  return (
    commonEdgeLength >= STRONG_EDGE_MINIMUM_LENGTH &&
    commonEdgeLength / Math.min(oldCharacters.length, newCharacters.length) >= STRONG_EDGE_MINIMUM_SHORTER_TEXT_RATIO
  )
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
