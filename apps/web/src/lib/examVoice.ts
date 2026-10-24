// Estado del examen por voz de la tarjeta (sin dependencias del navegador, testeable).
export type VoicePhase = 'listening' | 'idle' | 'typing'

export type VoiceState = {
  phase: VoicePhase
  transcript: string
  notice: string | null
}

export type VoiceAction =
  | { type: 'listen' }
  | { type: 'interim'; text: string }
  | { type: 'error'; code: string }
  | { type: 'typing'; notice?: string | null }

export const TYPING_NOTICE = 'Tu navegador no permite dictado; escribe la respuesta'
export const DENIED_NOTICE = 'No hay acceso al micrófono; escribe la respuesta'

export function initialVoiceState(available: boolean): VoiceState {
  return available
    ? { phase: 'listening', transcript: '', notice: null }
    : { phase: 'typing', transcript: '', notice: TYPING_NOTICE }
}

export function examVoiceReducer(state: VoiceState, a: VoiceAction): VoiceState {
  switch (a.type) {
    case 'listen':
      return { phase: 'listening', transcript: '', notice: null }
    case 'interim':
      return state.phase === 'listening' ? { ...state, transcript: a.text } : state
    case 'typing':
      return { phase: 'typing', transcript: '', notice: a.notice ?? null }
    case 'error':
      if (a.code === 'not-allowed' || a.code === 'service-not-allowed') {
        return { phase: 'typing', transcript: '', notice: DENIED_NOTICE }
      }
      if (a.code === 'unsupported') return { phase: 'typing', transcript: '', notice: TYPING_NOTICE }
      if (state.phase !== 'listening') return state
      // 'no-speech', 'aborted', 'network'…: queda a la espera de un reintento.
      return {
        phase: 'idle',
        transcript: '',
        notice:
          a.code === 'no-speech'
            ? 'No te escuché. R para reintentar, Y para escribir'
            : 'No pude oírte. R para reintentar, Y para escribir',
      }
  }
}
