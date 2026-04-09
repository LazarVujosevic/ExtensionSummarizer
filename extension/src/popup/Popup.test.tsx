import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import Popup from './Popup'

// Mock Chrome APIs
const mockSendMessage = vi.fn()
const mockTabsQuery = vi.fn()

vi.stubGlobal('chrome', {
  tabs: {
    query: mockTabsQuery,
    sendMessage: mockSendMessage,
  },
})

const LONG_TEXT = Array(120).fill('word').join(' ')
const EXTRACTED = { title: 'Test Article', text: LONG_TEXT }
const SUMMARY_RESPONSE = { summary: 'Kratki rezime.', wordCount: 4, processingTimeMs: 100 }

beforeEach(() => {
  mockTabsQuery.mockResolvedValue([{ id: 1, url: 'https://example.com' }])
  mockSendMessage.mockResolvedValue(EXTRACTED)
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Popup', () => {
  it('shows timeout message when fetch is aborted', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')))
    mockTabsQuery.mockResolvedValue([{ id: 1, url: 'https://example.com' }])
    mockSendMessage.mockResolvedValue(EXTRACTED)

    render(<Popup />)
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('Zahtev je trajao predugo. Pokušaj ponovo.')).toBeInTheDocument()
    })
  })

  it('shows error message when backend returns non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    mockTabsQuery.mockResolvedValue([{ id: 1, url: 'https://example.com' }])
    mockSendMessage.mockResolvedValue(EXTRACTED)

    render(<Popup />)
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('Greška. Proveri da li backend radi.')).toBeInTheDocument()
    })
  })

  it('shows unsupported-page message when content script is not loaded', async () => {
    mockTabsQuery.mockResolvedValue([{ id: 1, url: 'chrome://newtab' }])
    mockSendMessage.mockRejectedValue(new Error('Could not establish connection to the tab.'))

    render(<Popup />)
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('Ekstenzija ne radi na ovoj stranici.')).toBeInTheDocument()
    })
  })

  it('shows summary on successful response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(SUMMARY_RESPONSE),
    }))
    mockTabsQuery.mockResolvedValue([{ id: 1, url: 'https://example.com' }])
    mockSendMessage.mockResolvedValue(EXTRACTED)

    render(<Popup />)
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('Kratki rezime.')).toBeInTheDocument()
    })
  })

  it('shows not-article message when content script returns null', async () => {
    mockTabsQuery.mockResolvedValue([{ id: 1, url: 'https://example.com' }])
    mockSendMessage.mockResolvedValue(null)

    render(<Popup />)
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('Ova stranica nije članak.')).toBeInTheDocument()
    })
  })
})
