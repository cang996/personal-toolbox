<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { exchangeRateTool } from '@/app/tools'
import ToolPageLayout from '@/shared/components/ToolPageLayout.vue'

import { fetchExchangeRates } from './api'
import { formatBeijingTime, formatPrice } from './formatters'
import { currencies } from './types'
import type { BankExchangeRate, CurrencyCode, ExchangeRateComparison, RateStatus } from './types'

const selectedCurrency = ref<CurrencyCode>('AUD')
const comparison = ref<ExchangeRateComparison | null>(null)
const loading = ref(false)
const errorMessage = ref('')
let activeRequest: AbortController | null = null

const marketReferenceAvailable = computed(
  () =>
    comparison.value?.market_reference.status === 'available' &&
    comparison.value.market_reference.rate !== null,
)

async function loadRates() {
  activeRequest?.abort()
  const request = new AbortController()
  activeRequest = request
  loading.value = true
  errorMessage.value = ''

  try {
    const result = await fetchExchangeRates(selectedCurrency.value, { signal: request.signal })
    if (!request.signal.aborted) {
      comparison.value = result
    }
  } catch {
    if (!request.signal.aborted) {
      comparison.value = null
      errorMessage.value = '暂时无法获取汇率数据，请稍后重试。'
    }
  } finally {
    if (activeRequest === request) {
      loading.value = false
      activeRequest = null
    }
  }
}

function bankStatusLabel(status: RateStatus): string {
  return {
    available: '当前有报价',
    stale: '可能已过期',
    unavailable: '暂无当前报价',
    unsupported: '该银行暂不支持此币种',
  }[status]
}

function displayBankPrice(bank: BankExchangeRate, value: string | null): string {
  if (bank.status === 'unavailable' || bank.status === 'unsupported') {
    return '—'
  }
  return formatPrice(value)
}

onMounted(loadRates)
onBeforeUnmount(() => activeRequest?.abort())
</script>

