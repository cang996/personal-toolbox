<script setup lang="ts">
import { RouterLink } from 'vue-router'

import { tools } from '../tools'

const toolboxName = '个人工具箱'
const summary = '专注于日常小任务的浏览器工具。'
</script>

<template>
  <section class="home-view">
    <header class="home-header">
      <h1>{{ toolboxName }}</h1>
      <p>{{ summary }}</p>
    </header>

    <section class="tools-section" aria-labelledby="tools-heading">
      <h2 id="tools-heading">工具</h2>

      <div class="tool-grid">
        <RouterLink v-for="tool in tools" :key="tool.id" class="tool-card" :to="tool.path">
          <span class="tool-category">{{ tool.category }}</span>
          <h3>{{ tool.name }}</h3>
          <p>{{ tool.description }}</p>
        </RouterLink>
      </div>
    </section>
  </section>
</template>

<style scoped>
.home-view {
  display: grid;
  gap: var(--space-6);
}

.home-header {
  display: grid;
  gap: var(--space-3);
}

h1,
h2,
h3 {
  color: var(--color-text-primary);
}

h1 {
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 700;
  line-height: 1.1;
}

.home-header p {
  max-width: 42rem;
  color: var(--color-text-secondary);
  font-size: 1.05rem;
}

.tools-section {
  display: grid;
  gap: var(--space-4);
}

h2 {
  font-size: 2rem;
  font-weight: 700;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
  gap: var(--space-4);
}

.tool-card {
  display: grid;
  gap: var(--space-2);
  min-height: 12rem;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-small);
  padding: var(--space-4);
  color: inherit;
  text-decoration: none;
}

.tool-card:hover,
.tool-card:focus-visible {
  border-color: var(--color-accent);
  box-shadow: var(--shadow-card);
}

.tool-category {
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

h3 {
  font-size: 1.25rem;
  font-weight: 700;
}

.tool-card p {
  color: var(--color-text-secondary);
}

</style>
