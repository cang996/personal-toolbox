export interface ToolDefinition {
  id: string
  name: string
  englishName: string
  description: string
  category: string
  tags: readonly string[]
  path: `/tools/${string}`
}

export const textCompareTool: ToolDefinition = {
  id: 'text-compare',
  name: '文本对比工具',
  englishName: 'TEXT COMPARE',
  description: '比较两段相似文本中的新增、删除和修改内容。',
  category: '文本处理',
  tags: ['LOCAL', 'DIFF ENGINE'],
  path: '/tools/text-compare',
}

export const textCleanerTool: ToolDefinition = {
  id: 'text-cleaner',
  name: '文本清理',
  englishName: 'TEXT CLEANER',
  description: '清理 PDF、Markdown，并规范普通文本的空格与字符格式。',
  category: '文本处理',
  tags: ['LOCAL', 'PDF / MARKDOWN / TEXT'],
  path: '/tools/text-cleaner',
}

export const pdfTextCleanerTool: ToolDefinition = {
  id: 'pdf-text-cleaner',
  name: 'PDF 复制文本清理',
  englishName: 'PDF TEXT CLEANER',
  description: '清理从 PDF 复制后产生的异常换行、字符间距和列表结构。',
  category: '文本处理',
  tags: ['LOCAL', 'PDF'],
  path: '/tools/text-cleaner/pdf',
}

export const markdownTextCleanerTool: ToolDefinition = {
  id: 'markdown-text-cleaner',
  name: 'Markdown 格式清理',
  englishName: 'MARKDOWN CLEANER',
  description: '删除常见 Markdown 标记，保留适合复制到 Word 的文本结构。',
  category: '文本处理',
  tags: ['LOCAL', 'MARKDOWN'],
  path: '/tools/text-cleaner/markdown',
}

export const textNormalizerTool: ToolDefinition = {
  id: 'text-normalizer',
  name: '文本规范化',
  englishName: 'TEXT NORMALIZER',
  description: '规范普通文本的空格、中英混排、标点间距和全角字母数字。',
  category: '文本处理',
  tags: ['LOCAL', 'PLAIN TEXT'],
  path: '/tools/text-cleaner/normalizer',
}

export const exchangeRateTool: ToolDefinition = {
  id: 'exchange-rate',
  name: '汇率比较',
  englishName: 'EXCHANGE RATE',
  description: '查看市场参考汇率与五家银行的现汇、现钞买入和卖出报价。',
  category: '金融工具',
  tags: ['NETWORK', '5 BANK SOURCES'],
  path: '/tools/exchange-rate',
}

export const tools: ToolDefinition[] = [textCompareTool, textCleanerTool, exchangeRateTool]
export const recentTools: ToolDefinition[] = [
  textCompareTool,
  pdfTextCleanerTool,
  markdownTextCleanerTool,
  textNormalizerTool,
  exchangeRateTool,
]

export function findToolById(id: string): ToolDefinition | undefined {
  return tools.find((tool) => tool.id === id)
}

export function findRecentToolByPath(path: string): ToolDefinition | undefined {
  return recentTools.find((tool) => tool.path === path)
}
