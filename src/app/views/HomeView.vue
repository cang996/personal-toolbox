<script setup lang="ts">
import { RouterLink } from 'vue-router'

import { tools } from '../tools'

const toolboxName = 'Personal Toolbox'
const summary = 'A focused home for small browser-based utilities.'
</script>

<template>
  <section class="home-view">
    <header class="home-header">
      <h1>{{ toolboxName }}</h1>
      <p>{{ summary }}</p>
    </header>

    <section class="tools-section" aria-labelledby="tools-heading">
      <h2 id="tools-heading">Tools</h2>

      <div class="tool-grid">
        <RouterLink v-for="tool in tools" :key="tool.id" class="tool-card" :to="tool.path">
          <span class="tool-category">{{ tool.category }}</span>
          <h3>{{ tool.name }}</h3>
          <p>{{ tool.description }}</p>
          <span class="tool-status">{{ tool.status }}</span>
        </RouterLink>
      </div>
    </section>
  </section>
</template>

<style scoped>
.home-view {
  display: grid;
  gap: 2rem;
}

.home-header {
  display: grid;
  gap: 0.75rem;
}

h1,
h2,
h3 {
  color: var(--color-heading);
}

h1 {
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 700;
  line-height: 1.1;
}

.home-header p {
  max-width: 42rem;
  color: var(--color-muted);
  font-size: 1.05rem;
}

.tools-section {
  display: grid;
  gap: 1rem;
}

h2 {
  font-size: 2rem;
  font-weight: 700;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
  gap: 1rem;
}

.tool-card {
  display: grid;
  gap: 0.5rem;
  min-height: 12rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  padding: 1rem;
  color: inherit;
  text-decoration: none;
}

.tool-card:hover,
.tool-card:focus-visible {
  border-color: var(--color-link);
}

.tool-category,
.tool-status {
  color: var(--color-muted);
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
  color: var(--color-muted);
}

.tool-status {
  align-self: end;
}
</style>
