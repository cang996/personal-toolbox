import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'

import App from '../App.vue'
import { textCompareTool, tools } from './tools'

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

  it('contains valid unique ids and tool paths', () => {
    const ids = tools.map((tool) => tool.id)
    const uniqueIds = new Set(ids)

    expect(uniqueIds.size).toBe(ids.length)
    expect(ids.every((id) => id.trim().length > 0)).toBe(true)
    expect(tools.every((tool) => tool.path.startsWith('/tools/'))).toBe(true)
  })
})

describe('App', () => {
  it('mounts the application shell', async () => {
    const wrapper = await mountAt('/')

    expect(wrapper.text()).toContain('个人工具箱')
    expect(wrapper.text()).toContain('首页')
  })

  it('renders the text compare tool on the home page', async () => {
    const wrapper = await mountAt('/')

    expect(wrapper.text()).toContain(textCompareTool.name)
    expect(wrapper.text()).toContain(textCompareTool.description)
    expect(wrapper.find(`a[href="${textCompareTool.path}"]`).exists()).toBe(true)
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
