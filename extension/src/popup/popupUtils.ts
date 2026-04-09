export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

export function trimToMaxWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return text
  return words.slice(0, maxWords).join(' ')
}

export function classifyError(err: unknown): 'timeout' | 'unsupported-page' | 'error' {
  if (err instanceof DOMException && err.name === 'AbortError') return 'timeout'
  const message = err instanceof Error ? err.message : String(err)
  if (message.includes('Could not establish connection')) return 'unsupported-page'
  return 'error'
}
