import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type { Piece as Concept } from '@mus3o/shared'
import { examKeyterms, examVoiceReducer, initialVoiceState } from '../lib/examVoice'
import { canListen, listen, speak, stopSpeaking } from '../lib/voice'
import { isCorrectAny } from '../palace/match'
import { pointerLock } from '../scene/pointerLock'
import { useStore } from '../store'
import type { RoomPalette } from '../theme'
import { useCardScroll } from './cardScroll'
import { useIsTouch } from './useIsTouch'

const isTextTarget = (t: EventTarget | null) => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement

export function ExamCard({ concept, palette }: { concept: Concept; palette: RoomPalette }) {
  const result = useStore((s) => s.exam[concept.id])
  const recordExam = useStore((s) => s.recordExam)
  const [voice, dispatch] = useReducer(examVoiceReducer, undefined, () => initialVoiceState(canListen()))
  const [answer, setAnswer] = useState('')
  const [heard, setHeard] = useState('')
  const [hint, setHint] = useState(false)
  const stopRef = useRef<() => void>(() => {})
  const touch = useIsTouch()
  const inner = useRef<HTMLDivElement>(null)
  const more = useCardScroll(inner)

  const finish = useCallback(
    (ok: boolean) => {
      recordExam(concept.id, ok ? 'ok' : 'fail')
      speak(ok ? `Correcto: ${concept.title}` : `No era. Era ${concept.title}`)
    },
    [concept.id, concept.title, recordExam],
  )

  const startListening = useCallback(() => {
    stopRef.current()
    stopSpeaking()
    dispatch({ type: 'listen' })
    stopRef.current = listen({
      keyterms: examKeyterms(useStore.getState().palace?.rooms ?? [], concept.id),
      onInterim: (text) => dispatch({ type: 'interim', text }),
      onFinal: (alts) => {
        setHeard(alts[0])
        finish(isCorrectAny(alts, concept.title))
      },
      onError: (code) => {
        dispatch({ type: 'error', code })
        // Sin micrófono hay que escribir, y para eso se libera el puntero.
        if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'unsupported') pointerLock.unlock()
      },
    })
  }, [concept.id, concept.title, finish])

  const toTyping = useCallback(() => {
    stopRef.current()
    dispatch({ type: 'typing' })
    pointerLock.unlock()
  }, [])

  // La pulsación de E que abrió la tarjeta es el gesto del usuario: se escucha de inmediato.
  useEffect(() => {
    if (!result && canListen()) startListening()
    return () => {
      stopRef.current()
      stopSpeaking()
    }
    // Solo al abrir la tarjeta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (result) return
    const onKey = (e: KeyboardEvent) => {
      if (isTextTarget(e.target) || e.repeat) return
      if (e.code === 'KeyR' && voice.phase !== 'typing' && canListen()) startListening()
      else if (e.code === 'KeyY' && voice.phase !== 'typing') toTyping()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [result, voice.phase, startListening, toTyping])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!answer.trim()) return
    setHeard(answer.trim())
    finish(isCorrectAny([answer], concept.title))
  }
  const back = () => {
    useStore.getState().set({ openId: null })
    pointerLock.lock()
  }

  const style = { '--wall': palette.wall, '--wall-ink': palette.ink } as React.CSSProperties

  return (
    <aside className="card card-exam" style={style}>
      <div className="card-header-bar">
        <p className="card-tag">Modo examen</p>
        <button type="button" className="card-close" onClick={back} aria-label="Cerrar examen">
          ✕
        </button>
      </div>
      <div ref={inner} className={more ? 'card-inner has-more' : 'card-inner'}>
        {result ? (
          <>
            <h2 className={result === 'ok' ? 'ok' : 'fail'}>{result === 'ok' ? 'Recordado' : 'No era ese'}</h2>
            {heard && <p className="card-meta">Dijiste: “{heard}”</p>}
            <p className="card-body">
              Respuesta: <strong>{concept.title}</strong>
            </p>
            <div className="card-actions">
              <button className="btn btn-primary" onClick={back}>Seguir recorriendo</button>
              {!touch && <span className="keys"><kbd>E</kbd> cerrar</span>}
            </div>
          </>
        ) : voice.phase === 'typing' ? (
          <form onSubmit={submit}>
            <h2>¿Qué concepto estaba en este pedestal?</h2>
            {voice.notice && <p className="card-meta" role="status">{voice.notice}</p>}
            {concept.text && <p className="card-body">Pista del contenido: “{concept.text}”</p>}
            {hint && concept.mnemonicCue && <p className="card-meta">Anclaje visual: “{concept.mnemonicCue}”</p>}
            {hint && <p className="card-meta">Empieza con “{concept.title.slice(0, 2)}…” · {concept.title.length} letras</p>}
            <input autoFocus value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Escribe tu respuesta" maxLength={120} aria-label="Tu respuesta" />
            <div className="card-actions">
              <button type="submit" className="btn btn-primary">Responder</button>
              {!hint && <button type="button" className="btn btn-ghost" onClick={() => setHint(true)}>Ver pista</button>}
            </div>
          </form>
        ) : (
          <div>
            <h2>¿Qué concepto estaba en este pedestal?</h2>
            {concept.text && <p className="card-body">Pista del contenido: “{concept.text}”</p>}
            <div className="listen" data-active={voice.phase === 'listening'} role="status" aria-live="polite">
              <span className="listen-bars" aria-hidden="true">
                <i /><i /><i /><i /><i />
              </span>
              <span className="listen-label">{voice.phase === 'listening' ? 'Escuchando…' : 'En pausa'}</span>
            </div>
            <p className="listen-text">{voice.transcript || (voice.phase === 'listening' ? 'Di en voz alta qué concepto era' : voice.notice)}</p>
            <div className="card-actions">
              {touch ? (
                <>
                  {canListen() && (
                    <button type="button" className="btn btn-ghost" onClick={startListening}>
                      reintentar
                    </button>
                  )}
                  <button type="button" className="btn btn-ghost" onClick={toTyping}>
                    escribir
                  </button>
                </>
              ) : (
                <span className="keys">
                  <kbd>R</kbd> reintentar · <kbd>Y</kbd> escribir · <kbd>E</kbd> cerrar
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
