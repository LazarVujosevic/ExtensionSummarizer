import { useState } from 'react'

type Status = 'idle' | 'loading' | 'success' | 'error'

const BACKEND_URL = 'http://localhost:5000/api/summary'

export default function Popup() {
  const [summary, setSummary] = useState<string>('')
  const [status, setStatus] = useState<Status>('idle')
  const [wordCount, setWordCount] = useState<number>(0)
  const [processingTime, setProcessingTime] = useState<number>(0)

  const handleSummarize = async () => {
    setStatus('loading')
    setSummary('')

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id! },
        func: extractPageText,
      })

      const text = result.result as string

      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: tab.url, text }),
      })

      if (!response.ok) throw new Error('Backend error')

      const data = await response.json()
      setSummary(data.summary)
      setWordCount(data.wordCount)
      setProcessingTime(data.processingTimeMs)
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div style={{ width: 360, padding: 16, fontFamily: 'sans-serif' }}>
      <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>ExtensionSummarizer</h2>

      <button
        onClick={handleSummarize}
        disabled={status === 'loading'}
        style={{ width: '100%', padding: '8px 0', cursor: status === 'loading' ? 'not-allowed' : 'pointer' }}
      >
        {status === 'loading' ? 'Summarizing...' : 'Summarize'}
      </button>

      {status === 'success' && (
        <div style={{ marginTop: 12 }}>
          <p style={{ margin: '0 0 8px', lineHeight: 1.5 }}>{summary}</p>
          <small style={{ color: '#888' }}>
            {wordCount} words · {processingTime}ms
          </small>
        </div>
      )}

      {status === 'error' && (
        <p style={{ marginTop: 12, color: 'red', fontSize: 13 }}>
          Greška. Proveri da li backend radi.
        </p>
      )}
    </div>
  )
}

// Runs in page context via chrome.scripting.executeScript
// Phase 2: Replace with Readability.js for proper article extraction
function extractPageText(): string {
  return document.body.innerText.slice(0, 8000)
}
