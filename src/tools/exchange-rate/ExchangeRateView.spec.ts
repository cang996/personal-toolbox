import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchExchangeRates } from './api'
import ExchangeRateView from './ExchangeRateView.vue'
import type { ExchangeRateComparison, RateStatus } from './types'

type FetchExchangeRates = typeof import('./api').fetchExchangeRates

vi.mock('./api', () => ({
  fetchExchangeRates: vi.fn<FetchExchangeRates>(),
}))

const mockedFetch = vi.mocked(fetchExchangeRates)

function comparison(options: { marketStatus?: RateStatus } = {}): ExchangeRateComparison {
  return {
    currency_code: 'AUD',
    market_reference: {
      currency_code: 'AUD',
      rate: options.marketStatus === 'unavailable' ? null : '4.82117',
      source_code: 'currencybeacon',
      source_name: 'CurrencyBeacon',
      source_url: 'https://currencybeacon.com/',
      rate_type: 'mid_market',
      published_at: options.marketStatus === 'unavailable' ? null : '2026-08-24T03:19:18+00:00',
      retrieved_at: '2026-08-24T03:20:00+00:00',
      status: options.marketStatus ?? 'available',
    },
    banks: [
      bank('BOC', '中国银行', 'available', '4.8027'),
      bank('ICBC', '中国工商银行', 'stale', '4.7942'),
      bank('CCB', '中国建设银行', 'unavailable', null),
      bank('ABC', '中国农业银行', 'unsupported', null),
      bank('CMB', '招商银行', 'available', null),
    ],
  }
}

function bank(
  bankCode: string,
  bankName: string,
  status: RateStatus,
  spotBuy: string | null,
) {
  return {
    bank_code: bankCode,
    bank_name: bankName,
    currency_code: 'AUD',
    currency_name: '澳大利亚元',
    spot_buy: spotBuy,
    spot_sell: spotBuy === null ? null : '4.8408',
    cash_buy: spotBuy,
    cash_sell: spotBuy === null ? null : '4.8408',
    published_at: spotBuy === null ? null : '2026-08-24T13:00:12+08:00',
    status,
  }
}

function mountView() {
  return mount(ExchangeRateView, {
    global: {
      stubs: {
        ToolPageLayout: { template: '<main><slot /></main>' },
      },
    },
  })
}

describe('ExchangeRateView', () => {
  beforeEach(() => {
    mockedFetch.mockReset()
  })

  it('loads AUD by default and renders reference, four quote fields, statuses, and missing values', async () => {
    mockedFetch.mockResolvedValue(comparison())
    const wrapper = mountView()
    await flushPromises()

    expect(mockedFetch).toHaveBeenCalledWith('AUD', expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(wrapper.get('select').element.value).toBe('AUD')
    expect(wrapper.findAll('option')).toHaveLength(14)
    expect(wrapper.text()).toContain('1 AUD')
    expect(wrapper.text()).toContain('≈ 4.8212 CNY')
    expect(wrapper.get('a[href="https://currencybeacon.com/"]').text()).toContain('CurrencyBeacon')
    expect(wrapper.text()).toContain('2026-08-24 11:19:18')
    expect(wrapper.findAll('tbody tr')).toHaveLength(5)
    expect(wrapper.text()).toContain('银行现汇买入价')
    expect(wrapper.text()).toContain('银行现汇卖出价')
    expect(wrapper.text()).toContain('银行现钞买入价')
    expect(wrapper.text()).toContain('银行现钞卖出价')
    expect(wrapper.text()).toContain('当前可用')
    expect(wrapper.text()).toContain('可能已过期')
    expect(wrapper.text()).toContain('暂无当前报价')
    expect(wrapper.text()).toContain('暂不支持此币种')
    expect(wrapper.findAll('tbody td').some((cell) => cell.text() === '—')).toBe(true)
    expect(wrapper.text()).not.toContain('汇率数据暂不可用')
  })

  it('treats an unavailable market reference as partial data, not a page error', async () => {
    mockedFetch.mockResolvedValue(comparison({ marketStatus: 'unavailable' }))
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('市场参考汇率暂不可用')
    expect(wrapper.text()).toContain('银行报价仍可正常查看')
    expect(wrapper.findAll('tbody tr')).toHaveLength(5)
    expect(wrapper.find('.page-error').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('API key')
  })

  it('requests a selected currency once and refreshes only on explicit action', async () => {
    mockedFetch.mockResolvedValue(comparison())
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('select').setValue('JPY')
    await flushPromises()
    expect(mockedFetch.mock.calls.map(([currency]) => currency)).toEqual(['AUD', 'JPY'])

    await wrapper.get('.refresh-button').trigger('click')
    await flushPromises()
    expect(mockedFetch.mock.calls.map(([currency]) => currency)).toEqual(['AUD', 'JPY', 'JPY'])
  })

  it('shows a page error for network failure and retries without exposing details', async () => {
    mockedFetch.mockRejectedValueOnce(new Error('private stack detail'))
    mockedFetch.mockResolvedValueOnce(comparison())
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('汇率数据暂不可用')
    expect(wrapper.text()).toContain('暂时无法获取汇率数据，请稍后重试')
    expect(wrapper.text()).not.toContain('private stack detail')

    await wrapper.get('.page-error button').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('tbody tr')).toHaveLength(5)
    expect(mockedFetch).toHaveBeenCalledTimes(2)
  })
})
