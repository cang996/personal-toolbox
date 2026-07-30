import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import TextCompareView from './TextCompareView.vue'

function mountView() {
  return mount(TextCompareView, {
    global: {
      stubs: {
        ToolPageLayout: { template: '<div><slot /></div>' },
      },
    },
  })
}

function buttonByText(wrapper: ReturnType<typeof mountView>, text: string) {
  const button = wrapper.findAll('button').find((candidate) => candidate.text() === text)
  if (!button) {
    throw new Error(`Button not found: ${text}`)
  }
  return button
}

describe('TextCompareView', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('switches between edit and result modes while preserving text and options', async () => {
    const wrapper = mountView()
    const inputs = wrapper.findAll('textarea')

    expect(inputs).toHaveLength(2)
    await inputs[0]!.setValue('旧文本')
    await inputs[1]!.setValue('新文本')
    await wrapper.findAll('input[type="checkbox"]')[0]!.setValue(false)
    await buttonByText(wrapper, '开始对比').trigger('click')

    expect(wrapper.findAll('textarea')).toHaveLength(0)
    expect(wrapper.text()).toContain('返回编辑')
    expect(wrapper.text()).not.toContain('复制差异摘要')
    expect(wrapper.text()).not.toContain('[+]')
    expect(wrapper.text()).not.toContain('[-]')

    await buttonByText(wrapper, '返回编辑').trigger('click')
    const restoredInputs = wrapper.findAll('textarea')
    expect(restoredInputs[0]!.element.value).toBe('旧文本')
    expect(restoredInputs[1]!.element.value).toBe('新文本')
    expect((wrapper.findAll('input[type="checkbox"]')[0]!.element as HTMLInputElement).checked).toBe(false)
  })

  it('keeps equal content out of the differences-only view without rerunning comparison', async () => {
    const wrapper = mountView()
    const inputs = wrapper.findAll('textarea')
    await inputs[0]!.setValue('相同一\n旧内容\n相同二')
    await inputs[1]!.setValue('相同一\n新内容\n相同二')
    await buttonByText(wrapper, '开始对比').trigger('click')

    expect(wrapper.text()).toContain('相同一')
    await buttonByText(wrapper, '只看差异').trigger('click')
    expect(wrapper.text()).not.toContain('相同一')
    expect(wrapper.text()).toContain('中间省略 1 行相同内容')
    expect(wrapper.text()).toContain('修改前')
    expect(wrapper.text()).toContain('修改后')
  })

  it('renders modified content as two sibling sides, including one-to-many and many-to-one groups', async () => {
    const wrapper = mountView()
    const inputs = wrapper.findAll('textarea')
    await inputs[0]!.setValue('第一段相同内容，保留更多描述。')
    await inputs[1]!.setValue('第一段相同内容，\n保留更多描述并补充。')
    await buttonByText(wrapper, '开始对比').trigger('click')

    const modifiedContent = wrapper.get('.modified-content')
    const sides = modifiedContent.findAll(':scope > .modified-side')
    expect(sides).toHaveLength(2)
    expect(sides[0]!.classes()).toContain('modified-old')
    expect(sides[0]!.text()).toContain('修改前')
    expect(sides[1]!.classes()).toContain('modified-new')
    expect(sides[1]!.text()).toContain('修改后')
    expect(sides[1]!.findAll('.line-text')).toHaveLength(2)

    await buttonByText(wrapper, '返回编辑').trigger('click')
    const restoredInputs = wrapper.findAll('textarea')
    await restoredInputs[0]!.setValue('第一部分保留。\n第二部分保留。\n第三部分保留。')
    await restoredInputs[1]!.setValue('第一部分保留。第二部分保留。第三部分保留并补充。')
    await buttonByText(wrapper, '开始对比').trigger('click')

    expect(wrapper.get('.modified-content .modified-old').findAll('.line-text')).toHaveLength(3)
    expect(wrapper.text()).not.toContain('[+]')
    expect(wrapper.text()).not.toContain('[-]')
  })

  it('does not leave edit mode for empty or over-limit input', async () => {
    const wrapper = mountView()
    await buttonByText(wrapper, '开始对比').trigger('click')
    expect(wrapper.findAll('textarea')).toHaveLength(2)
    expect(wrapper.text()).toContain('两边输入都为空')

    await wrapper.findAll('textarea')[0]!.setValue('a'.repeat(100_001))
    await buttonByText(wrapper, '开始对比').trigger('click')
    expect(wrapper.findAll('textarea')).toHaveLength(2)
    expect(wrapper.text()).toContain('旧文本超出限制')
  })

  it('provides a bottom return-to-edit action that preserves input and options', async () => {
    const wrapper = mountView()
    const inputs = wrapper.findAll('textarea')
    await inputs[0]!.setValue('old text')
    await inputs[1]!.setValue('new text')
    await wrapper.findAll('input[type="checkbox"]')[0]!.setValue(false)
    await buttonByText(wrapper, '开始对比').trigger('click')

    expect(wrapper.findAll('.back-to-edit')).toHaveLength(2)
    await wrapper.get('.result-footer .back-to-edit').trigger('click')

    const restoredInputs = wrapper.findAll('textarea')
    expect(restoredInputs[0]!.element.value).toBe('old text')
    expect(restoredInputs[1]!.element.value).toBe('new text')
    expect((wrapper.findAll('input[type="checkbox"]')[0]!.element as HTMLInputElement).checked).toBe(false)
  })

  it('shows the window-scoped back-to-top button only after the threshold and scrolls smoothly', async () => {
    const scrollY = vi.spyOn(window, 'scrollY', 'get')
    const scrollTo = vi.fn<(options: ScrollToOptions) => void>()
    vi.stubGlobal('scrollTo', scrollTo)
    scrollY.mockReturnValue(0)

    const wrapper = mountView()
    expect(wrapper.find('.back-to-top').exists()).toBe(false)
    const inputs = wrapper.findAll('textarea')
    await inputs[0]!.setValue('old text')
    await inputs[1]!.setValue('new text')
    await buttonByText(wrapper, '开始对比').trigger('click')
    expect(wrapper.find('.back-to-top').exists()).toBe(false)

    scrollY.mockReturnValue(500)
    window.dispatchEvent(new Event('scroll'))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.back-to-top').exists()).toBe(false)

    scrollY.mockReturnValue(501)
    window.dispatchEvent(new Event('scroll'))
    await wrapper.vm.$nextTick()
    const button = wrapper.get('.back-to-top')
    expect(button.text()).toContain('返回顶部')
    expect(button.attributes('aria-label')).toBe('返回页面顶部')
    await button.trigger('click')
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
    expect(wrapper.find('.back-to-top').exists()).toBe(false)
  })

  it('registers one window scroll listener and removes it when unmounted', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener')
    const removeEventListener = vi.spyOn(window, 'removeEventListener')
    const wrapper = mountView()

    expect(addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true })
    wrapper.unmount()
    expect(removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function))
  })
})
