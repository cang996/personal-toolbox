import { describe, expect, it } from 'vitest'

import { countCharacters, countLines } from './textStatistics'

describe('textStatistics', () => {
  it('counts Unicode code points rather than UTF-16 code units', () => {
    expect(countCharacters('')).toBe(0)
    expect(countCharacters('abc')).toBe(3)
    expect(countCharacters('中文')).toBe(2)
    expect(countCharacters('😀')).toBe(1)
    expect(countCharacters('A中😀')).toBe(3)
  })

  it('counts normalized logical lines including a trailing empty line', () => {
    expect(countLines('')).toBe(0)
    expect(countLines('abc')).toBe(1)
    expect(countLines('a\nb')).toBe(2)
    expect(countLines('a\r\nb')).toBe(2)
    expect(countLines('a\rb')).toBe(2)
    expect(countLines('a\n')).toBe(2)
  })
})
