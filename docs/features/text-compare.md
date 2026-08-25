# Text Compare

> Architecture & Algorithm Notes。本文描述仓库中当前实际算法与 UI 分层；实现和测试是最终事实来源。

## 1. Purpose and Scope

Text Compare 在 `/tools/text-compare` 比较“旧文本”和“新文本”，显示相同、新增、删除和修改内容。它在浏览器主线程本地运行，不上传、不持久化，也不依赖第三方 diff 库。

## 2. Architecture

```text
TextCompareView.vue
  |-- input/options/page state
  |-- size guard and interaction
  |-- compareTexts()
  |     `-- TextDiffResult { lines, summary }
  |-- presentation helpers
  `-- side-by-side Vue rendering
```

- `textDiff.ts`：纯算法、计数及纯文本格式化函数。
- `types.ts`：diff 领域内的 TypeScript 数据结构。
- `textComparePresentation.ts`：大小阈值、只看差异和多行 segment 拆分。
- `TextCompareView.vue`：输入、执行、页面模式和渲染。

## 3. User Flow

用户输入两侧文本，可选择忽略行尾空格（默认开启）和忽略空白行（默认关闭），再点击“开始对比”。成功后页面进入结果模式；“显示全部/只看差异”只过滤已有结果，不重新运行算法。“返回编辑”保留输入和选项；修改输入或选项会清除旧结果。页面还支持交换文本、清空和超过 500px 后显示的返回顶部按钮。

## 4. Comparison Granularity

算法采用两级粒度：

1. 先以行为单位找到完全相等的稳定锚点。
2. 对锚点之间的 changed block 尝试建立“修改”配对；成功后再以 Unicode code point 为单位生成行内高亮。

因此顶层结果是 line/group diff，而 modified 项内部是 character/code-point diff。它不是 word diff，也不做语法或语义分析。

## 5. Normalization and Tokenization

- CRLF 和 CR 统一为 LF。
- 空字符串包含 0 行；非空字符串按 LF 分行，结尾 LF 会产生额外空行。
- 每一行保留原始 `text` 和原始 1-based 行号，同时生成用于相等判断的 `comparableText`。
- 开启 `ignoreTrailingWhitespace` 时，只从 comparable text 移除行尾 space/tab；显示文本不变。
- 开启 `ignoreBlankLines` 时，纯 space/tab 的行从比较序列过滤，但保留行号对应原输入位置。
- 字符操作使用 `Array.from(text)`，按 Unicode code point 切分；这能把常见单 code-point emoji 计为一个，但不等同于用户感知的 grapheme cluster。

## 6. Exact Line Alignment

`findLineMatches` 为旧/新行序列建立二维长度矩阵，计算 comparable text 的 Longest Common Subsequence（LCS），再从左上角恢复单调递增的相等行配对。遇到等价路径时使用 `>=` 优先前进旧序列。

这些 exact matches 是第一层锚点。每两个锚点之间，以及首尾未锚定区域，分别成为 changed block。这样后续相似度配对不会跨越已确认相同的行。

## 7. Modified-Group Alignment

每个 changed block 通过第二个动态规划选择单调、非重叠的 modified candidates。候选形状固定为：

- 1 old : 1 new
- 1 old : 2 new
- 1 old : 3 new
- 2 old : 1 new
- 3 old : 1 new

多行候选用 LF 拼接后计算字符相似度。候选得分是 `similarity * min(oldCharacterCount, newCharacterCount)`；动态规划最大化后续候选的累计得分。没有达到候选条件的旧行输出为 removed，新行输出为 added。

这种有限的 one-to-many / many-to-one 支持用于段落被拆成最多三行或最多三行被合并的场景，并刻意不引入任意规模分组。

## 8. Similarity Function and Thresholds

字符 LCS 相似度为：

```text
2 * characterLcsLength / (oldLength + newLength)
```

空侧相似度为 0。最长一侧超过 40 code points 时直接使用该值；短文本还会计算“共同前缀长度或共同后缀长度的较大值 / 较长文本长度”，最终相似度为 LCS 相似度与 edge 相似度的平均值。

普通候选阈值为 `0.45`。另外，1:1 长文本若共同前缀或后缀至少 20 code points，且至少占较短文本的 30%，也可作为 modified candidate。这条 strong-edge 规则用于保住长句的明确共同开头/结尾，但不允许短共同前缀强行配对。

## 9. Character-Level Diff

对已选中的 modified group，算法再次运行字符 LCS。匹配索引标记为 `equal`；旧侧其余字符标记为 `removed`，新侧其余字符标记为 `added`。相邻同类型字符被合并成 `DiffSegment`，所以两侧 segment 拼接后可无损重建各自 group 文本。

换行也参加 group 的字符 LCS。presentation layer 再通过 `splitSegmentsByLine` 按 LF 拆回原行，以便 Vue 在并排布局中显示每个原始行号。

## 10. Algorithm Classification

