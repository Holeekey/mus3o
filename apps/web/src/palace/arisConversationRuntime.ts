import { useDioramaStore } from '../diorama/dioramaStore'
import { introState } from '../intro/store'
import { canListen, isSpeakingNow, listen } from '../lib/voice'
import { pointerLock } from '../scene/pointerLock'
import { inExamScope, useStore } from '../store'
import { speakAris } from './arisBrain'
import { createArisConversation } from './arisConversation'
import { resolveUserSpeechLanguage } from './useSpeechRecognition'

/** La conversación por voz de la app, conectada a la tienda, la voz y el estado del juego. Nada arranca al importar. */
export const arisConversation = createArisConversation({
  canListen,
  listen,
  isSpeakingNow,
  // El micrófono solo se abre con el juego en marcha: puntero capturado, en la sala, sin consulta escrita ni intro.
  // Una ficha de exploración no pausa (se puede preguntar por ella); una tarjeta de examen sí.
  canRun: () => {
    const s = useStore.getState()
    const examOpen = !!s.openId && inExamScope(s, s.openId)
    return s.locked && !examOpen && !s.arisPromptOpen && useDioramaStore.getState().phase === 'room' && !introState.active
  },
  isMuted: () => useStore.getState().arisMuted,
  keyterms: () => useStore.getState().palace?.rooms.flatMap((r) => r.pieces.map((p) => p.title)) ?? [],
  lang: resolveUserSpeechLanguage,
  ask: (text) => useStore.getState().askAris(text),
  say: (text) => {
    const s = useStore.getState()
    speakAris(text, s.arisMuted)
    s.set({ arisMessage: `Aris: ${text}` })
  },
  openTyped: () => {
    useStore.getState().setArisPromptOpen(true)
    pointerLock.unlock()
  },
})
