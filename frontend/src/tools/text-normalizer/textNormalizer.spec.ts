import { describe, expect, it } from 'vitest'

import { normalizeText } from './textNormalizer'
import type { TextNormalizerOptions } from './textNormalizer'

const allOff: TextNormalizerOptions = {
  cleanCopyResidue: false,
  normalizeWhitespace: false,
  addCjkLatinSpacing: false,
  normalizePunctuationSpacing: false,
  normalizeFullWidthAlphanumeric: false,
}

function withOption(option: keyof TextNormalizerOptions): TextNormalizerOptions {
  return { ...allOff, [option]: true }
}

describe('normalizeText', () => {
  it('preserves ordinary content with all options off while normalizing newlines', () => {
    expect(normalizeText('', allOff)).toBe('')
    expect(normalizeText('  A   B\n\n中文English  ', allOff)).toBe('  A   B\n\n中文English  ')
    expect(normalizeText('a\r\n\r\nb\rc', allOff)).toBe('a\n\nb\nc')
  })

  it('always removes one document-leading BOM and preserves an internal BOM by default', () => {
    expect(normalizeText('\uFEFFStart\uFEFFMiddle', allOff)).toBe('Start\uFEFFMiddle')
    expect(normalizeText('\uFEFF\uFEFFStart', allOff)).toBe('\uFEFFStart')
  })

  it('uses the shared copy-residue contract only when enabled', () => {
    const input = 'A\u200BB\u00ADC\u00A0D\uFEFFE\u200CF\u200DG-state-of-the-art'

    expect(normalizeText(input, allOff)).toBe(input)
    expect(normalizeText(input, withOption('cleanCopyResidue'))).toBe(
      'ABC DE\u200CF\u200DG-state-of-the-art',
    )
    expect(normalizeText('environ-\nmental', withOption('cleanCopyResidue'))).toBe('environ-\nmental')
  })

  it('normalizes ordinary whitespace per line without removing lines or all leading indentation', () => {
    const input = '  aligned\t\ttext  \n\t \u3000\u00a0\n\n    column'

    expect(normalizeText(input, allOff)).toBe(input)
    expect(normalizeText(input, withOption('normalizeWhitespace'))).toBe(
      ' aligned text\n\n\n column',
    )
  })

  it('adds one space at Han and ASCII Latin or digit boundaries', () => {
    const options = withOption('addCjkLatinSpacing')

    expect(normalizeText('中文English English中文 中文2026 2026中文', options)).toBe(
      '中文 English English 中文 中文 2026 2026 中文',
    )
    expect(normalizeText('这是ChatGPT生成的', options)).toBe('这是 ChatGPT 生成的')
    expect(normalizeText('3D打印 2026年', options)).toBe('3D 打印 2026 年')
    expect(normalizeText('中文\t\tEnglish English   中文', options)).toBe('中文 English English 中文')
  })

  it('keeps technical tokens intact while spacing their Han boundaries', () => {
    const options = withOption('addCjkLatinSpacing')
    const tokens = 'GPT-5 Python3 Vue3 iPhone17 C++ C# Node.js v2.1.0'

    expect(normalizeText(tokens, options)).toBe(tokens)
    expect(normalizeText('使用GPT-5模型，运行Python3代码，学习C++语言', options)).toBe(
      '使用 GPT-5 模型，运行 Python3 代码，学习 C++ 语言',
    )
  })

  it('normalizes conservative punctuation spacing without converting glyphs', () => {
    const options = withOption('normalizePunctuationSpacing')

    expect(normalizeText('Hello , world !', options)).toBe('Hello, world!')
    expect(normalizeText('你好 ， 世界 ！', options)).toBe('你好， 世界！')
    expect(normalizeText('（ 内容 ）【 示例 】', options)).toBe('（内容）【示例】')
    expect(normalizeText('Hello,world 你好,世界!', options)).toBe('Hello,world 你好,世界!')
    expect(normalizeText('1 . 5\n98.5 %\n$ 20.50\n1 : 2\n10: 30\nv 2.1.0', options)).toBe(
      '1.5\n98.5%\n$20.50\n1:2\n10:30\nv2.1.0',
    )
  })

  it('protects technical fragments from punctuation cleanup', () => {
    const options = { ...allOff, normalizePunctuationSpacing: true, addCjkLatinSpacing: true }
    const technical = [
      'https://example.com/a?x=1',
      'hello@example.com',
      'C:\\Users\\name',
      '/usr/local/bin',
      '3.14159',
      'v2.1.0',
      '2026-08-27',
      'npm run dev',
      'foo_bar',
    ].join('\n')

    expect(normalizeText(technical, options)).toBe(technical)
    expect(normalizeText('使用https://example.com/a?x=1测试', options)).toBe(
      '使用 https://example.com/a?x=1 测试',
    )
  })

  it('normalizes only full-width ASCII letters and digits', () => {
    const options = withOption('normalizeFullWidthAlphanumeric')

    expect(normalizeText('ＡＢＣ１２３ ｈｅｌｌｏ', options)).toBe('ABC123 hello')
    expect(normalizeText('ＡＢＣ１２３，中文！ （）【】①²', options)).toBe(
      'ABC123，中文！ （）【】①²',
    )
    expect(normalizeText('Ａ　Ｂ', options)).toBe('A　B')
  })

  it('keeps options independent and produces deterministic combined output', () => {
    expect(normalizeText('Ａ  B', withOption('normalizeFullWidthAlphanumeric'))).toBe('A  B')
    expect(normalizeText('中文 ，English', withOption('addCjkLatinSpacing'))).toBe('中文 ，English')

    const copyAndWhitespace = { ...allOff, cleanCopyResidue: true, normalizeWhitespace: true }
    expect(normalizeText('A\u200B  B\u00A0C', copyAndWhitespace)).toBe('A B C')

    const widthAndSpacing = {
      ...allOff,
      normalizeFullWidthAlphanumeric: true,
      addCjkLatinSpacing: true,
    }
    expect(normalizeText('使用ＧＰＴ５模型', widthAndSpacing)).toBe('使用 GPT5 模型')

    const whitespaceAndPunctuation = {
      ...allOff,
      normalizeWhitespace: true,
      normalizePunctuationSpacing: true,
    }
    expect(normalizeText('Hello   ,\tworld !  ', whitespaceAndPunctuation)).toBe('Hello, world!')

    const allOn: TextNormalizerOptions = {
      cleanCopyResidue: true,
      normalizeWhitespace: true,
      addCjkLatinSpacing: true,
      normalizePunctuationSpacing: true,
      normalizeFullWidthAlphanumeric: true,
    }
    const input = '\uFEFF使用ＧＰＴ５\u200B模型 ： https://example.com/a?x=1\nＡ   B ！'
    const once = normalizeText(input, allOn)

    expect(once).toBe('使用 GPT5 模型： https://example.com/a?x=1\nA B！')
    expect(normalizeText(once, allOn)).toBe(once)
  })
})
