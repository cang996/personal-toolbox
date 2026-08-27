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

function checkboxByLabel(wrapper: ReturnType<typeof mountView>, label: string) {
  const option = wrapper.findAll('label').find((candidate) => candidate.text().includes(label))
  if (!option) throw new Error(`Expected checkbox label: ${label}`)
  return option.find('input[type="checkbox"]')
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
    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    const preserveLinkUrls = checkboxes[0]!
    const numberHeadings = checkboxes[1]!
    const cleanCopyResidue = checkboxes[2]!
    await wrapper.find('#markdown-source-text').setValue('[Link](https://example.com)')
    await preserveLinkUrls.setValue(true)
    await numberHeadings.setValue(true)
    await cleanCopyResidue.setValue(true)
    await buttons(wrapper).clean.trigger('click')
    await buttons(wrapper).clear.trigger('click')

    expect((wrapper.find('#markdown-source-text').element as HTMLTextAreaElement).value).toBe('')
    expect((preserveLinkUrls.element as HTMLInputElement).checked).toBe(false)
    expect((numberHeadings.element as HTMLInputElement).checked).toBe(false)
    expect((cleanCopyResidue.element as HTMLInputElement).checked).toBe(false)
  })

  it('leaves heading numbering off by default and applies the existing numbering when enabled', async () => {
    const wrapper = mountView()
    const source = wrapper.find('#markdown-source-text')
    const numberHeadings = wrapper.findAll('input[type="checkbox"]')[1]!

    expect((numberHeadings.element as HTMLInputElement).checked).toBe(false)
    await source.setValue('# Title\n### Detail')
    await buttons(wrapper).clean.trigger('click')
    expect((wrapper.find('#cleaned-markdown-text').element as HTMLTextAreaElement).value).toBe('Title\nDetail')

    await numberHeadings.setValue(true)
    await buttons(wrapper).clean.trigger('click')
    expect((wrapper.find('#cleaned-markdown-text').element as HTMLTextAreaElement).value).toBe('1. Title\n1.1.1 Detail')

    await source.setValue('# 2. Existing\n## Background')
    await buttons(wrapper).clean.trigger('click')
    expect((wrapper.find('#cleaned-markdown-text').element as HTMLTextAreaElement).value).toBe(
      '2. Existing\n2.1 Background',
    )
  })

  it('keeps copy residue by default, cleans it when enabled, and invalidates the old result', async () => {
    const wrapper = mountView()
    const source = wrapper.find('#markdown-source-text')
    const cleanCopyResidue = checkboxByLabel(wrapper, '清理复制残留字符')

    expect((cleanCopyResidue.element as HTMLInputElement).checked).toBe(false)
    await source.setValue('A\u200BB\u00A0C')
    await buttons(wrapper).clean.trigger('click')
    expect((wrapper.find('#cleaned-markdown-text').element as HTMLTextAreaElement).value).toBe('A\u200BB\u00A0C')

    await cleanCopyResidue.setValue(true)
    expect((wrapper.find('#cleaned-markdown-text').element as HTMLTextAreaElement).value).toBe('')
    await buttons(wrapper).clean.trigger('click')
    expect((wrapper.find('#cleaned-markdown-text').element as HTMLTextAreaElement).value).toBe('AB C')
  })

  it('updates input and valid output statistics and removes stale output statistics', async () => {
    const wrapper = mountView()
    const source = wrapper.find('#markdown-source-text')

    expect(wrapper.find('[aria-label="输入文本统计"]').text()).toBe('0 字符 · 0 行')
    expect(wrapper.find('[aria-label="清理结果统计"]').exists()).toBe(false)

    await source.setValue('A😀\n中')
    expect(wrapper.find('[aria-label="输入文本统计"]').text()).toBe('4 字符 · 2 行')
    await buttons(wrapper).clean.trigger('click')
    expect(wrapper.find('[aria-label="清理结果统计"]').text()).toBe('4 字符 · 2 行')

    await source.setValue('x')
    expect(wrapper.find('[aria-label="输入文本统计"]').text()).toBe('1 字符 · 1 行')
    expect(wrapper.find('[aria-label="清理结果统计"]').exists()).toBe(false)
  })

  it('keeps the existing link URL option behavior', async () => {
    const wrapper = mountView()
    const source = wrapper.find('#markdown-source-text')
    const preserveLinkUrls = checkboxByLabel(wrapper, '保留链接 URL')

    await source.setValue('[Link](https://example.com)')
    await buttons(wrapper).clean.trigger('click')
    expect((wrapper.find('#cleaned-markdown-text').element as HTMLTextAreaElement).value).toBe('Link')

    await preserveLinkUrls.setValue(true)
    await buttons(wrapper).clean.trigger('click')
    expect((wrapper.find('#cleaned-markdown-text').element as HTMLTextAreaElement).value).toBe(
      'Link（https://example.com）',
    )
  })

  it('copies a result and displays a clipboard failure', async () => {
    const wrapper = mountView()
    const writeText = vi.mocked(navigator.clipboard.writeText)
    writeText.mockResolvedValue()
    await wrapper.find('#markdown-source-text').setValue('# Title')
    await buttons(wrapper).clean.trigger('click')
    await buttons(wrapper).copy.trigger('click')

    expect(writeText).toHaveBeenCalledWith('Title')
    writeText.mockRejectedValueOnce(new Error('blocked'))
    await buttons(wrapper).copy.trigger('click')
    expect(wrapper.text()).toContain('复制失败，请手动选择结果文本后复制。')
  })
})
