<script setup lang="ts">
import { RouterLink } from 'vue-router'

import ToolPageLayout from '@/shared/components/ToolPageLayout.vue'

const pdfCleanerPath = '/tools/text-cleaner/pdf'
const markdownCleanerPath = '/tools/text-cleaner/markdown'
const textNormalizerPath = '/tools/text-cleaner/normalizer'
</script>

<template>
  <ToolPageLayout title="文本清理" description="选择适合文本来源的清理方式。所有内容均在浏览器本地处理。">
    <div class="cleaner-grid">
      <RouterLink class="cleaner-card" :to="pdfCleanerPath">
        <h2>PDF 复制文本清理</h2>
        <p>清理从 PDF 复制后产生的异常换行、字符间距和列表结构。</p>
      </RouterLink>

      <RouterLink class="cleaner-card" :to="markdownCleanerPath">
        <h2>Markdown 格式清理</h2>
        <p>删除常见 Markdown 标记，保留适合复制到 Word 的文本结构。</p>
      </RouterLink>

      <RouterLink class="cleaner-card" :to="textNormalizerPath">
        <h2>文本规范化</h2>
        <p>规范普通文本的空格、中英混排、标点间距和全角字母数字。</p>
      </RouterLink>
    </div>
  </ToolPageLayout>
</template>

<style scoped>
.cleaner-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
}

.cleaner-card {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
  min-height: 12rem;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-small);
  padding: var(--space-4);
  color: inherit;
  text-decoration: none;
}

.cleaner-card:hover,
.cleaner-card:focus-visible {
  border-color: var(--color-accent);
  box-shadow: var(--shadow-card);
}

h2 {
  color: var(--color-text-primary);
  font-size: 1.25rem;
  font-weight: 700;
}

p {
  color: var(--color-text-secondary);
}

@media (max-width: 900px) {
  .cleaner-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .cleaner-grid {
    grid-template-columns: 1fr;
  }
}
</style>
