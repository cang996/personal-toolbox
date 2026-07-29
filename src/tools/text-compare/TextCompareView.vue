<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { textCompareTool } from '@/app/tools'
import ToolPageLayout from '@/shared/components/ToolPageLayout.vue'

import { compareTexts, countCharacters, countLines } from './textDiff'
import {
  createDisplayDiffItems,
  extremeTextMessage,
  longTextMessage,
  splitSegmentsByLine,
} from './textComparePresentation'
import type { DiffLine, DiffSegment, TextDiffResult } from './types'

type CompareState = 'idle' | 'empty' | 'same' | 'different' | 'error'
type PageMode = 'edit' | 'results'

const BACK_TO_TOP_SCROLL_THRESHOLD = 500

const oldText = ref('')
const newText = ref('')
const ignoreTrailingWhitespace = ref(true)
const ignoreBlankLines = ref(false)
const result = ref<TextDiffResult | null>(null)
const compareState = ref<CompareState>('idle')
const pageMode = ref<PageMode>('edit')
const differencesOnly = ref(false)
const showBackToTop = ref(false)
const statusMessage = ref('尚未进行对比。')

const oldCharacterCount = computed(() => countCharacters(oldText.value))
const newCharacterCount = computed(() => countCharacters(newText.value))
const oldLineCount = computed(() => countLines(oldText.value))
const newLineCount = computed(() => countLines(newText.value))
const longTextWarning = computed(() => longTextMessage(oldText.value, newText.value))
const hasResult = computed(() => result.value !== null)
const hasDiff = computed(() => {
  if (!result.value) {
    return false
  }

  const summary = result.value.summary
  return summary.added + summary.removed + summary.modified > 0
})
const displayItems = computed(() => createDisplayDiffItems(result.value?.lines ?? [], differencesOnly.value))

watch([oldText, newText, ignoreTrailingWhitespace, ignoreBlankLines], resetToUncompared, { flush: 'sync' })

