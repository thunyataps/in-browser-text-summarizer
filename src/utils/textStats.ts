export interface TextStats {
  words: number
  chars: number
}

export function countWords(text: string): number {
  const trimmed = text.trim()
  if (trimmed === '') return 0
  return trimmed.split(/\s+/).length
}

export function countChars(text: string): number {
  return text.length
}

export function getTextStats(text: string): TextStats {
  return { words: countWords(text), chars: countChars(text) }
}

export function compressionPercent(original: TextStats, summary: TextStats): number {
  if (original.words === 0) return 0
  const reduction = 1 - summary.words / original.words
  return Math.round(reduction * 100)
}
