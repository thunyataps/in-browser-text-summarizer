import { describe, it, expect } from 'vitest'
import { truncateToLimit, MAX_INPUT_WORDS } from './textLimits'

describe('truncateToLimit', () => {
  it('leaves short text unchanged', () => {
    const result = truncateToLimit('hello world')
    expect(result).toEqual({ text: 'hello world', wasTruncated: false })
  })

  it('leaves empty text unchanged', () => {
    expect(truncateToLimit('')).toEqual({ text: '', wasTruncated: false })
  })

  it('does not truncate text exactly at the limit', () => {
    const text = Array.from({ length: 5 }, (_, i) => `word${i}`).join(' ')
    const result = truncateToLimit(text, 5)
    expect(result).toEqual({ text, wasTruncated: false })
  })

  it('truncates text over the limit to exactly maxWords words', () => {
    const text = Array.from({ length: 10 }, (_, i) => `word${i}`).join(' ')
    const result = truncateToLimit(text, 5)
    expect(result.wasTruncated).toBe(true)
    expect(result.text).toBe('word0 word1 word2 word3 word4')
  })

  it('defaults to MAX_INPUT_WORDS when no limit is given', () => {
    const text = Array.from({ length: MAX_INPUT_WORDS + 10 }, (_, i) => `w${i}`).join(' ')
    const result = truncateToLimit(text)
    expect(result.wasTruncated).toBe(true)
    expect(result.text.split(' ')).toHaveLength(MAX_INPUT_WORDS)
  })
})
