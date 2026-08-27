import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import TextNormalizerView from './TextNormalizerView.vue'

function mountView() {
  return mount(TextNormalizerView)
}

function buttonByText(wrapper: ReturnType<typeof mountView>, text: string) {
  const button = wrapper.findAll('button').find((candidate) => candidate.text() === text)
  if (!button) throw new Error(`Expected button: ${text}`)
  return button
}

function checkboxByLabel(wrapper: ReturnType<typeof mountView>, label: string) {
  const option = wrapper.findAll('label').find((candidate) => candidate.text().includes(label))
  if (!option) throw new Error(`Expected checkbox label: ${label}`)
  return option.find('input[type="checkbox"]')
}

function radioByLabel(wrapper: ReturnType<typeof mountView>, label: string) {
  const option = wrapper.findAll('label').find((candidate) => candidate.text().includes(label))
  if (!option) throw new Error(`Expected radio label: ${label}`)
  return option.find('input[type="radio"]')
}

describe('TextNormalizerView', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn<(text: string) => Promise<void>>() } })
  })

  it('renders five options off by default and normalizes only after an explicit run', async () => {
    const wrapper = mountView()
    const source = wrapper.find('#normalizer-source-text')
    const checkboxes = wrapper.findAll('input[type="checkbox"]')

    expect(checkboxes).toHaveLength(5)
    expect(checkboxes.every((checkbox) => !(checkbox.element as HTMLInputElement).checked)).toBe(true)
    await source.setValue('A\r\nB')
    expect((wrapper.find('#normalized-text').element as HTMLTextAreaElement).value).toBe('')

    await buttonByText(wrapper, '开始规范化').trigger('click')
    expect((wrapper.find('#normalized-text').element as HTMLTextAreaElement).value).toBe('A\nB')
    expect(wrapper.text()).toContain('已生成规范化结果。')
  })

  it('renders a concise description for every option', () => {
    const wrapper = mountView()
    const descriptions = wrapper.findAll('.option-description')

    expect(descriptions).toHaveLength(5)
    expect(descriptions.map((description) => description.text())).toEqual([
      '删除零宽空格、软连字符等不可见复制残留，并将不换行空格转为普通空格；普通连字符会保留。',
      '统一 Tab、全角空格和连续空格，并清理行尾空格；可能改变手工对齐、代码缩进或排版文本。',
      '在汉字与英文或数字之间统一加入一个空格，让中英混排更清晰；这属于排版风格，不是强制标准。',
      '删除标点附近多余空格，并整理小数、百分比、金额等常见间距；不会转换中英文标点符号。',
      '例如 ＡＢＣ１２３ → ABC123；只转换全角字母和数字，中文标点保持不变。',
    ])
  })

  it('renders the custom and Chinese publication modes with their product boundaries', () => {
    const wrapper = mountView()
    const custom = radioByLabel(wrapper, '自定义')
    const standard = radioByLabel(wrapper, '中文出版规范')

    expect((custom.element as HTMLInputElement).checked).toBe(true)
    expect((standard.element as HTMLInputElement).checked).toBe(false)
    expect(wrapper.text()).toContain('CY/T 154—2017 · 纯文本子集')
    expect(wrapper.text()).toContain('不检查字体、字号、换行排版或页面效果。')
    expect(wrapper.text()).toContain('标准允许根据排版效果决定中英文之间是否留空格；本模式不强制。')
    expect(wrapper.text()).toContain('可单独使用，也可以叠加在中文出版规范之后。')
  })

  it('runs the standard with personal options off and composes personal spacing afterward', async () => {
    const wrapper = mountView()
    const source = wrapper.find('#normalizer-source-text')
    const standard = radioByLabel(wrapper, '中文出版规范')
    const personalSpacing = checkboxByLabel(wrapper, '添加中英文/数字间距')

    await source.setValue('中文Python ，版本２０２６.')
    await standard.setValue(true)
    expect(
      wrapper.findAll('input[type="checkbox"]').every((checkbox) => !(checkbox.element as HTMLInputElement).checked),
    ).toBe(true)

    await buttonByText(wrapper, '开始规范化').trigger('click')
    expect((wrapper.find('#normalized-text').element as HTMLTextAreaElement).value).toBe(
      '中文Python，版本2026。',
    )

    await personalSpacing.setValue(true)
    expect((wrapper.find('#normalized-text').element as HTMLTextAreaElement).value).toBe('')
    await buttonByText(wrapper, '开始规范化').trigger('click')
    expect((wrapper.find('#normalized-text').element as HTMLTextAreaElement).value).toBe(
      '中文 Python，版本 2026。',
    )
  })

  it('invalidates a current result when the mode changes without changing personal options', async () => {
    const wrapper = mountView()
    const cleanCopyResidue = checkboxByLabel(wrapper, '清理复制残留字符')
    await wrapper.find('#normalizer-source-text').setValue('这是测试,继续.')
    await cleanCopyResidue.setValue(true)
    await buttonByText(wrapper, '开始规范化').trigger('click')

    await radioByLabel(wrapper, '中文出版规范').setValue(true)

    expect((wrapper.find('#normalized-text').element as HTMLTextAreaElement).value).toBe('')
    expect(wrapper.find('[aria-label="规范化结果统计"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('输入或选项已变更，请重新开始规范化。')
    expect((cleanCopyResidue.element as HTMLInputElement).checked).toBe(true)
  })

  it('rejects whitespace-only input and keeps copy disabled', async () => {
    const wrapper = mountView()
    await wrapper.find('#normalizer-source-text').setValue(' \n\t')
    await buttonByText(wrapper, '开始规范化').trigger('click')

    expect(wrapper.text()).toContain('请输入要规范化的文本。')
    expect(buttonByText(wrapper, '复制结果').attributes('disabled')).toBeDefined()
  })

  it.each([
    ['清理复制残留字符', 'A\u200BB', 'AB'],
    ['规范普通空白', 'A   B', 'A B'],
    ['添加中英文/数字间距', '中文English', '中文 English'],
    ['规范标点周围空格', 'Hello , world !', 'Hello, world!'],
    ['全角字母数字转半角', 'ＡＢＣ１２３，中文！', 'ABC123，中文！'],
  ])('wires the %s option to the transformation', async (label, input, expected) => {
    const wrapper = mountView()
    await wrapper.find('#normalizer-source-text').setValue(input)
    await checkboxByLabel(wrapper, label).setValue(true)
    await buttonByText(wrapper, '开始规范化').trigger('click')

    expect((wrapper.find('#normalized-text').element as HTMLTextAreaElement).value).toBe(expected)
  })

  it('invalidates the result after input and every option change', async () => {
    const labels = [
      '清理复制残留字符',
      '规范普通空白',
      '添加中英文/数字间距',
      '规范标点周围空格',
      '全角字母数字转半角',
    ]

    for (const label of labels) {
      const wrapper = mountView()
      await wrapper.find('#normalizer-source-text').setValue('text')
      await buttonByText(wrapper, '开始规范化').trigger('click')
      await checkboxByLabel(wrapper, label).setValue(true)

      expect((wrapper.find('#normalized-text').element as HTMLTextAreaElement).value).toBe('')
      expect(wrapper.find('[aria-label="规范化结果统计"]').exists()).toBe(false)
      expect(wrapper.text()).toContain('输入或选项已变更，请重新开始规范化。')
    }

    const wrapper = mountView()
    await wrapper.find('#normalizer-source-text').setValue('text')
    await buttonByText(wrapper, '开始规范化').trigger('click')
    await wrapper.find('#normalizer-source-text').setValue('changed')
    expect((wrapper.find('#normalized-text').element as HTMLTextAreaElement).value).toBe('')
  })

  it('clears both fields and resets all options to off', async () => {
    const wrapper = mountView()
    await wrapper.find('#normalizer-source-text').setValue('中文English')
    await radioByLabel(wrapper, '中文出版规范').setValue(true)
    for (const checkbox of wrapper.findAll('input[type="checkbox"]')) await checkbox.setValue(true)
    await buttonByText(wrapper, '开始规范化').trigger('click')
    await buttonByText(wrapper, '清空').trigger('click')

    expect((wrapper.find('#normalizer-source-text').element as HTMLTextAreaElement).value).toBe('')
    expect((wrapper.find('#normalized-text').element as HTMLTextAreaElement).value).toBe('')
    expect(
      wrapper.findAll('input[type="checkbox"]').every((checkbox) => !(checkbox.element as HTMLInputElement).checked),
    ).toBe(true)
    expect((radioByLabel(wrapper, '自定义').element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.find('[aria-label="规范化结果统计"]').exists()).toBe(false)
  })

  it('shows input and current output statistics and hides stale output statistics', async () => {
    const wrapper = mountView()
    const source = wrapper.find('#normalizer-source-text')

    expect(wrapper.find('[aria-label="输入文本统计"]').text()).toBe('0 字符 · 0 行')
    await source.setValue('A😀\n中')
    expect(wrapper.find('[aria-label="输入文本统计"]').text()).toBe('4 字符 · 2 行')
    await buttonByText(wrapper, '开始规范化').trigger('click')
    expect(wrapper.find('[aria-label="规范化结果统计"]').text()).toBe('4 字符 · 2 行')

    await source.setValue('x')
    expect(wrapper.find('[aria-label="规范化结果统计"]').exists()).toBe(false)
  })

  it('copies a valid result and reports clipboard failure', async () => {
    const wrapper = mountView()
    const writeText = vi.mocked(navigator.clipboard.writeText)
    writeText.mockResolvedValue()
    await wrapper.find('#normalizer-source-text').setValue('text')
    await buttonByText(wrapper, '开始规范化').trigger('click')
    await buttonByText(wrapper, '复制结果').trigger('click')

    expect(writeText).toHaveBeenCalledWith('text')
    expect(wrapper.text()).toContain('已复制规范化结果。')

    writeText.mockRejectedValueOnce(new Error('blocked'))
    await buttonByText(wrapper, '复制结果').trigger('click')
    expect(wrapper.text()).toContain('复制失败，请手动选择结果文本后复制。')
  })
})
