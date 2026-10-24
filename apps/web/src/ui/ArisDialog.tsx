import { useEffect, useRef, useState } from 'react'
import { pointerLock } from '../scene/pointerLock'
import { useStore } from '../store'

export function ArisDialog() {
  const message = useStore((s) => s.arisMessage)
  const close = useStore((s) => s.closeArisDialog)
  const isMuted = useStore((s) => s.arisMuted)
  const toggleMute = useStore((s) => s.toggleArisMute)

  useEffect(() => {
    if (!message) return
    // Auto-cierre a los 10 segundos si el usuario no lo cierra antes
    const timer = setTimeout(() => {
      close()
    }, 10000)
    return () => clearTimeout(timer)
  }, [message, close])

  if (!message) return null

  return (
    <aside className="aris-bubble" aria-live="polite">
      <div className="aris-bubble-header">
        <span className="aris-avatar">🤖</span>
        <span className="aris-name">Aris</span>
        <button
          type="button"
          className="aris-mute-btn"
          onClick={toggleMute}
          aria-label={isMuted ? 'Activar voz' : 'Silenciar voz'}
          title={isMuted ? 'Activar voz' : 'Silenciar voz'}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
        <button
          type="button"
          className="aris-close-btn"
          onClick={close}
          aria-label="Cerrar mensaje"
        >
          ✕
        </button>
      </div>
      <p className="aris-bubble-text">{message.replace(/^Aris:\s*/i, '')}</p>
    </aside>
  )
}

export function ArisPrompt() {
  const isOpen = useStore((s) => s.arisPromptOpen)
  const setOpen = useStore((s) => s.setArisPromptOpen)
  const askAris = useStore((s) => s.askAris)
  const isMuted = useStore((s) => s.arisMuted)
  const toggleMute = useStore((s) => s.toggleArisMute)
  const [query, setQuery] = useState('')
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<any>(null)

  // Detección de soporte nativo para Web Speech API
  const hasSpeech =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  useEffect(() => {
    if (!hasSpeech) return

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRec()
    recognition.lang = 'es-ES'
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      if (transcript) {
        askAris(transcript)
        setQuery('')
        pointerLock.lock()
      }
      setIsListening(false)
    }

    recognition.onerror = () => {
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
  }, [hasSpeech, askAris])

  const toggleMic = () => {
    if (!recognitionRef.current) return
    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      try {
        setIsListening(true)
        recognitionRef.current.start()
      } catch {
        setIsListening(false)
      }
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    askAris(query)
    setQuery('')
    pointerLock.lock()
  }

  const cancel = () => {
    setOpen(false)
    pointerLock.lock()
  }

  if (!isOpen) return null

  return (
    <div className="aris-modal-overlay">
      <form className="aris-modal" onSubmit={submit}>
        <div className="aris-modal-header">
          <span className="aris-avatar">🤖</span>
          <div>
            <h3>Consultar a Aris</h3>
            <p className="aris-modal-sub">
              Pregúntale qué falta memorizar, adónde ir o pistas sobre la sala.
            </p>
          </div>
          <button
            type="button"
            className="aris-mute-btn"
            onClick={toggleMute}
            aria-label={isMuted ? 'Activar voz' : 'Silenciar voz'}
            title={isMuted ? 'Activar voz' : 'Silenciar voz'}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
          <button type="button" className="aris-close-btn" onClick={cancel}>
            ✕
          </button>
        </div>

        <div className="aris-input-row">
          <input
            autoFocus
            type="text"
            className="aris-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isListening ? 'Escuchando tu voz...' : 'Escribe tu pregunta a Aris...'}
            disabled={isListening}
          />
          {hasSpeech && (
            <button
              type="button"
              className={`aris-mic-btn ${isListening ? 'listening' : ''}`}
              onClick={toggleMic}
              title="Dictar por voz"
            >
              🎤
            </button>
          )}
          <button type="submit" className="btn btn-primary">
            Preguntar
          </button>
        </div>

        <div className="aris-quick-pills">
          <button
            type="button"
            className="pill"
            onClick={() => {
              askAris('¿Qué falta memorizar?')
              pointerLock.lock()
            }}
          >
            ¿Qué falta memorizar?
          </button>
          <button
            type="button"
            className="pill"
            onClick={() => {
              askAris('¿Adónde voy ahora?')
              pointerLock.lock()
            }}
          >
            ¿Adónde voy ahora?
          </button>
          <button
            type="button"
            className="pill"
            onClick={() => {
              askAris('¿De qué trata esta sala?')
              pointerLock.lock()
            }}
          >
            Resumen de sala
          </button>
          <button
            type="button"
            className="pill"
            onClick={() => {
              askAris('¿Dónde está la llave?')
              pointerLock.lock()
            }}
          >
            ¿Dónde está la llave?
          </button>
        </div>
      </form>
    </div>
  )
}