function runCompare() {
  if (oldText.value.length === 0 && newText.value.length === 0) {
    result.value = null
    compareState.value = 'empty'
    statusMessage.value = '两边输入都为空，请输入要对比的文本。'
    return
  }

  const limitMessage = extremeTextMessage(oldText.value, newText.value)
  if (limitMessage) {
    result.value = null
    compareState.value = 'error'
    statusMessage.value = limitMessage
    return
  }

  try {
    result.value = compareTexts(oldText.value, newText.value, {
      ignoreTrailingWhitespace: ignoreTrailingWhitespace.value,
      ignoreBlankLines: ignoreBlankLines.value,
    })
    differencesOnly.value = false
    pageMode.value = 'results'
    updateBackToTopVisibility()

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

function returnToEdit() {
  pageMode.value = 'edit'
  showBackToTop.value = false
}

function updateBackToTopVisibility() {
  showBackToTop.value = pageMode.value === 'results' && window.scrollY > BACK_TO_TOP_SCROLL_THRESHOLD
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
  showBackToTop.value = false
}

onMounted(() => {
  window.addEventListener('scroll', updateBackToTopVisibility, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateBackToTopVisibility)
})

function swapTexts() {
  const previousOldText = oldText.value
  oldText.value = newText.value
  newText.value = previousOldText
  statusMessage.value = '已交换旧文本和新文本。'
}

function clearAll() {
  oldText.value = ''
  newText.value = ''
  result.value = null
  pageMode.value = 'edit'
  compareState.value = 'idle'
  statusMessage.value = '已清空输入和对比结果。'
}

function resetToUncompared() {
  result.value = null
  pageMode.value = 'edit'
  compareState.value = 'idle'
  statusMessage.value = '尚未进行对比。'
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

function lineNumbers(numbers: number[] | undefined, lineNumber: number | undefined): number[] {
  return numbers ?? (lineNumber === undefined ? [] : [lineNumber])
}

function lineRange(label: string, numbers: number[] | undefined, lineNumber: number | undefined): string {
  const values = lineNumbers(numbers, lineNumber)
  if (values.length === 0) {
    return `${label}仅`
  }
  return values.length === 1 ? `${label}${values[0]}` : `${label}${values[0]}–${values.at(-1)}`
}

function textsForSide(line: DiffLine, side: 'old' | 'new'): string[] {
  const texts = side === 'old' ? line.oldTexts : line.newTexts
  const text = side === 'old' ? line.oldText : line.newText
  return texts ?? (text === undefined ? [] : [text])
}

function segmentsForSide(line: DiffLine, side: 'old' | 'new'): DiffSegment[][] {
  const texts = textsForSide(line, side)
  return splitSegmentsByLine(side === 'old' ? line.oldSegments : line.newSegments, texts.length)
}

function segmentClass(segment: DiffSegment): string {
  return `segment segment-${segment.type}`
}
</script>

<template>
  <ToolPageLayout :title="textCompareTool.name" :description="textCompareTool.description">
    <div class="text-compare-tool">
      <template v-if="pageMode === 'edit'">
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

        <p v-if="longTextWarning" class="long-text-warning" role="status">{{ longTextWarning }}</p>
        <p class="status-message" :class="`state-${compareState}`" role="status">{{ statusMessage }}</p>
      </template>

      <section v-else-if="hasResult && result" class="result-mode">
        <header class="result-toolbar">
          <div>
            <button type="button" class="back-to-edit" @click="returnToEdit">返回编辑</button>
          </div>
          <div class="display-controls" aria-label="结果显示方式">
            <button type="button" :class="{ active: !differencesOnly }" @click="differencesOnly = false">显示全部</button>
            <button type="button" :class="{ active: differencesOnly }" @click="differencesOnly = true">只看差异</button>
          </div>
        </header>

        <p class="primary-summary">
          修改 {{ result.summary.modified }} 处 · 删除 {{ result.summary.removed }} 行 · 新增 {{ result.summary.added }} 行
        </p>
        <dl class="summary-grid" aria-label="详细差异统计">
          <div><dt>相同</dt><dd>{{ result.summary.equal }} 行</dd></div>
          <div><dt>新增</dt><dd>{{ result.summary.added }} 行</dd></div>
          <div><dt>删除</dt><dd>{{ result.summary.removed }} 行</dd></div>
          <div><dt>修改</dt><dd>{{ result.summary.modified }} 处</dd></div>
        </dl>
        <p class="diff-legend"><span class="legend-removed">红色：删除或被替换的文字</span><span class="legend-added">绿色：新增或替换后的文字</span></p>
        <p class="status-message" :class="`state-${compareState}`" role="status">{{ statusMessage }}</p>
        <p v-if="!hasDiff" class="empty-result">当前没有差异。</p>

        <div class="diff-list">
          <template v-for="(item, index) in displayItems" :key="item.type === 'line' ? `${item.line.type}-${item.line.oldLineNumber ?? 'x'}-${item.line.newLineNumber ?? 'x'}-${index}` : `omitted-${index}`">
            <p v-if="item.type === 'omitted-equal'" class="omitted-equal">……中间省略 {{ item.count }} 行相同内容……</p>

            <article v-else class="diff-item" :class="`item-${item.line.type}`">
              <template v-if="item.line.type === 'modified'">
                <div class="modified-content">
                  <section class="modified-side modified-old">
                    <p class="item-heading"><strong>修改前</strong>{{ lineRange('旧行 ', item.line.oldLineNumbers, item.line.oldLineNumber) }}</p>
                    <p v-for="(text, textIndex) in textsForSide(item.line, 'old')" :key="`old-${textIndex}`" class="line-text">
                      <span class="line-number">{{ lineNumbers(item.line.oldLineNumbers, item.line.oldLineNumber)[textIndex] }}</span>
                      <span v-for="(segment, segmentIndex) in segmentsForSide(item.line, 'old')[textIndex]" :key="`old-${textIndex}-${segmentIndex}`" :class="segmentClass(segment)">{{ segment.text }}</span>
                      <span v-if="segmentsForSide(item.line, 'old')[textIndex]?.length === 0">{{ text }}</span>
                    </p>
                  </section>
                  <section class="modified-side modified-new">
                    <p class="item-heading"><strong>修改后</strong>{{ lineRange('新行 ', item.line.newLineNumbers, item.line.newLineNumber) }}</p>
                    <p v-for="(text, textIndex) in textsForSide(item.line, 'new')" :key="`new-${textIndex}`" class="line-text">
                      <span class="line-number">{{ lineNumbers(item.line.newLineNumbers, item.line.newLineNumber)[textIndex] }}</span>
                      <span v-for="(segment, segmentIndex) in segmentsForSide(item.line, 'new')[textIndex]" :key="`new-${textIndex}-${segmentIndex}`" :class="segmentClass(segment)">{{ segment.text }}</span>
                      <span v-if="segmentsForSide(item.line, 'new')[textIndex]?.length === 0">{{ text }}</span>
                    </p>
                  </section>
                </div>
              </template>

              <template v-else>
                <p class="item-heading"><strong>{{ labelForLine(item.line) }}</strong>{{ item.line.type === 'added' ? lineRange('新行 ', item.line.newLineNumbers, item.line.newLineNumber) : item.line.type === 'removed' ? lineRange('旧行 ', item.line.oldLineNumbers, item.line.oldLineNumber) : `${lineRange('旧行 ', item.line.oldLineNumbers, item.line.oldLineNumber)} / ${lineRange('新行 ', item.line.newLineNumbers, item.line.newLineNumber)}` }}</p>
                <p class="line-text">{{ visibleText(item.line) }}</p>
              </template>
            </article>
          </template>
        </div>

        <footer class="result-footer">
          <p>已到达对比结果末尾</p>
          <button type="button" class="back-to-edit" @click="returnToEdit">返回编辑</button>
        </footer>
      </section>

      <button
        v-if="showBackToTop"
        type="button"
        class="back-to-top"
        aria-label="返回页面顶部"
        @click="scrollToTop"
      >
        ↑ 返回顶部
      </button>
    </div>
  </ToolPageLayout>
</template>

<style scoped>
.text-compare-tool, .result-mode, .input-panel, .summary-grid, .diff-list { display: grid; gap: 1rem; }
.input-grid, .modified-side { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
.input-panel { grid-template-columns: 1fr; gap: 0.5rem; }
label, strong { color: var(--color-heading); font-weight: 700; }
textarea { min-height: 18rem; resize: vertical; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-background); padding: 0.875rem; color: var(--color-text); line-height: 1.5; }
textarea:focus-visible, button:focus-visible { outline: 2px solid var(--color-link); outline-offset: 2px; }
.text-metrics, .status-message, .empty-result, .long-text-warning, .item-heading { color: var(--color-muted); }
.controls, .options, .actions, .result-toolbar, .display-controls, .diff-legend { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.controls, .result-toolbar { align-items: center; justify-content: space-between; }
.checkbox-label { display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer; }
button { border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-background); padding: 0.55rem 0.85rem; color: var(--color-heading); font-weight: 700; cursor: pointer; }
button:hover, button.active { border-color: var(--color-link); }
.primary-action, .back-to-edit { border-color: var(--color-link); background: var(--color-link); color: var(--color-background); }
.state-empty, .state-error { color: #b91c1c; }
.state-same { color: #047857; }
.long-text-warning { border-left: 4px solid #d97706; background: #fffbeb; padding: 0.75rem; }
.primary-summary { color: var(--color-heading); font-weight: 700; }
.summary-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.75rem; }
.summary-grid div, .diff-item { border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-background); padding: 0.85rem; }
dt { color: var(--color-muted); font-size: 0.875rem; font-weight: 700; } dd { color: var(--color-heading); font-size: 1.2rem; font-weight: 700; }
.diff-legend { color: var(--color-muted); font-size: 0.9rem; }.legend-removed { color: #b91c1c; }.legend-added { color: #047857; }
.diff-list { gap: 0.75rem; }.item-removed { border-left: 4px solid #dc2626; background: #fef2f2; }.item-added { border-left: 4px solid #059669; background: #ecfdf5; }.item-modified { border-left: 4px solid #d97706; background: #fffbeb; }.item-equal { border-left: 4px solid var(--color-border); }
.item-heading { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }.line-text { min-width: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace; line-height: 1.65; }.line-number { display: inline-block; min-width: 3rem; color: var(--color-muted); user-select: none; }.modified-content { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }.modified-side { display: grid; grid-template-columns: 1fr; gap: 0.35rem; min-width: 0; padding: 0.25rem; }.modified-old { border-right: 1px solid var(--color-border); }.segment-added { background: #bbf7d0; color: #064e3b; }.segment-removed { background: #fecaca; color: #7f1d1d; }.omitted-equal { color: var(--color-muted); text-align: center; }
.result-footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; border-top: 1px solid var(--color-border); padding-top: 1.5rem; }.result-footer p { color: var(--color-muted); }.back-to-top { position: fixed; right: max(1rem, env(safe-area-inset-right)); bottom: max(1rem, env(safe-area-inset-bottom)); z-index: 2; border-color: var(--color-link); background: var(--color-surface); box-shadow: 0 4px 12px rgb(15 23 42 / 0.18); transition: opacity 150ms ease; }
@media (prefers-color-scheme: dark) { .long-text-warning, .item-modified { background: #451a03; }.item-added { background: #052e25; }.item-removed { background: #450a0a; }.segment-added { background: #047857; color: #ecfdf5; }.segment-removed { background: #b91c1c; color: #fef2f2; } }
@media (prefers-reduced-motion: reduce) { .back-to-top { transition: none; } }
@media (max-width: 760px) { .input-grid, .summary-grid, .modified-content { grid-template-columns: 1fr; }.modified-old { border-right: 0; border-bottom: 1px solid var(--color-border); }.result-toolbar { align-items: flex-start; }.back-to-top { right: max(0.75rem, env(safe-area-inset-right)); bottom: max(0.75rem, env(safe-area-inset-bottom)); padding: 0.45rem 0.65rem; font-size: 0.9rem; } textarea { min-height: 14rem; } }
</style>
