import { beforeEach, describe, expect, it } from 'vitest'

import { setTheme, useTheme } from './useTheme'

describe('theme preference', () => {
  beforeEach(() => {
    window.localStorage.clear()
    setTheme('light')
  })

  it('applies and persists an explicit theme', () => {
    const { theme } = useTheme()

    setTheme('dark')

    expect(theme.value).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(window.localStorage.getItem('personal-toolbox.ui.theme')).toBe('dark')
  })

  it('keeps the preference storage access outside Vue components', () => {
    setTheme('light')

    expect(document.documentElement.style.colorScheme).toBe('light')
    expect(window.localStorage.getItem('personal-toolbox.ui.theme')).toBe('light')
  })
})
