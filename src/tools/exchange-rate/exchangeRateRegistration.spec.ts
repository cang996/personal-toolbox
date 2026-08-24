import { describe, expect, it } from 'vitest'

import router from '@/app/router'
import { exchangeRateTool, tools } from '@/app/tools'

describe('exchange-rate registration', () => {
  it('registers one tool entry and matching lazy route', () => {
    expect(tools).toContain(exchangeRateTool)
    expect(exchangeRateTool.path).toBe('/tools/exchange-rate')
    expect(router.getRoutes().some((route) => route.path === exchangeRateTool.path)).toBe(true)
  })
})
