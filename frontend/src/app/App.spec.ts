import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'

import App from '../App.vue'
import { recordRecentToolPath } from './recentTool'
import { exchangeRateTool, textCleanerTool, textCompareTool, tools } from './tools'
import { setTheme } from '@/shared/theme/useTheme'

type MountedApp = Awaited<ReturnType<typeof mountAt>>

function createTestRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      {
        path: '/',
        component: () => import('./views/HomeView.vue'),
      },
      {
        path: textCompareTool.path,
        component: () => import('@/tools/text-compare/TextCompareView.vue'),
      },
      {
        path: textCleanerTool.path,
        component: () => import('@/tools/text-cleaner/TextCleanerHomeView.vue'),
      },
      {
        path: '/tools/text-cleaner/pdf',
        component: () => import('@/tools/pdf-text-cleaner/PdfTextCleanerView.vue'),
      },
      {
        path: '/tools/text-cleaner/markdown',
        component: () => import('@/tools/markdown-text-cleaner/MarkdownTextCleanerView.vue'),
      },
      {
        path: '/:pathMatch(.*)*',
        component: () => import('./views/NotFoundView.vue'),
      },
    ],
  })
}

async function mountAt(path: string) {
  const router = createTestRouter()

  router.push(path)
  await router.isReady()

  return mount(App, {
    global: {
      plugins: [router],
    },
  })
}

function getTextareas(wrapper: MountedApp) {
  const textareas = wrapper.findAll('textarea')
  const oldTextarea = textareas[0]
  const newTextarea = textareas[1]

  if (!oldTextarea || !newTextarea) {
    throw new Error('Expected text compare page to render two textarea inputs')
  }

  return { oldTextarea, newTextarea }
}

function getButtonByText(wrapper: MountedApp, text: string) {
  const button = wrapper.findAll('button').find((candidate) => candidate.text() === text)

  if (!button) {
    throw new Error(`Expected to find button: ${text}`)
  }

  return button
}

function getCheckboxes(wrapper: MountedApp) {
  const checkboxes = wrapper.findAll('input[type="checkbox"]')
  const ignoreTrailingWhitespace = checkboxes[0]
  const ignoreBlankLines = checkboxes[1]

  if (!ignoreTrailingWhitespace || !ignoreBlankLines) {
    throw new Error('Expected text compare page to render two option checkboxes')
  }

  return { ignoreTrailingWhitespace, ignoreBlankLines }
}

async function generateSimpleDiff(wrapper: MountedApp) {
  const { oldTextarea, newTextarea } = getTextareas(wrapper)

  await oldTextarea.setValue('old')
  await newTextarea.setValue('new')
  await wrapper.find('button.primary-action').trigger('click')

  expect(wrapper.text()).toContain('返回编辑')

  await getButtonByText(wrapper, '返回编辑').trigger('click')

  return getTextareas(wrapper)
}

