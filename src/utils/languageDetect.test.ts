import { describe, it, expect } from 'vitest'
import { isThaiText } from './languageDetect'

describe('isThaiText', () => {
  it('returns false for pure English text', () => {
    expect(isThaiText('A Lion was woken angrily by a little Mouse.')).toBe(false)
  })

  it('returns true for pure Thai text', () => {
    expect(isThaiText('สิงโตตัวหนึ่งถูกหนูตัวเล็กปลุกให้โกรธ')).toBe(true)
  })

  it('returns true when Thai characters dominate mixed text', () => {
    expect(isThaiText('ESG คืออะไร ย่อมาจาก Environmental Social Governance สิ่งแวดล้อมสังคมธรรมาภิบาล')).toBe(
      true,
    )
  })

  it('returns false when only a few Thai words appear in mostly English text', () => {
    expect(
      isThaiText(
        'This is a long English article about a topic sometimes referred to as ESG in ประเทศไทย only briefly.',
      ),
    ).toBe(false)
  })

  it('returns false for empty input', () => {
    expect(isThaiText('')).toBe(false)
  })

  it('returns false for whitespace-only input', () => {
    expect(isThaiText('   \n\t  ')).toBe(false)
  })
})
