import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import MarkdownTextCleanerView from './MarkdownTextCleanerView.vue'

function mountView() {
  return mount(MarkdownTextCleanerView)
}

function buttons(wrapper: ReturnType<typeof mountView>) {
  const get = (text: string) => {
    const button = wrapper.findAll('button').find((candidate) => candidate.text() === text)
    if (!button) throw new Error(`Expected button: ${text}`)
    return button
  }
  return { clean: get('开始清理'), clear: get('清空'), copy: get('复制结果') }
}

describe('MarkdownTextCleanerView', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn<(text: string) => Promise<void>>() } })
  })

  it('cleans only after the user starts the action and invalidates a changed result', async () => {
    const wrapper = mountView()
    const source = wrapper.find('#markdown-source-text')

    await source.setValue('**Bold**')
    expect((wrapper.find('#cleaned-markdown-text').element as HTMLTextAreaElement).value).toBe('')
    await buttons(wrapper).clean.trigger('click')
    expect((wrapper.find('#cleaned-markdown-text').element as HTMLTextAreaElement).value).toBe('Bold')

    await source.setValue('*Italic*')
    expect((wrapper.find('#cleaned-markdown-text').element as HTMLTextAreaElement).value).toBe('')
  })

  it('clears fields and restores the default option', async () => {
    const wrapper = mountView()
    const checkbox = wrapper.find('input[type="checkbox"]')
    await wrapper.find('#markdown-source-text').setValue('[Link](https://example.com)')
    await checkbox.setValue(true)
    await buttons(wrapper).clean.trigger('click')
    await buttons(wrapper).clear.trigger('click')

    expect((wrapper.find('#markdown-source-text').element as HTMLTextAreaElement).value).toBe('')
    expect((checkbox.element as HTMLInputElement).checked).toBe(false)
  })

  it('copies a result and displays a clipboard failure', async () => {
    const wrapper = mountView()
    const writeText = vi.mocked(navigator.clipboard.writeText)
    writeText.mockResolvedValue()
    await wrapper.find('#markdown-source-text').setValue('# Title')
    await buttons(wrapper).clean.trigger('click')
    await buttons(wrapper).copy.trigger('click')

    expect(writeText).toHaveBeenCalledWith('1. Title')
    writeText.mockRejectedValueOnce(new Error('blocked'))
    await buttons(wrapper).copy.trigger('click')
    expect(wrapper.text()).toContain('复制失败，请手动选择结果文本后复制。')
  })
})
