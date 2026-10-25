import { createStore, type StoreApi } from 'zustand/vanilla'
import type { ListenOptions } from '../lib/voice'
import { normalizeTranscript } from './arisTranscript'

/** Conversación por voz con Aris: escucha, responde, y vuelve a escuchar sin que haya que reabrir nada. */

/** Arranca sola al entrar al museo por primera vez (el clic de entrada es el gesto que permite audio y micrófono). */
export const ARIS_VOICE_AUTOSTART = true

export const GREETING = 'Hola, soy Aris. Te escucho: pregúntame lo que quieras.'

/** Turnos seguidos sin nada útil tras los que Aris se queda en silencio (T la despierta). */
export const MAX_IDLE_TURNS = 2
/** Pausa mínima entre turnos vacíos: un fallo que repite al instante no agota el límite de /api/stt. */
export const MIN_TURN_GAP_MS = 1200
/** Pausa entre que termina Aris de hablar y se abre el micrófono (para no recoger el final de su voz). */
export const RESUME_DELAY_MS = 350
/** Lo máximo que se espera una respuesta que no llega a sonar. Si suena más tiempo, el bucle espera a que termine. */
export const ANSWER_WAIT_MAX_MS = 12_000
/** Silenciada no hay voz que esperar: se sigue pronto. */
export const MUTED_WAIT_MS = 1500
const TICK_MS = 250
const NOTICE_MS = 3500

const FILLERS = new Set(['si', 'sí', 'no', 'eh', 'ah', 'mm', 'mmm', 'hmm', 'uh', 'um', 'ok', 'vale', 'bueno', 'aja', 'ajá', 'oh'])

/**
 * ¿Es una frase que merece respuesta? Con el micrófono siempre abierto caen fragmentos sueltos ("Sí.", "eh"):
 * cada uno costaría una llamada a Haiku, caracteres de voz y una sesión de dictado.
 */
