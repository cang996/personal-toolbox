<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { textCompareTool } from '@/app/tools'
import ToolPageLayout from '@/shared/components/ToolPageLayout.vue'

import { compareTexts, countCharacters, countLines, formatDiffSummary, formatFullDiff } from './textDiff'
import type { DiffLine, DiffSegment, TextDiffResult } from './types'

type CompareState = 'idle' | 'empty' | 'same' | 'different' | 'error'

const oldText = ref('')
const newText = ref('')
const ignoreTrailingWhitespace = ref(true)
const ignoreBlankLines = ref(false)
const result = ref<TextDiffResult | null>(null)
const compareState = ref<CompareState>('idle')
const statusMessage = ref('尚未进行对比。')
const copyMessage = ref('')

const oldCharacterCount = computed(() => countCharacters(oldText.value))
const newCharacterCount = computed(() => countCharacters(newText.value))
const oldLineCount = computed(() => countLines(oldText.value))
const newLineCount = computed(() => countLines(newText.value))
const hasResult = computed(() => result.value !== null)
const hasDiff = computed(() => {
  if (!result.value) {
    return false
  }

  const summary = result.value.summary
  return summary.added + summary.removed + summary.modified > 0
})

watch(
  [oldText, newText, ignoreTrailingWhitespace, ignoreBlankLines],
  () => {
    resetToUncompared()
  },
  { flush: 'sync' },
)

function runCompare() {
  copyMessage.value = ''

  if (oldText.value.length === 0 && newText.value.length === 0) {
    result.value = null
    compareState.value = 'empty'
    statusMessage.value = '两边输入都为空，请输入要对比的文本。'
    return
  }

  try {
    const nextResult = compareTexts(oldText.value, newText.value, {
      ignoreTrailingWhitespace: ignoreTrailingWhitespace.value,
      ignoreBlankLines: ignoreBlankLines.value,
    })

    result.value = nextResult

    if (!hasDiff.value) {
      compareState.value = 'same'
      statusMessage.value = '文本内容相同，当前没有差异。'
    } else {
      compareState.value = 'different'
      statusMessage.value = '已生成文本差异结果。'
    }
  } catch {
    result.value = null
    compareState.value = 'error'
    statusMessage.value = '对比失败，请检查输入后重试。'
  }
}

function swapTexts() {
  const previousOldText = oldText.value
  oldText.value = newText.value
  newText.value = previousOldText
  clearResult('已交换旧文本和新文本。')
}

function clearAll() {
  oldText.value = ''
  newText.value = ''
  clearResult('已清空输入和对比结果。')
}

function clearResult(message: string) {
  result.value = null
  compareState.value = 'idle'
  statusMessage.value = message
  copyMessage.value = ''
}

function resetToUncompared() {
  result.value = null
  compareState.value = 'idle'
  statusMessage.value = '尚未进行对比。'
  copyMessage.value = ''
}

async function copySummary() {
  if (!result.value) {
    copyMessage.value = '请先生成对比结果。'
    return
  }

  await copyText(formatDiffSummary(result.value.summary), '已复制差异摘要。')
}

async function copyFullDiff() {
  if (!result.value) {
    copyMessage.value = '请先生成对比结果。'
    return
  }

  await copyText(formatFullDiff(result.value.lines), '已复制完整差异。')
}

async function copyText(text: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(text)
    copyMessage.value = successMessage
  } catch {
    copyMessage.value = '复制失败，请检查浏览器剪贴板权限。'
  }
}

function markerForLine(line: DiffLine): string {
  if (line.type === 'equal') {
    return ' '
  }

  if (line.type === 'added') {
    return '+'
  }

  if (line.type === 'removed') {
    return '-'
  }

  return '~'
}

function labelForLine(line: DiffLine): string {
  const labels: Record<DiffLine['type'], string> = {
    equal: '相同',
    added: '新增',
    removed: '删除',
    modified: '修改',
  }

  return labels[line.type]
}

