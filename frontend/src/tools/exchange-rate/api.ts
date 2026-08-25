import type { CurrencyCode, ExchangeRateComparison } from './types'

const DEFAULT_API_BASE_URL = ''

export class ExchangeRateApiError extends Error {
  constructor() {
    super('暂时无法获取汇率数据')
    this.name = 'ExchangeRateApiError'
  }
}

export function getApiBaseUrl(configuredUrl = import.meta.env.VITE_API_BASE_URL): string {
  return (configuredUrl || DEFAULT_API_BASE_URL).replace(/\/+$/, '')
}

export async function fetchExchangeRates(
  currencyCode: CurrencyCode,
  options: {
    baseUrl?: string
    fetcher?: typeof fetch
    signal?: AbortSignal
  } = {},
): Promise<ExchangeRateComparison> {
  const fetcher = options.fetcher ?? fetch
  let response: Response
  try {
    response = await fetcher(
      `${getApiBaseUrl(options.baseUrl)}/api/exchange-rates/${currencyCode}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: options.signal,
      },
    )
  } catch (error) {
    if (options.signal?.aborted) {
      throw error
    }
    throw new ExchangeRateApiError()
  }

  if (!response.ok) {
    throw new ExchangeRateApiError()
  }

  try {
    return (await response.json()) as ExchangeRateComparison
  } catch {
    throw new ExchangeRateApiError()
  }
}
