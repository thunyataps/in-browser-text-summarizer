import { describe, it, expect, vi, afterEach } from 'vitest'
import { isBrowserSupported } from './browserSupport'

describe('isBrowserSupported', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns true when Worker and WebAssembly are defined', () => {
    expect(isBrowserSupported()).toBe(true)
  })

  it('returns false when Worker is missing', () => {
    vi.stubGlobal('Worker', undefined)
    expect(isBrowserSupported()).toBe(false)
  })

  it('returns false when WebAssembly is missing', () => {
    vi.stubGlobal('WebAssembly', undefined)
    expect(isBrowserSupported()).toBe(false)
  })
})
