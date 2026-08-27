<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import ToolPageLayout from '@/shared/components/ToolPageLayout.vue'
import { countCharacters, countLines } from '@/shared/text/textStatistics'

import { normalizeChinesePublicationText } from './chinesePublicationStandard'
import { normalizeText } from './textNormalizer'

type NormalizerState = 'idle' | 'empty' | 'success' | 'copy-success' | 'copy-error'
type NormalizerMode = 'custom' | 'chinese-publication'

const inputText = ref('')
const mode = ref<NormalizerMode>('custom')
const cleanCopyResidue = ref(false)
const normalizeWhitespace = ref(false)
const addCjkLatinSpacing = ref(false)
const normalizePunctuationSpacing = ref(false)
const normalizeFullWidthAlphanumeric = ref(false)
const result = ref('')
const state = ref<NormalizerState>('idle')
const statusMessage = ref('粘贴文本后点击“开始规范化”。')

const hasResult = computed(() => result.value.length > 0)
const hasCurrentResult = computed(() => state.value !== 'idle' && state.value !== 'empty')
const inputCharacterCount = computed(() => countCharacters(inputText.value))
const inputLineCount = computed(() => countLines(inputText.value))
const outputCharacterCount = computed(() => countCharacters(result.value))
const outputLineCount = computed(() => countLines(result.value))

watch(
  [
    inputText,
    mode,
    cleanCopyResidue,
    normalizeWhitespace,
    addCjkLatinSpacing,
    normalizePunctuationSpacing,
    normalizeFullWidthAlphanumeric,
  ],
  invalidateResult,
  { flush: 'sync' },
)

function runNormalizer() {
  if (!inputText.value.trim()) {
    result.value = ''
    state.value = 'empty'
    statusMessage.value = '请输入要规范化的文本。'
    return
  }

  const modeResult =
    mode.value === 'chinese-publication'
      ? normalizeChinesePublicationText(inputText.value)
      : inputText.value
  result.value = normalizeText(modeResult, {
    cleanCopyResidue: cleanCopyResidue.value,
    normalizeWhitespace: normalizeWhitespace.value,
    addCjkLatinSpacing: addCjkLatinSpacing.value,
    normalizePunctuationSpacing: normalizePunctuationSpacing.value,
    normalizeFullWidthAlphanumeric: normalizeFullWidthAlphanumeric.value,
  })
  state.value = 'success'
  statusMessage.value = '已生成规范化结果。'
}

function clearAll() {
  inputText.value = ''
  result.value = ''
  mode.value = 'custom'
  cleanCopyResidue.value = false
  normalizeWhitespace.value = false
  addCjkLatinSpacing.value = false
  normalizePunctuationSpacing.value = false
  normalizeFullWidthAlphanumeric.value = false
  state.value = 'idle'
  statusMessage.value = '已清空输入和规范化结果。'
}

async function copyResult() {
  if (!hasResult.value) return

  try {
    await navigator.clipboard.writeText(result.value)
    state.value = 'copy-success'
    statusMessage.value = '已复制规范化结果。'
  } catch {
    state.value = 'copy-error'
    statusMessage.value = '复制失败，请手动选择结果文本后复制。'
  }
}

function invalidateResult() {
  if (!hasResult.value) return

  result.value = ''
  state.value = 'idle'
  statusMessage.value = '输入或选项已变更，请重新开始规范化。'
}
</script>

