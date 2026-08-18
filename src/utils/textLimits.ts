export const MAX_INPUT_WORDS = 750

export function truncateToLimit(
  text: string,
  maxWords: number = MAX_INPUT_WORDS,
): { text: string; wasTruncated: boolean } {
  const trimmed = text.trim()
  if (trimmed === '') return { text, wasTruncated: false }

  const words = trimmed.split(/\s+/)
  if (words.length <= maxWords) return { text, wasTruncated: false }

  return { text: words.slice(0, maxWords).join(' '), wasTruncated: true }
}
