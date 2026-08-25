import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import PdfTextCleanerView from './PdfTextCleanerView.vue'

function mountView() {
  return mount(PdfTextCleanerView)
}

function buttons(wrapper: ReturnType<typeof mountView>) {
  const get = (text: string) => {
    const button = wrapper.findAll('button').find((candidate) => candidate.text() === text)
    if (!button) throw new Error(`Expected button: ${text}`)
    return button
  }
  return { clean: get('开始清理'), clear: get('清空'), copy: get('复制结果') }
}

describe('PdfTextCleanerView', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn<(text: string) => Promise<void>>() } })
  })

  it('cleans text only after the user starts the action', async () => {
    const wrapper = mountView()
    const source = wrapper.find('#pdf-source-text')

    await source.setValue('以\n小\n组')
    expect((wrapper.find('#cleaned-text').element as HTMLTextAreaElement).value).toBe('')

    await buttons(wrapper).clean.trigger('click')
    expect((wrapper.find('#cleaned-text').element as HTMLTextAreaElement).value).toBe('以小组')
    expect(wrapper.text()).toContain('已生成清理结果。')
  })

  it('invalidates an existing result after input or option changes', async () => {
    const wrapper = mountView()
    await wrapper.find('#pdf-source-text').setValue('Gradle 文 件')
    await buttons(wrapper).clean.trigger('click')
    await wrapper.find('#pdf-source-text').setValue('minSdk 指 定')

    expect((wrapper.find('#cleaned-text').element as HTMLTextAreaElement).value).toBe('')
    expect(wrapper.text()).toContain('输入或选项已变更，请重新开始清理。')
  })

  it('clears both fields and restores the default option', async () => {
    const wrapper = mountView()
    const checkbox = wrapper.find('input[type="checkbox"]')
    await wrapper.find('#pdf-source-text').setValue('Android 和 Java API')
    await checkbox.setValue(false)
    await buttons(wrapper).clean.trigger('click')
    await buttons(wrapper).clear.trigger('click')

    expect((wrapper.find('#pdf-source-text').element as HTMLTextAreaElement).value).toBe('')
    expect((wrapper.find('#cleaned-text').element as HTMLTextAreaElement).value).toBe('')
    expect((checkbox.element as HTMLInputElement).checked).toBe(true)
  })

  it('copies a valid result and reports clipboard failures', async () => {
    const wrapper = mountView()
    const writeText = vi.mocked(navigator.clipboard.writeText)
    writeText.mockResolvedValue()
    await wrapper.find('#pdf-source-text').setValue('text')
    await buttons(wrapper).clean.trigger('click')
    await buttons(wrapper).copy.trigger('click')

    expect(writeText).toHaveBeenCalledWith('text')
    expect(wrapper.text()).toContain('已复制清理结果。')

    writeText.mockRejectedValueOnce(new Error('blocked'))
    await buttons(wrapper).copy.trigger('click')
    expect(wrapper.text()).toContain('复制失败，请手动选择结果文本后复制。')
  })
})
