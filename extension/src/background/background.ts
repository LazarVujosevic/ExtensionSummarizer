// Background service worker — handles extension lifecycle

chrome.runtime.onInstalled.addListener(() => {
  console.log('ExtensionSummarizer installed')
})

export {}
