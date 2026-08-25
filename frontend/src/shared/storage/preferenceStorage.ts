export interface PreferenceStorage {
  read(key: string): string | null
  write(key: string, value: string): void
}

export const browserPreferenceStorage: PreferenceStorage = {
  read(key) {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  },
  write(key, value) {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      // UI preferences are best-effort when browser storage is unavailable.
    }
  },
}
