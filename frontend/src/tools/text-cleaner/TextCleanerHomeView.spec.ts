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
      { path: '/tools/text-cleaner/normalizer', component: { template: '<div>Normalizer page</div>' } },
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

  it('shows the text normalizer linked to its route', () => {
    const wrapper = mountView()

    expect(wrapper.text()).toContain('文本规范化')
    expect(wrapper.find('a[href="/tools/text-cleaner/normalizer"]').exists()).toBe(true)
    expect(wrapper.findAll('a.cleaner-card')).toHaveLength(3)
  })

  it('does not show redundant availability badges', () => {
    const wrapper = mountView()

    expect(wrapper.text()).not.toContain('可用')
    expect(wrapper.find('.status-available').exists()).toBe(false)
  })
})
