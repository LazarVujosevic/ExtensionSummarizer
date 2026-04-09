import { useState } from 'react'
import styles from './Popup.module.css'
import './popup.css'
import { classifyError } from './popupUtils'

type Status = 'idle' | 'loading' | 'success' | 'error' | 'not-article' | 'unsupported-page' | 'timeout' | 'too-short'

const BACKEND_URL = 'http://localhost:5000/api/summary'
const FETCH_TIMEOUT_MS = 60_000

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

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

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

      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: tab.url, text: trimmedText }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error('Backend error')

      const data = await response.json()
      setSummary(data.summary)
      setTitle(extracted.title)
      setWordCount(data.wordCount)
      setProcessingTime(data.processingTimeMs)
      setStatus('success')
    } catch (err) {
      setStatus(classifyError(err))
    } finally {
      clearTimeout(timeoutId)
    }
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>Summarizer</h2>

      <button
        onClick={handleSummarize}
        disabled={status === 'loading'}
        className={styles.button}
      >
        {status === 'loading' ? (
          <span className="btnLoading">
            <span className="spinner" />
            Summarizing
          </span>
        ) : 'Summarize'}
      </button>

      {status === 'success' && (
        <div className={styles.result}>
          {title && <p className={styles.articleTitle}>{title}</p>}
          <p className={styles.summary}>{summary}</p>
          <small className={styles.meta}>
            {wordCount} words · {processingTime}ms
          </small>
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
