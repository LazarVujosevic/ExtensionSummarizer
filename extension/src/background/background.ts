// Background service worker — handles extension lifecycle and SSE streaming.
//
// Streaming goes through the service worker because Chrome extension popup
// pages buffer cross-origin ReadableStream responses until the full response
// completes. Service workers do not have this limitation.
//
// The popup opens a port named 'summary-stream', sends the request payload,
// and receives token/done/error events back via port.postMessage.

const BACKEND_URL = 'http://localhost:5000/api/summary/stream'

chrome.runtime.onInstalled.addListener(() => {
  console.log('ExtensionSummarizer installed')
})

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'summary-stream') return

  const abortController = new AbortController()

  // When the popup closes or disconnects the port, abort the fetch so Ollama
  // does not keep generating tokens in the background.
  port.onDisconnect.addListener(() => {
    abortController.abort()
  })

  port.onMessage.addListener(async (request: { type?: string; url: string; text: string }) => {
    if (request.type === 'ping') return
    try {
      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: abortController.signal,
      })

      if (!response.ok || !response.body) {
        port.postMessage({ type: 'error' })
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            port.postMessage(event)
          } catch { /* ignore malformed SSE lines */ }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Port was disconnected (popup closed or timeout) — nothing to do.
        return
      }
      port.postMessage({ type: 'error' })
    }
  })
})

export {}
