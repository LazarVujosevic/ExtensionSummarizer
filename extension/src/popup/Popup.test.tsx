import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import Popup from './Popup'

// Mock Chrome APIs
const mockSendMessage = vi.fn()
const mockTabsQuery = vi.fn()
const mockConnect = vi.fn()

vi.stubGlobal('chrome', {
  tabs: {
    query: mockTabsQuery,
    sendMessage: mockSendMessage,
  },
  runtime: {
    connect: mockConnect,
  },
})

const LONG_TEXT = Array(120).fill('word').join(' ')
const EXTRACTED = { title: 'Test Article', text: LONG_TEXT }

// ─── port mock helpers ────────────────────────────────────────────────────────

// Creates a mock chrome.runtime port. The behavior callback receives two
// trigger functions: one to fire onMessage listeners, one to fire onDisconnect.
// The triggers are called after postMessage — i.e. when the popup sends the request.
function makeMockPort(behavior: (
  triggerMessage: (event: object) => void,
  triggerDisconnect: () => void,
) => void) {
  const messageListeners: ((event: object) => void)[] = []
  const disconnectListeners: (() => void)[] = []

  const triggerMessage = (event: object) => messageListeners.forEach((fn) => fn(event))
  const triggerDisconnect = () => disconnectListeners.forEach((fn) => fn())

  const port = {
    onMessage: { addListener: (fn: (event: object) => void) => messageListeners.push(fn) },
    onDisconnect: { addListener: (fn: () => void) => disconnectListeners.push(fn) },
    postMessage: vi.fn(() => behavior(triggerMessage, triggerDisconnect)),
    disconnect: vi.fn(triggerDisconnect),
  }

  mockConnect.mockReturnValue(port)
  return port
}

// Simulates a successful stream: one token then done.
function mockPortSuccess(summary: string, wordCount: number, processingTimeMs: number) {
  makeMockPort((triggerMessage) => {
    setTimeout(() => {
      triggerMessage({ type: 'token', content: summary })
      triggerMessage({ type: 'done', wordCount, processingTimeMs })
    }, 0)
  })
}

// Simulates a non-OK backend response.
function mockPortError() {
  makeMockPort((triggerMessage) => {
    setTimeout(() => triggerMessage({ type: 'error' }), 0)
  })
}

// Simulates a timeout: port disconnects immediately (as if the 60s timer fired).
function mockPortTimeout() {
  makeMockPort((_triggerMessage, triggerDisconnect) => {
    setTimeout(() => triggerDisconnect(), 0)
  })
}

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockTabsQuery.mockResolvedValue([{ id: 1, url: 'https://example.com' }])
  mockSendMessage.mockResolvedValue(EXTRACTED)
  mockConnect.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Popup', () => {
  it('shows timeout message when request times out', async () => {
    mockPortTimeout()
    mockTabsQuery.mockResolvedValue([{ id: 1, url: 'https://example.com' }])
    mockSendMessage.mockResolvedValue(EXTRACTED)

    render(<Popup />)
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('Zahtev je trajao predugo. Pokušaj ponovo.')).toBeInTheDocument()
    })
  })

  it('shows error message when backend returns non-OK response', async () => {
    mockPortError()
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

  it('shows summary on successful streaming response', async () => {
    mockPortSuccess('Kratki rezime.', 120, 1500)
    mockTabsQuery.mockResolvedValue([{ id: 1, url: 'https://example.com' }])
    mockSendMessage.mockResolvedValue(EXTRACTED)

    render(<Popup />)
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('Kratki rezime.')).toBeInTheDocument()
    })
    expect(screen.getByText(/120 words/)).toBeInTheDocument()
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
