import { useCallback, useEffect, useRef, useState } from 'react'
import { canListen, listen } from '../lib/voice'
import { normalizeTranscript } from './arisTranscript'

export interface UseSpeechRecognitionOptions {
  onFinalResult: (transcript: string) => void
  autoSendDelayMs?: number
  /** Términos del museo que conviene reconocer bien (solo lo usa el dictado remoto de ElevenLabs). */
  keyterms?: string[]
  /** Se llama en cuanto hay frase confirmada, antes del envío automático: sirve para mostrar "procesando". */
  onProcessing?: () => void
}

type ErrorStatus = 'not-allowed' | 'no-speech' | 'network' | 'unknown'

/** Detecta dinámicamente el dialecto preferido del usuario con fallback seguro a español */
export function resolveUserSpeechLanguage(): string {
  if (typeof navigator === 'undefined' || !navigator.language) return 'es-419'
  const navLang = navigator.language.trim()
  if (navLang.toLowerCase().startsWith('es')) {
    return navLang
  }
  return 'es-419'
}

/** Traduce los códigos de lib/voice (navegador o ElevenLabs) a los estados que muestra la UI. */
function toErrorStatus(code: string): ErrorStatus {
  if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'permission-denied') return 'not-allowed'
  if (code === 'no-speech') return 'no-speech'
  if (code === 'network') return 'network'
  return 'unknown'
}

/**
 * Dictado para el diálogo de Aris. Usa lib/voice: ElevenLabs Scribe en tiempo real si el servidor lo tiene y, si no
 * o si falla, el dictado del navegador. `isListening` se mantiene hasta que hay frase, error o se detiene a mano.
 */
export function useSpeechRecognition({
  onFinalResult,
  autoSendDelayMs = 400,
  keyterms,
  onProcessing,
}: UseSpeechRecognitionOptions) {
  const isSupported = canListen()

  const [isListening, setIsListening] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [errorStatus, setErrorStatus] = useState<ErrorStatus | null>(null)

  const stopRef = useRef<() => void>(() => {})
  const autoSendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onFinalResultRef = useRef(onFinalResult)
  onFinalResultRef.current = onFinalResult
  const keytermsRef = useRef(keyterms)
  keytermsRef.current = keyterms
  const onProcessingRef = useRef(onProcessing)
  onProcessingRef.current = onProcessing

  const clearTimer = useCallback(() => {
    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current)
      autoSendTimerRef.current = null
    }
  }, [])

  const stopListening = useCallback(() => {
    clearTimer()
    stopRef.current()
    stopRef.current = () => {}
    setIsListening(false)
    setInterimText('')
  }, [clearTimer])

  const startListening = useCallback(() => {
    if (!isSupported) return
    clearTimer()
    stopRef.current()
    setErrorStatus(null)
    setInterimText('')
    setIsListening(true)

    stopRef.current = listen({
      lang: resolveUserSpeechLanguage(),
      keyterms: keytermsRef.current,
      onInterim: (text) => setInterimText(text),
      onFinal: (alternatives) => {
        const normalized = normalizeTranscript(alternatives[0] ?? '')
        if (!normalized) {
          setIsListening(false)
          setErrorStatus('no-speech')
          return
        }
        setInterimText(normalized)
        onProcessingRef.current?.()
        // Auto-envío tras breve delay perceptivo para que el usuario confirme lo que se transcribió
        clearTimer()
        autoSendTimerRef.current = setTimeout(() => {
          autoSendTimerRef.current = null
          setIsListening(false)
          setInterimText('')
          onFinalResultRef.current(normalized)
        }, autoSendDelayMs)
      },
      onError: (code) => {
        setIsListening(false)
        setInterimText('')
        setErrorStatus(toErrorStatus(code))
      },
    })
  }, [isSupported, clearTimer, autoSendDelayMs])

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  useEffect(() => {
    return () => {
      clearTimer()
      stopRef.current()
    }
  }, [clearTimer])

  return {
    isSupported,
    isListening,
    interimText,
    errorStatus,
    startListening,
    stopListening,
    toggleListening,
  }
}
