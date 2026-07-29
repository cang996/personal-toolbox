export type DiffLineType = 'equal' | 'added' | 'removed' | 'modified'

export type DiffSegmentType = 'equal' | 'added' | 'removed'

export interface DiffSegment {
  type: DiffSegmentType
  text: string
}

export interface DiffLine {
  type: DiffLineType
  oldLineNumber?: number
  newLineNumber?: number
  oldText?: string
  newText?: string
  oldSegments?: DiffSegment[]
  newSegments?: DiffSegment[]
}

export interface DiffSummary {
  equal: number
  added: number
  removed: number
  modified: number
}

export interface TextDiffOptions {
  ignoreTrailingWhitespace: boolean
  ignoreBlankLines: boolean
}

export interface TextDiffResult {
  lines: DiffLine[]
  summary: DiffSummary
}
