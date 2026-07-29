import { describe, expect, it } from 'vitest'

import {
  MODIFIED_LINE_SIMILARITY_THRESHOLD,
  calculateLineSimilarity,
  compareTexts,
  formatDiffSummary,
  formatFullDiff,
} from './textDiff'

function lineTypes(oldText: string, newText: string, options = {}) {
  return compareTexts(oldText, newText, options).lines.map((line) => line.type)
}

function firstLine(oldText: string, newText: string) {
  const line = compareTexts(oldText, newText).lines[0]

  if (!line) {
    throw new Error('Expected at least one diff line')
  }

  return line
}

describe('compareTexts', () => {
  it('handles two empty inputs', () => {
    const result = compareTexts('', '')

    expect(result.lines).toEqual([])
    expect(result.summary).toEqual({ equal: 0, added: 0, removed: 0, modified: 0 })
  })

  it('recognizes completely identical text', () => {
    const result = compareTexts('alpha\nbeta', 'alpha\nbeta')

    expect(lineTypes('alpha\nbeta', 'alpha\nbeta')).toEqual(['equal', 'equal'])
    expect(result.summary).toEqual({ equal: 2, added: 0, removed: 0, modified: 0 })
  })

  it('marks all lines as removed when only old text exists', () => {
    expect(lineTypes('alpha\nbeta', '')).toEqual(['removed', 'removed'])
  })

  it('marks all lines as added when only new text exists', () => {
    expect(lineTypes('', 'alpha\nbeta')).toEqual(['added', 'added'])
  })

  it('detects a single added line', () => {
    expect(lineTypes('alpha', 'alpha\nbeta')).toEqual(['equal', 'added'])
  })

  it('detects a single removed line', () => {
    expect(lineTypes('alpha\nbeta', 'alpha')).toEqual(['equal', 'removed'])
  })

  it('detects a single modified line', () => {
    expect(lineTypes('alpha', 'alpine')).toEqual(['modified'])
  })

  it('detects an inserted line in the middle of multiple lines', () => {
    expect(lineTypes('alpha\ngamma', 'alpha\nbeta\ngamma')).toEqual(['equal', 'added', 'equal'])
  })

  it('detects a removed line in the middle of multiple lines', () => {
    expect(lineTypes('alpha\nbeta\ngamma', 'alpha\ngamma')).toEqual(['equal', 'removed', 'equal'])
  })

  it('detects a modified line in the middle of multiple lines', () => {
    expect(lineTypes('alpha\nbeta\ngamma', 'alpha\nbetter\ngamma')).toEqual(['equal', 'modified', 'equal'])
  })

  it('detects consecutive added lines', () => {
    expect(lineTypes('alpha\nomega', 'alpha\nbeta\ngamma\nomega')).toEqual(['equal', 'added', 'added', 'equal'])
  })

  it('detects consecutive removed lines', () => {
    expect(lineTypes('alpha\nbeta\ngamma\nomega', 'alpha\nomega')).toEqual(['equal', 'removed', 'removed', 'equal'])
  })

  it('normalizes Windows and Unix newlines before comparing', () => {
    expect(lineTypes('alpha\r\nbeta', 'alpha\nbeta')).toEqual(['equal', 'equal'])
  })

  it('treats a trailing newline as an extra blank line', () => {
    const result = compareTexts('alpha', 'alpha\n')

    expect(result.lines).toMatchObject([
      { type: 'equal', oldText: 'alpha', newText: 'alpha' },
      { type: 'added', newText: '' },
    ])
    expect(result.summary).toEqual({ equal: 1, added: 1, removed: 0, modified: 0 })
  })

  it('ignores trailing spaces and tabs by default', () => {
    expect(lineTypes('alpha  \n beta\t', 'alpha\n beta')).toEqual(['equal', 'equal'])
  })

  it('detects trailing whitespace when that option is disabled', () => {
    expect(lineTypes('alpha  ', 'alpha', { ignoreTrailingWhitespace: false })).toEqual(['modified'])
  })

  it('does not ignore blank lines by default', () => {
    expect(lineTypes('alpha\n\nbeta', 'alpha\nbeta')).toEqual(['equal', 'removed', 'equal'])
  })

  it('ignores whitespace-only blank lines when enabled', () => {
    expect(lineTypes('alpha\n \t\nbeta', 'alpha\nbeta', { ignoreBlankLines: true })).toEqual(['equal', 'equal'])
  })

  it('creates character-level differences for Chinese text', () => {
    const modifiedLine = firstLine('玄仲已经达到九十级。', '玄仲已经突破九十级。')

    expect(modifiedLine.type).toBe('modified')
    expect(modifiedLine.oldSegments?.some((segment) => segment.type === 'removed' && segment.text === '达到')).toBe(true)
    expect(modifiedLine.newSegments?.some((segment) => segment.type === 'added' && segment.text === '突破')).toBe(true)
  })

  it('pairs high-similarity changed lines as modified', () => {
    expect(lineTypes('colour mode', 'color mode')).toEqual(['modified'])
  })

  it('keeps low-similarity changed lines as removed and added', () => {
    expect(lineTypes('old account', 'new database')).toEqual(['removed', 'added'])
  })

  it('does not force delete-me and insert-me into a modified line', () => {
    expect(lineTypes('alpha\ndelete-me\nomega', 'alpha\ninsert-me\nomega')).toEqual([
      'equal',
      'removed',
      'added',
      'equal',
    ])
  })

  it('keeps unrelated Chinese lines as removed and added', () => {
    expect(lineTypes('苹果', '数据库连接配置失败')).toEqual(['removed', 'added'])
  })

  it('does not pair an empty line and non-empty line as modified', () => {
    expect(lineTypes('\nend', 'content\nend')).toEqual(['removed', 'added', 'equal'])
  })

  it('has stable line similarity threshold behavior', () => {
    expect(calculateLineSimilarity('abcd', 'abef')).toBeGreaterThanOrEqual(MODIFIED_LINE_SIMILARITY_THRESHOLD)
    expect(calculateLineSimilarity('abcde', 'abxyz')).toBeLessThan(MODIFIED_LINE_SIMILARITY_THRESHOLD)
  })

  it('handles mixed Chinese and English text', () => {
    const result = compareTexts('版本 v1 已发布', '版本 v2 已发布')

    expect(result.summary.modified).toBe(1)
  })

  it('handles common emoji input without crashing', () => {
    const result = compareTexts('状态 😀 完成', '状态 😄 完成')

    expect(result.summary.modified).toBe(1)
  })

  it('can rebuild original old and new text from modified character segments', () => {
    const modifiedLine = firstLine('alpha beta', 'alpha brave beta')
    const oldText = modifiedLine.oldSegments?.map((segment) => segment.text).join('')
    const newText = modifiedLine.newSegments?.map((segment) => segment.text).join('')

    expect(oldText).toBe('alpha beta')
    expect(newText).toBe('alpha brave beta')
  })

  it('returns correct summary counts', () => {
    const result = compareTexts('same\nold\nremove\nend', 'same\nnew\nend\nadded')

    expect(result.summary).toEqual({ equal: 2, added: 2, removed: 2, modified: 0 })
  })

  it('does not mutate original inputs', () => {
    const oldText = 'alpha  '
    const newText = 'alpha'

    compareTexts(oldText, newText)

    expect(oldText).toBe('alpha  ')
    expect(newText).toBe('alpha')
  })
})

describe('diff formatting', () => {
  it('formats summary as plain text', () => {
    expect(formatDiffSummary({ equal: 1, added: 2, removed: 3, modified: 4 })).toBe(
      '文本对比结果\n\n相同：1 行\n新增：2 行\n删除：3 行\n修改：4 行',
    )
  })

  it('formats full diff as plain text', () => {
    const result = compareTexts('same\nold', 'same\nnew')

    expect(formatFullDiff(result.lines)).toBe('  same\n- old\n+ new')
  })
})
