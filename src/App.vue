<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <RouterLink class="app-title" to="/">Personal Toolbox</RouterLink>
      <nav aria-label="Primary navigation">
        <RouterLink class="home-link" to="/">Home</RouterLink>
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
  gap: 1rem;
  border-bottom: 1px solid var(--color-border);
  padding: 1rem max(1rem, calc((100vw - var(--page-max-width)) / 2));
}

.app-title {
  color: var(--color-heading);
  font-size: 1rem;
  font-weight: 700;
  text-decoration: none;
}

.home-link {
  color: var(--color-link);
  font-weight: 600;
  text-decoration: none;
}

.home-link:hover,
.home-link:focus-visible {
  text-decoration: underline;
}

.app-main {
  margin: 0 auto;
  max-width: var(--page-max-width);
  padding: 2rem 1rem 3rem;
}
</style>
