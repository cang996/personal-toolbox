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

function checkboxByLabel(wrapper: ReturnType<typeof mountView>, label: string) {
  const option = wrapper.findAll('label').find((candidate) => candidate.text().includes(label))
  if (!option) throw new Error(`Expected checkbox label: ${label}`)
  return option.find('input[type="checkbox"]')
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
    const removeCjkLatinSpaces = checkboxByLabel(wrapper, '移除中文与英文之间的空格')
    const cleanCopyResidue = checkboxByLabel(wrapper, '清理复制残留字符')
    await wrapper.find('#pdf-source-text').setValue('Android 和 Java API')
    await removeCjkLatinSpaces.setValue(false)
    await cleanCopyResidue.setValue(true)
    await buttons(wrapper).clean.trigger('click')
    await buttons(wrapper).clear.trigger('click')

    expect((wrapper.find('#pdf-source-text').element as HTMLTextAreaElement).value).toBe('')
    expect((wrapper.find('#cleaned-text').element as HTMLTextAreaElement).value).toBe('')
    expect((removeCjkLatinSpaces.element as HTMLInputElement).checked).toBe(true)
    expect((cleanCopyResidue.element as HTMLInputElement).checked).toBe(false)
    expect(wrapper.find('[aria-label="输入文本统计"]').text()).toBe('0 字符 · 0 行')
    expect(wrapper.find('[aria-label="清理结果统计"]').exists()).toBe(false)
  })

  it('keeps copy residue by default, cleans it when enabled, and invalidates the old result', async () => {
    const wrapper = mountView()
    const source = wrapper.find('#pdf-source-text')
    const cleanCopyResidue = checkboxByLabel(wrapper, '清理复制残留字符')

    expect((cleanCopyResidue.element as HTMLInputElement).checked).toBe(false)
    await source.setValue('A\u200BB\u00A0C')
    await buttons(wrapper).clean.trigger('click')
    expect((wrapper.find('#cleaned-text').element as HTMLTextAreaElement).value).toBe('A\u200BB\u00A0C')

    await cleanCopyResidue.setValue(true)
    expect((wrapper.find('#cleaned-text').element as HTMLTextAreaElement).value).toBe('')
    expect(wrapper.find('[aria-label="清理结果统计"]').exists()).toBe(false)
    await buttons(wrapper).clean.trigger('click')
    expect((wrapper.find('#cleaned-text').element as HTMLTextAreaElement).value).toBe('AB C')
  })

  it('updates input and valid output statistics and removes stale output statistics', async () => {
    const wrapper = mountView()
    const source = wrapper.find('#pdf-source-text')

    expect(wrapper.find('[aria-label="输入文本统计"]').text()).toBe('0 字符 · 0 行')
    expect(wrapper.find('[aria-label="清理结果统计"]').exists()).toBe(false)

    await source.setValue('A😀\n中。')
    expect(wrapper.find('[aria-label="输入文本统计"]').text()).toBe('5 字符 · 2 行')
    await buttons(wrapper).clean.trigger('click')
    expect(wrapper.find('[aria-label="清理结果统计"]').text()).toBe('4 字符 · 1 行')

    await source.setValue('x')
    expect(wrapper.find('[aria-label="输入文本统计"]').text()).toBe('1 字符 · 1 行')
    expect(wrapper.find('[aria-label="清理结果统计"]').exists()).toBe(false)
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
