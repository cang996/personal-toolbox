import { createRouter, createWebHistory } from 'vue-router'

import { installRecentToolTracking } from '../recentTool'
import { exchangeRateTool, textCleanerTool, textCompareTool } from '../tools'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/development-log',
      name: 'development-log',
      component: () => import('../views/DevelopmentLogView.vue'),
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
      path: exchangeRateTool.path,
      name: `tool-${exchangeRateTool.id}`,
      component: () => import('@/tools/exchange-rate/ExchangeRateView.vue'),
    },
    {
      path: '/tools/text-cleaner/pdf',
      name: 'tool-text-cleaner-pdf',
      component: () => import('@/tools/pdf-text-cleaner/PdfTextCleanerView.vue'),
    },
    {
      path: '/tools/text-cleaner/markdown',
      name: 'tool-text-cleaner-markdown',
      component: () => import('@/tools/markdown-text-cleaner/MarkdownTextCleanerView.vue'),
    },
    {
      path: '/tools/text-cleaner/normalizer',
      name: 'tool-text-cleaner-normalizer',
      component: () => import('@/tools/text-normalizer/TextNormalizerView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../views/NotFoundView.vue'),
    },
  ],
})

installRecentToolTracking(router)

export default router
