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

export const pdfTextCleanerTool: ToolDefinition = {
  id: 'pdf-text-cleaner',
  name: 'PDF 文本清理',
  description: '修复从 PDF 复制文本时产生的异常换行和字符间距，并尽量保留段落与列表结构。',
  category: '文本处理',
  path: '/tools/pdf-text-cleaner',
}

export const tools: ToolDefinition[] = [textCompareTool, pdfTextCleanerTool]

export function findToolById(id: string): ToolDefinition | undefined {
  return tools.find((tool) => tool.id === id)
}
