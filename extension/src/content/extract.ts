import { Readability } from '@mozilla/readability'

export function extractArticle(doc: Document): { title: string; text: string } | null {
  const clone = doc.cloneNode(true) as Document
  const article = new Readability(clone).parse()

  if (!article) return null

  return { title: article.title, text: article.textContent }
}
