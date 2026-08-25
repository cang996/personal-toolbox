<script setup lang="ts">
import { RouterLink } from 'vue-router'

import { readRecentTool } from '../recentTool'
import { tools } from '../tools'

const recentTool = readRecentTool()
const toolCategories = [
  {
    id: 'text-tools',
    code: '01',
    englishName: 'TEXT TOOLS',
    name: '文本工具',
    tools: tools.filter((tool) => tool.category === '文本处理'),
  },
  {
    id: 'data-finance',
    code: '02',
    englishName: 'FINANCE TOOLS',
    name: '金融工具',
    tools: tools.filter((tool) => tool.category === '金融工具'),
  },
]

function formatUsedAt(value: string): string {
  const date = new Date(value)
  const pad = (part: number) => String(part).padStart(2, '0')

  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function moduleNumber(toolId: string): string {
  return String(tools.findIndex((tool) => tool.id === toolId) + 1).padStart(2, '0')
}
</script>

<template>
  <div class="home-view">
    <section class="terminal-intro" aria-labelledby="home-title">
      <div class="intro-meta">
        <span>PERSONAL TOOLBOX / PT-01</span>
        <span class="system-status">SYS.STATUS / ONLINE</span>
      </div>
      <h1 id="home-title">日常任务的轻量处理终端</h1>
    </section>

    <RouterLink
      v-if="recentTool"
      class="last-used"
      :to="recentTool.path"
      :aria-label="`继续使用${recentTool.name}`"
    >
      <span class="last-used-label">LAST USED / 最近使用</span>
      <span class="last-used-tool">
        <small>{{ recentTool.englishName }} /</small>
        <strong>{{ recentTool.name }}</strong>
      </span>
      <span class="last-used-type">{{ recentTool.tags[0] }}</span>
      <time :datetime="recentTool.usedAt">{{ formatUsedAt(recentTool.usedAt) }}</time>
      <span class="last-used-action">CONTINUE <span aria-hidden="true">→</span></span>
    </RouterLink>

    <section
      v-for="category in toolCategories"
      :key="category.id"
      class="tool-category-section"
      :aria-labelledby="`${category.id}-heading`"
    >
      <header class="category-heading">
        <div class="category-identity">
          <span class="section-code">{{ category.code }} / {{ category.englishName }}</span>
          <h2 :id="`${category.id}-heading`">{{ category.name }}</h2>
        </div>
      </header>

      <div class="tool-grid" :class="{ 'tool-grid-single': category.tools.length === 1 }">
        <RouterLink
          v-for="tool in category.tools"
          :key="tool.id"
          class="tool-card"
          :to="tool.path"
          :aria-label="`进入${tool.name}`"
        >
          <div class="card-scanline" aria-hidden="true"></div>
          <header class="card-header">
            <span>MODULE_{{ moduleNumber(tool.id) }}</span>
            <span class="tool-english">{{ tool.englishName }}</span>
          </header>
          <div class="card-body">
            <h3>{{ tool.name }}</h3>
            <p class="tool-description">{{ tool.description }}</p>
          </div>
          <footer class="card-footer">
            <ul class="tool-tags" :aria-label="`${tool.name} 元信息`">
              <li v-for="tag in tool.tags" :key="tag">{{ tag }}</li>
            </ul>
            <span class="card-cta">
              进入模块 <span aria-hidden="true">↗</span>
            </span>
          </footer>
        </RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home-view {
  display: grid;
  gap: var(--space-5);
}

.terminal-intro {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-5);
  border-block: 1px solid var(--color-border-strong);
  padding: 0.65rem 0;
}

.terminal-intro::before {
  position: absolute;
  top: -1px;
  left: 0;
  width: min(7rem, 25%);
  height: 3px;
  background: var(--color-accent);
  box-shadow: var(--glow-accent);
  content: '';
}

.intro-meta,
.card-header,
.section-code {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: var(--font-size-label);
  font-weight: 700;
  letter-spacing: 0.13em;
}

.intro-meta {
  display: flex;
  grid-column: 2;
  grid-row: 1;
  gap: var(--space-5);
  color: var(--color-text-muted);
}

.system-status::before {
  display: inline-block;
  width: 0.42rem;
  height: 0.42rem;
  margin-right: var(--space-2);
  background: var(--color-accent);
  content: '';
}

h1 {
  grid-column: 1;
  grid-row: 1;
  color: var(--color-text-primary);
  font-size: clamp(1.25rem, 2vw, 1.75rem);
  font-weight: 760;
  letter-spacing: 0.02em;
  line-height: 1.2;
}

.last-used {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: var(--space-3);
  border-block: 1px solid var(--color-border-strong);
  background: color-mix(in srgb, var(--color-accent) 3%, var(--color-surface));
  padding: 0.4rem var(--space-3);
  color: var(--color-text-primary);
  text-decoration: none;
  cursor: pointer;
}

.last-used:hover,
.last-used:focus-visible {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
  box-shadow: var(--glow-accent);
}

.last-used-label,
.last-used-tool small,
.last-used-type,
.last-used-action {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: var(--font-size-label);
  font-weight: 700;
  letter-spacing: 0.1em;
}

.last-used-label,
.last-used-tool small,
.last-used-type {
  color: var(--color-text-muted);
}

