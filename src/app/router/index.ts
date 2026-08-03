import { createRouter, createWebHistory } from 'vue-router'

import { textCleanerTool, textCompareTool } from '../tools'

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
      path: textCleanerTool.path,
      name: `tool-${textCleanerTool.id}`,
      component: () => import('@/tools/text-cleaner/TextCleanerHomeView.vue'),
    },
    {
      path: '/tools/text-cleaner/pdf',
      name: 'tool-text-cleaner-pdf',
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