export function isUsableUtterance(text: string): boolean {
  const words = text
    .toLowerCase()
    .replace(/[.,;:!?¡¿"'()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return false
  if (words.length === 1) return words[0].length >= 5 && !FILLERS.has(words[0])
  return words.some((w) => !FILLERS.has(w))
}

export interface ArisConversationDeps {
  canListen: () => boolean
  listen: (o: ListenOptions) => () => void
  isSpeakingNow: () => boolean
  /** ¿Se puede tener el micrófono abierto ahora? (puntero capturado, en la sala, sin tarjeta ni modal ni intro). */
  canRun: () => boolean
  isMuted: () => boolean
  /** Títulos del museo para que el dictado remoto los reconozca bien. */
  keyterms: () => string[]
  lang: () => string
  /** Envía lo dicho a Aris (responde por voz y en el globo). */
  ask: (text: string) => void
  /** Aris dice algo por su cuenta (muestra el globo y habla). */
  say: (text: string) => void
  /** Abre la consulta escrita. */
  openTyped: () => void
}

export interface ConversationState {
  /** La conversación está activa (aunque en pausa). Apagada, el micrófono no se abre. */
  on: boolean
  /** El micrófono está abierto ahora mismo: es lo que se señala en pantalla. */
  listening: boolean
  /** Aris está procesando una pregunta o hablando la respuesta. */
  answering: boolean
  interim: string
  notice: string | null
}

const INITIAL: ConversationState = { on: false, listening: false, answering: false, interim: '', notice: null }

export interface ArisConversation {
  store: StoreApi<ConversationState>
  /** Enciende la conversación; false si no hay forma de escuchar. */
  start: () => boolean
  /** La apaga (con un aviso breve opcional). */
  stop: (notice?: string) => void
  /** T: apaga si está encendida; si no, la enciende (o abre la consulta escrita si no se puede escuchar). */
  talk: () => void
  /** Primera entrada al museo: la enciende sola, una vez. */
  autoStart: () => void
}

export function createArisConversation(deps: ArisConversationDeps): ArisConversation {
  const store = createStore<ConversationState>(() => ({ ...INITIAL }))
  const set = store.setState

  let timer: ReturnType<typeof setInterval> | null = null
  let noticeTimer: ReturnType<typeof setTimeout> | undefined
  let stopTurn: (() => void) | null = null
  let turn = 0
  let awaiting: { since: number; sawSpeech: boolean } | null = null
  let nextAllowedAt = 0
  let idleTurns = 0
  let greeted = false
  let autoStarted = false
  let micDenied = false

  const notice = (text: string) => {
    set({ notice: text })
    clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => set({ notice: null }), NOTICE_MS)
  }

  const closeTurn = () => {
    turn++
    stopTurn?.()
    stopTurn = null
    set({ listening: false, interim: '' })
  }

  const stop = (text?: string) => {
    if (timer) clearInterval(timer)
    timer = null
    closeTurn()
    awaiting = null
    set({ on: false, answering: false })
    if (text) notice(text)
  }

  /** Un turno sin nada útil: tras `MAX_IDLE_TURNS` seguidos, Aris se queda en silencio. */
  const idleTurn = () => {
    idleTurns++
    if (idleTurns >= MAX_IDLE_TURNS) stop('Me quedo en silencio. Pulsa T para hablar.')
    else nextAllowedAt = Date.now() + MIN_TURN_GAP_MS
  }

  const beginTurn = () => {
    const mine = ++turn
    set({ listening: true, interim: '' })
    stopTurn = deps.listen({
      lang: deps.lang(),
      keyterms: deps.keyterms(),
      ambient: true,
      onInterim: (text) => {
        if (mine === turn) set({ interim: text })
      },
      onFinal: (alternatives) => {
        if (mine !== turn) return
        stopTurn = null
        set({ listening: false, interim: '' })
        const text = normalizeTranscript(alternatives[0] ?? '')
        if (!isUsableUtterance(text)) return idleTurn()
        idleTurns = 0
        awaiting = { since: Date.now(), sawSpeech: false }
        set({ answering: true })
        deps.ask(text)
      },
      onError: (code) => {
        if (mine !== turn) return
        stopTurn = null
        set({ listening: false, interim: '' })
        if (code === 'no-speech') return idleTurn()
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          // Sin permiso no se vuelve a pedir solo: queda la consulta escrita.
          micDenied = true
          stop()
          deps.openTyped()
          return
        }
        stop('No pude usar el micrófono. Pulsa Shift+T para escribir.')
      },
    })
  }

  /** Un paso del bucle: pausa si hace falta, espera a que Aris termine y abre el siguiente turno. */
  const tick = () => {
    const now = Date.now()
    if (!deps.canRun()) {
      if (stopTurn) closeTurn() // en pausa el micrófono nunca queda abierto
      return
    }
    if (!greeted) {
      greeted = true
      deps.say(GREETING)
      awaiting = { since: now, sawSpeech: false }
      return
    }
    if (awaiting) {
      const speaking = deps.isSpeakingNow()
      if (speaking) awaiting.sawSpeech = true
      const waited = now - awaiting.since
      const finished = awaiting.sawSpeech ? !speaking : waited > ANSWER_WAIT_MAX_MS || (deps.isMuted() && waited > MUTED_WAIT_MS)
      if (finished) {
        awaiting = null
        set({ answering: false })
        nextAllowedAt = now + RESUME_DELAY_MS
      }
      return
    }
    // Medio dúplex: mientras suena una voz (Aris o el narrador) no se escucha.
    if (!stopTurn && now >= nextAllowedAt && !deps.isSpeakingNow()) beginTurn()
  }

  const start = () => {
    if (store.getState().on) return true
    if (!deps.canListen()) return false
    idleTurns = 0
    nextAllowedAt = 0
    set({ on: true, notice: null })
    timer = setInterval(tick, TICK_MS)
    return true
  }

  return {
    store,
    start,
    stop,
    talk: () => {
      if (store.getState().on) return stop('Micrófono apagado. Pulsa T para hablar.')
      if (micDenied || !start()) deps.openTyped()
    },
    autoStart: () => {
      if (!ARIS_VOICE_AUTOSTART || autoStarted || micDenied) return
      if (start()) autoStarted = true
    },
  }
}