function visibleText(line: DiffLine): string {
  return line.oldText ?? line.newText ?? ''
}

function lineNumberText(lineNumber?: number): string {
  return lineNumber === undefined ? '-' : String(lineNumber)
}

function segmentClass(segment: DiffSegment): string {
  return `segment segment-${segment.type}`
}
</script>

<template>
  <ToolPageLayout :title="textCompareTool.name" :description="textCompareTool.description">
    <div class="text-compare-tool">
      <section class="input-grid" aria-label="文本输入">
        <div class="input-panel">
          <label for="old-text">旧文本</label>
          <textarea id="old-text" v-model="oldText" spellcheck="false" />
          <p class="text-metrics">{{ oldCharacterCount }} 字符 · {{ oldLineCount }} 行</p>
        </div>

        <div class="input-panel">
          <label for="new-text">新文本</label>
          <textarea id="new-text" v-model="newText" spellcheck="false" />
          <p class="text-metrics">{{ newCharacterCount }} 字符 · {{ newLineCount }} 行</p>
        </div>
      </section>

      <section class="controls" aria-label="对比设置和操作">
        <div class="options">
          <label class="checkbox-label">
            <input v-model="ignoreTrailingWhitespace" type="checkbox" />
            忽略行尾空格
          </label>
          <label class="checkbox-label">
            <input v-model="ignoreBlankLines" type="checkbox" />
            忽略空白行
          </label>
        </div>

        <div class="actions">
          <button type="button" class="primary-action" @click="runCompare">开始对比</button>
          <button type="button" @click="swapTexts">交换文本</button>
          <button type="button" @click="clearAll">清空</button>
        </div>
      </section>

      <p class="status-message" :class="`state-${compareState}`" role="status">
        {{ statusMessage }}
      </p>

      <section v-if="hasResult && result" class="summary-section" aria-labelledby="summary-heading">
        <h2 id="summary-heading">差异统计</h2>
        <dl class="summary-grid">
          <div>
            <dt>相同</dt>
            <dd>{{ result.summary.equal }} 行</dd>
          </div>
          <div>
            <dt>新增</dt>
            <dd>{{ result.summary.added }} 行</dd>
          </div>
          <div>
            <dt>删除</dt>
            <dd>{{ result.summary.removed }} 行</dd>
          </div>
          <div>
            <dt>修改</dt>
            <dd>{{ result.summary.modified }} 行</dd>
          </div>
        </dl>

        <div class="copy-actions">
          <button type="button" @click="copySummary">复制差异摘要</button>
          <button type="button" @click="copyFullDiff">复制完整差异</button>
        </div>
        <p v-if="copyMessage" class="copy-message" role="status">{{ copyMessage }}</p>
      </section>

      <section
        v-if="hasResult && result"
        class="result-section"
        aria-labelledby="result-heading"
        tabindex="0"
      >
        <h2 id="result-heading">合并差异视图</h2>
        <p v-if="!hasDiff" class="empty-result">当前没有差异。</p>

        <div v-else class="diff-list">
          <article
            v-for="(line, index) in result.lines"
            :key="`${line.type}-${line.oldLineNumber ?? 'x'}-${line.newLineNumber ?? 'x'}-${index}`"
            class="diff-line"
            :class="`line-${line.type}`"
          >
            <div class="line-meta" aria-hidden="true">
              <span class="line-marker">{{ markerForLine(line) }}</span>
              <span class="line-label">{{ labelForLine(line) }}</span>
              <span>旧 {{ lineNumberText(line.oldLineNumber) }}</span>
              <span>新 {{ lineNumberText(line.newLineNumber) }}</span>
            </div>

            <div v-if="line.type === 'modified'" class="modified-content">
              <p>
                <span class="version-label">旧</span>
                <span class="line-text">
                  <span
                    v-for="(segment, segmentIndex) in line.oldSegments"
                    :key="`old-${segmentIndex}`"
                    :class="segmentClass(segment)"
                  >
                    {{ segment.text }}
                  </span>
                </span>
              </p>
              <p>
                <span class="version-label">新</span>
                <span class="line-text">
                  <span
                    v-for="(segment, segmentIndex) in line.newSegments"
                    :key="`new-${segmentIndex}`"
                    :class="segmentClass(segment)"
                  >
                    {{ segment.text }}
                  </span>
                </span>
              </p>
            </div>

            <p v-else class="line-text">{{ visibleText(line) }}</p>
          </article>
        </div>
      </section>
    </div>
  </ToolPageLayout>