.last-used-tool {
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
  min-width: 0;
}

.last-used-tool strong {
  overflow: hidden;
  font-weight: 730;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.last-used time {
  color: var(--color-text-secondary);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: var(--font-size-meta);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.last-used-action {
  color: var(--color-accent-active);
  white-space: nowrap;
}

.tool-category-section {
  display: grid;
  gap: var(--space-3);
}

.category-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--space-4);
  border-bottom: 1px solid var(--color-border-strong);
  padding-bottom: var(--space-2);
}

.category-identity {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
}

.section-code {
  color: var(--color-accent-active);
}

h2 {
  color: var(--color-text-primary);
  font-size: var(--font-size-section-title);
  font-weight: 760;
  letter-spacing: 0.02em;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border-top: 1px solid var(--color-border-strong);
  border-left: 1px solid var(--color-border-strong);
}

.tool-grid-single {
  grid-template-columns: minmax(0, 3fr) minmax(0, 5fr);
  border-top: 0;
  border-left: 0;
}

.tool-grid-single .tool-card {
  grid-column: 2;
  border: 1px solid var(--color-border-strong);
}

.tool-card {
  position: relative;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: var(--space-3);
  min-width: 0;
  min-height: 13.5rem;
  overflow: hidden;
  border-right: 1px solid var(--color-border-strong);
  border-bottom: 1px solid var(--color-border-strong);
  background: var(--color-surface);
  padding: var(--space-4);
  color: inherit;
  text-decoration: none;
  cursor: pointer;
  transition:
    background var(--transition-fast) ease,
    box-shadow var(--transition-fast) ease,
    transform var(--transition-fast) ease;
}

.tool-card:hover,
.tool-card:focus-visible {
  z-index: 1;
  background: color-mix(in srgb, var(--color-accent) 5%, var(--color-surface));
  box-shadow: var(--shadow-card), var(--glow-accent);
  transform: translateY(-3px);
}

.card-scanline {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 3px;
  background: var(--color-accent);
  transition: width 220ms ease;
}

.tool-card:hover .card-scanline,
.tool-card:focus-visible .card-scanline {
  width: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  color: var(--color-text-muted);
}

.card-body {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.tool-english {
  color: var(--color-accent-active);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: var(--font-size-label);
  font-weight: 700;
  letter-spacing: 0.14em;
}

h3 {
  margin-block: var(--space-1) var(--space-2);
  color: var(--color-text-primary);
  font-size: clamp(1.4rem, 2.2vw, 1.85rem);
  font-weight: 760;
  line-height: 1.15;
}

.tool-description {
  color: var(--color-text-secondary);
  font-size: 0.88rem;
  line-height: 1.45;
}

.card-footer {
  display: grid;
  gap: var(--space-2);
}

.tool-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: 0;
  list-style: none;
}

.tool-tags li {
  border: 1px solid var(--color-border-subtle);
  padding: 0.16rem 0.4rem;
  color: var(--color-text-muted);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.card-cta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--color-border-subtle);
  padding-top: var(--space-2);
  color: var(--color-text-primary);
  font-size: var(--font-size-meta);
  font-weight: 760;
  letter-spacing: 0.06em;
}

.tool-card:hover .card-cta,
.tool-card:focus-visible .card-cta {
  color: var(--color-accent-active);
}

@media (max-width: 760px) {
  .last-used {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .last-used time {
    grid-column: 2;
  }

  .last-used-action {
    grid-column: 3;
  }

}

@media (max-width: 620px) {
  .terminal-intro {
    grid-template-columns: 1fr;
  }

  .intro-meta {
    grid-column: 1;
    grid-row: 1;
    align-items: flex-start;
    flex-direction: column;
    gap: var(--space-1);
  }

  h1 {
    grid-column: 1;
    grid-row: 2;
  }

  .last-used {
    grid-template-columns: 1fr auto;
    gap: var(--space-1) var(--space-3);
    padding: 0.35rem var(--space-2);
  }

  .last-used-label {
    grid-column: 1 / -1;
  }

  .last-used-tool {
    display: grid;
  }

  .last-used-type,
  .last-used time,
  .last-used-action {
    grid-column: auto;
  }

  .category-heading,
  .category-identity {
    align-items: flex-start;
    flex-direction: column;
    gap: var(--space-1);
  }

  .tool-grid {
    grid-template-columns: 1fr;
  }

  .tool-grid-single .tool-card {
    grid-column: 1;
  }

  .tool-card {
    grid-template-rows: auto;
    gap: var(--space-2);
    min-height: 0;
    padding: var(--space-3);
  }

  .card-header {
    gap: var(--space-2);
  }

  .tool-english {
    text-align: right;
  }

  h3 {
    margin-block: 0 var(--space-1);
    font-size: clamp(1.25rem, 6vw, 1.5rem);
  }

  .tool-description {
    font-size: 0.82rem;
    line-height: 1.4;
  }

  .card-footer {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    gap: var(--space-2);
  }

  .tool-tags {
    gap: var(--space-1);
  }

  .tool-tags li {
    padding-block: 0.1rem;
  }

  .card-cta {
    gap: var(--space-2);
    border-top: 0;
    padding-top: 0;
    white-space: nowrap;
  }
}
</style>
