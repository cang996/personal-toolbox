import { createRouter, createWebHistory } from 'vue-router'

import { pdfTextCleanerTool, textCompareTool } from '../tools'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: textCompareTool.path,
      name: `tool-${textCompareTool.id}`,
      component: () => import('@/tools/text-compare/TextCompareView.vue'),
    },
    {
      path: pdfTextCleanerTool.path,
      name: `tool-${pdfTextCleanerTool.id}`,
      component: () => import('@/tools/pdf-text-cleaner/PdfTextCleanerView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../views/NotFoundView.vue'),
    },
  ],
})

export default router
