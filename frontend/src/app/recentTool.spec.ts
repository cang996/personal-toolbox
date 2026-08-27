import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import type { PreferenceStorage } from '@/shared/storage/preferenceStorage'
import { storageKeys } from '@/shared/storage/storageKeys'

import {
  installRecentToolTracking,
  readRecentTool,
  recordRecentToolPath,
} from './recentTool'
import { markdownTextCleanerTool, textCompareTool, textNormalizerTool } from './tools'

function createMemoryStorage(): PreferenceStorage {
  const values = new Map<string, string>()

  return {
    read(key) {
      return values.get(key) ?? null
    },
    write(key, value) {
      values.set(key, value)
    },
  }
}

function createTrackingRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div>Home</div>' } },
      { path: textCompareTool.path, component: { template: '<div>Compare</div>' } },
      { path: markdownTextCleanerTool.path, component: { template: '<div>Markdown</div>' } },
      { path: textNormalizerTool.path, component: { template: '<div>Normalizer</div>' } },
    ],
  })
}

describe('recent tool tracking', () => {
  it('does not fabricate a tool when there is no stored record', () => {
    expect(readRecentTool(createMemoryStorage())).toBeNull()
  })

  it('persists and reads a supported tool with its route and timestamp', () => {
    const storage = createMemoryStorage()
    const usedAt = new Date('2026-08-26T00:30:00.000Z')

    recordRecentToolPath(textCompareTool.path, usedAt, storage)

    expect(readRecentTool(storage)).toMatchObject({
      id: textCompareTool.id,
      path: textCompareTool.path,
      name: textCompareTool.name,
      usedAt: usedAt.toISOString(),
    })
  })

  it('updates the record when a different concrete tool route is visited', async () => {
    const storage = createMemoryStorage()
    const router = createTrackingRouter()
    const times = [
      new Date('2026-08-26T00:30:00.000Z'),
      new Date('2026-08-26T00:31:00.000Z'),
    ]
    installRecentToolTracking(router, storage, () => times.shift() ?? new Date(0))

    await router.push(textCompareTool.path)
    await router.isReady()
    expect(readRecentTool(storage)?.id).toBe(textCompareTool.id)

    await router.push(markdownTextCleanerTool.path)
    expect(readRecentTool(storage)).toMatchObject({
      id: markdownTextCleanerTool.id,
      path: markdownTextCleanerTool.path,
      usedAt: '2026-08-26T00:31:00.000Z',
    })
  })

  it('ignores malformed or unsupported stored data', () => {
    const storage = createMemoryStorage()
    storage.write(storageKeys.lastUsedTool, '{"schemaVersion":1,"toolId":"unknown"}')

    expect(readRecentTool(storage)).toBeNull()
  })

  it('records and restores the text normalizer as a concrete recent tool', async () => {
    const storage = createMemoryStorage()
    const router = createTrackingRouter()
    installRecentToolTracking(router, storage, () => new Date('2026-08-27T12:00:00.000Z'))

    await router.push(textNormalizerTool.path)
    await router.isReady()

    expect(readRecentTool(storage)).toMatchObject({
      id: textNormalizerTool.id,
      name: textNormalizerTool.name,
      path: textNormalizerTool.path,
      usedAt: '2026-08-27T12:00:00.000Z',
    })
  })
})
