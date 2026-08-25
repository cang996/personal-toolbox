# Text Cleaner

> Architecture & Learning Notes。本文记录当前仓库中的真实实现，不是完整 Markdown/PDF 规范，也不是文件解析器说明。代码和测试是最终事实来源。

## 1. Purpose

Text Cleaner 是一个纯前端文本处理工具，用来整理从 PDF 阅读器复制出的文本，以及把 Markdown 转成适合粘贴到普通文档中的纯文本结构。它不上传内容，也不保存草稿。

## 2. Feature Scope

应用入口为 `/tools/text-cleaner`，提供两个独立子模块：

- `/tools/text-cleaner/pdf`：PDF 复制文本清理。
- `/tools/text-cleaner/markdown`：Markdown 格式清理。

“PDF”指用户从 PDF 复制后粘贴进文本框的文字；当前实现不接收、读取或解析 `.pdf` 文件。两个模块共享入口和页面布局，但处理规则、状态与测试分别留在各自 feature module 中。

## 3. Architecture

```text
frontend/src/app/router/index.ts
  -> TextCleanerHomeView.vue
       |-> PdfTextCleanerView.vue -> cleanPdfText()
       `-> MarkdownTextCleanerView.vue -> cleanMarkdownText()
                                      |
                                      `-> browser clipboard (copy only)
```

主要文件：

- `frontend/src/tools/text-cleaner/TextCleanerHomeView.vue`
- `frontend/src/tools/pdf-text-cleaner/PdfTextCleanerView.vue`
- `frontend/src/tools/pdf-text-cleaner/pdfTextCleaner.ts`
- `frontend/src/tools/markdown-text-cleaner/MarkdownTextCleanerView.vue`
- `frontend/src/tools/markdown-text-cleaner/markdownTextCleaner.ts`

Vue view 负责输入、选项、显式执行、结果失效、清空、复制和状态消息；两个 TypeScript utility 负责纯文本转换。模块没有互相导入。

## 4. User Flow

1. 用户从 Text Cleaner 入口选择 PDF 或 Markdown 模式。
2. 用户把文本粘贴到左侧输入框并设置本页选项。
3. 点击“开始清理”后，view 调用对应纯函数并在右侧显示结果。
4. 输入或选项变化会清除旧结果，避免显示与当前设置不一致的内容。
5. 用户可复制结果或清空输入；复制失败时页面提示手动复制。

处理不会随着输入自动运行。

## 5. Data Flow

```text
textarea string + local option refs
  -> runCleaner input validation
  -> pure TypeScript cleaner
  -> result ref
  -> readonly textarea
  -> navigator.clipboard.writeText (user action)
```

没有网络请求、store、storage repository、Web Worker、后端或数据库参与该链路。

## 6. Frontend Responsibilities

两个 view 都维护 `idle`、`empty`、`success`、`copy-success`、`copy-error` 状态。空白输入不会生成结果；结果存在时，输入或选项变化会将其作废。清空操作恢复各页默认选项。所有业务转换都由 utility 完成，而不是写在模板中。

## 7. PDF Copy Text Cleaner

### 7.1 Input model

`cleanPdfText(input, { removeCjkLatinSpaces })` 接受任意字符串和一个必填布尔选项。页面默认开启“移除中文与英文之间的空格”。输入可能包含 CRLF、复制时产生的逐字换行、段落空行、列表、标题、URL、邮箱或简单代码。

### 7.2 Processing pipeline

1. 将 CRLF/CR 统一为 LF，并逐行分类。
2. 用保守启发式把行识别为：空行、编号标题、普通标题、标签标题、列表项、独立 URL、独立邮箱、代码行或正文。
3. 保留结构边界；把看起来属于同一段落或列表项续行的异常换行合并。
4. 按 CJK/拉丁字符和标点语义决定连接时是否插入空格。
5. 清理确定性的空格模式，并恢复部分被复制换行打散的中文结构。
6. 合并多余空段并裁掉首尾空白。

### 7.3 Preserved structure and spacing rules

- 段落空行、受支持的标题、短标签、URL、邮箱和简单代码保持独立。
- `•`、`●`、带空格的 `-`/`*`、数字列表和全角括号数字可作为列表起点；负数、年份和数学表达式有单独保护。
- 英文断行用空格连接；CJK 相邻字符、CJK 标点附近的断行通常直接连接。
- CJK 字符之间的异常空格始终清理；CJK 与拉丁字符之间的空格是否清理由页面选项决定。
- 小数点、货币符号、百分号、时间/比例、版本号及常见中英文标点的空格会按已测试规则规范化。
- 连字符结尾、短完整句、技术字段和多行代码使用额外边界规则，避免盲目拼接。
- 当前仅专门恢复“谁：”“什么：”“地点：”“原因：”等短标签，以及有限的中文章节、编号和行内标签模式。

### 7.4 Output and edge cases

输出始终是一个纯文本字符串。空白输入输出空字符串。算法刻意采用启发式而非版面分析：未知标题形式、复杂代码、表格、多栏 PDF、OCR 错字及语义模糊的短行可能无法恢复成原始排版。

## 8. Markdown Text Cleaner

### 8.1 Input model

`cleanMarkdownText(input, options)` 接受 Markdown 字符串；`preserveLinkUrls` 控制内联链接是否输出 URL，`numberHeadings` 控制是否为识别出的标题加层级编号。`numberHeadings` 缺省为 `false`，页面初始值和清空后的值也都是关闭。