<template>
  <ToolPageLayout :title="exchangeRateTool.name" :description="exchangeRateTool.description">
    <div class="exchange-rate-tool" :aria-busy="loading">
      <section class="toolbar" aria-labelledby="currency-heading">
        <div class="currency-control">
          <label id="currency-heading" for="currency-selector">选择外币</label>
          <select id="currency-selector" v-model="selectedCurrency" @change="loadRates">
            <option v-for="currency in currencies" :key="currency.code" :value="currency.code">
              {{ currency.code }} — {{ currency.name }}
            </option>
          </select>
        </div>
        <button type="button" class="refresh-button" :disabled="loading" @click="loadRates">
          {{ loading ? '正在更新…' : '刷新报价' }}
        </button>
      </section>

      <p v-if="loading && !comparison" class="loading-state" role="status">
        正在获取 {{ selectedCurrency }} 汇率数据…
      </p>

      <section v-else-if="errorMessage" class="page-error" role="alert">
        <div>
          <h2>汇率数据暂不可用</h2>
          <p>{{ errorMessage }}</p>
        </div>
        <button type="button" @click="loadRates">重试</button>
      </section>

      <template v-else-if="comparison">
        <p v-if="loading" class="updating-state" role="status">
          正在更新 {{ selectedCurrency }}，当前报价仍可查看。
        </p>

        <section class="market-card" aria-labelledby="market-heading">
          <div class="market-heading-row">
            <div>
              <p class="eyebrow">MID-MARKET REFERENCE</p>
              <h2 id="market-heading">市场参考汇率</h2>
            </div>
            <span class="reference-badge">仅供参考</span>
          </div>

          <template v-if="marketReferenceAvailable">
            <p class="market-rate">
              <span>1 {{ comparison.currency_code }}</span>
              <strong>≈ {{ formatPrice(comparison.market_reference.rate) }} CNY</strong>
            </p>
            <dl class="reference-meta">
              <div>
                <dt>来源</dt>
                <dd>
                  <a
                    v-if="comparison.market_reference.source_url"
                    :href="comparison.market_reference.source_url"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {{ comparison.market_reference.source_name }} <span aria-hidden="true">↗</span>
                    <span class="visually-hidden">（在新窗口打开）</span>
                  </a>
                  <span v-else>{{ comparison.market_reference.source_name }}</span>
                </dd>
              </div>
              <div>
                <dt>更新时间（北京时间）</dt>
                <dd>{{ formatBeijingTime(comparison.market_reference.published_at) }}</dd>
              </div>
            </dl>
          </template>
          <div v-else class="market-unavailable" role="status">
            <strong>市场参考汇率暂不可用</strong>
            <p>银行报价仍可正常查看。</p>
          </div>
          <p class="reference-note">该数据为市场中间价参考，不代表银行实际成交价或官方中间价。</p>
        </section>

        <section class="bank-section" aria-labelledby="bank-heading">
          <header class="bank-section-heading">
            <div>
              <p class="eyebrow">BANK QUOTES</p>
              <h2 id="bank-heading">五家银行报价比较</h2>
            </div>
            <p>
              买入 / 卖出均为银行视角，所有价格均为 1 单位外币对应的人民币价格。页面展示银行公开报价，仅供比较参考；实际可办理币种及成交价格以银行渠道为准。
            </p>
          </header>

          <div class="table-scroll" tabindex="0" aria-label="银行汇率横向比较表，可横向滚动">
            <table>
              <thead>
                <tr>
                  <th scope="col">银行与状态</th>
                  <th scope="col">银行现汇买入价</th>
                  <th scope="col">银行现汇卖出价</th>
                  <th scope="col">银行现钞买入价</th>
                  <th scope="col">银行现钞卖出价</th>
                  <th scope="col">更新时间（北京时间）</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="bank in comparison.banks" :key="bank.bank_code" :class="`status-${bank.status}`">
                  <th scope="row">
                    <span class="bank-name">{{ bank.bank_name }}</span>
                    <span class="status-label" :class="`status-label-${bank.status}`">
                      {{ bankStatusLabel(bank.status) }}
                    </span>
                  </th>
                  <td>{{ displayBankPrice(bank, bank.spot_buy) }}</td>
                  <td>{{ displayBankPrice(bank, bank.spot_sell) }}</td>
                  <td>{{ displayBankPrice(bank, bank.cash_buy) }}</td>
                  <td>{{ displayBankPrice(bank, bank.cash_sell) }}</td>
                  <td class="timestamp">{{ formatBeijingTime(bank.published_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p class="bank-guidance">
            用人民币购买外币时通常关注银行卖出价；将外币换回人民币时通常关注银行买入价。
          </p>
        </section>
      </template>
    </div>
  </ToolPageLayout>
</template>

<style scoped>
.exchange-rate-tool {
  display: grid;
  gap: var(--space-5);
}

.toolbar,
.market-heading-row,
.bank-section-heading,
.page-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.toolbar {
  border-bottom: 1px solid var(--color-border-subtle);
  padding-bottom: var(--space-4);
}

.currency-control {
  display: grid;
  gap: var(--space-2);
  min-width: min(100%, 19rem);
}

label,
h2,
.bank-name {
  color: var(--color-text-primary);
  font-weight: 700;
}

select,
button {
  min-height: var(--control-height);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  padding: 0.6rem 0.8rem;
}

select {
  width: 100%;
}

button {
  color: var(--color-text-primary);
  font-weight: 700;
  cursor: pointer;
}

.refresh-button,
.page-error button {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: #fff;
}

.refresh-button:hover,
.page-error button:hover {
  border-color: var(--color-accent-hover);
  background: var(--color-accent-hover);
}

.loading-state,
.page-error,
.market-card {
  border-radius: var(--radius-card);
  padding: clamp(1rem, 3vw, 1.5rem);
}

.loading-state,
.updating-state {
  color: var(--color-text-secondary);
}

.loading-state {
  min-height: 12rem;
  background: color-mix(in srgb, var(--color-accent) 4%, var(--color-surface));
}

.updating-state {
  border-left: 3px solid var(--color-accent);
  padding-left: var(--space-3);
}

.page-error {
  border: 1px solid color-mix(in srgb, var(--color-danger) 25%, var(--color-border-subtle));
  background: color-mix(in srgb, var(--color-danger) 4%, var(--color-surface));
}

.page-error p {
  color: var(--color-text-secondary);
}

.market-card {
  display: grid;
  gap: var(--space-4);
  border: 1px solid color-mix(in srgb, var(--color-accent) 25%, var(--color-border-subtle));
  background: linear-gradient(145deg, color-mix(in srgb, var(--color-accent) 7%, #fff), #fff 62%);
}

.eyebrow {
  color: var(--color-text-muted);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.reference-badge,
.status-label {
  display: inline-flex;
  width: fit-content;
  border-radius: 999px;
  padding: 0.2rem 0.55rem;
  font-size: 0.78rem;
  font-weight: 700;
}

.reference-badge {
  background: color-mix(in srgb, var(--color-accent) 9%, #fff);
  color: var(--color-accent-active);
}

.market-rate {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-3);
  color: var(--color-text-secondary);
}

.market-rate strong {
  color: var(--color-text-primary);
  font-size: clamp(1.7rem, 5vw, 2.5rem);
  font-weight: 700;
  letter-spacing: -0.025em;
}

.reference-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-5);
}

.reference-meta div {
  display: grid;
  gap: var(--space-1);
}

dt,
.reference-note,
.bank-section-heading p,
.bank-guidance,
.market-unavailable p {
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

dd {
  color: var(--color-text-primary);
}

dd a {
  color: var(--color-accent);
  font-weight: 700;
  text-decoration: none;
}

dd a:hover,
dd a:focus-visible {
  text-decoration: underline;
}

.market-unavailable {
  display: grid;
  gap: var(--space-1);
  border-left: 3px solid var(--color-text-muted);
  padding-left: var(--space-3);
}

.bank-section {
  display: grid;
  gap: var(--space-4);
}

.bank-section-heading {
  align-items: flex-end;
}

.bank-section-heading > p {
  max-width: 29rem;
  text-align: right;
}

.table-scroll {
  overflow-x: auto;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}

table {
  width: 100%;
  min-width: 920px;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}

th,
td {
  border-bottom: 1px solid var(--color-border-subtle);
  padding: 0.85rem 0.75rem;
  text-align: right;
  white-space: nowrap;
}

thead th {
  background: color-mix(in srgb, var(--color-page-background) 72%, #fff);
  color: var(--color-text-secondary);
  font-size: 0.82rem;
  font-weight: 700;
}

th:first-child {
  position: sticky;
  left: 0;
  z-index: 1;
  min-width: 10rem;
  background: var(--color-surface);
  text-align: left;
}

thead th:first-child {
  z-index: 2;
  background: color-mix(in srgb, var(--color-page-background) 72%, #fff);
}

tbody tr:last-child th,
tbody tr:last-child td {
  border-bottom: 0;
}

.bank-name {
  display: block;
  margin-bottom: var(--space-1);
}

.status-label-available {
  background: color-mix(in srgb, var(--color-success) 9%, #fff);
  color: var(--color-success);
}

.status-label-stale {
  background: var(--color-warning-surface);
  color: var(--color-warning);
}

.status-label-unavailable,
.status-label-unsupported {
  background: var(--color-page-background);
  color: var(--color-text-muted);
}

.status-stale td,
.status-stale th,
.status-unavailable td,
.status-unavailable th,
.status-unsupported td,
.status-unsupported th {
  color: var(--color-text-muted);
}

.timestamp {
  color: var(--color-text-secondary);
  font-size: 0.86rem;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (max-width: 700px) {
  .toolbar,
  .page-error,
  .bank-section-heading {
    align-items: stretch;
    flex-direction: column;
  }

  .refresh-button,
  .page-error button {
    width: 100%;
  }

  .bank-section-heading > p {
    text-align: left;
  }

  .table-scroll {
    margin-inline: -0.25rem;
  }
}
</style>
