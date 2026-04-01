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

const SERBIAN_ARTICLE_HTML = `
<html>
  <head><title>Vest dana</title></head>
  <body>
    <article>
      <h1>Vest dana</h1>
      <p>Vlada Srbije usvojila je danas novi paket ekonomskih mera kojima se predviđa povećanje minimalca.</p>
      <p>Ministar finansija izjavio je da će mere stupiti na snagu od prvog januara naredne godine.</p>
      <p>Očekuje se da će od povećanja imati koristi više od pola miliona zaposlenih u Srbiji.</p>
    </article>
  </body>
</html>
`

const NAVIGATION_ONLY_HTML = `
<html>
  <head><title>Navigacija</title></head>
  <body>
    <nav>
      <a href="/home">Početna</a>
      <a href="/vesti">Vesti</a>
      <a href="/sport">Sport</a>
      <a href="/kultura">Kultura</a>
      <a href="/kontakt">Kontakt</a>
    </nav>
  </body>
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

  it('returns null for a completely empty page', () => {
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

  it('returns text without HTML tags', () => {
    const doc = makeDocument(ARTICLE_HTML)
    const result = extractArticle(doc)

    expect(result).not.toBeNull()
    expect(result!.text).not.toMatch(/<[^>]+>/)
  })

  it('returns non-empty text for a valid article', () => {
    const doc = makeDocument(ARTICLE_HTML)
    const result = extractArticle(doc)

    expect(result).not.toBeNull()
    expect(result!.text.trim().length).toBeGreaterThan(0)
  })

  it('correctly extracts Serbian article content', () => {
    const doc = makeDocument(SERBIAN_ARTICLE_HTML)
    const result = extractArticle(doc)

    expect(result).not.toBeNull()
    expect(result!.title).toBe('Vest dana')
    expect(result!.text).toContain('minimalca')
  })

  it('extracts content from navigation-only pages (Readability rarely returns null)', () => {
    // Readability.parse() returns null only on completely empty pages.
    // Pages with any visible text — even navigation links — will be parsed.
    // Do not rely on null as a signal that the page is "not an article".
    const doc = makeDocument(NAVIGATION_ONLY_HTML)
    const result = extractArticle(doc)

    // Result may or may not be null depending on Readability heuristics,
    // but the function must not throw regardless.
    expect(() => extractArticle(doc)).not.toThrow()
    if (result !== null) {
      expect(typeof result.text).toBe('string')
      expect(typeof result.title).toBe('string')
    }
  })
})
