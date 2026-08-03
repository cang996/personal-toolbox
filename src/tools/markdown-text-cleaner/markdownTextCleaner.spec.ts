import { describe, expect, it } from 'vitest'

import { cleanMarkdownText } from './markdownTextCleaner'

describe('cleanMarkdownText', () => {
  const withoutUrls = { preserveLinkUrls: false }

  it('numbers ATX headings, including skipped levels', () => {
    expect(cleanMarkdownText('# 第一部分\n## 背景\n## 目标\n# 第二部分\n## 实现', withoutUrls)).toBe(
      '1. 第一部分\n1.1 背景\n1.2 目标\n2. 第二部分\n2.1 实现',
    )
    expect(cleanMarkdownText('### 测试方法\n\n## 项目背景', withoutUrls)).toBe('1.1.1 测试方法\n\n1.2 项目背景')
  })

  it('numbers Setext headings before removing horizontal rules', () => {
    expect(cleanMarkdownText('Project Title\n=============\n\nSection\n-------\n\n---', withoutUrls)).toBe(
      '1. Project Title\n\n1.1 Section',
    )
  })

  it('converts unordered and task lists while preserving indentation', () => {
    expect(cleanMarkdownText('- 第一项\n-5\n-3.5\n2 - 1\n  - 子项目\n- [x] 已完成\n* [X] 也已完成\n+ [ ] 未完成', withoutUrls)).toBe(
      '• 第一项\n-5\n-3.5\n2 - 1\n  • 子项目\n☑ 已完成\n☑ 也已完成\n☐ 未完成',
    )
  })

  it('removes every quote marker outside code blocks', () => {
    expect(cleanMarkdownText('> text\n>> text\n> > text\n>>> text\n\n```\n>> code\n```', withoutUrls)).toBe(
      'text\ntext\ntext\ntext\n\n>> code',
    )
  })

  it('cleans links, auto links, and images without touching inline code', () => {
    const input = '[Monash University](https://www.monash.edu)\n<https://example.com/path?q=100%25#top>\n<user@example.com>\n![logo](logo.png)\n`<https://code.example>`'

    expect(cleanMarkdownText(input, withoutUrls)).toBe(
      'Monash University\nhttps://example.com/path?q=100%25#top\nuser@example.com\nlogo\n<https://code.example>',
    )
    expect(cleanMarkdownText(input, { preserveLinkUrls: true })).toContain('Monash University（https://www.monash.edu）')
  })

  it('preserves emphasis semantics, identifiers, and code block contents', () => {
    const input = '**粗体**\n*斜体*\n***粗斜体***\n~~删除线~~\nuser_name\nfile_name.txt\n`npm install`\n\n```bash\nnpm run dev\n```'

    expect(cleanMarkdownText(input, withoutUrls)).toBe(
      '粗体\n斜体\n粗斜体\n删除线\nuser_name\nfile_name.txt\nnpm install\n\nnpm run dev',
    )
  })

  it('normalizes line endings and Markdown escapes', () => {
    expect(cleanMarkdownText('A\\*literal\\*\r\n\r\n[reference][ref]', withoutUrls)).toBe('A*literal*\n\nreference')
  })

  it('keeps escaped Markdown punctuation visible without treating it as formatting', () => {
    const input = String.raw`\# 这不是标题
\* 这不是列表
\**这不是粗体**
\_这不是斜体_
\~~这不是删除线~~
\[这不是链接](https://example.com)
\+ \- \` \\`

    expect(cleanMarkdownText(input, withoutUrls)).toBe(`# 这不是标题
* 这不是列表
**这不是粗体**
_这不是斜体_
~~这不是删除线~~
[这不是链接](https://example.com)
+ - \` \\`)
    expect(cleanMarkdownText('C:\\Program Files\\App', withoutUrls)).toBe('C:\\Program Files\\App')
  })

  it('restores every supported Markdown escape without leaving placeholders', () => {
    const input = String.raw`\# \* \_ \~ \[ \] \( \) \> \+ \- \` \\`

    expect(cleanMarkdownText(input, withoutUrls)).toBe('# * _ ~ [ ] ( ) > + - ` \\')
  })

  it('removes nested emphasis without changing real English spacing', () => {
    const input = `这是 **粗体**。
这是 *斜体*。
这是 ***粗斜体***。
这是 **粗体中的 *斜体***。
这是 *斜体中的 **粗体***。
这是 ~~删除线里的 **粗体**~~。
This is **bold text** in a sentence.`

    expect(cleanMarkdownText(input, withoutUrls)).toBe(`这是粗体。
这是斜体。
这是粗斜体。
这是粗体中的斜体。
这是斜体中的粗体。
这是删除线里的粗体。
This is bold text in a sentence.`)
  })

  it('keeps balanced parentheses inside link URLs', () => {
    const input = `[普通链接](https://example.com)
[带括号](https://example.com/docs_(old))
[多个片段](https://example.com/a_(b)_c)
[带标题](https://example.com/docs_(old) "Old docs")
[查询参数](https://example.com/search?q=a%20b&lang=zh#top)`
    const withUrls = `普通链接（https://example.com）
带括号（https://example.com/docs_(old)）
多个片段（https://example.com/a_(b)_c）
带标题（https://example.com/docs_(old)）
查询参数（https://example.com/search?q=a%20b&lang=zh#top）`

    expect(cleanMarkdownText(input, { preserveLinkUrls: true })).toBe(withUrls)
    expect(cleanMarkdownText(input, withoutUrls)).toBe('普通链接\n带括号\n多个片段\n带标题\n查询参数')
  })

  it('keeps malformed Markdown visible without swallowing later text', () => {
    const input = '**没有结束\n[链接没有结束](https://example.com\n`代码没有结束\n\\'

    expect(cleanMarkdownText(input, withoutUrls)).toBe(input)
    expect(cleanMarkdownText(input, withoutUrls)).not.toContain('\uE000')
    expect(cleanMarkdownText(input, withoutUrls)).not.toContain('\uE001')
  })

  it('keeps nested URL parentheses and conservative escaped input intact', () => {
    const link = '[nested](https://example.com/a_(b_(c)))'
    const malformed = '**unfinished\n[unfinished](https://example.com\n`unfinished\n\\\n\\**\nC:\\Users\\name\\file.txt'

    expect(cleanMarkdownText(link, { preserveLinkUrls: true })).toBe('nested（https://example.com/a_(b_(c))）')
    expect(cleanMarkdownText(link, withoutUrls)).toBe('nested')
    expect(cleanMarkdownText(malformed, withoutUrls)).toBe(
      '**unfinished\n[unfinished](https://example.com\n`unfinished\n\\\n**\nC:\\Users\\name\\file.txt',
    )
  })

  it('keeps protected Markdown in code while cleaning the complete edge-case sample', () => {
    const input =
      String.raw`\# 这不是标题
\* 这不是列表
\**这不是粗体**

这是 **粗体中的 *斜体***。
这是 ***粗斜体***。
这是 ~~删除线里的 **粗体**~~。

- 这是第一项，
  它在 Markdown 中继续到下一行。
- 这是第二项。

[搜索结果](https://example.com/search?q=vue%203&lang=zh#top)
[带括号的页面](https://example.com/docs_(old))` +
      `

\`const label = "**not bold**"\`

\`\`\`ts
const heading = "# not a title"
const item = "- not a list"
const link = "[text](url)"
\`\`\``

    expect(cleanMarkdownText(input, { preserveLinkUrls: true })).toBe(`# 这不是标题
* 这不是列表
**这不是粗体**

这是粗体中的斜体。
这是粗斜体。
这是删除线里的粗体。

• 这是第一项，
  它在 Markdown 中继续到下一行。
• 这是第二项。

搜索结果（https://example.com/search?q=vue%203&lang=zh#top）
带括号的页面（https://example.com/docs_(old)）

const label = "**not bold**"

const heading = "# not a title"
const item = "- not a list"
const link = "[text](url)"`)
  })

  it('handles the PDF cleaner regression sample', () => {
    const input = `# PDF 文本清理工具

这是一个用于清理 **PDF 复制文本** 的简单工具。

## 主要功能

- 清理异常换行
- 修复中文字符间距
- 保留 \`Java API\` 等英文词组
- [查看项目说明](https://example.com/docs)

> 所有内容只在浏览器本地处理。

### 使用命令

\`\`\`bash
npm run dev
\`\`\``

    expect(cleanMarkdownText(input, withoutUrls)).toBe(
      '1. PDF 文本清理工具\n\n这是一个用于清理 PDF 复制文本 的简单工具。\n\n1.1 主要功能\n\n• 清理异常换行\n• 修复中文字符间距\n• 保留 Java API 等英文词组\n• 查看项目说明\n\n所有内容只在浏览器本地处理。\n\n1.1.1 使用命令\n\nnpm run dev',
    )
  })

  it('removes standalone horizontal rules without removing Markdown table separators', () => {
    expect(cleanMarkdownText('---', withoutUrls)).toBe('')
    expect(cleanMarkdownText('***', withoutUrls)).toBe('')
    expect(cleanMarkdownText('___', withoutUrls)).toBe('')
    expect(cleanMarkdownText('| Name | Value |\n| --- | --- |\n| PDF | Text |', withoutUrls)).toBe(
      '| Name | Value |\n| --- | --- |\n| PDF | Text |',
    )
  })

  it('handles headings, lists, links, quotes, code, and deletion markers together', () => {
    const input = `# PDF 文本清理工具

这是一个用于清理 **PDF 复制文本** 的简单工具。

## 主要功能

- 清理异常换行
- 修复中文字符间距
- 保留 \`Java API\` 等英文词组
- [查看项目说明](https://example.com/docs)

> 所有内容只在浏览器本地处理。

### 使用命令

\`\`\`bash
npm run dev
\`\`\`

- [x] 已完成 PDF 模式
- [ ] 完成 Markdown 模式

~~旧方案已经废弃。~~`

    const expectedWithUrls = `1. PDF 文本清理工具

这是一个用于清理 PDF 复制文本 的简单工具。

1.1 主要功能

• 清理异常换行
• 修复中文字符间距
• 保留 Java API 等英文词组
• 查看项目说明（https://example.com/docs）

所有内容只在浏览器本地处理。

1.1.1 使用命令

npm run dev

☑ 已完成 PDF 模式
☐ 完成 Markdown 模式

旧方案已经废弃。`

    expect(cleanMarkdownText(input, { preserveLinkUrls: true })).toBe(expectedWithUrls)
    expect(cleanMarkdownText(input, withoutUrls)).toBe(expectedWithUrls.replace('（https://example.com/docs）', ''))
  })
})
