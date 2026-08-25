<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <RouterLink class="app-title" to="/">个人工具箱</RouterLink>
      <nav aria-label="主导航">
        <RouterLink class="home-link" to="/">首页</RouterLink>
      </nav>
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  border-bottom: 1px solid var(--color-border-subtle);
  background: var(--color-surface-elevated);
  padding: var(--space-4) max(var(--space-4), calc((100vw - var(--content-max-width)) / 2));
}

.app-title {
  color: var(--color-text-primary);
  font-size: 1rem;
  font-weight: 700;
  text-decoration: none;
}

.home-link {
  color: var(--color-accent);
  font-weight: 600;
  text-decoration: none;
}

.home-link:hover,
.home-link:focus-visible {
  text-decoration: underline;
}

.app-main {
  margin: 0 auto;
  max-width: var(--content-max-width);
  padding: var(--space-6) var(--space-4) 3rem;
}
</style>
