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

export const tools: ToolDefinition[] = [exampleTool]

export function findToolById(id: string): ToolDefinition | undefined {
  return tools.find((tool) => tool.id === id)
}
