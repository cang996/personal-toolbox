import type { Router } from 'vue-router'

import { browserPreferenceStorage } from '@/shared/storage/preferenceStorage'
import type { PreferenceStorage } from '@/shared/storage/preferenceStorage'
import { storageKeys } from '@/shared/storage/storageKeys'

import { findRecentToolByPath } from './tools'
import type { ToolDefinition } from './tools'

const recentToolSchemaVersion = 1

interface StoredRecentTool {
  schemaVersion: typeof recentToolSchemaVersion
  toolId: string
  path: string
  usedAt: string
}

export interface RecentTool extends ToolDefinition {
  usedAt: string
}

function parseStoredRecentTool(value: string | null): RecentTool | null {
  if (!value) {
    return null
  }

  try {
    const stored = JSON.parse(value) as Partial<StoredRecentTool>
    if (
      stored.schemaVersion !== recentToolSchemaVersion ||
      typeof stored.toolId !== 'string' ||
      typeof stored.path !== 'string' ||
      typeof stored.usedAt !== 'string' ||
      Number.isNaN(Date.parse(stored.usedAt))
    ) {
      return null
    }

    const tool = findRecentToolByPath(stored.path)
    if (!tool || tool.id !== stored.toolId) {
      return null
    }

    return { ...tool, usedAt: stored.usedAt }
  } catch {
    return null
  }
}

export function readRecentTool(
  storage: PreferenceStorage = browserPreferenceStorage,
): RecentTool | null {
  return parseStoredRecentTool(storage.read(storageKeys.lastUsedTool))
}

export function recordRecentToolPath(
  path: string,
  usedAt: Date = new Date(),
  storage: PreferenceStorage = browserPreferenceStorage,
): RecentTool | null {
  const tool = findRecentToolByPath(path)
  if (!tool) {
    return null
  }

  const record: StoredRecentTool = {
    schemaVersion: recentToolSchemaVersion,
    toolId: tool.id,
    path: tool.path,
    usedAt: usedAt.toISOString(),
  }
  storage.write(storageKeys.lastUsedTool, JSON.stringify(record))

  return { ...tool, usedAt: record.usedAt }
}

export function installRecentToolTracking(
  router: Router,
  storage: PreferenceStorage = browserPreferenceStorage,
  now: () => Date = () => new Date(),
) {
  return router.afterEach((to, _from, failure) => {
    if (!failure) {
      recordRecentToolPath(to.path, now(), storage)
    }
  })
}
