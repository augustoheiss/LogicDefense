import { useState, useRef, useEffect, useCallback } from 'react'
import type { KeyboardEvent } from 'react'
import './ChatInterface.css'

/* ── Types ──────────────────────────────────────────────────────── */
export interface CVVersions {
  professional: string
  historian: string
  didactic: string
  alien: string
}

interface Message {
  id: string
  role: 'user' | 'ai'
  content: string
}

const API_URL = 'http://localhost:8000/api/generate-cvs'

interface ChatInterfaceProps {
  onCVGenerated: (versions: CVVersions) => void
  hasGeneratedCVs: boolean
  onReset: () => void
}

/* ── Welcome message ─────────────────────────────────────────────── */
const INITIAL_MESSAGES: Message[] = [
  {
    id: 'welcome',
    role: 'ai',
    content:
      "Hi! I'm your AI CV Assistant.\n\nPaste your resume or describe your background below — I'll generate 4 tailored versions optimised for different audiences:\n\n💼  Professional — ATS-optimised, recruiter-ready\n📜  Historian — Narrative, story-driven tone\n🎓  Didactic — Clear, structured, educational\n🤖  Alien — Playful, tech-forward, memorable\n\nReady when you are. Press Ctrl + Enter to send.",
  },
]

/* ── Component ───────────────────────────────────────────────────── */
export function ChatInterface({
  onCVGenerated,
  hasGeneratedCVs,
  onReset,
}: ChatInterfaceProps) {
  const [messages, setMessages]   = useState<Message[]>(INITIAL_MESSAGES)
  const [input, setInput]         = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [elapsed, setElapsed]     = useState(0)
  const bottomRef                 = useRef<HTMLDivElement>(null)
  const timerRef                  = useRef<ReturnType<typeof setInterval> | null>(null)

  /* Start / stop elapsed-seconds timer whenever loading state changes */
  useEffect(() => {
    if (isLoading) {
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isLoading])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: input.trim(),
    }
    setInput('')

    /* Guard: already has 4 CVs */
    if (hasGeneratedCVs) {
      setMessages(prev => [
        ...prev,
        userMsg,
        {
          id: `a-${Date.now()}`,
          role: 'ai',
          content:
            "⚠️  You already have 4 generated CV versions!\n\nPlease download your files using the toolbar, then click the Reset button above to start fresh with a new resume.",
        },
      ])
      return
    }

    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_text: userMsg.content }),
      })

      if (!res.ok) {
        /* Surface the backend error message when available */
        let detail = `Server responded with ${res.status} ${res.statusText}.`
        try {
          const errBody = await res.json()
          if (errBody?.detail) detail = String(errBody.detail)
        } catch { /* ignore parse failure */ }
        throw new Error(detail)
      }

      const data: CVVersions = await res.json()

      setMessages(prev => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'ai',
          content:
            "✅  Your CVs have been forged!\n\nI've generated 4 tailored versions from your resume. Use the Persona selector in the toolbar on the right to switch between:\n\n💼  Professional\n📜  Historian\n🎓  Didactic\n🤖  Alien\n\nDownload any version as YAML or export to PDF using the toolbar buttons.",
        },
      ])

      onCVGenerated(data)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred.'

      const isNetworkError =
        message.includes('fetch') ||
        message.includes('Failed to fetch') ||
        message.includes('NetworkError')

      setMessages(prev => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'ai',
          content: isNetworkError
            ? `⚠️  Could not reach the AI backend.\n\nMake sure the Python server is running:\n\ncd backend\nuvicorn main:app --reload --port 8000\n\nThen try again.`
            : `⚠️  Something went wrong while generating your CVs.\n\n${message}\n\nDouble-check your resume text isn't empty, then try again.`,
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, hasGeneratedCVs, onCVGenerated])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleReset = () => {
    setMessages(INITIAL_MESSAGES)
    setInput('')
    onReset()
  }

  return (
    <div className="chat">
      {/* Header */}
      <header className="chat__header">
        <div className="chat__header-info">
          <span className="chat__badge">✨ AI Assistant</span>
          <h2 className="chat__title">CV Generator</h2>
        </div>
        <button
          className="chat__reset-btn"
          onClick={handleReset}
          aria-label="Reset chat and clear generated CVs"
        >
          ↺ Reset
        </button>
      </header>

      {/* Message history */}
      <div
        className="chat__messages"
        role="log"
        aria-live="polite"
        aria-label="Chat conversation"
      >
        {messages.map(msg => (
          <div key={msg.id} className={`chat__msg chat__msg--${msg.role}`}>
            <span className="chat__msg-avatar" aria-hidden="true">
              {msg.role === 'ai' ? '🤖' : '👤'}
            </span>
            <div className="chat__msg-bubble">
              <p className="chat__msg-text">{msg.content}</p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="chat__msg chat__msg--ai" aria-label="AI is generating">
            <span className="chat__msg-avatar" aria-hidden="true">🤖</span>
            <div className="chat__msg-bubble chat__msg-bubble--loading">
              <div className="chat__dots">
                <span /><span /><span />
              </div>
              <span className="chat__elapsed" aria-live="polite">
                Forging 4 CVs… {elapsed}s
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Warning when CVs already exist */}
      {hasGeneratedCVs && (
        <div className="chat__warning" role="status">
          ⚠️  4 CV versions are ready. Download your files, then Reset to generate a new one.
        </div>
      )}

      {/* Composer */}
      <div className="chat__composer">
        <textarea
          className="chat__input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste your resume text here, or describe your background and experience…"
          disabled={isLoading}
          aria-label="Resume text input"
          rows={5}
        />
        <div className="chat__composer-footer">
          <span className="chat__hint">Ctrl + Enter to send</span>
          <button
            className="chat__send-btn"
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            aria-label="Send resume for processing"
          >
            {isLoading
              ? <><span className="chat__send-spinner" aria-hidden="true" /> Forging CVs…</>
              : 'Send →'
            }
          </button>
        </div>
      </div>
    </div>
  )
}
