import { readonly, ref } from 'vue'

import { browserPreferenceStorage } from '@/shared/storage/preferenceStorage'
import { storageKeys } from '@/shared/storage/storageKeys'

export type Theme = 'light' | 'dark'

const activeTheme = ref<Theme>('light')
let initialized = false

function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark'
}

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

export function initializeTheme() {
  if (initialized || typeof window === 'undefined') {
    return
  }

  const storedTheme = browserPreferenceStorage.read(storageKeys.theme)
  activeTheme.value = isTheme(storedTheme) ? storedTheme : systemTheme()
  applyTheme(activeTheme.value)
  initialized = true
}

export function setTheme(theme: Theme) {
  activeTheme.value = theme
  applyTheme(theme)
  browserPreferenceStorage.write(storageKeys.theme, theme)
}

export function useTheme() {
  initializeTheme()

  return {
    theme: readonly(activeTheme),
    setTheme,
  }
}
