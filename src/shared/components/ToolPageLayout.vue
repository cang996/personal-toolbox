<script setup lang="ts">
import { RouterLink } from 'vue-router'

defineProps<{
  title: string
  description: string
}>()
</script>

<template>
  <section class="tool-page">
    <RouterLink class="back-link" to="/">Back to Home</RouterLink>

    <header class="tool-header">
      <h1>{{ title }}</h1>
      <p>{{ description }}</p>
    </header>

    <div class="tool-content">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.tool-page {
  display: grid;
  gap: 1.5rem;
}

.back-link {
  color: var(--color-link);
  font-weight: 600;
  text-decoration: none;
}

.back-link:hover,
.back-link:focus-visible {
  text-decoration: underline;
}

.tool-header {
  display: grid;
  gap: 0.5rem;
}

h1 {
  color: var(--color-heading);
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  font-weight: 700;
  line-height: 1.15;
}

p {
  max-width: 42rem;
  color: var(--color-muted);
}

.tool-content {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  padding: 1.25rem;
}
</style>
