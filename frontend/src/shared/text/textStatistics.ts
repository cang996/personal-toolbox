export function countCharacters(text: string): number {
  return Array.from(text).length
}

export function countLines(text: string): number {
  if (text.length === 0) return 0

  return text.replace(/\r\n?/g, '\n').split('\n').length
}
