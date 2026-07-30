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

  it('restores equal anchors after a large replacement without forcing unrelated lines into modifications', () => {
    const result = compareTexts(
      ['【零】', '旧段落 A', '旧段落 B', '旧段落 C', '【一】', '共同段落', '一路无语。'].join('\n'),
      ['新增段落 X', '新增段落 Y', '【一】', '共同段落', '一路无言。'].join('\n'),
    )

    expect(result.lines).toMatchObject([
      { type: 'removed', oldLineNumber: 1, oldText: '【零】' },
      { type: 'removed', oldLineNumber: 2, oldText: '旧段落 A' },
      { type: 'removed', oldLineNumber: 3, oldText: '旧段落 B' },
      { type: 'removed', oldLineNumber: 4, oldText: '旧段落 C' },
      { type: 'added', newLineNumber: 1, newText: '新增段落 X' },
      { type: 'added', newLineNumber: 2, newText: '新增段落 Y' },
      { type: 'equal', oldLineNumber: 5, newLineNumber: 3, oldText: '【一】' },
      { type: 'equal', oldLineNumber: 6, newLineNumber: 4, oldText: '共同段落' },
      { type: 'modified', oldLineNumber: 7, newLineNumber: 5, oldText: '一路无语。', newText: '一路无言。' },
    ])
    expect(result.lines.filter((line) => line.type === 'modified')).toHaveLength(1)
  })

  it('matches a corresponding real paragraph as a one-to-one modified group', () => {
    const oldParagraph = '学校一放假，嬴驷便央求嬴虔送他去西安。自从找到现世的张仪，并得知此人在西安找了工作后，嬴驷每个大小假期都直奔张仪的住所，张仪也乐此不疲。'
    const newParagraph = '学校的放假通知刚一落地，嬴驷便央求好大伯嬴虔送他去西安。自打寻到张仪的踪迹、得知他在西安工作后，每个大小假期嬴驷都往那边跑，张仪也乐此不疲。'
    const result = compareTexts(oldParagraph, newParagraph)
    const modifiedLine = result.lines[0]

    expect(result.summary).toEqual({ equal: 0, added: 0, removed: 0, modified: 1 })
    expect(modifiedLine).toMatchObject({ oldLineNumbers: [1], newLineNumbers: [1] })
    expect(modifiedLine?.oldSegments?.map((segment) => segment.text).join('')).toBe(oldParagraph)
    expect(modifiedLine?.newSegments?.map((segment) => segment.text).join('')).toBe(newParagraph)
  })

  it('uses a strong shared prefix for a long one-to-one modification without merging later lines', () => {
    const sharedPrefix = '脱下的外套被随手挂在门口的衣架上，嬴驷扑向沙发'
    const oldLine = `${sharedPrefix}。掏出手机打算给张仪发条微信消息。输到一半手突然停下，他想不如给他来个惊喜，便删掉文字，退出微信。`
    const newLine = `${sharedPrefix}，余光瞥见茶几玻璃下压着的一张便签纸。是张仪的笔迹，潦草地写着：“抽屉里有个好东西，你先别看。”`
    const sharedLines = Array.from({ length: 30 }, (_, index) => `共同前置 ${index + 1}`)
    const result = compareTexts(
      [...sharedLines, oldLine, '海边落日', '松林薄雾'].join('\n'),
      [...sharedLines, newLine, '高山云雾', '城市夜灯', '远处钟声', '纸上墨迹', '窗前雨滴'].join('\n'),
    )
    const modifiedLine = result.lines.find((line) => line.type === 'modified')

    expect(modifiedLine).toMatchObject({ oldLineNumbers: [31], newLineNumbers: [31] })
    expect(modifiedLine?.oldSegments?.map((segment) => segment.text).join('')).toBe(oldLine)
    expect(modifiedLine?.newSegments?.map((segment) => segment.text).join('')).toBe(newLine)
    expect(modifiedLine?.oldSegments?.[0]).toMatchObject({ type: 'equal' })
    expect(modifiedLine?.oldSegments?.[0]?.text).toContain('嬴驷扑向沙发')
    expect(modifiedLine?.oldSegments?.some((segment) => segment.type === 'removed' && segment.text.includes('掏出手机'))).toBe(true)
    expect(modifiedLine?.newSegments?.some((segment) => segment.type === 'added' && segment.text.includes('余光瞥见'))).toBe(true)
    expect(result.lines.slice(-8).map((line) => line.type)).toEqual([
      'modified',
      'removed',
      'removed',
      'added',
      'added',
      'added',
      'added',
      'added',
    ])
  })

  it('does not use a short shared prefix as sufficient modification evidence', () => {
    expect(lineTypes('脱下外套以后，他坐在沙发上休息。', '脱下外套以后，窗外忽然下起暴雨，整座城市陷入停电。')).toEqual([
      'removed',
      'added',
    ])
  })

  it('matches one old paragraph with three consecutive new paragraphs', () => {
    const oldParagraph = '离家之前，嬴驷在玄关的白板上写下“不在家过年，开学再回”几个大字，潇洒的笔迹难以掩饰他当下的雀跃与迫不及待。他将笔随手一丢，推着小行李箱往门外跑，坐上嬴虔来接他的车，头也不回地离开了。'
    const newParagraphs = [
      '离家那天，嬴驷站在玄关的白板前大笔一挥，落下',
      '“不在家过年，开学再回”',
      '几个字，利落洒脱的笔迹难以掩饰他当下的雀跃与迫不及待。他将笔随手一丢，推着小行李箱往门外冲，直到坐上嬴虔那辆黑色奔驰的后座，他都没回头看一眼，只剩对目的地的期盼。',
    ]
    const result = compareTexts(oldParagraph, newParagraphs.join('\n'))
    const modifiedLine = result.lines[0]

    expect(result.summary).toEqual({ equal: 0, added: 0, removed: 0, modified: 1 })
    expect(modifiedLine).toMatchObject({ oldLineNumbers: [1], newLineNumbers: [1, 2, 3], oldTexts: [oldParagraph], newTexts: newParagraphs })
    expect(modifiedLine?.oldSegments?.map((segment) => segment.text).join('')).toBe(oldParagraph)
    expect(modifiedLine?.newSegments?.map((segment) => segment.text).join('')).toBe(newParagraphs.join('\n'))
  })

  it('matches one old paragraph with two consecutive new paragraphs', () => {
    const result = compareTexts('第一段相同内容，保留更多描述。', '第一段相同内容，\n保留更多描述并补充。')

    expect(result.summary).toEqual({ equal: 0, added: 0, removed: 0, modified: 1 })
    expect(result.lines[0]).toMatchObject({ oldLineNumbers: [1], newLineNumbers: [1, 2] })
  })

  it('matches two consecutive old paragraphs with one new paragraph', () => {
    const oldParagraphs = [
      '车窗外的景色从咸阳郊区光秃的枝干过渡成西安市区林立的高楼。',
      '等红绿灯期间，嬴虔突然开口问道：“驷儿，你确定不回栎阳老宅过年？”',
    ]
    const newParagraph = '他们从咸阳驶进西安，秃枝变成高楼，在路口等待红灯的片刻，嬴虔突然侧头问道：“驷儿，你确定不回栎阳老宅过年？”'
    const result = compareTexts(oldParagraphs.join('\n'), newParagraph)

    expect(result.summary).toEqual({ equal: 0, added: 0, removed: 0, modified: 1 })
    expect(result.lines[0]).toMatchObject({ oldLineNumbers: [1, 2], newLineNumbers: [1], oldTexts: oldParagraphs, newTexts: [newParagraph] })
  })

  it('matches three consecutive old paragraphs with one new paragraph', () => {
    const result = compareTexts('第一部分保留。\n第二部分保留。\n第三部分保留。', '第一部分保留。第二部分保留。第三部分保留并补充。')

    expect(result.summary).toEqual({ equal: 0, added: 0, removed: 0, modified: 1 })
    expect(result.lines[0]).toMatchObject({ oldLineNumbers: [1, 2, 3], newLineNumbers: [1] })
  })

  it('keeps low-similarity paragraph groups as removed and added', () => {
    const result = compareTexts('完全无关的旧段落甲。\n完全无关的旧段落乙。', '另一组毫无联系的新内容甲。\n另一组毫无联系的新内容乙。')

    expect(result.summary).toEqual({ equal: 0, added: 2, removed: 2, modified: 0 })
  })

  it('preserves exact anchors around paragraph group matching', () => {
    const result = compareTexts(
      '【一】\n车窗外的景色从咸阳郊区光秃的枝干过渡成西安市区林立的高楼。\n等红绿灯期间，嬴虔突然开口问道：“驷儿，你确定不回栎阳老宅过年？”\n共同正文',
      '【一】\n他们从咸阳驶进西安，秃枝变成高楼，在路口等待红灯的片刻，嬴虔突然侧头问道：“驷儿，你确定不回栎阳老宅过年？”\n共同正文',
    )

    expect(result.lines).toMatchObject([
      { type: 'equal', oldLineNumber: 1, newLineNumber: 1 },
      { type: 'modified', oldLineNumbers: [2, 3], newLineNumbers: [2] },
      { type: 'equal', oldLineNumber: 4, newLineNumber: 3 },
    ])
  })

  it('keeps unrelated long Chinese replacements as removed and added before later equal anchors', () => {
    const result = compareTexts(
      ['学校的放假通知刚一落地，姨妈便央求好大侄女送他去西安。', '离家那天，姨妈站在玄关的白板前大笔一挥。', '“不在家过年，开学再回”', '【零】', '共同正文'].join('\n'),
      ['12/13岁初中生马甲，5岁社畜，骂人only，小马大作，转世现代。', '3k+流水账短打，ooc属于我。', '我是文盲，有问题欢迎指出。', '【零】', '共同正文'].join('\n'),
    )

    expect(result.summary).toEqual({ equal: 2, added: 3, removed: 3, modified: 0 })
    expect(result.lines.slice(-2).map((line) => line.type)).toEqual(['equal', 'equal'])
  })

  it('finds the only suitable modification when multiple old lines share one changed region', () => {
    const result = compareTexts('相似句第一版\n完全无关旧句\n另一个完全无关旧句', '相似句第二版')

    expect(result.summary).toEqual({ equal: 0, added: 0, removed: 2, modified: 1 })
    expect(result.lines.find((line) => line.type === 'modified')).toMatchObject({
      oldLineNumber: 1,
      newLineNumber: 1,
    })
  })

  it('finds the only suitable modification when multiple new lines share one changed region', () => {
    const result = compareTexts('相似句第一版', '完全无关新句\n相似句第二版\n另一个完全无关新句')

    expect(result.summary).toEqual({ equal: 0, added: 2, removed: 0, modified: 1 })
    expect(result.lines.find((line) => line.type === 'modified')).toMatchObject({
      oldLineNumber: 1,
      newLineNumber: 2,
    })
  })

  it('selects monotonic modified matches when several candidates are available', () => {
    const result = compareTexts('版本 alpha 一\n版本 beta 一', '版本 alpha 二\n版本 beta 二')
    const modifiedLines = result.lines.filter((line) => line.type === 'modified')

    expect(modifiedLines).toHaveLength(2)
    expect(modifiedLines.map((line) => [line.oldLineNumber, line.newLineNumber])).toEqual([
      [1, 1],
      [2, 2],
    ])
  })

  it('restores multiple independent equal anchor regions', () => {
    expect(lineTypes('x\nANCHOR A\ny\nANCHOR B\nz', '1\nANCHOR A\n2\nANCHOR B\n3')).toEqual([
      'removed',
      'added',
      'equal',
      'removed',
      'added',
      'equal',
      'removed',
      'added',
    ])
  })

  it.each(['【一】', '【二】', 'Chapter 1', 'SECTION'])('uses %s as a normal exact alignment anchor', (anchor) => {
    expect(lineTypes(`old\n${anchor}\nshared`, `new\n${anchor}\nshared`)).toEqual([
      'removed',
      'added',
      'equal',
      'equal',
    ])
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
