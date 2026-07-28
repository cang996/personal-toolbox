import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'

import App from '../App.vue'
import { exampleTool, tools } from './tools'

function createTestRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      {
        path: '/',
        component: () => import('./views/HomeView.vue'),
      },
      {
        path: exampleTool.path,
        component: () => import('@/tools/example/ExampleToolView.vue'),
      },
      {
        path: '/:pathMatch(.*)*',
        component: () => import('./views/NotFoundView.vue'),
      },
    ],
  })
}

async function mountAt(path: string) {
  const router = createTestRouter()

  router.push(path)
  await router.isReady()

  return mount(App, {
    global: {
      plugins: [router],
    },
  })
}

describe('tool registry', () => {
  it('uses the exported example tool in the tools array', () => {
    expect(tools).toContain(exampleTool)
  })

  it('contains valid unique ids and tool paths', () => {
    const ids = tools.map((tool) => tool.id)
    const uniqueIds = new Set(ids)

    expect(uniqueIds.size).toBe(ids.length)
    expect(ids.every((id) => id.trim().length > 0)).toBe(true)
    expect(tools.every((tool) => tool.path.startsWith('/tools/'))).toBe(true)
  })
})

describe('App', () => {
  it('mounts the application shell', async () => {
    const wrapper = await mountAt('/')

    expect(wrapper.text()).toContain('Personal Toolbox')
    expect(wrapper.text()).toContain('Home')
  })

  it('renders the registered placeholder tool on the home page', async () => {
    const wrapper = await mountAt('/')
    const placeholderTool = tools.find((tool) => tool.id === 'example')

    expect(placeholderTool).toBeDefined()
    if (!placeholderTool) {
      throw new Error('Expected example tool to be registered')
    }

    expect(wrapper.text()).toContain(placeholderTool.name)
    expect(wrapper.text()).toContain(placeholderTool.description)
    expect(wrapper.find(`a[href="${placeholderTool.path}"]`).exists()).toBe(true)
  })

  it('renders the placeholder tool page', async () => {
    const wrapper = await mountAt(exampleTool.path)
    const placeholderNotice =
      '\u6b64\u9875\u9762\u4ec5\u7528\u4e8e\u9a8c\u8bc1\u5de5\u5177\u63a5\u5165\u65b9\u5f0f\uff0c\u4e0d\u5305\u542b\u771f\u5b9e\u529f\u80fd\u3002'

    expect(wrapper.text()).toContain(exampleTool.name)
    expect(wrapper.text()).toContain(placeholderNotice)
  })

  it('renders the not found page for unknown routes', async () => {
    const wrapper = await mountAt('/missing-page')

    expect(wrapper.text()).toContain('Page Not Found')
    expect(wrapper.text()).toContain('Back to Home')
  })
})