describe('tool registry', () => {
  it('uses the exported text compare tool in the tools array', () => {
    expect(tools).toContain(textCompareTool)
  })

  it('uses the exported text cleaner entry in the tools array instead of a standalone PDF tool', () => {
    expect(tools).toContain(textCleanerTool)
    expect(tools.some((tool) => tool.name === 'PDF 文本清理')).toBe(false)
  })

  it('contains valid unique ids and tool paths', () => {
    const ids = tools.map((tool) => tool.id)
    const uniqueIds = new Set(ids)

    expect(uniqueIds.size).toBe(ids.length)
    expect(ids.every((id) => id.trim().length > 0)).toBe(true)
    expect(tools.every((tool) => tool.path.startsWith('/tools/'))).toBe(true)
  })
})

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear()
    setTheme('light')
  })

  it('mounts the application shell', async () => {
    const wrapper = await mountAt('/')

    expect(wrapper.text()).toContain('个人工具箱')
    expect(wrapper.text()).toContain('UTILITY TERMINAL / PT-01')
    expect(wrapper.text()).toContain('LIGHT')
    expect(wrapper.text()).toContain('DARK')
  })

  it('shows the safe GitHub Profile action on Home instead of a redundant Home link', async () => {
    const home = await mountAt('/')
    const appHeader = home.find('header.app-header')
    const actionSlot = appHeader.find('nav.header-action-slot')
    const githubLink = home.find('nav a.github-link')

    expect(home.findAll('header.app-header')).toHaveLength(1)
    expect(actionSlot.exists()).toBe(true)
    expect(githubLink.exists()).toBe(true)
    expect(githubLink.text()).toContain('GITHUB')
    expect(githubLink.text()).toContain('PROFILE ↗')
    expect(githubLink.attributes('href')).toBe('https://github.com/uri996')
    expect(githubLink.attributes('target')).toBe('_blank')
    expect(githubLink.attributes('rel')).toBe('noopener noreferrer')
    expect(githubLink.classes()).toContain('header-action')
    expect(githubLink.findAll(':scope > .header-action-label')).toHaveLength(1)
    expect(githubLink.findAll(':scope > .header-action-value')).toHaveLength(1)
    expect(home.find('nav a.home-link').exists()).toBe(false)
    expect(home.find('nav').text()).not.toContain('首页')
  })

  it('keeps the Home navigation action on tool routes', async () => {
    const tool = await mountAt(textCompareTool.path)
    const appHeader = tool.find('header.app-header')
    const actionSlot = appHeader.find('nav.header-action-slot')
    const homeLink = tool.find('nav a.home-link')

    expect(tool.findAll('header.app-header')).toHaveLength(1)
    expect(actionSlot.exists()).toBe(true)
    expect(homeLink.exists()).toBe(true)
    expect(homeLink.attributes('href')).toBe('/')
    expect(homeLink.text()).toContain('INDEX')
    expect(homeLink.text()).toContain('首页')
    expect(homeLink.classes()).toContain('header-action')
    expect(homeLink.findAll(':scope > .header-action-label')).toHaveLength(1)
    expect(homeLink.findAll(':scope > .header-action-value')).toHaveLength(1)
    expect(tool.find('nav a.github-link').exists()).toBe(false)
  })

  it('switches the global theme from the application header', async () => {
    const wrapper = await mountAt('/')
    const darkButton = wrapper.findAll('button').find((button) => button.text() === 'DARK')

    expect(darkButton).toBeDefined()
    await darkButton?.trigger('click')

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(darkButton?.attributes('aria-pressed')).toBe('true')
  })

  it('renders the text compare tool on the home page', async () => {
    const wrapper = await mountAt('/')

    expect(wrapper.text()).toContain(textCompareTool.name)
    expect(wrapper.text()).toContain(textCompareTool.description)
    expect(wrapper.find(`a[href="${textCompareTool.path}"]`).exists()).toBe(true)
  })

  it('renders the text cleaner entry on the home page', async () => {
    const home = await mountAt('/')

    expect(home.text()).toContain(textCleanerTool.name)
    expect(home.text()).toContain(textCleanerTool.description)
    expect(home.find(`a[href="${textCleanerTool.path}"]`).exists()).toBe(true)
    expect(home.text()).not.toContain('PDF 文本清理')
  })

  it('renders compact whole-card routes without a module-count summary', async () => {
    const home = await mountAt('/')

    expect(home.text()).not.toContain('MODULES AVAILABLE')
    const cards = home.findAll('a.tool-card')
    expect(cards).toHaveLength(tools.length)
    tools.forEach((tool, index) => {
      expect(cards[index]?.attributes('href')).toBe(tool.path)
      expect(cards[index]?.text()).toContain('进入模块')
    })
    expect(home.text()).not.toContain('快速入口')
  })

  it('removes the large central toolbox Hero and keeps a compact terminal intro', async () => {
    const home = await mountAt('/')
    const intro = home.find('.terminal-intro')

    expect(home.find('.hero').exists()).toBe(false)
    expect(intro.exists()).toBe(true)
    expect(intro.text()).toContain('PERSONAL TOOLBOX / PT-01')
    expect(intro.text()).toContain('SYS.STATUS / ONLINE')
    expect(intro.text()).toContain('日常任务的轻量处理终端')
    expect(intro.text()).not.toContain('工具箱')
    expect(intro.text()).not.toContain('聚合文本处理')
    expect(intro.text()).not.toContain('MODULES AVAILABLE')
  })

  it('groups tools under their real product categories', async () => {
    const home = await mountAt('/')
    const textTools = home.find('section[aria-labelledby="text-tools-heading"]')
    const dataFinance = home.find('section[aria-labelledby="data-finance-heading"]')

    expect(textTools.text()).toContain('01 / TEXT TOOLS')
    expect(textTools.text()).toContain('文本工具')
    expect(textTools.text()).toContain(textCompareTool.name)
    expect(textTools.text()).toContain(textCleanerTool.name)
    expect(textTools.text()).not.toContain(exchangeRateTool.name)
    expect(textTools.find('.tool-grid').exists()).toBe(true)
    expect(textTools.find('.tool-grid-single').exists()).toBe(false)
    expect(textTools.findAll('a.tool-card')).toHaveLength(2)

    expect(dataFinance.text()).toContain('02 / FINANCE TOOLS')
    expect(dataFinance.text()).toContain('金融工具')
    expect(dataFinance.text()).toContain(exchangeRateTool.name)
    expect(dataFinance.text()).not.toContain(textCompareTool.name)
    expect(dataFinance.find('.tool-grid.tool-grid-single').exists()).toBe(true)
    expect(dataFinance.findAll('a.tool-card')).toHaveLength(1)
  })

  it('hides Last Used on first visit and shows the stored concrete tool route', async () => {
    const firstVisit = await mountAt('/')
    expect(firstVisit.find('.last-used').exists()).toBe(false)

    firstVisit.unmount()
    recordRecentToolPath('/tools/text-cleaner/markdown', new Date('2026-08-26T00:30:00'))
    const returningVisit = await mountAt('/')

    expect(returningVisit.text()).toContain('LAST USED / 最近使用')
    expect(returningVisit.text()).toContain('Markdown 格式清理')
    expect(returningVisit.find('.last-used').attributes('href')).toBe(
      '/tools/text-cleaner/markdown',
    )
  })

  it('renders the text cleaner entry page and its PDF route', async () => {
    const entry = await mountAt(textCleanerTool.path)

    expect(entry.text()).toContain('PDF 复制文本清理')
    expect(entry.text()).toContain('Markdown 格式清理')
    expect(entry.text()).not.toContain('可用')
    expect(entry.find('a[href="/tools/text-cleaner/pdf"]').exists()).toBe(true)
    expect(entry.find('a[href="/tools/text-cleaner/markdown"]').exists()).toBe(true)

    const tool = await mountAt('/tools/text-cleaner/pdf')
    expect(tool.text()).toContain('PDF 复制文本清理')
    expect(tool.find('#pdf-source-text').exists()).toBe(true)
  })

  it('does not register the legacy PDF cleaner route', async () => {
    const legacy = await mountAt('/tools/pdf-text-cleaner')
    expect(legacy.text()).toContain('页面未找到')
  })

  it('renders the Markdown cleaner route', async () => {
    const markdown = await mountAt('/tools/text-cleaner/markdown')

    expect(markdown.text()).toContain('Markdown 格式清理')
    expect(markdown.find('#markdown-source-text').exists()).toBe(true)
  })

  it('renders text compare route and generates a diff result', async () => {
    const wrapper = await mountAt(textCompareTool.path)
    const { oldTextarea, newTextarea } = getTextareas(wrapper)

    await oldTextarea.setValue('玄仲已经达到九十级。')
    await newTextarea.setValue('玄仲已经突破九十级。')
    await wrapper.find('button.primary-action').trigger('click')

  expect(wrapper.text()).toContain(textCompareTool.name)
  expect(wrapper.text()).toContain('已生成文本差异结果。')
  expect(wrapper.text()).not.toContain('合并差异视图')
  expect(wrapper.text()).toContain('修改')
    expect(wrapper.text()).toContain('达到')
    expect(wrapper.text()).toContain('突破')
  })

  it('shows a same-text message after comparing identical text', async () => {
    const wrapper = await mountAt(textCompareTool.path)
    const { oldTextarea, newTextarea } = getTextareas(wrapper)

    await oldTextarea.setValue('alpha')
    await newTextarea.setValue('alpha')
    await wrapper.find('button.primary-action').trigger('click')

    expect(wrapper.text()).toContain('文本内容相同，当前没有差异。')
    expect(wrapper.text()).toContain('当前没有差异。')
  })

  it('swaps text and clears the old result', async () => {
    const wrapper = await mountAt(textCompareTool.path)
    const { oldTextarea, newTextarea } = getTextareas(wrapper)

    await oldTextarea.setValue('old')
    await newTextarea.setValue('new')
    await wrapper.find('button.primary-action').trigger('click')
    await getButtonByText(wrapper, '返回编辑').trigger('click')
    await getButtonByText(wrapper, '交换文本').trigger('click')

    const restoredInputs = getTextareas(wrapper)

    expect((restoredInputs.oldTextarea.element as HTMLTextAreaElement).value).toBe('new')
    expect((restoredInputs.newTextarea.element as HTMLTextAreaElement).value).toBe('old')
    expect(wrapper.text()).toContain('已交换旧文本和新文本。')
    expect(wrapper.text()).not.toContain('返回编辑')
  })

  it('clears text and result', async () => {
    const wrapper = await mountAt(textCompareTool.path)
    const { oldTextarea, newTextarea } = getTextareas(wrapper)

    await oldTextarea.setValue('old')
    await newTextarea.setValue('new')
    await wrapper.find('button.primary-action').trigger('click')
    await getButtonByText(wrapper, '返回编辑').trigger('click')
    await getButtonByText(wrapper, '清空').trigger('click')

    const restoredInputs = getTextareas(wrapper)

    expect((restoredInputs.oldTextarea.element as HTMLTextAreaElement).value).toBe('')
    expect((restoredInputs.newTextarea.element as HTMLTextAreaElement).value).toBe('')
    expect(wrapper.text()).toContain('已清空输入和对比结果。')
    expect(wrapper.text()).not.toContain('返回编辑')
  })

  it('clears the old result after old text changes', async () => {
    const wrapper = await mountAt(textCompareTool.path)
    const { oldTextarea } = await generateSimpleDiff(wrapper)

    await oldTextarea.setValue('changed old text')

    expect(wrapper.text()).toContain('尚未进行对比。')
    expect(wrapper.text()).not.toContain('返回编辑')
  })

  it('clears the old result after new text changes', async () => {
    const wrapper = await mountAt(textCompareTool.path)
    const { newTextarea } = await generateSimpleDiff(wrapper)

    await newTextarea.setValue('changed new text')

    expect(wrapper.text()).toContain('尚未进行对比。')
    expect(wrapper.text()).not.toContain('返回编辑')
  })

  it('clears the old result after ignore trailing whitespace changes', async () => {
    const wrapper = await mountAt(textCompareTool.path)
    await generateSimpleDiff(wrapper)
    const { ignoreTrailingWhitespace } = getCheckboxes(wrapper)

    await ignoreTrailingWhitespace.setValue(false)

    expect(wrapper.text()).toContain('尚未进行对比。')
    expect(wrapper.text()).not.toContain('返回编辑')
  })

  it('clears the old result after ignore blank lines changes', async () => {
    const wrapper = await mountAt(textCompareTool.path)
    await generateSimpleDiff(wrapper)
    const { ignoreBlankLines } = getCheckboxes(wrapper)

    await ignoreBlankLines.setValue(true)

    expect(wrapper.text()).toContain('尚未进行对比。')
    expect(wrapper.text()).not.toContain('返回编辑')
  })

  it('does not rerun comparison automatically after input changes', async () => {
    const wrapper = await mountAt(textCompareTool.path)
    const { oldTextarea, newTextarea } = await generateSimpleDiff(wrapper)

    await oldTextarea.setValue('same')
    await newTextarea.setValue('same')

    expect(wrapper.text()).toContain('尚未进行对比。')
    expect(wrapper.text()).not.toContain('文本内容相同，当前没有差异。')
    expect(wrapper.text()).not.toContain('返回编辑')

    await wrapper.find('button.primary-action').trigger('click')

    expect(wrapper.text()).toContain('文本内容相同，当前没有差异。')
    expect(wrapper.text()).toContain('当前没有差异。')
  })

  it('counts a common emoji as one character', async () => {
    const wrapper = await mountAt(textCompareTool.path)
    const { oldTextarea } = getTextareas(wrapper)

    await oldTextarea.setValue('😀')

    expect(wrapper.text()).toContain('1 字符 · 1 行')
  })

  it('renders the not found page for unknown routes', async () => {
    const wrapper = await mountAt('/missing-page')

    expect(wrapper.text()).toContain('页面未找到')
    expect(wrapper.text()).toContain('返回首页')
  })
})
