import { describe, expect, it, vi } from 'vitest'

import { ExchangeRateApiError, fetchExchangeRates, getApiBaseUrl } from './api'
import { formatBeijingTime, formatPrice } from './formatters'
import { currencies, normalizeCurrencyCode } from './types'
import type { ExchangeRateComparison } from './types'

const response: ExchangeRateComparison = {
  currency_code: 'AUD',
  market_reference: {
    currency_code: 'AUD',
    rate: '4.8211000000000001',
    source_code: 'currencybeacon',
    source_name: 'CurrencyBeacon',
    source_url: 'https://currencybeacon.com/',
    rate_type: 'mid_market',
    published_at: '2026-08-24T03:00:00+00:00',
    retrieved_at: '2026-08-24T03:01:00+00:00',
    status: 'available',
  },
  banks: [],
}

describe('exchange-rate API client', () => {
  it('requests only the backend endpoint and preserves Decimal strings', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const result = await fetchExchangeRates('AUD', {
      baseUrl: 'http://backend.test/',
      fetcher,
    })

    expect(fetcher).toHaveBeenCalledOnce()
    expect(fetcher.mock.calls[0]?.[0]).toBe('http://backend.test/api/exchange-rates/AUD')
    expect(result.market_reference.rate).toBe('4.8211000000000001')
    expect(typeof result.market_reference.rate).toBe('string')
  })

  it('uses a localhost default and strips trailing slashes from configuration', () => {
    expect(getApiBaseUrl('http://localhost:9000///')).toBe('http://localhost:9000')
    expect(getApiBaseUrl('')).toBe('http://127.0.0.1:8000')
  })

  it('exposes a safe feature error for HTTP and network failures', async () => {
    const httpFailure = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('private body', { status: 500 }))
    const networkFailure = vi.fn<typeof fetch>().mockRejectedValue(new Error('private network error'))

    await expect(fetchExchangeRates('AUD', { fetcher: httpFailure })).rejects.toBeInstanceOf(
      ExchangeRateApiError,
    )
    await expect(fetchExchangeRates('AUD', { fetcher: networkFailure })).rejects.toBeInstanceOf(
      ExchangeRateApiError,
    )
  })
})

describe('exchange-rate presentation utilities', () => {
  it('normalizes supported currencies and contains the complete V1 selection', () => {
    expect(normalizeCurrencyCode(' aud ')).toBe('AUD')
    expect(normalizeCurrencyCode('cny')).toBeNull()
    expect(currencies).toHaveLength(14)
  })

  it('rounds only for display without exposing long tails', () => {
    expect(formatPrice('4.8350599999999995')).toBe('4.8351')
    expect(formatPrice('0.04821099')).toBe('0.048211')
    expect(formatPrice('0.100000')).toBe('0.1')
    expect(formatPrice(null)).toBe('—')
    expect(formatPrice('not-a-rate')).toBe('—')
  })

  it('formats aware timestamps in Beijing time', () => {
    expect(formatBeijingTime('2026-08-24T03:19:18+00:00')).toBe('2026-08-24 11:19:18')
    expect(formatBeijingTime('2026-08-24T11:19:18+08:00')).toBe('2026-08-24 11:19:18')
    expect(formatBeijingTime(null)).toBe('—')
  })
})
