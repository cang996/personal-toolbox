import { createRouter, createWebHistory } from 'vue-router'

import { exampleTool, textCompareTool } from '../tools'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: exampleTool.path,
      name: `tool-${exampleTool.id}`,
      component: () => import('@/tools/example/ExampleToolView.vue'),
    },
    {
      path: textCompareTool.path,
      name: `tool-${textCompareTool.id}`,
      component: () => import('@/tools/text-compare/TextCompareView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../views/NotFoundView.vue'),
    },
  ],
})

export default router
