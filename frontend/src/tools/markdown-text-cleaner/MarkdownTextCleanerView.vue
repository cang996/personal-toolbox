<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import ToolPageLayout from '@/shared/components/ToolPageLayout.vue'
import { countCharacters, countLines } from '@/shared/text/textStatistics'

import { cleanMarkdownText } from './markdownTextCleaner'

type CleanerState = 'idle' | 'empty' | 'success' | 'copy-success' | 'copy-error'

const inputText = ref('')
const preserveLinkUrls = ref(false)
const numberHeadings = ref(false)
const cleanCopyResidue = ref(false)
const result = ref('')
const state = ref<CleanerState>('idle')
const statusMessage = ref('粘贴 Markdown 后点击“开始清理”。')
const hasResult = computed(() => result.value.length > 0)
const hasCurrentResult = computed(() => state.value !== 'idle' && state.value !== 'empty')
const inputCharacterCount = computed(() => countCharacters(inputText.value))
const inputLineCount = computed(() => countLines(inputText.value))
const outputCharacterCount = computed(() => countCharacters(result.value))
const outputLineCount = computed(() => countLines(result.value))

watch([inputText, preserveLinkUrls, numberHeadings, cleanCopyResidue], invalidateResult, { flush: 'sync' })

function runCleaner() {
  if (!inputText.value.trim()) {
    result.value = ''
    state.value = 'empty'
    statusMessage.value = '请输入要清理的 Markdown。'
    return
  }

  result.value = cleanMarkdownText(inputText.value, {
    preserveLinkUrls: preserveLinkUrls.value,
    numberHeadings: numberHeadings.value,
    cleanCopyResidue: cleanCopyResidue.value,
  })
  state.value = 'success'
  statusMessage.value = '已生成清理结果。'
}

function clearAll() {
  inputText.value = ''
  result.value = ''
  preserveLinkUrls.value = false
  numberHeadings.value = false
  cleanCopyResidue.value = false
  state.value = 'idle'
  statusMessage.value = '已清空输入和清理结果。'
}

async function copyResult() {
  if (!hasResult.value) return

  try {
    await navigator.clipboard.writeText(result.value)
    state.value = 'copy-success'
    statusMessage.value = '已复制清理结果。'
  } catch {
    state.value = 'copy-error'
    statusMessage.value = '复制失败，请手动选择结果文本后复制。'
  }
}

function invalidateResult() {
  if (!hasResult.value) return

  result.value = ''
  state.value = 'idle'
  statusMessage.value = '输入或选项已变更，请重新开始清理。'
}
</script>

<template>
  <ToolPageLayout title="Markdown 格式清理" description="删除常见 Markdown 标记，保留适合复制到 Word 的文本结构。">
    <div class="markdown-text-cleaner">
      <div class="content-grid">
        <section class="text-panel">
          <div class="panel-heading">
            <label for="markdown-source-text">Markdown 原文</label>
            <p class="text-metrics" aria-label="输入文本统计">{{ inputCharacterCount }} 字符 · {{ inputLineCount }} 行</p>
          </div>
          <textarea id="markdown-source-text" v-model="inputText" placeholder="粘贴 Markdown 文本" spellcheck="false" />
        </section>

        <section class="text-panel">
          <div class="panel-heading">
            <label for="cleaned-markdown-text">清理结果</label>
            <p v-if="hasCurrentResult" class="text-metrics" aria-label="清理结果统计">
              {{ outputCharacterCount }} 字符 · {{ outputLineCount }} 行
            </p>
          </div>
          <textarea id="cleaned-markdown-text" :value="result" readonly aria-label="清理结果" />
        </section>
      </div>

      <section class="controls" aria-label="清理选项和操作">
        <div class="options">
          <label class="checkbox-label">
            <input v-model="preserveLinkUrls" type="checkbox" />
            保留链接 URL
          </label>

          <label class="checkbox-label">
            <input v-model="numberHeadings" type="checkbox" />
            自动为标题编号
          </label>

          <label class="checkbox-label">
            <input v-model="cleanCopyResidue" type="checkbox" />
            清理复制残留字符
          </label>
        </div>

        <div class="actions">
          <button type="button" class="primary-action" @click="runCleaner">开始清理</button>
          <button type="button" @click="clearAll">清空</button>
          <button type="button" :disabled="!hasResult" @click="copyResult">复制结果</button>
        </div>
      </section>

      <p class="status-message" :class="`state-${state}`" role="status">{{ statusMessage }}</p>
    </div>
  </ToolPageLayout>
</template>

<style scoped>
.markdown-text-cleaner, .text-panel { display: grid; gap: var(--space-4); }
.content-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); }
.text-panel { gap: var(--space-2); min-width: 0; }
.panel-heading { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-3); align-items: baseline; justify-content: space-between; min-width: 0; }
.text-metrics { color: var(--color-text-muted); font-size: 0.8125rem; white-space: nowrap; }
label { color: var(--color-text-primary); font-weight: 700; }
textarea { min-width: 0; min-height: 20rem; resize: vertical; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-control); background: var(--color-surface); padding: 0.875rem; color: var(--color-text-primary); line-height: 1.6; overflow-wrap: anywhere; white-space: pre-wrap; }
textarea:focus-visible { border-color: var(--color-accent); }
.controls, .options, .actions { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; }
.controls { justify-content: space-between; }
.checkbox-label { display: inline-flex; gap: var(--space-2); align-items: center; cursor: pointer; }
button { min-height: var(--control-height); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-control); background: var(--color-surface); padding: 0.55rem 0.85rem; color: var(--color-text-primary); font-weight: 700; cursor: pointer; }
button:hover { border-color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 8%, var(--color-surface)); }
.primary-action { border-color: var(--color-accent); background: var(--color-accent); color: var(--color-accent-contrast); }
.primary-action:hover { border-color: var(--color-accent-hover); background: var(--color-accent-hover); }
.status-message { color: var(--color-text-muted); }
.state-empty, .state-copy-error { color: var(--color-danger); }
.state-success, .state-copy-success { color: var(--color-success); }
@media (max-width: 760px) { .content-grid { grid-template-columns: 1fr; } textarea { min-height: 14rem; } .controls { align-items: flex-start; } }
</style>
