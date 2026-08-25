<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'

import { useTheme } from '@/shared/theme/useTheme'

const { theme, setTheme } = useTheme()
const route = useRoute()
const now = ref(new Date())
let clockTimer: ReturnType<typeof setInterval> | undefined
const isHome = computed(() => route.path === '/')

const dateLabel = computed(() =>
  new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).format(now.value),
)
const timeLabel = computed(() =>
  new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now.value),
)

onMounted(() => {
  clockTimer = setInterval(() => {
    now.value = new Date()
  }, 1000)
})

onBeforeUnmount(() => {
  if (clockTimer) {
    clearInterval(clockTimer)
  }
})
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="header-inner">
        <RouterLink class="brand" to="/" aria-label="个人工具箱首页">
          <span class="brand-marker" aria-hidden="true"></span>
          <span class="brand-copy">
            <strong>个人工具箱</strong>
            <small>UTILITY TERMINAL / PT-01</small>
          </span>
        </RouterLink>

        <div class="header-console">
          <div class="clock-panel" aria-label="当前本地日期和时间">
            <span class="console-label">LOCAL TIME</span>
            <time :datetime="now.toISOString()">
              <span>{{ dateLabel }}</span>
              <strong>{{ timeLabel }}</strong>
            </time>
          </div>

          <div class="theme-panel">
            <span class="console-label">DISPLAY MODE</span>
            <div class="theme-switch" aria-label="主题切换">
              <button
                type="button"
                :class="{ active: theme === 'light' }"
                :aria-pressed="theme === 'light'"
                @click="setTheme('light')"
              >
                LIGHT
              </button>
              <button
                type="button"
                :class="{ active: theme === 'dark' }"
                :aria-pressed="theme === 'dark'"
                @click="setTheme('dark')"
              >
                DARK
              </button>
            </div>
          </div>

          <nav class="header-action-slot" aria-label="主导航">
            <a
              v-if="isHome"
              class="header-action github-link"
              href="https://github.com/cang996"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="在新窗口打开 cang996 的 GitHub Profile"
            >
              <svg class="github-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 2.6a9.6 9.6 0 0 0-3 18.72c.48.09.66-.21.66-.47v-1.68c-2.68.58-3.25-1.14-3.25-1.14-.44-1.12-1.07-1.42-1.07-1.42-.87-.6.07-.59.07-.59.97.07 1.48 1 1.48 1 .86 1.47 2.25 1.05 2.8.8.08-.62.34-1.05.61-1.29-2.14-.24-4.39-1.07-4.39-4.75 0-1.05.38-1.91 1-2.58-.1-.24-.43-1.22.09-2.54 0 0 .81-.26 2.64.98A9.2 9.2 0 0 1 12 7.4c.82 0 1.63.11 2.4.32 1.83-1.24 2.64-.98 2.64-.98.52 1.32.19 2.3.09 2.54.62.67 1 1.53 1 2.58 0 3.69-2.26 4.5-4.4 4.74.35.3.65.88.65 1.78v2.47c0 .26.18.57.66.47A9.6 9.6 0 0 0 12 2.6Z"
                />
              </svg>
              <span>GITHUB</span>
              <strong>PROFILE ↗</strong>
            </a>
            <RouterLink v-else class="header-action home-link" to="/">
              <span>INDEX</span>
              <strong>首页</strong>
            </RouterLink>
          </nav>
        </div>
      </div>
    </header>

    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
}

.app-header {
  position: sticky;
  top: 0;
  z-index: 20;
  border-bottom: 1px solid var(--color-border-strong);
  background: var(--color-surface-elevated);
  backdrop-filter: blur(14px);
}

.header-inner {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  width: min(100%, var(--content-max-width));
  min-height: 4.75rem;
  margin: 0 auto;
  padding-inline: var(--space-4);
}

.brand {
  display: flex;
  gap: var(--space-4);
  align-items: center;
  color: var(--color-text-primary);
  text-decoration: none;
}

.brand-marker {
  width: 4px;
  height: 2.4rem;
  background: var(--color-accent);
  box-shadow: var(--glow-accent);
}

.brand-copy {
  display: grid;
  gap: 0.15rem;
}

.brand-copy strong {
  font-size: 1.18rem;
  font-weight: 760;
  letter-spacing: 0.08em;
}

.brand-copy small,
.console-label {
  color: var(--color-text-muted);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: var(--font-size-label);
  font-weight: 700;
  letter-spacing: 0.13em;
}

.header-console {
  display: flex;
  align-items: stretch;
  border-left: 1px solid var(--color-border-subtle);
}

.clock-panel,
.theme-panel,
.header-action {
  display: grid;
  align-content: center;
  gap: var(--space-1);
  min-width: 10rem;
  border-right: 1px solid var(--color-border-subtle);
  padding: var(--space-2) var(--space-4);
}

.clock-panel time {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  font-variant-numeric: tabular-nums;
}

.clock-panel time span {
  color: var(--color-text-secondary);
  font-size: var(--font-size-meta);
}

.clock-panel time strong {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 1rem;
  font-weight: 700;
}

.theme-switch {
  display: flex;
  border: 1px solid var(--color-border-subtle);
  padding: 2px;
}

.theme-switch button {
  min-height: 1.75rem;
  border: 0;
  background: transparent;
  padding: 0.25rem 0.65rem;
  color: var(--color-text-muted);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  cursor: pointer;
}

.theme-switch button.active {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}

.header-action {
  inline-size: 7.25rem;
  min-inline-size: 7.25rem;
  color: var(--color-text-primary);
  text-decoration: none;
}

.header-action-slot {
  display: flex;
}

.header-action span {
  color: var(--color-text-muted);
  font-size: var(--font-size-label);
  font-weight: 700;
  letter-spacing: 0.12em;
}

.header-action strong {
  font-weight: 700;
}

.header-action:hover,
.header-action:focus-visible {
  background: var(--color-accent-soft);
  color: var(--color-accent-active);
}

.github-link {
  position: relative;
  grid-template-columns: auto 1fr;
}

.github-link strong {
  grid-column: 2;
}

.github-icon {
  grid-row: 1 / 3;
  width: 1rem;
  align-self: center;
}

.app-main {
  width: min(100%, var(--content-max-width));
  margin: 0 auto;
  padding: var(--space-6) var(--space-4) var(--space-8);
}

@media (max-width: 760px) {
  .header-inner {
    flex-direction: column;
  }

  .brand {
    min-height: 3.75rem;
  }

  .header-console {
    border-top: 1px solid var(--color-border-subtle);
    border-left: 0;
  }

  .clock-panel {
    flex: 1;
  }
}

@media (max-width: 600px) {
  .header-console {
    display: grid;
    grid-template-columns: minmax(8rem, 1fr) auto auto;
  }

  .clock-panel {
    grid-column: auto;
  }

  .clock-panel,
  .theme-panel {
    min-width: 0;
  }

  .header-action {
    inline-size: 6.5rem;
    min-inline-size: 6.5rem;
  }

  .clock-panel time {
    display: grid;
    gap: 0;
  }

  .clock-panel,
  .theme-panel,
  .header-action {
    padding-inline: var(--space-2);
  }

  .clock-panel time span {
    font-size: 0.66rem;
  }

  .app-main {
    padding-top: var(--space-6);
  }
}
</style>
