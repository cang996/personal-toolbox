import { describe, expect, it } from 'vitest'

import { normalizeText } from './textNormalizer'
import type { TextNormalizerOptions } from './textNormalizer'
import { normalizeChinesePublicationText } from './chinesePublicationStandard'

const allPersonalOptionsOff: TextNormalizerOptions = {
  cleanCopyResidue: false,
  normalizeWhitespace: false,
  addCjkLatinSpacing: false,
  normalizePunctuationSpacing: false,
  normalizeFullWidthAlphanumeric: false,
}

describe('normalizeChinesePublicationText', () => {
  it('normalizes unambiguous Chinese outer punctuation', () => {
    expect(normalizeChinesePublicationText('这是测试,继续.')).toBe('这是测试，继续。')
    expect(normalizeChinesePublicationText('你好!\n为什么?')).toBe('你好！\n为什么？')
    expect(normalizeChinesePublicationText('他说Python,然后继续.')).toBe('他说Python，然后继续。')
    expect(normalizeChinesePublicationText('说明如下:Information.')).toBe('说明如下：Information。')
    expect(
      normalizeChinesePublicationText('天气很热,她还是要 ice cream;天气冷了,她也要 ice cream.'),
    ).toBe('天气很热，她还是要 ice cream；天气冷了，她也要 ice cream。')
  })

  it('keeps English-only text unchanged', () => {
    const input = 'This is English, and it stays English.\nAre you serious?\nHello: world!'
    expect(normalizeChinesePublicationText(input)).toBe(input)
  })

  it('protects clear English islands inside Chinese quotes and parentheses', () => {
    const input = [
      '他说：“It depends.”。',
      '她问：“Are you serious?”。',
      '报道中写道：“The debt, if any, is to be written off.”。',
      '同学说：“Come with us, and you can choose; stay home, and wait.”。',
      '脱氧核糖核酸（deoxyribonucleic acid, DNA）很重要.',
      'DIY（Do It Yourself）教育',
    ].join('\n')
    const expected = [
      '他说：“It depends.”。',
      '她问：“Are you serious?”。',
      '报道中写道：“The debt, if any, is to be written off.”。',
      '同学说：“Come with us, and you can choose; stay home, and wait.”。',
      '脱氧核糖核酸（deoxyribonucleic acid, DNA）很重要。',
      'DIY（Do It Yourself）教育',
    ].join('\n')

    expect(normalizeChinesePublicationText(input)).toBe(expected)
  })

  it('protects technical fragments while normalizing surrounding Chinese punctuation', () => {
    const input = [
      '访问https://example.com/a?x=1,然后继续.',
      '详情见https://example.com.',
      '联系hello@example.com,然后等待.',
      '版本v2.1.0,已经发布.',
      '时间10:30,开始.',
      '比例1:2,结果正常.',
      '价格$20.50,可以接受.',
      '路径C:\\Users\\name,不要修改.',
      '目录/usr/local/bin,不要修改.',
      '日期2026-08-28,已经确认.',
      '使用GPT-5,C++,C#和Node.js.',
    ].join('\n')
    const expected = [
      '访问https://example.com/a?x=1，然后继续。',
      '详情见https://example.com。',
      '联系hello@example.com，然后等待。',
      '版本v2.1.0，已经发布。',
      '时间10:30，开始。',
      '比例1:2，结果正常。',
      '价格$20.50，可以接受。',
      '路径C:\\Users\\name，不要修改。',
      '目录/usr/local/bin，不要修改。',
      '日期2026-08-28，已经确认。',
      '使用GPT-5，C++，C#和Node.js。',
    ].join('\n')

    expect(normalizeChinesePublicationText(input)).toBe(expected)
  })

  it('does not force the optional Han and English spacing choice', () => {
    expect(normalizeChinesePublicationText('中文Python')).toBe('中文Python')
    expect(normalizeChinesePublicationText('中文 Python')).toBe('中文 Python')
  })

  it('removes extra spaces between Chinese punctuation and adjacent English', () => {
    expect(normalizeChinesePublicationText('Python ，Java')).toBe('Python，Java')
    expect(normalizeChinesePublicationText('： Information')).toBe('：Information')
    expect(normalizeChinesePublicationText('（ Python ）')).toBe('（Python）')
  })

  it('converts only full-width digits to half-width form', () => {
    expect(normalizeChinesePublicationText('２０２６')).toBe('2026')
    expect(normalizeChinesePublicationText('ＡＢＣ２０２６，中文！')).toBe('ＡＢＣ2026，中文！')
  })

  it('composes standard rules before existing personal options', () => {
    const personalSpacing = { ...allPersonalOptionsOff, addCjkLatinSpacing: true }
    const standardOnly = normalizeText(
      normalizeChinesePublicationText('中文Python ，测试.'),
      allPersonalOptionsOff,
    )
    const combined = normalizeText(
      normalizeChinesePublicationText('中文Python,版本２０２６.'),
      personalSpacing,
    )

    expect(standardOnly).toBe('中文Python，测试。')
    expect(combined).toBe('中文 Python，版本 2026。')
  })

  it('is idempotent alone and when composed with all personal options', () => {
    const input = '使用ＧＰＴ５和Python ，访问https://example.com/a?x=1,版本２０２６.'
    const once = normalizeChinesePublicationText(input)
    expect(normalizeChinesePublicationText(once)).toBe(once)

    const allPersonalOptionsOn: TextNormalizerOptions = {
      cleanCopyResidue: true,
      normalizeWhitespace: true,
      addCjkLatinSpacing: true,
      normalizePunctuationSpacing: true,
      normalizeFullWidthAlphanumeric: true,
    }
    const combinedOnce = normalizeText(once, allPersonalOptionsOn)
    const combinedTwice = normalizeText(
      normalizeChinesePublicationText(combinedOnce),
      allPersonalOptionsOn,
    )

    expect(combinedTwice).toBe(combinedOnce)
  })
})