### 8.2 Block processing rules

- 识别一至六级 ATX 标题，并删除开头 `#` 和可选闭合 `#`。
- 识别一级/二级 Setext 标题，并删除下一行的 `=`/`-` 标记。
- 标题编号关闭时只保留清理后的标题文字；标题识别与 marker 删除仍然执行。
- 标题编号开启时沿用原有六级计数算法：当前层递增、更深层清零、跳级时缺失的父级补为 `1`；一级显示为 `1. Title`，更深层显示为 `1.1 Title`。
- 独立 horizontal rule 被删除；Markdown 表格中的分隔行不会被当作独立 horizontal rule。
- 无序列表标记转成 `•`，任务列表转成 `☑`/`☐`，并保留缩进。
- 代码围栏本身被删除，围栏内文本保持原样；行内反引号被删除，内容受到保护。
- blockquote 的 `>` 层级标记被删除。

### 8.3 Inline rules

- 删除粗体、斜体、粗斜体和删除线 marker，保留文字。
- 图片转换为 alt text。
- 普通内联链接和 reference link 保留 label；开启“保留链接 URL”时，普通内联链接输出为 `label（URL）`。
- autolink 的 URL 或邮箱保持可见。
- 受支持的反斜杠转义字符最终恢复为字面字符，不再被当作 Markdown 语法。
- URL、行内代码和转义片段在其他正则清理期间使用内部 placeholder 保护，随后恢复。
- 换行统一为 LF，连续三个以上换行压缩为两个，最后裁掉首尾空白。

### 8.4 Edge cases

链接 URL 支持平衡的嵌套圆括号和可选 title；格式不完整的强调、链接、行内代码和单独反斜杠尽量原样保留。该实现不是 CommonMark parser，复杂嵌套、HTML、脚注、定义列表和非标准扩展不保证完全保真。

## 9. Shared Logic

两个 cleaner 仅共享应用级 `ToolPageLayout`、路由和浏览器剪贴板能力。其分类规则、选项和转换函数语义不同，因此没有抽成统一 cleaner engine。Vue 组件也不直接访问 `localStorage` 或 IndexedDB。

## 10. Input/Output Contract

| Module | Input | Options | Output |
| --- | --- | --- | --- |
| PDF | pasted text string | `removeCjkLatinSpaces: boolean` | cleaned plain-text string |
| Markdown | Markdown string | `preserveLinkUrls: boolean`; optional `numberHeadings: boolean` | cleaned plain-text string |

函数是同步、确定性、无副作用的纯转换；空字符串都得到空字符串。页面负责拒绝只有空白的交互输入，但 utility 本身仍可直接测试。

## 11. Local Processing and Privacy

实现中没有 `fetch`、上传、后端调用或持久化。输入和输出只存在于当前 Vue 组件内存中。只有用户点击“复制结果”时，结果字符串才传给浏览器的 `navigator.clipboard`；实际剪贴板权限和系统行为由浏览器控制。

## 12. Tests

- `TextCleanerHomeView.spec.ts` 保护两个子模块入口及路由。
- `pdfTextCleaner.spec.ts` 覆盖换行合并、CJK/拉丁空格、段落、列表、标题、标签、URL、邮箱、代码、数字与完整回归样本。
- `PdfTextCleanerView.spec.ts` 覆盖显式执行、结果失效、默认选项、清空和复制失败。
- `markdownTextCleaner.spec.ts` 覆盖 block/inline 规则、转义保护、畸形输入、URL 圆括号、代码、标题默认不编号及开启后的原编号算法。
- `MarkdownTextCleanerView.spec.ts` 覆盖执行、结果失效、两个选项的默认/清空行为、编号切换和剪贴板反馈。

## 13. Known Limitations

- PDF 模式不读取 PDF 文件，也没有字体、坐标、列或页信息，只能依据粘贴后的字符和换行猜测结构。
- 两个 cleaner 都是针对已知复制文本问题的正则与启发式实现，不是通用排版恢复或 Markdown AST 转换器。
- 大文本在主线程同步处理，当前没有显式大小限制或进度反馈。
- 页面刷新会丢失输入和结果；没有草稿保存或备份格式。
- 剪贴板可能因权限、浏览器策略或非安全上下文而失败。

## 14. Where to Modify

- PDF 转换规则：`frontend/src/tools/pdf-text-cleaner/pdfTextCleaner.ts`，并同步扩充同目录 spec。
- Markdown 转换规则：`frontend/src/tools/markdown-text-cleaner/markdownTextCleaner.ts`，并同步扩充同目录 spec。
- 页面选项和交互：各自的 `*View.vue` 与 `*View.spec.ts`。
- 入口卡片：`frontend/src/tools/text-cleaner/`。
- 应用路由和工具元数据：`frontend/src/app/router/index.ts`、`frontend/src/app/tools.ts`。

避免让一个 cleaner 直接依赖另一个 cleaner；只有语义、错误处理和变更原因真正一致的行为才应进入 `frontend/src/shared`。

## 15. Design Decisions

- 保持“显式点击后处理”，让用户能在运行前完成输入与选项设置。
- 选项变化使旧结果失效，而不是静默展示过期结果。
- Markdown 标题编号是可选的内容改写，默认关闭；marker removal 属于基础清理，始终执行。
- 编号开启时保留既有算法和输出格式，避免破坏需要层级编号的既有使用方式。
- 两个模块使用小型纯函数和聚焦测试，不引入 parser 依赖、统一引擎、后端或持久化。
