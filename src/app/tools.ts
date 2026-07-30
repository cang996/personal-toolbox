export interface ToolDefinition {
  id: string
  name: string
  description: string
  category: string
  path: `/tools/${string}`
}

export const textCompareTool: ToolDefinition = {
  id: 'text-compare',
  name: '文本对比工具',
  description: '比较两段相似文本中的新增、删除和修改内容。',
  category: '文本处理',
  path: '/tools/text-compare',
}

export const tools: ToolDefinition[] = [textCompareTool]

export function findToolById(id: string): ToolDefinition | undefined {
  return tools.find((tool) => tool.id === id)
}
