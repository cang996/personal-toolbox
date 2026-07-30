<script setup lang="ts">
defineProps<{
  title: string
  description: string
}>()
</script>

<template>
  <section class="tool-page">
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
  gap: var(--space-5);
}

.tool-header {
  display: grid;
  gap: var(--space-2);
}

h1 {
  color: var(--color-text-primary);
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  font-weight: 700;
  line-height: 1.15;
}

p {
  max-width: 42rem;
  color: var(--color-text-secondary);
}

.tool-content {
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-small);
  padding: 1.25rem;
}
</style>
