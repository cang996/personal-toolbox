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

export const textCleanerTool: ToolDefinition = {
  id: 'text-cleaner',
  name: '文本清理',
  description: '清理 PDF 复制文本，并逐步支持更多文本格式。',
  category: '文本处理',
  path: '/tools/text-cleaner',
}

export const exchangeRateTool: ToolDefinition = {
  id: 'exchange-rate',
  name: '汇率比较',
  description: '查看市场参考汇率与五家银行的现汇、现钞买入和卖出报价。',
  category: '金融工具',
  path: '/tools/exchange-rate',
}

export const tools: ToolDefinition[] = [textCompareTool, textCleanerTool, exchangeRateTool]

export function findToolById(id: string): ToolDefinition | undefined {
  return tools.find((tool) => tool.id === id)
}
