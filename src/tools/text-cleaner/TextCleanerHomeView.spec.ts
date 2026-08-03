import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { describe, expect, it } from 'vitest'

import TextCleanerHomeView from './TextCleanerHomeView.vue'

function mountView() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: '/tools/text-cleaner/pdf', component: { template: '<div>PDF page</div>' } }],
  })

  return mount(TextCleanerHomeView, { global: { plugins: [router] } })
}

describe('TextCleanerHomeView', () => {
  it('shows the PDF cleaner entry linked to its route', () => {
    const wrapper = mountView()

    expect(wrapper.text()).toContain('PDF 复制文本清理')
    expect(wrapper.find('a[href="/tools/text-cleaner/pdf"]').exists()).toBe(true)
  })

  it('shows the unavailable Markdown cleaner without a link', () => {
    const wrapper = mountView()
    const unavailableCard = wrapper.find('.cleaner-card-unavailable')

    expect(unavailableCard.text()).toContain('Markdown 格式清理')
    expect(unavailableCard.text()).toContain('即将推出')
    expect(unavailableCard.find('a').exists()).toBe(false)
  })
})
