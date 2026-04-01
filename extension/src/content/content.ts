import { extractArticle } from './extract'

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action !== 'extract') return

  sendResponse(extractArticle(document))
})
