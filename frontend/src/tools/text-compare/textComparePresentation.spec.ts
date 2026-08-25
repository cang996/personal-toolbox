import { describe, expect, it } from 'vitest'

import { compareTexts } from './textDiff'
import {
  checkTextSize,
  createDisplayDiffItems,
  extremeTextMessage,
  longTextMessage,
} from './textComparePresentation'

describe('text compare presentation helpers', () => {
  it('counts Unicode code points for text-size limits', () => {
    expect(checkTextSize('😀').characterCount).toBe(1)
  })

  it('uses strict boundaries for long-text warnings and extreme limits', () => {
    expect(checkTextSize('a'.repeat(20_000)).isLong).toBe(false)
    expect(checkTextSize('a'.repeat(20_001)).isLong).toBe(true)
    expect(checkTextSize('a'.repeat(100_000)).isExtreme).toBe(false)
    expect(checkTextSize('a'.repeat(100_001)).isExtreme).toBe(true)
    expect(checkTextSize(Array.from({ length: 1_000 }, () => 'a').join('\n')).isLong).toBe(false)
    expect(checkTextSize(Array.from({ length: 1_001 }, () => 'a').join('\n')).isLong).toBe(true)
    expect(checkTextSize(Array.from({ length: 5_000 }, () => 'a').join('\n')).isExtreme).toBe(false)
    expect(checkTextSize(Array.from({ length: 5_001 }, () => 'a').join('\n')).isExtreme).toBe(true)
  })

  it('identifies the side that needs a warning or is over the limit', () => {
    expect(longTextMessage('a'.repeat(20_001), '')).toContain('旧文本较长')
    expect(longTextMessage('a'.repeat(20_001), 'a'.repeat(20_001))).toContain('两侧文本都较长')
    expect(extremeTextMessage('', 'a'.repeat(100_001))).toContain('新文本超出限制')
  })

  it('filters only equal display items and coalesces each omitted run', () => {
    const result = compareTexts('same 1\nold\nsame 2\nsame 3', 'same 1\nnew\nsame 2\nsame 3')

    expect(createDisplayDiffItems(result.lines, false)).toHaveLength(5)
    expect(createDisplayDiffItems(result.lines, true)).toMatchObject([
      { type: 'omitted-equal', count: 1 },
      { type: 'line', line: { type: 'removed' } },
      { type: 'line', line: { type: 'added' } },
      { type: 'omitted-equal', count: 2 },
    ])
  })
})
