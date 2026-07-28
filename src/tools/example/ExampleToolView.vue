<script setup lang="ts">
import ToolPageLayout from '@/shared/components/ToolPageLayout.vue'
import { exampleTool } from '@/app/tools'
</script>

<template>
  <ToolPageLayout :title="exampleTool.name" :description="exampleTool.description">
    <p class="placeholder-note">
      &#27492;&#39029;&#38754;&#20165;&#29992;&#20110;&#39564;&#35777;&#24037;&#20855;&#25509;&#20837;&#26041;&#24335;&#65292;&#19981;&#21253;&#21547;&#30495;&#23454;&#21151;&#33021;&#12290;
    </p>
  </ToolPageLayout>
</template>

<style scoped>
.placeholder-note {
  color: var(--color-text);
  font-weight: 600;
}
</style>
