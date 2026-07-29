export type ToolStatus = 'available' | 'development' | 'planned'

export interface ToolDefinition {
  id: string
  name: string
  description: string
  category: string
  path: `/tools/${string}`
  status: ToolStatus
}

export const exampleTool: ToolDefinition = {
  id: 'example',
  name: 'Example Tool',
  description: 'A placeholder tool used to verify the toolbox structure.',
  category: 'Foundation',
  path: '/tools/example',
  status: 'development',
}

export const textCompareTool: ToolDefinition = {
  id: 'text-compare',
  name: '文本对比工具',
  description: '比较两段相似文本中的新增、删除和修改内容。',
  category: '文本处理',
  path: '/tools/text-compare',
  status: 'available',
}

export const tools: ToolDefinition[] = [exampleTool, textCompareTool]

export function findToolById(id: string): ToolDefinition | undefined {
  return tools.find((tool) => tool.id === id)
}