当前实现是自定义动态规划 LCS diff：行级 exact alignment 和 modified 内字符 alignment 都使用 LCS 长度矩阵；changed block 的 group selection 也是自定义动态规划。它不是 Myers diff，也没有调用 npm diff library。

## 11. Internal Diff Representation

`TextDiffResult` 包含 `lines: DiffLine[]` 和 `summary`。`DiffLine.type` 为：

- `equal`：两侧行号和原文。
- `removed`：旧行号和旧文。
- `added`：新行号和新文。
- `modified`：两侧首行号、完整行号数组、原始行数组、以 LF 拼接的文本，以及 old/new character segments。

`DiffSummary` 分别累计 equal、added、removed、modified 项数。一个 1:3 modified group 计为一处 modified，而不是三行 added；UI 文案因此使用“修改 N 处”。

## 12. Alignment and Rendering Separation

算法层不知道 Vue、CSS 或“只看差异”。它输出稳定的数据结构和摘要。presentation helpers 承担：

- Unicode code-point 字符数和行数统计。
- 长文本提醒与极端文本阻止规则。
- 把连续 equal 项折叠成 `omitted-equal` 展示项。
- 把 modified segments 拆回各物理行。

Vue 只把结果映射为相同/新增/删除/修改卡片；modified 使用“修改前/修改后”两个同级区域并对 segment 着色。显示过滤不会改变 `TextDiffResult`。

## 13. Stable Examples

### Inserted line

```text
old: A\nC
new: A\nB\nC
result: equal(A), added(B), equal(C)
```

### Similar one-line change

```text
old: 这是旧版本文本
new: 这是新版本文本
result: one modified item, with equal/removed/added character segments
```

### Paragraph split

```text
old: 第一段相同内容，保留更多描述。
new: 第一段相同内容，\n保留更多描述并补充。
result: one 1:2 modified group with old line [1] and new lines [1, 2]
```

低相似度的 `delete me` / `insert me` 不会被强制称为修改，而是 removed + added。测试也固定了 exact anchor 前后的 1:3、2:1、3:1 中文段落场景。

## 14. Size Behaviour

- 超过 20,000 code points 或 1,000 行：只显示长文本提示，仍允许执行。
- 超过 100,000 code points 或 5,000 行：阻止本次比较，并要求拆分文本。
- 阈值判断使用严格大于，因此恰好等于阈值仍不进入对应状态。

限制存在是因为 LCS 矩阵需要随两侧序列乘积增长的时间和内存；字符级 LCS 还会在候选相似度与 modified segment 阶段重复运行。

## 15. Output Helpers

`formatDiffSummary` 可生成相同/新增/删除/修改计数的纯文本摘要；`formatFullDiff` 可生成带 `  `、`- `、`+ ` 前缀的纯文本 diff。当前 Vue view 没有暴露复制或下载这些格式的按钮，它直接渲染结构化结果。

## 16. Tests and Evidence

- `textDiff.spec.ts` 覆盖空输入、相同文本、增删改、换行规范化、选项、中文/英文/emoji、阈值、segment 可重建性、exact anchors、长段落和所有受支持 group shapes。
- `textComparePresentation.spec.ts` 覆盖 code-point 计数、阈值边界、提示侧别和 equal run 折叠。
- `TextCompareView.spec.ts` 覆盖编辑/结果模式、选项保留、只看差异、1:N/N:1 并排渲染、大小阻止和返回顶部生命周期。

判断算法为 LCS、自定义 modified matching 及非 Myers 的直接证据位于 `findLineMatches`、`findModifiedMatches`、`findCharacterMatches`；`frontend/package.json` 也没有 diff 运行时依赖。

## 17. Trade-offs and Known Limitations

- LCS 的二维矩阵提供确定、易测的单调对齐，但最坏时间和内存为两侧长度乘积；当前在 UI 中用大小阈值缓解，而不是流式或 worker 化。
- exact line anchors 优先，能保护共同章节位置，但重复相同行可能因 LCS tie-break 得到其中一种确定对齐，而不一定符合人的语义选择。
- `0.45`、40/20/30% 和最多三行分组都是产品启发式，不是自然语言语义模型。
- code-point diff 不识别单词、句法或 grapheme cluster；组合字符和 ZWJ emoji 可能拆成多个 segment。
- 忽略空白行会从算法序列中移除它们，结果不会为这些行生成 equal/added/removed 项。
- 全部计算同步发生在浏览器主线程；长文本可能暂时影响交互响应。
- 功能没有文件导入、持久化、协作、历史版本、patch 应用或后端处理。

修改算法时应优先更新 `textDiff.ts` 和 `textDiff.spec.ts`；只改变显示过滤或大小提示时更新 `textComparePresentation.ts`；交互和 DOM 布局留在 `TextCompareView.vue`。不要把 feature-specific diff 类型移入 `frontend/src/shared`，除非出现真正相同的跨工具契约。
