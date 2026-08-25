<script setup lang="ts">
defineProps<{
  title: string
  description: string
}>()
</script>

<template>
  <section class="tool-page">
    <header class="tool-header">
      <p class="tool-kicker">ACTIVE MODULE / WORKSPACE</p>
      <h1>{{ title }}</h1>
      <p class="tool-description">{{ description }}</p>
    </header>

    <div class="tool-content">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.tool-page {
  display: grid;
  gap: var(--space-6);
}

.tool-header {
  position: relative;
  display: grid;
  gap: var(--space-3);
  border-top: 1px solid var(--color-border-strong);
  padding-top: var(--space-5);
}

.tool-header::before {
  position: absolute;
  top: -1px;
  left: 0;
  width: 6rem;
  height: 3px;
  background: var(--color-accent);
  box-shadow: var(--glow-accent);
  content: '';
}

.tool-kicker {
  color: var(--color-accent-active);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: var(--font-size-label);
  font-weight: 700;
  letter-spacing: 0.13em;
}

h1 {
  color: var(--color-text-primary);
  font-size: var(--font-size-page-title);
  font-weight: 780;
  line-height: 1;
  letter-spacing: -0.045em;
}

.tool-description {
  max-width: 42rem;
  color: var(--color-text-secondary);
}

.tool-content {
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-small);
  padding: clamp(1rem, 2.5vw, 1.75rem);
}
</style>
