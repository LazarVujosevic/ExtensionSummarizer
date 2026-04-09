import { describe, it, expect } from 'vitest'
import { countWords, trimToMaxWords, classifyError } from './popupUtils'

describe('countWords', () => {
  it('counts words correctly', () => {
    expect(countWords('one two three')).toBe(3)
  })

  it('returns less than 100 for a short text', () => {
    const shortText = Array(50).fill('word').join(' ')
    expect(countWords(shortText)).toBeLessThan(100)
  })

  it('handles extra whitespace and newlines', () => {
    expect(countWords('  one  two\nthree\t')).toBe(3)
  })

  it('returns 0 for empty string', () => {
    expect(countWords('')).toBe(0)
  })
})

describe('trimToMaxWords', () => {
  it('trims text longer than 10,000 words to exactly 10,000 words', () => {
    const longText = Array(10_001).fill('word').join(' ')
    const result = trimToMaxWords(longText, 10_000)
    expect(result.split(' ').length).toBe(10_000)
  })

  it('does not modify text that is already within the limit', () => {
    const shortText = Array(50).fill('word').join(' ')
    expect(trimToMaxWords(shortText, 10_000)).toBe(shortText)
  })

  it('does not modify text that is exactly at the limit', () => {
    const exactText = Array(10_000).fill('word').join(' ')
    expect(trimToMaxWords(exactText, 10_000)).toBe(exactText)
  })
})

describe('classifyError', () => {
  it('returns timeout for AbortError', () => {
    const err = new DOMException('Aborted', 'AbortError')
    expect(classifyError(err)).toBe('timeout')
  })

  it('returns unsupported-page for connection error', () => {
    const err = new Error('Could not establish connection to the tab.')
    expect(classifyError(err)).toBe('unsupported-page')
  })

  it('returns error for generic backend error', () => {
    const err = new Error('Backend error')
    expect(classifyError(err)).toBe('error')
  })

  it('returns error for unknown thrown value', () => {
    expect(classifyError('something went wrong')).toBe('error')
  })
})
