import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { developmentLogEntries } from '../developmentLog'
import router from '../router'
import DevelopmentLogView from './DevelopmentLogView.vue'

describe('DevelopmentLogView', () => {
  it('is registered at the public Development Log route', () => {
    expect(router.getRoutes().some((route) => route.path === '/development-log')).toBe(true)
  })

  it('renders every static milestone in newest-first order', () => {
    const wrapper = mount(DevelopmentLogView)
    const entries = wrapper.findAll('article.timeline-entry')

    expect(entries).toHaveLength(developmentLogEntries.length)
    expect(entries[0]?.text()).toContain(developmentLogEntries[0]?.title)
    expect(entries.at(-1)?.text()).toContain(developmentLogEntries.at(-1)?.title)
    expect(
      developmentLogEntries.every(
        (entry, index, allEntries) =>
          index === 0 || entry.dateTime <= (allEntries[index - 1]?.dateTime ?? ''),
      ),
    ).toBe(true)
  })

  it('uses semantic timeline content with the concise introduction and no status block', () => {
    const wrapper = mount(DevelopmentLogView)

    expect(wrapper.find('section.timeline').exists()).toBe(true)
    expect(wrapper.findAll('article time')).toHaveLength(developmentLogEntries.length)
    expect(wrapper.findAll('article h3')).toHaveLength(developmentLogEntries.length)
    expect(wrapper.text()).toContain('记录 Personal Toolbox 的主要功能更新与开发历程。')
    expect(wrapper.find('.current-status').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('CURRENT STATUS')
    expect(wrapper.text()).not.toContain('Paused between feature cycles')
  })
})
