import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { describe, expect, it } from 'vitest'

import TextCleanerHomeView from './TextCleanerHomeView.vue'

function mountView() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/tools/text-cleaner/pdf', component: { template: '<div>PDF page</div>' } },
      { path: '/tools/text-cleaner/markdown', component: { template: '<div>Markdown page</div>' } },
    ],
  })

  return mount(TextCleanerHomeView, { global: { plugins: [router] } })
}

describe('TextCleanerHomeView', () => {
  it('shows the PDF cleaner entry linked to its route', () => {
    const wrapper = mountView()

    expect(wrapper.text()).toContain('PDF 复制文本清理')
    expect(wrapper.find('a[href="/tools/text-cleaner/pdf"]').exists()).toBe(true)
  })

  it('shows the Markdown cleaner linked to its route', () => {
    const wrapper = mountView()

    expect(wrapper.text()).toContain('Markdown 格式清理')
    expect(wrapper.find('a[href="/tools/text-cleaner/markdown"]').exists()).toBe(true)
  })
})
