const THAI_CHAR_PATTERN = /[฀-๿]/g

export function isThaiText(text: string, threshold = 0.15): boolean {
  const nonWhitespace = text.replace(/\s/g, '')
  if (nonWhitespace.length === 0) return false

  const thaiMatches = nonWhitespace.match(THAI_CHAR_PATTERN)
  const thaiCount = thaiMatches ? thaiMatches.length : 0

  return thaiCount / nonWhitespace.length >= threshold
}
