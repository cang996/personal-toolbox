import { describe, expect, it } from 'vitest'

import { cleanPdfText } from './pdfTextCleaner'

const removeCjkLatinSpaces = { removeCjkLatinSpaces: true }
const withCopyResidueCleanup = { removeCjkLatinSpaces: true, cleanCopyResidue: true }

describe('cleanPdfText', () => {
  it('returns empty text for empty or whitespace-only input', () => {
    expect(cleanPdfText('', removeCjkLatinSpaces)).toBe('')
    expect(cleanPdfText(' \n\t ', removeCjkLatinSpaces)).toBe('')
  })

  it('keeps single-line Chinese and English text', () => {
    expect(cleanPdfText('单行中文', removeCjkLatinSpaces)).toBe('单行中文')
    expect(cleanPdfText('Hidden Disabilities Sunflower', removeCjkLatinSpaces)).toBe('Hidden Disabilities Sunflower')
  })

  it('normalizes CRLF and joins English lines with a space', () => {
    expect(cleanPdfText('walkable city\r\n environment\rcentre', removeCjkLatinSpaces)).toBe('walkable city environment centre')
  })

  it('removes abnormal CJK spacing while preserving English word spacing', () => {
    expect(cleanPdfText('版 本 ， 但 Java API', removeCjkLatinSpaces)).toBe('版本，但Java API')
  })

  it('applies the CJK and Latin spacing option without joining English words', () => {
    expect(cleanPdfText('Android 和 Java API', removeCjkLatinSpaces)).toBe('Android和Java API')
    expect(cleanPdfText('Android 和 Java API', { removeCjkLatinSpaces: false })).toBe('Android 和 Java API')
  })

  describe('copy residue cleanup', () => {
    it('preserves contracted residues when the option is off', () => {
      const input = 'A\u200BB\u00ADC\u00A0D\uFEFFE'

      expect(cleanPdfText(input, removeCjkLatinSpaces)).toBe(input)
    })

    it('removes contracted residues and converts NBSP when the option is on', () => {
      expect(cleanPdfText('A\u200BB\u00ADC\u00A0D\uFEFFE', withCopyResidueCleanup)).toBe('ABC DE')
      expect(cleanPdfText('标签\u200B：\n• 项\u00AD目', withCopyResidueCleanup)).toBe('标签：\n• 项目')
    })

    it('always removes one leading BOM while preserving an internal BOM when cleanup is off', () => {
      expect(cleanPdfText('\uFEFFStart\uFEFFMiddle', removeCjkLatinSpaces)).toBe('Start\uFEFFMiddle')
      expect(cleanPdfText('\uFEFFStart\uFEFFMiddle', withCopyResidueCleanup)).toBe('StartMiddle')
    })

    it('preserves ZWNJ and ZWJ with cleanup both off and on', () => {
      const input = 'A\u200CB\u200DC'

      expect(cleanPdfText(input, removeCjkLatinSpaces)).toBe(input)
      expect(cleanPdfText(input, withCopyResidueCleanup)).toBe(input)
    })

    it('does not clean residue inside protected code, URL, or email lines', () => {
      const code = 'const value = "\u200B\u00AD\u00A0\uFEFF";'
      const url = 'https://example.com/\u200B\u00AD\uFEFFpath'
      const email = 'user\u200B\u00AD\uFEFF@example.com'
      const input = `${code}\n${url}\n${email}`

      expect(cleanPdfText(input, withCopyResidueCleanup)).toBe(input)
    })
  })

  it('preserves paragraph boundaries and normalizes repeated blank lines', () => {
    expect(cleanPdfText('first line\nsecond line\n\n\nthird line', removeCjkLatinSpaces)).toBe('first line second line\n\nthird line')
  })

  it('keeps supported list starts on separate lines and joins their continuations', () => {
    expect(cleanPdfText('● First item\ncontinues\n• Second item\n1. Third item\n1) Fourth item\n（1）第五项', removeCjkLatinSpaces)).toBe(
      '● First item continues\n• Second item\n1. Third item\n1) Fourth item\n（1）第五项',
    )
  })

  it('restores only the supported short labels', () => {
    expect(cleanPdfText('以\n小\n组\n讨\n论\n谁\n：\n确\n定\n他\n说\n：\n“\n好\n”', removeCjkLatinSpaces)).toBe(
      '以小组讨论\n谁：确定他说：“好”',
    )
  })

  it('cleans the English prose and list regression sample', () => {
    const input = `Freddy enjoys the independence that public transport provides and values Melbourne's walkable city 
environment. He commutes daily to Melbourne’s CBD via train and tram.
● Metro Trains in Melbourne launch the Hidden Disabilities
Sunflower
● Designing cities for neurodiversity – why we need
inclusive public open spaces | City Futures Research
Centre Blog`

    expect(cleanPdfText(input, removeCjkLatinSpaces)).toBe(
      "Freddy enjoys the independence that public transport provides and values Melbourne's walkable city environment. He commutes daily to Melbourne’s CBD via train and tram.\n● Metro Trains in Melbourne launch the Hidden Disabilities Sunflower\n● Designing cities for neurodiversity – why we need inclusive public open spaces | City Futures Research Centre Blog",
    )
  })

  it('cleans the character-by-character Chinese labels regression sample', () => {
    const input = '以\n小\n组\n讨\n论\n形\n式\n进\n行\n，\n并\n就\n以\n下\n内\n容\n做\n笔\n记\n谁\n：\n确\n定\n遇\n到\n问\n题\n的\n群\n体\n什\n么\n：\n定\n义\n具\n体\n的\n问\n题\n地\n点\n：\n确\n定\n问\n题\n发\n生\n的\n背\n景\n原\n因\n：\n解\n释\n问\n题\n背\n后\n的\n成\n因'

    expect(cleanPdfText(input, removeCjkLatinSpaces)).toBe(
      '以小组讨论形式进行，并就以下内容做笔记\n谁：确定遇到问题的群体\n什么：定义具体的问题\n地点：确定问题发生的背景\n原因：解释问题背后的成因',
    )
  })

  it('cleans the mixed CJK, Latin, and list regression sample', () => {
    const input = `• 分 布 式 系 统 概 述 
• Gradle 文 件 
• 调 试
minSdk 指 定 了 应 用 支 持 的 最 低 版 本 ， 但 
使 用 过 低 的 版 本 可 能 会 导 致 兼 容 性 
问 题 。 
compileSdk 决 定 了 编 译 代 码 时 使 用 的 
Android 和 Java API 的 版 本 。`

    expect(cleanPdfText(input, removeCjkLatinSpaces)).toBe(
      '• 分布式系统概述\n• Gradle文件\n• 调试\nminSdk指定了应用支持的最低版本，但使用过低的版本可能会导致兼容性问题。\ncompileSdk决定了编译代码时使用的Android和Java API的版本。',
    )
  })

  describe('paragraph recovery boundaries', () => {
    it('merges wrapped Chinese prose while preserving blank and complete-sentence boundaries', () => {
      expect(cleanPdfText('这是第一行，\n这是同一段第二行，\n这是同一段第三行。', removeCjkLatinSpaces)).toBe(
        '这是第一行，这是同一段第二行，这是同一段第三行。',
      )
      expect(cleanPdfText('这是第一段。\n\n这是第二段。', removeCjkLatinSpaces)).toBe('这是第一段。\n\n这是第二段。')
      expect(cleanPdfText('这是第一句话。\n这是第二句话。', removeCjkLatinSpaces)).toBe('这是第一句话。\n这是第二句话。')
    })

    it('merges wrapped English and mixed-language prose without treating it as a heading', () => {
      expect(cleanPdfText('This is a sentence that was wrapped\nby the PDF layout.', removeCjkLatinSpaces)).toBe(
        'This is a sentence that was wrapped by the PDF layout.',
      )
      expect(cleanPdfText('这个工具支持Vue 3和\nTypeScript projects.', removeCjkLatinSpaces)).toBe(
        '这个工具支持Vue 3和TypeScript projects.',
      )
    })

    it('keeps independent complete sentences even when the first sentence is long', () => {
      const first = `This deliberately long sentence exceeds the old arbitrary length threshold while still ending as a complete independent sentence.`
      const second = 'This is another complete sentence.'

      expect(cleanPdfText(`${first}\n${second}`, removeCjkLatinSpaces)).toBe(`${first}\n${second}`)
    })

    it('protects only the heading-to-body boundary and merges wrapped body lines', () => {
      expect(
        cleanPdfText('Introduction\nThis is the first line of the paragraph\nand this is the continuation.', removeCjkLatinSpaces),
      ).toBe('Introduction\nThis is the first line of the paragraph and this is the continuation.')
      expect(cleanPdfText('项目背景\n这是正文第一行\n这是正文第二行', removeCjkLatinSpaces)).toBe(
        '项目背景\n这是正文第一行这是正文第二行',
      )
      expect(cleanPdfText('项目背景\n正文第一行\n正文第二行', removeCjkLatinSpaces)).toBe('项目背景\n正文第一行正文第二行')
    })

    it('keeps a body-confirmed weak heading independent of unrelated preceding short lines', () => {
      const headingAndBody = '项目背景\n正文第一行正文第二行'

      expect(cleanPdfText('AB\nwell-known\n项目背景\n正文第一行\n正文第二行', removeCjkLatinSpaces)).toBe(
        `AB\nwell-known\n${headingAndBody}`,
      )
      expect(cleanPdfText('A\u200BB\nwell-known\n项目背景\n正文第一行\n正文第二行', withCopyResidueCleanup)).toBe(
        `AB\nwell-known\n${headingAndBody}`,
      )
      expect(cleanPdfText('前置普通文本\n项目背景\n正文第一行\n正文第二行', removeCjkLatinSpaces)).toBe(
        `前置普通文本\n${headingAndBody}`,
      )
      expect(cleanPdfText('项目背景\n正文第一行\n正文第二行', removeCjkLatinSpaces)).toBe(headingAndBody)
    })

    it('keeps consecutive ambiguous structural lines while still merging short wrapped prose', () => {
      expect(cleanPdfText('项目背景\nIntroduction\nConclusion\nReferences', removeCjkLatinSpaces)).toBe(
        '项目背景\nIntroduction\nConclusion\nReferences',
      )
      expect(cleanPdfText('Introduction\nConclusion\nReferences', removeCjkLatinSpaces)).toBe(
        'Introduction\nConclusion\nReferences',
      )
      expect(cleanPdfText('AB\nwell-known', removeCjkLatinSpaces)).toBe('AB\nwell-known')
      expect(cleanPdfText('A short phrase\ncontinued here.', removeCjkLatinSpaces)).toBe(
        'A short phrase continued here.',
      )
    })

    it('treats ambiguous short Chinese prose conservatively instead of forcing a heading', () => {
      expect(cleanPdfText('这是正文\n下一行正文', removeCjkLatinSpaces)).toBe('这是正文下一行正文')
    })

    it('separates new list items and prose while merging clear list continuations', () => {
      expect(cleanPdfText('1. First item\n2. Second item', removeCjkLatinSpaces)).toBe('1. First item\n2. Second item')
      expect(cleanPdfText('1. First item\n   continuation of first item', removeCjkLatinSpaces)).toBe(
        '1. First item continuation of first item',
      )
      expect(cleanPdfText('1. First item\nThis is a new paragraph.', removeCjkLatinSpaces)).toBe(
        '1. First item\nThis is a new paragraph.',
      )
      expect(cleanPdfText('• 调试\n这是新段落。', removeCjkLatinSpaces)).toBe('• 调试\n这是新段落。')
    })

    it('keeps literal hyphenated line breaks without dehyphenating them', () => {
      expect(cleanPdfText('environ-\nmental', removeCjkLatinSpaces)).toBe('environ-\nmental')
      expect(cleanPdfText('well-\nknown', removeCjkLatinSpaces)).toBe('well-\nknown')
      expect(cleanPdfText('state-of-the-\nart', removeCjkLatinSpaces)).toBe('state-of-the-\nart')
    })
  })

  describe('exploratory structure regressions', () => {
    it('keeps conservative English and Chinese headings separate from following prose', () => {
      expect(cleanPdfText('Introduction\nThis section explains the background of the project.\n\n项目背景\n本项目主要解决问题。', removeCjkLatinSpaces)).toBe(
        'Introduction\nThis section explains the background of the project.\n\n项目背景\n本项目主要解决问题。',
      )
      expect(cleanPdfText('第一段\n这是第一段内容。\n第二段\n这是第二段内容。', removeCjkLatinSpaces)).toBe(
        '第一段\n这是第一段内容。\n第二段\n这是第二段内容。',
      )
    })

    it('does not mistake negative numbers or decimals for list items', () => {
      expect(cleanPdfText('-5 degrees\ncan feel cold.', removeCjkLatinSpaces)).toBe('-5 degrees can feel cold.')
      expect(cleanPdfText('1.5 is a decimal\nvalue.', removeCjkLatinSpaces)).toBe('1.5 is a decimal value.')
    })

    it('keeps list items separate, ends a list at a heading, and preserves hyphenated line breaks', () => {
      const input = `1. Main item
continues here
* Child item
continues too
项目背景
本项目主要解决问题。
2. Next item
neuro-
divergent`

      expect(cleanPdfText(input, removeCjkLatinSpaces)).toBe(
        '1. Main item continues here\n* Child item continues too\n项目背景\n本项目主要解决问题。\n2. Next item\nneuro-\ndivergent',
      )
    })

    it('normalizes English punctuation spacing without changing the CJK and Latin option behavior', () => {
      expect(cleanPdfText('Hello , world !', removeCjkLatinSpaces)).toBe('Hello, world!')
      expect(cleanPdfText('Vue 3', removeCjkLatinSpaces)).toBe('Vue 3')
    })

    it('keeps URLs, emails, and simple code lines independent from prose', () => {
      const input = `Before the link
https://example.com/path
test@example.com
const value = 1;
After the code`

      expect(cleanPdfText(input, removeCjkLatinSpaces)).toBe(
        'Before the link\nhttps://example.com/path\ntest@example.com\nconst value = 1;\nAfter the code',
      )
    })

    it('keeps the complete exploratory input structurally separated', () => {
      const input = `Introduction
This section explains the background of the project.

项目背景
本项目主要解决问题。

1. Main item
continues here
* Child item
continues too
第一段
这是第一段内容。

https://example.com/path
test@example.com
const value = 1;
Hello , world !



Vue 3`

      expect(cleanPdfText(input, removeCjkLatinSpaces)).toBe(
        'Introduction\nThis section explains the background of the project.\n\n项目背景\n本项目主要解决问题。\n\n1. Main item continues here\n* Child item continues too\n第一段\n这是第一段内容。\n\nhttps://example.com/path\ntest@example.com\nconst value = 1;\nHello, world!\n\nVue 3',
      )
    })

    it('keeps short completed sentences and numeric sentences on separate lines', () => {
      expect(cleanPdfText('这是第一段，没有空行，但本来应该结束。\n这是第二段，本来应该另起一段。', removeCjkLatinSpaces)).toBe(
        '这是第一段，没有空行，但本来应该结束。\n这是第二段，本来应该另起一段。',
      )
      expect(cleanPdfText('项目背景\n本项目主要解决……\n-5 degrees is very cold.\n1.5 is greater than 1.2.', removeCjkLatinSpaces)).toBe(
        '项目背景\n本项目主要解决……\n-5 degrees is very cold.\n1.5 is greater than 1.2.',
      )
    })

    it('isolates both lines in consecutive hyphenated word pairs', () => {
      expect(cleanPdfText('neuro-\ndivergent', removeCjkLatinSpaces)).toBe('neuro-\ndivergent')
      expect(cleanPdfText('neuro-\ndivergent\nsensory-\nfriendly\n正文', removeCjkLatinSpaces)).toBe(
        'neuro-\ndivergent\nsensory-\nfriendly\n正文',
      )
      expect(cleanPdfText('- Sub item', removeCjkLatinSpaces)).toBe('- Sub item')
    })

    it('removes spaces before common Chinese punctuation without changing protected content', () => {
      expect(cleanPdfText('字 。 字 ， 字 ！ 字 ？ ） 。 ） ， 】 。 》 。', removeCjkLatinSpaces)).toBe(
        '字。字，字！字？）。），】。》。',
      )
      expect(cleanPdfText('Hello , world !', removeCjkLatinSpaces)).toBe('Hello, world!')
      expect(cleanPdfText('https://example.com/path\ntest@example.com\nconst value = 1;\n1.5', removeCjkLatinSpaces)).toBe(
        'https://example.com/path\ntest@example.com\nconst value = 1;\n1.5',
      )
    })

    it('keeps the complete screenshot regression input structurally separated', () => {
      const input = `这是第一段，没有空行，但本来应该结束。
这是第二段，本来应该另起一段。

Introduction
This section explains the background of the project.

项目背景
本项目主要解决……
-5 degrees is very cold.
1.5 is greater than 1.2.

1. Main item
continues here
* Sub item
continues too
neuro-
divergent
sensory-
friendly
这是一段文本（包含括号） 。
Hello , world !
Vue 3 是 一 个 前 端 框 架 。
API 版 本 是 v 2 。

https://example.com/path
test@example.com
const value = 1;

第一段


第二段
• Final item`

      expect(cleanPdfText(input, removeCjkLatinSpaces)).toBe(
        '这是第一段，没有空行，但本来应该结束。\n这是第二段，本来应该另起一段。\n\nIntroduction\nThis section explains the background of the project.\n\n项目背景\n本项目主要解决……\n-5 degrees is very cold.\n1.5 is greater than 1.2.\n\n1. Main item continues here\n* Sub item continues too\nneuro-\ndivergent\nsensory-\nfriendly\n这是一段文本（包含括号）。\nHello, world!\nVue 3是一个前端框架。\nAPI版本是v 2。\n\nhttps://example.com/path\ntest@example.com\nconst value = 1;\n\n第一段\n\n第二段\n• Final item',
      )
    })

    it('distinguishes numbered headings, Chinese numbered headings, and list items', () => {
      const input = `1. Introduction
This chapter explains the background of the project.
2. Methodology
The research used interviews and observations.
一、项目背景
这是中文正文。
（一）项目背景
这是另一段正文。
1、项目背景
这是第三段正文。
1. First step
continues here
2. Second step`

      expect(cleanPdfText(input, removeCjkLatinSpaces)).toBe(
        '1. Introduction\nThis chapter explains the background of the project.\n2. Methodology\nThe research used interviews and observations.\n一、项目背景\n这是中文正文。\n（一）项目背景\n这是另一段正文。\n1、项目背景\n这是第三段正文。\n1. First step continues here\n2. Second step',
      )
    })

    it('keeps generic labels and numeric sentences separate from surrounding prose', () => {
      const input = `研究问题：
研究目标：
Documentation:
https://example.com
Contact us at test@example.com.
Email:
support@example.com
2026. The project began in Melbourne.
3.14 is approximately pi.`

      expect(cleanPdfText(input, removeCjkLatinSpaces)).toBe(
        '研究问题：\n研究目标：\nDocumentation:\nhttps://example.com\nContact us at test@example.com.\nEmail:\nsupport@example.com\n2026. The project began in Melbourne.\n3.14 is approximately pi.',
      )
    })

    it('normalizes Chinese quotation and decimal spacing without changing protected text', () => {
      expect(cleanPdfText('他说 ： “ 我 不 知 道 。 ”\n他说 ： ‘ 我 不 知 道 。 ’\n他说 ： 「 我 不 知 道 。 」\n他说 ： 『 我 不 知 道 。 』', removeCjkLatinSpaces)).toBe(
        '他说：“我不知道。”\n他说：‘我不知道。’\n他说：「我不知道。」\n他说：『我不知道。』',
      )
      expect(cleanPdfText('版本号是 1.5 ，不是 1 . 5 。\n版本号是1.5，不是1. 5。', removeCjkLatinSpaces)).toBe(
        '版本号是1.5，不是1.5。\n版本号是1.5，不是1.5。',
      )
    })

    it('preserves multi-line code blocks and keeps following prose separate', () => {
      const input = `const message =
  "Hello world";
console.log(
  message
);
下一段正文。`

      expect(cleanPdfText(input, removeCjkLatinSpaces)).toBe(
        'const message =\n  "Hello world";\nconsole.log(\n  message\n);\n下一段正文。',
      )
    })

    it('keeps the complete boundary regression sample structurally separated', () => {
      const input = `1. Introduction
This chapter explains the background of the project.
2. Methodology
The research used interviews and observations.

一、项目背景
这是中文正文。
二、用户需求
这是第二段正文。
（一）项目背景
这是第三段正文。
1、项目背景
这是第四段正文。

研究问题：
研究目标：
Documentation:
https://example.com
Contact us at test@example.com.
Email:
support@example.com

2026. The project began in Melbourne.
3.14 is approximately pi.
-5 degrees is very cold.
Vue 3 是 一 个 前 端 框 架 。
他说 ： “ 我 不 知 道 。 ”
版本号是 1.5 ，不是 1 . 5 。

1. First step
continues here
2. Second step
neuro-
divergent

const message =
  "Hello world";
console.log(
  message
);
下一段正文。


第一段


第二段
• Final item`

      expect(cleanPdfText(input, removeCjkLatinSpaces)).toBe(
        '1. Introduction\nThis chapter explains the background of the project.\n2. Methodology\nThe research used interviews and observations.\n\n一、项目背景\n这是中文正文。\n二、用户需求\n这是第二段正文。\n（一）项目背景\n这是第三段正文。\n1、项目背景\n这是第四段正文。\n\n研究问题：\n研究目标：\nDocumentation:\nhttps://example.com\nContact us at test@example.com.\nEmail:\nsupport@example.com\n\n2026. The project began in Melbourne.\n3.14 is approximately pi.\n-5 degrees is very cold.\nVue 3是一个前端框架。\n他说：“我不知道。”\n版本号是1.5，不是1.5。\n\n1. First step continues here\n2. Second step\nneuro-\ndivergent\n\nconst message =\n  "Hello world";\nconsole.log(\n  message\n);\n下一段正文。\n\n第一段\n\n第二段\n• Final item',
      )
    })

    it('ends list items before negative and mathematical sentences', () => {
      const input = '- First item\n  This is a continuation of the first item.\n- Second item\n  Another continuation line.\n-5 is a negative number.\n2 - 1 = 1.'

      expect(cleanPdfText(input, removeCjkLatinSpaces)).toBe(
        '- First item This is a continuation of the first item.\n- Second item Another continuation line.\n-5 is a negative number.\n2 - 1 = 1.',
      )
    })

    it('restores collapsed Chinese numbering and both key-value and prose labels', () => {
      const collapsed = '三\n、\n系\n统\n设\n计\n本\n系\n统\n包\n含\n以\n下\n功\n能\n：\n1\n、\n文\n本\n输\n入\n2\n、\n格\n式\n清\n理\n3\n、\n结\n果\n复\n制'

      expect(cleanPdfText(collapsed, removeCjkLatinSpaces)).toBe(
        '三、系统设计\n本系统包含以下功能：\n1、文本输入\n2、格式清理\n3、结果复制',
      )
      expect(cleanPdfText('项目名称：Personal Toolbox开发框架：Vue 3编程语言：TypeScript测试工具：Vitest', removeCjkLatinSpaces)).toBe(
        '项目名称：Personal Toolbox\n开发框架：Vue 3\n编程语言：TypeScript\n测试工具：Vitest',
      )
      expect(cleanPdfText('输入示例：这是一段从PDF复制出来的文本。\n输出结果：这是一段已经清理完成的文本。', removeCjkLatinSpaces)).toBe(
        '输入示例：\n这是一段从PDF复制出来的文本。\n\n输出结果：\n这是一段已经清理完成的文本。',
      )
    })

    it('normalizes deterministic symbol spacing and preserves code indentation', () => {
      expect(cleanPdfText('$ 20.50\n98.5 %\n1 : 2\n10: 30\nv 2.1.0\nVue 3\nNode.js 22.0', removeCjkLatinSpaces)).toBe(
        '$20.50\n98.5%\n1:2\n10:30\nv2.1.0\nVue 3\nNode.js 22.0',
      )
      expect(cleanPdfText('const options = {\n  removeCjkLatinSpaces: true,\n  preserveParagraphs: true,\n};', removeCjkLatinSpaces)).toBe(
        'const options = {\n  removeCjkLatinSpaces: true,\n  preserveParagraphs: true,\n};',
      )
    })

    it('keeps the complete latest regression sample structurally separated', () => {
      const input = `- First item
  This is a continuation of the first item.
- Second item
  Another continuation line.
-5 is a negative number.
2 - 1 = 1.

三、系统设计本系统包含以下功能：1、文本输入2、格式清理3、结果复制

项目名称：Personal Toolbox开发框架：Vue 3编程语言：TypeScript测试工具：Vitest
输入示例：这是一段从PDF复制出来的文本。
输出结果：这是一段已经清理完成的文本。

$ 20.50
98.5 %
1 : 2
10: 30
v 2.1.0
Vue 3
Node.js 22.0

const options = {
  removeCjkLatinSpaces: true,
  preserveParagraphs: true,
};`

      expect(cleanPdfText(input, removeCjkLatinSpaces)).toBe(
        '- First item This is a continuation of the first item.\n- Second item Another continuation line.\n-5 is a negative number.\n2 - 1 = 1.\n\n三、系统设计\n本系统包含以下功能：\n1、文本输入\n2、格式清理\n3、结果复制\n\n项目名称：Personal Toolbox\n开发框架：Vue 3\n编程语言：TypeScript\n测试工具：Vitest\n输入示例：\n这是一段从PDF复制出来的文本。\n\n输出结果：\n这是一段已经清理完成的文本。\n\n$20.50\n98.5%\n1:2\n10:30\nv2.1.0\nVue 3\nNode.js 22.0\n\nconst options = {\n  removeCjkLatinSpaces: true,\n  preserveParagraphs: true,\n};',
      )
    })
  })
})
