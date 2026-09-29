<script setup lang="ts">
import { developmentLogEntries, type DevelopmentLogEntryType } from '../developmentLog'

const typeLabels: Record<DevelopmentLogEntryType, string> = {
  feature: 'FEATURE',
  improvement: 'IMPROVEMENT',
  release: 'RELEASE',
}
</script>

<template>
  <div class="development-log-view">
    <header class="page-heading">
      <div class="heading-meta">
        <span>PROJECT RECORD / PT-01</span>
        <span>NEWEST FIRST</span>
      </div>
      <p class="eyebrow">DEVELOPMENT LOG</p>
      <h1>开发日志</h1>
      <p class="page-summary">记录 Personal Toolbox 的主要功能更新与开发历程。</p>
    </header>

    <section class="timeline" aria-labelledby="timeline-heading">
      <header class="section-heading">
        <span>01 / MODULE HISTORY</span>
        <h2 id="timeline-heading">主要里程碑</h2>
      </header>

      <ol class="timeline-list">
        <li v-for="(entry, index) in developmentLogEntries" :key="entry.dateTime + entry.title">
          <article class="timeline-entry" :data-entry-type="entry.type">
            <div class="entry-index" aria-hidden="true">
              {{ String(developmentLogEntries.length - index).padStart(2, '0') }}
            </div>
            <div class="entry-content">
              <header class="entry-header">
                <time :datetime="entry.dateTime">{{ entry.period }}</time>
                <span class="entry-type">{{ typeLabels[entry.type] }}</span>
              </header>
              <h3>{{ entry.title }}</h3>
              <p class="entry-summary">{{ entry.summary }}</p>
              <ul>
                <li v-for="highlight in entry.highlights" :key="highlight">{{ highlight }}</li>
              </ul>
            </div>
          </article>
        </li>
      </ol>
    </section>
  </div>
</template>

<style scoped>
.development-log-view {
  display: grid;
  gap: var(--space-6);
  min-width: 0;
}

.page-heading {
  position: relative;
  display: grid;
  gap: var(--space-2);
  border-block: 1px solid var(--color-border-strong);
  padding: var(--space-5) 0;
}

.page-heading::before {
  position: absolute;
  top: -1px;
  left: 0;
  width: min(9rem, 32%);
  height: 3px;
  background: var(--color-accent);
  box-shadow: var(--glow-accent);
  content: '';
}

.heading-meta,
.eyebrow,
.section-heading > span,
.entry-header,
.entry-index {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: var(--font-size-label);
  font-weight: 700;
  letter-spacing: 0.13em;
}

.heading-meta {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  color: var(--color-text-muted);
}

.eyebrow,
.section-heading > span,
.entry-type {
  color: var(--color-accent-active);
}

h1 {
  color: var(--color-text-primary);
  font-size: var(--font-size-page-title);
  font-weight: 780;
  letter-spacing: -0.03em;
  line-height: 1;
}

.page-summary {
  max-width: 48rem;
  color: var(--color-text-secondary);
  line-height: 1.7;
}

.timeline {
  display: grid;
  gap: var(--space-4);
}

.section-heading {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  border-bottom: 1px solid var(--color-border-strong);
  padding-bottom: var(--space-2);
}

.section-heading h2 {
  font-size: var(--font-size-section-title);
  font-weight: 760;
}

.timeline-list {
  display: grid;
  padding: 0;
  list-style: none;
}

.timeline-entry {
  display: grid;
  grid-template-columns: 4.5rem minmax(0, 1fr);
  border-bottom: 1px solid var(--color-border-subtle);
}

.timeline-list > li:first-child .timeline-entry {
  border-top: 1px solid var(--color-border-subtle);
}

.entry-index {
  display: grid;
  place-items: start center;
  border-right: 1px solid var(--color-border-strong);
  padding-top: var(--space-5);
  color: var(--color-text-muted);
  font-size: 0.8rem;
}

.entry-index::after {
  width: 0.55rem;
  height: 0.55rem;
  margin-top: var(--space-3);
  background: var(--color-accent);
  box-shadow: var(--glow-accent);
  content: '';
}

.entry-content {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-5);
}

.entry-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--space-2);
}

.entry-header time {
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.entry-type {
  border: 1px solid var(--color-border-subtle);
  padding: 0.12rem 0.45rem;
}

.entry-content h3 {
  color: var(--color-text-primary);
  font-size: clamp(1.25rem, 2.4vw, 1.75rem);
  font-weight: 760;
  line-height: 1.2;
}

.entry-summary {
  max-width: 52rem;
  color: var(--color-text-secondary);
}

.entry-content ul {
  display: grid;
  gap: var(--space-2);
  padding: 0;
  color: var(--color-text-secondary);
  list-style: none;
}

.entry-content li {
  position: relative;
  padding-left: var(--space-4);
}

.entry-content li::before {
  position: absolute;
  top: 0.68em;
  left: 0;
  width: 0.4rem;
  height: 1px;
  background: var(--color-accent);
  content: '';
}

@media (max-width: 760px) {
  .timeline-entry {
    grid-template-columns: 3rem minmax(0, 1fr);
  }

  .entry-content {
    padding: var(--space-4);
  }
}

@media (max-width: 430px) {
  .heading-meta,
  .section-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: var(--space-1);
  }

  .timeline-entry {
    grid-template-columns: 2rem minmax(0, 1fr);
  }

  .entry-index {
    justify-content: start;
    font-size: 0.62rem;
  }

  .entry-content {
    gap: var(--space-2);
    padding: var(--space-4) 0 var(--space-4) var(--space-3);
  }
}
</style>
