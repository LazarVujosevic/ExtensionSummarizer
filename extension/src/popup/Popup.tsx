import { useState } from 'react'
import styles from './Popup.module.css'
import './popup.css'
import { classifyError } from './popupUtils'

type Status = 'idle' | 'loading' | 'streaming' | 'success' | 'error' | 'not-article' | 'unsupported-page' | 'timeout' | 'too-short'

const STREAM_TIMEOUT_MS = 180_000

export default function Popup() {
  const [summary, setSummary] = useState<string>('')
  const [title, setTitle] = useState<string>('')
  const [status, setStatus] = useState<Status>('idle')
  const [wordCount, setWordCount] = useState<number>(0)
  const [processingTime, setProcessingTime] = useState<number>(0)

  const handleSummarize = async () => {
    setStatus('loading')
    setSummary('')
    setTitle('')

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

      const extracted = await chrome.tabs.sendMessage(tab.id!, { action: 'extract' }) as { title: string; text: string } | null

      if (!extracted) {
        setStatus('not-article')
        return
      }

      const words = extracted.text.split(/\s+/).filter(Boolean)
      if (words.length < 100) {
        setStatus('too-short')
        return
      }

      const trimmedText = words.slice(0, 10_000).join(' ')
      setTitle(extracted.title)

      // Streaming goes through the background service worker. Chrome extension
      // popup pages buffer cross-origin ReadableStream responses until the full
      // response completes — the service worker does not have this limitation.
      const port = chrome.runtime.connect({ name: 'summary-stream' })
      const timeoutId = setTimeout(() => port.disconnect(), STREAM_TIMEOUT_MS)
      // Chrome MV3 terminates service workers after ~30s of inactivity.
      // Sending a periodic ping keeps the worker alive during Ollama's cold start.
      const keepAliveId = setInterval(() => port.postMessage({ type: 'ping' }), 20_000)
      let firstToken = true
      let done = false

      await new Promise<void>((resolve, reject) => {
        port.onMessage.addListener((event) => {
          if (event.type === 'token') {
            if (firstToken) {
              setStatus('streaming')
              firstToken = false
            }
            setSummary((prev) => prev + event.content)
          } else if (event.type === 'done') {
            done = true
            setWordCount(event.wordCount)
            setProcessingTime(event.processingTimeMs)
            setStatus('success')
            clearTimeout(timeoutId)
            clearInterval(keepAliveId)
            port.disconnect()
            resolve()
          } else if (event.type === 'error') {
            done = true
            clearTimeout(timeoutId)
            clearInterval(keepAliveId)
            port.disconnect()
            reject(new Error('Backend error'))
          }
        })

        // onDisconnect fires when:
        //   - the timeout above calls port.disconnect()  → treat as timeout
        //   - done/error already disconnected the port   → done=true, skip
        //   - the popup is closed mid-stream             → no-op (context destroyed)
        port.onDisconnect.addListener(() => {
          if (!done) {
            clearTimeout(timeoutId)
            clearInterval(keepAliveId)
            reject(new DOMException('Aborted', 'AbortError'))
          }
        })

        port.postMessage({ url: tab.url, text: trimmedText })
      })
    } catch (err) {
      setStatus(classifyError(err))
    }
  }

  const isActive = status === 'loading' || status === 'streaming'

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>Summarizer</h2>

      <button
        onClick={handleSummarize}
        disabled={isActive}
        className={styles.button}
      >
        {isActive ? (
          <span className="btnLoading">
            <span className="spinner" />
            Summarizing
          </span>
        ) : 'Summarize'}
      </button>

      {(status === 'streaming' || status === 'success') && (
        <div className={styles.result}>
          {title && <p className={styles.articleTitle}>{title}</p>}
          <p className={`${styles.summary} ${status === 'streaming' ? styles.streaming : ''}`}>
            {summary}
          </p>
          {status === 'success' && (
            <small className={styles.meta}>
              {wordCount} words · {processingTime}ms
            </small>
          )}
        </div>
      )}

      {status === 'not-article' && (
        <p className={`${styles.statusMessage} ${styles.statusMuted}`}>
          Ova stranica nije članak.
        </p>
      )}

      {status === 'unsupported-page' && (
        <p className={`${styles.statusMessage} ${styles.statusMuted}`}>
          Ekstenzija ne radi na ovoj stranici.
        </p>
      )}

      {status === 'error' && (
        <p className={`${styles.statusMessage} ${styles.statusError}`}>
          Greška. Proveri da li backend radi.
        </p>
      )}

      {status === 'timeout' && (
        <p className={`${styles.statusMessage} ${styles.statusError}`}>
          Zahtev je trajao predugo. Pokušaj ponovo.
        </p>
      )}

      {status === 'too-short' && (
        <p className={`${styles.statusMessage} ${styles.statusMuted}`}>
          Članak je prekratak za sumarizaciju.
        </p>
      )}
    </div>
  )
}
