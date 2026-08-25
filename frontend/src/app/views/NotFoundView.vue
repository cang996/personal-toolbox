<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <section class="not-found">
    <p class="status-code">404</p>
    <h1>页面未找到</h1>
    <p>你访问的页面不存在。</p>
    <RouterLink class="home-link" to="/">返回首页</RouterLink>
  </section>
</template>

<style scoped>
.not-found {
  display: grid;
  gap: 0.75rem;
  max-width: 38rem;
}

.status-code {
  color: var(--color-accent);
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

h1 {
  color: var(--color-text-primary);
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  font-weight: 700;
  line-height: 1.15;
}

p {
  color: var(--color-text-secondary);
}

.home-link {
  width: fit-content;
  color: var(--color-accent);
  font-weight: 600;
  text-decoration: none;
}

.home-link:hover,
.home-link:focus-visible {
  text-decoration: underline;
}
</style>
