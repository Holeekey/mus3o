import { useCallback, useEffect, useRef, useState } from 'react'
import { useDioramaStore } from '../diorama/dioramaStore'
import { fetchWikiInfo, firstSentence, peekWikiInfo } from '../lib/info'
import { readNarratorOn, saveNarratorOn } from '../lib/narratorPref'
import { canSpeak, speak, stopSpeaking } from '../lib/voice'
import type { PalaceLayout } from '../palace/layout'
import { inExamScope, useStore } from '../store'
import { KeyHint } from './KeyHint'

/** El guía: lee en voz alta las salas y los conceptos al explorar. Apagado por defecto. */
export function Narrator({ layout }: { layout: PalaceLayout }) {
  const [on, setOn] = useState(readNarratorOn)
  // Aviso breve al cambiarlo: apagado, el botón no ocupa lugar en escritorio.
  const [flash, setFlash] = useState(false)
  useEffect(() => {
    if (!flash) return
    const timer = setTimeout(() => setFlash(false), 2_000)
    return () => clearTimeout(timer)
  }, [flash])
  const mode = useStore((s) => s.mode)
  const locked = useStore((s) => s.locked)
  const palace = useStore((s) => s.palace)
  const currentRoomId = useStore((s) => s.currentRoomId)
  const openId = useStore((s) => s.openId)
  const dioramaPhase = useDioramaStore((s) => s.phase)
  const supported = canSpeak()
  // Durante la transición al cuadro (entrar o salir) no se habla.
  const inTransition = dioramaPhase === 'entering' || dioramaPhase === 'leaving'
  const active = on && supported && mode === 'explore' && locked && !inTransition

  const toggle = useCallback(() => {
    setFlash(true)
    setOn((v) => {
      saveNarratorOn(!v)
      if (v) stopSpeaking()
      return !v
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyN' || e.repeat) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (useStore.getState().mode !== 'explore') return
      toggle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])

  // Silencio al pausar, cambiar de modo, apagar el narrador o salir del palacio.
  useEffect(() => {
    if (!active) stopSpeaking()
  }, [active])
  useEffect(() => stopSpeaking, [])

  // Solo se anuncia una sala cuando cambia, no al reanudar tras una pausa.
  const spokenRoom = useRef<string | null>(null)
  useEffect(() => {
    if (!on || mode !== 'explore') spokenRoom.current = null
  }, [on, mode])
  useEffect(() => {
    if (!active || !currentRoomId || spokenRoom.current === currentRoomId) return
    spokenRoom.current = currentRoomId
    if (useStore.getState().openId) return
    const room = layout.rooms.find((r) => r.id === currentRoomId)
    if (!room) return
    const description = palace?.rooms.find((r) => r.id === currentRoomId)?.description?.trim()
    speak(`Sala ${room.index + 1}: ${room.title}.${description ? ` ${description}` : ''}`)
  }, [active, currentRoomId, layout, palace])

  // Al entrar a un cuadro habla la guía de Aris (diorama/guideStore.ts), con la misma voz y el mismo interruptor.

  const prevOpen = useRef<string | null>(null)
  useEffect(() => {
    const wasOpen = prevOpen.current
    prevOpen.current = openId
    if (!active) return
    if (!openId) {
      if (wasOpen) stopSpeaking()
      return
    }
    const concept = palace?.rooms.flatMap((r) => r.pieces).find((p) => p.id === openId)
    if (!concept) return
    // Tras el concepto, la primera oración del resumen de Wikipedia (si llega pronto; nunca en un examen).
    const base = `${concept.title}.${concept.text ? ` ${concept.text}` : ''}`
    if (inExamScope(useStore.getState(), openId)) {
      speak(base)
      return
    }
    let cancelled = false
    const known = peekWikiInfo(concept.imageSearch)
    const info =
      known !== undefined
        ? Promise.resolve(known)
        : Promise.race([fetchWikiInfo(concept.imageSearch ?? {}), new Promise<null>((r) => setTimeout(() => r(null), 1_200))])
    void info.then((found) => {
      if (cancelled || useStore.getState().openId !== openId) return
      speak(found ? `${base} ${firstSentence(found.extract)}` : base)
    })
    return () => {
      cancelled = true
    }
  }, [active, openId, palace])

  if (!supported || mode !== 'explore') return null
  // Apagado solo se ve un momento tras cambiarlo (en escritorio); en táctil es el interruptor y queda siempre.
  return (
    <button type="button" className={flash ? 'narrator is-flash' : 'narrator'} aria-pressed={on} onClick={toggle}>
      Narrador: {on ? 'activado' : 'desactivado'} <KeyHint k="N" />
    </button>
  )
}
