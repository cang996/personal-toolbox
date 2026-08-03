<script setup lang="ts">
import { RouterLink } from 'vue-router'

import ToolPageLayout from '@/shared/components/ToolPageLayout.vue'

const pdfCleanerPath = '/tools/text-cleaner/pdf'
const markdownCleanerPath = '/tools/text-cleaner/markdown'
</script>

<template>
  <ToolPageLayout title="文本清理" description="选择适合文本来源的清理方式。所有内容均在浏览器本地处理。">
    <div class="cleaner-grid">
      <RouterLink class="cleaner-card cleaner-card-available" :to="pdfCleanerPath">
        <div class="card-heading">
          <h2>PDF 复制文本清理</h2>
          <span class="status status-available">可用</span>
        </div>
        <p>清理从 PDF 复制后产生的异常换行、字符间距和列表结构。</p>
      </RouterLink>

      <RouterLink class="cleaner-card cleaner-card-available" :to="markdownCleanerPath">
        <div class="card-heading">
          <h2>Markdown 格式清理</h2>
          <span class="status status-available">可用</span>
        </div>
        <p>删除常见 Markdown 标记，保留适合复制到 Word 的文本结构。</p>
      </RouterLink>
    </div>
  </ToolPageLayout>
</template>

<style scoped>
.cleaner-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.cleaner-card {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
  min-height: 12rem;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-card);
  padding: var(--space-4);
}

.cleaner-card-available {
  background: var(--color-surface);
  box-shadow: var(--shadow-small);
  color: inherit;
  text-decoration: none;
}

.cleaner-card-available:hover,
.cleaner-card-available:focus-visible {
  border-color: var(--color-accent);
  box-shadow: var(--shadow-card);
}

.card-heading {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

h2 {
  color: var(--color-text-primary);
  font-size: 1.25rem;
  font-weight: 700;
}

p {
  color: var(--color-text-secondary);
}

.status {
  border-radius: var(--radius-small);
  padding: var(--space-1) var(--space-2);
  font-size: 0.8125rem;
  font-weight: 700;
  white-space: nowrap;
}

.status-available {
  background: color-mix(in srgb, var(--color-success) 12%, var(--color-surface));
  color: var(--color-success);
}

@media (max-width: 680px) {
  .cleaner-grid {
    grid-template-columns: 1fr;
  }
}
</style>
