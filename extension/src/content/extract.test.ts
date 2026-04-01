import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import { extractArticle } from './extract'

function makeDocument(html: string): Document {
  return new JSDOM(html, { url: 'https://example.com' }).window.document
}

const ARTICLE_HTML = `
<html>
  <head><title>Test Article</title></head>
  <body>
    <article>
      <h1>Test Article</h1>
      <p>First paragraph with enough content to be recognized as an article by Readability.</p>
      <p>Second paragraph continues the article with more meaningful content here.</p>
      <p>Third paragraph adds further detail so Readability confidently parses this as an article.</p>
    </article>
  </body>
</html>
`

const NON_ARTICLE_HTML = `
<html>
  <head><title>Home</title></head>
  <body></body>
</html>
`

describe('extractArticle', () => {
  it('returns title and text for a valid article page', () => {
    const doc = makeDocument(ARTICLE_HTML)
    const result = extractArticle(doc)

    expect(result).not.toBeNull()
    expect(result!.title).toBe('Test Article')
    expect(result!.text).toContain('First paragraph')
  })

  it('returns null for a non-article page', () => {
    const doc = makeDocument(NON_ARTICLE_HTML)
    const result = extractArticle(doc)

    expect(result).toBeNull()
  })

  it('does not mutate the original document', () => {
    const doc = makeDocument(ARTICLE_HTML)
    const originalTitle = doc.title

    extractArticle(doc)

    expect(doc.title).toBe(originalTitle)
  })
})
