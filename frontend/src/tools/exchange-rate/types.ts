export type RateStatus = 'available' | 'stale' | 'unavailable' | 'unsupported'

export interface MarketReferenceRate {
  currency_code: string
  rate: string | null
  source_code: string
  source_name: string
  source_url: string
  rate_type: string
  published_at: string | null
  retrieved_at: string
  status: RateStatus
}

export interface BankExchangeRate {
  bank_code: string
  bank_name: string
  currency_code: string
  currency_name: string | null
  spot_buy: string | null
  spot_sell: string | null
  cash_buy: string | null
  cash_sell: string | null
  published_at: string | null
  status: RateStatus
}

export interface ExchangeRateComparison {
  currency_code: string
  market_reference: MarketReferenceRate
  banks: BankExchangeRate[]
}

export const currencies = [
  { code: 'USD', name: '美元' },
  { code: 'CAD', name: '加拿大元' },
  { code: 'EUR', name: '欧元' },
  { code: 'GBP', name: '英镑' },
  { code: 'CHF', name: '瑞士法郎' },
  { code: 'AUD', name: '澳大利亚元' },
  { code: 'NZD', name: '新西兰元' },
  { code: 'JPY', name: '日元' },
  { code: 'KRW', name: '韩元' },
  { code: 'HKD', name: '港币' },
  { code: 'MOP', name: '澳门元' },
  { code: 'TWD', name: '新台币' },
  { code: 'SGD', name: '新加坡元' },
  { code: 'MYR', name: '马来西亚林吉特' },
] as const

export type CurrencyCode = (typeof currencies)[number]['code']

export function normalizeCurrencyCode(value: string): CurrencyCode | null {
  const normalized = value.trim().toUpperCase()
  return currencies.some((currency) => currency.code === normalized)
    ? (normalized as CurrencyCode)
    : null
}