<template>
  <ToolPageLayout title="文本规范化" description="规范普通文本的空格、中英混排、标点间距和全角字母数字。">
    <div class="text-normalizer">
      <div class="content-grid">
        <section class="text-panel">
          <div class="panel-heading">
            <label for="normalizer-source-text">原始文本</label>
            <p class="text-metrics" aria-label="输入文本统计">{{ inputCharacterCount }} 字符 · {{ inputLineCount }} 行</p>
          </div>
          <textarea id="normalizer-source-text" v-model="inputText" placeholder="粘贴要规范化的普通文本" spellcheck="false" />
        </section>

        <section class="text-panel">
          <div class="panel-heading">
            <label for="normalized-text">规范化结果</label>
            <p v-if="hasCurrentResult" class="text-metrics" aria-label="规范化结果统计">
              {{ outputCharacterCount }} 字符 · {{ outputLineCount }} 行
            </p>
          </div>
          <textarea id="normalized-text" :value="result" readonly aria-label="规范化结果" />
        </section>
      </div>

      <section class="mode-section" aria-labelledby="normalizer-mode-heading">
        <div class="section-heading">
          <h2 id="normalizer-mode-heading">处理模式</h2>
        </div>

        <div class="mode-options">
          <label class="mode-option">
            <span class="mode-choice"><input v-model="mode" type="radio" value="custom" />自定义</span>
            <span class="mode-description">仅执行下方选择的个人格式偏好。</span>
          </label>

          <label class="mode-option">
            <span class="mode-choice"><input v-model="mode" type="radio" value="chinese-publication" />中文出版规范</span>
            <span class="mode-description"><strong>CY/T 154—2017 · 纯文本子集</strong><br />按《中文出版物夹用英文的编辑规范》中可由纯文本安全判断的规则处理。<br />不检查字体、字号、换行排版或页面效果。</span>
          </label>
        </div>

        <p class="standard-note">标准允许根据排版效果决定中英文之间是否留空格；本模式不强制。如果你偏好留空格，可继续开启“添加中英文/数字间距”。</p>
      </section>

      <section class="controls" aria-labelledby="personal-preferences-heading">
        <div class="section-heading">
          <h2 id="personal-preferences-heading">个人格式偏好</h2>
          <p>可单独使用，也可以叠加在中文出版规范之后。</p>
        </div>

        <div class="options">
          <div class="option-item">
            <label class="checkbox-label"><input v-model="cleanCopyResidue" type="checkbox" />清理复制残留字符</label>
            <p class="option-description">删除零宽空格、软连字符等不可见复制残留，并将不换行空格转为普通空格；普通连字符会保留。</p>
          </div>

          <div class="option-item">
            <label class="checkbox-label"><input v-model="normalizeWhitespace" type="checkbox" />规范普通空白</label>
            <p class="option-description">统一 Tab、全角空格和连续空格，并清理行尾空格；可能改变手工对齐、代码缩进或排版文本。</p>
          </div>

          <div class="option-item">
            <label class="checkbox-label"><input v-model="addCjkLatinSpacing" type="checkbox" />添加中英文/数字间距</label>
            <p class="option-description">在汉字与英文或数字之间统一加入一个空格，让中英混排更清晰；这属于排版风格，不是强制标准。</p>
          </div>

          <div class="option-item">
            <label class="checkbox-label"><input v-model="normalizePunctuationSpacing" type="checkbox" />规范标点周围空格</label>
            <p class="option-description">删除标点附近多余空格，并整理小数、百分比、金额等常见间距；不会转换中英文标点符号。</p>
          </div>

          <div class="option-item">
            <label class="checkbox-label"><input v-model="normalizeFullWidthAlphanumeric" type="checkbox" />全角字母数字转半角</label>
            <p class="option-description">例如 ＡＢＣ１２３ → ABC123；只转换全角字母和数字，中文标点保持不变。</p>
          </div>
        </div>

        <div class="actions">
          <button type="button" class="primary-action" @click="runNormalizer">开始规范化</button>
          <button type="button" @click="clearAll">清空</button>
          <button type="button" :disabled="!hasResult" @click="copyResult">复制结果</button>
        </div>
      </section>

      <p class="status-message" :class="`state-${state}`" role="status">{{ statusMessage }}</p>
    </div>
  </ToolPageLayout>
</template>

<style scoped>
.text-normalizer, .text-panel { display: grid; gap: var(--space-4); }
.content-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); }
.text-panel { gap: var(--space-2); min-width: 0; }
.panel-heading { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-3); align-items: baseline; justify-content: space-between; min-width: 0; }
.text-metrics { color: var(--color-text-muted); font-size: 0.8125rem; white-space: nowrap; }
label { color: var(--color-text-primary); font-weight: 700; }
textarea { min-width: 0; min-height: 20rem; resize: vertical; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-control); background: var(--color-surface); padding: 0.875rem; color: var(--color-text-primary); line-height: 1.6; overflow-wrap: anywhere; white-space: pre-wrap; }
textarea:focus-visible { border-color: var(--color-accent); }
.mode-section, .controls { display: grid; gap: var(--space-4); }
.mode-section { border-top: 1px solid var(--color-border-subtle); border-bottom: 1px solid var(--color-border-subtle); padding-block: var(--space-4); }
.section-heading { display: grid; gap: var(--space-1); }
.section-heading h2 { color: var(--color-text-primary); font-size: 1rem; }
.section-heading p, .mode-description, .standard-note { color: var(--color-text-muted); font-size: 0.8125rem; font-weight: 400; line-height: 1.5; }
.mode-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3) var(--space-4); }
.mode-option { display: grid; gap: var(--space-1); min-width: 0; align-content: start; cursor: pointer; }
.mode-choice { display: inline-flex; gap: var(--space-2); align-items: center; }
.mode-description { padding-left: calc(1rem + var(--space-2)); overflow-wrap: anywhere; }
.mode-description strong { color: var(--color-text-secondary); font-weight: 700; }
.standard-note { max-width: 72rem; }
.options { display: grid; grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr)); gap: var(--space-3) var(--space-4); min-width: 0; }
.option-item { display: grid; gap: var(--space-1); min-width: 0; align-content: start; }
.checkbox-label { display: inline-flex; gap: var(--space-2); align-items: center; cursor: pointer; }
.option-description { padding-left: calc(1rem + var(--space-2)); color: var(--color-text-muted); font-size: 0.75rem; line-height: 1.45; overflow-wrap: anywhere; }
.actions { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; }
button { min-height: var(--control-height); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-control); background: var(--color-surface); padding: 0.55rem 0.85rem; color: var(--color-text-primary); font-weight: 700; cursor: pointer; }
button:hover { border-color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 8%, var(--color-surface)); }
button:disabled { cursor: not-allowed; opacity: 0.55; }
.primary-action { border-color: var(--color-accent); background: var(--color-accent); color: var(--color-accent-contrast); }
.primary-action:hover { border-color: var(--color-accent-hover); background: var(--color-accent-hover); }
.status-message { color: var(--color-text-muted); }
.state-empty, .state-copy-error { color: var(--color-danger); }
.state-success, .state-copy-success { color: var(--color-success); }
@media (max-width: 760px) { .content-grid, .mode-options, .options { grid-template-columns: 1fr; } textarea { min-height: 14rem; } }
</style>
