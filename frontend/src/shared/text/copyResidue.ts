export function removeCopyResidue(text: string): string {
  return text.replace(/[\u200B\u00AD\uFEFF]/g, '').replace(/\u00A0/g, ' ')
}