</template>

<style scoped>
.text-compare-tool {
  display: grid;
  gap: 1.25rem;
}

.input-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.input-panel {
  display: grid;
  gap: 0.5rem;
}

label {
  color: var(--color-heading);
  font-weight: 700;
}

textarea {
  min-height: 18rem;
  resize: vertical;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  padding: 0.875rem;
  color: var(--color-text);
  line-height: 1.5;
}

textarea:focus-visible {
  outline: 2px solid var(--color-link);
  outline-offset: 2px;
}

.text-metrics,
.status-message,
.copy-message,
.empty-result {
  color: var(--color-muted);
}

.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.options,
.actions,
.copy-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
}

button {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  padding: 0.55rem 0.85rem;
  color: var(--color-heading);
  font-weight: 700;
  cursor: pointer;
}

button:hover,
button:focus-visible {
  border-color: var(--color-link);
}

.primary-action {
  border-color: var(--color-link);
  background: var(--color-link);
  color: var(--color-background);
}

.state-empty,
.state-error {
  color: #b91c1c;
}

.state-same {
  color: #047857;
}

.summary-section,
.result-section {
  display: grid;
  gap: 1rem;
}

h2 {
  color: var(--color-heading);
  font-size: 1.25rem;
  font-weight: 700;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
}

.summary-grid div {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-background);
  padding: 0.85rem;
}

dt {
  color: var(--color-muted);
  font-size: 0.875rem;
  font-weight: 700;
}

dd {
  color: var(--color-heading);
  font-size: 1.35rem;
  font-weight: 700;
}

.result-section {
  border-top: 1px solid var(--color-border);
  padding-top: 1rem;
}

.result-section:focus-visible {
  outline: 2px solid var(--color-link);
  outline-offset: 4px;
}

.diff-list {
  display: grid;
  gap: 0.5rem;
}

.diff-line {
  display: grid;
  grid-template-columns: minmax(9rem, auto) minmax(0, 1fr);
  gap: 0.75rem;
  border-left: 4px solid var(--color-border);
  background: var(--color-background);
  padding: 0.75rem;
}

.line-added {
  border-left-color: #059669;
  background: #ecfdf5;
}

.line-removed {
  border-left-color: #dc2626;
  background: #fef2f2;
}

.line-modified {
  border-left-color: #d97706;
  background: #fffbeb;
}

.line-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  color: var(--color-muted);
  font-size: 0.85rem;
  font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace;
}

.line-marker,
.line-label,
.version-label {
  color: var(--color-heading);
  font-weight: 700;
}

.line-text {
  min-width: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace;
}

.modified-content {
  display: grid;
  gap: 0.4rem;
  min-width: 0;
}

.modified-content p {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr);
  gap: 0.5rem;
}

.segment-added {
  background: #bbf7d0;
  color: #064e3b;
}

.segment-removed {
  background: #fecaca;
  color: #7f1d1d;
}

@media (prefers-color-scheme: dark) {
  .line-added {
    background: #052e25;
  }

  .line-removed {
    background: #450a0a;
  }

  .line-modified {
    background: #451a03;
  }

  .segment-added {
    background: #047857;
    color: #ecfdf5;
  }

  .segment-removed {
    background: #b91c1c;
    color: #fef2f2;
  }
}

@media (max-width: 760px) {
  .input-grid,
  .summary-grid,
  .diff-line {
    grid-template-columns: 1fr;
  }

  textarea {
    min-height: 14rem;
  }
}
</style>
