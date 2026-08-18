import { describe, it, expect } from 'vitest'
import { countWords, countChars, getTextStats, compressionPercent } from './textStats'

describe('countWords', () => {
  it('returns 0 for an empty string', () => {
    expect(countWords('')).toBe(0)
  })

  it('returns 0 for whitespace-only text', () => {
    expect(countWords('   \n  ')).toBe(0)
  })

  it('counts simple words', () => {
    expect(countWords('hello world')).toBe(2)
  })

  it('collapses repeated whitespace and newlines', () => {
    expect(countWords('hello   world\nfoo')).toBe(3)
  })
})

describe('countChars', () => {
  it('returns 0 for an empty string', () => {
    expect(countChars('')).toBe(0)
  })

  it('counts characters including spaces', () => {
    expect(countChars('hello')).toBe(5)
  })
})

describe('getTextStats', () => {
  it('combines word and char counts', () => {
    expect(getTextStats('hello world')).toEqual({ words: 2, chars: 11 })
  })
})

describe('compressionPercent', () => {
  it('returns the percentage reduction in word count', () => {
    expect(compressionPercent({ words: 100, chars: 500 }, { words: 30, chars: 150 })).toBe(70)
  })

  it('returns 0 when the original has no words', () => {
    expect(compressionPercent({ words: 0, chars: 0 }, { words: 0, chars: 0 })).toBe(0)
  })
})
