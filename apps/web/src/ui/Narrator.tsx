import { useCallback, useEffect, useRef, useState } from 'react'
import { useDioramaStore } from '../diorama/dioramaStore'
import { canSpeak, speak, stopSpeaking } from '../lib/voice'
import type { PalaceLayout } from '../palace/layout'
import { useStore } from '../store'
import { KeyHint } from './KeyHint'

const KEY = 'mus3o-narrator'

function readSaved(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}
function save(on: boolean) {
  try {
    window.localStorage.setItem(KEY, on ? '1' : '0')
  } catch {
    /* sin almacenamiento: solo dura la sesión */
  }
}

/** El guía: lee en voz alta las salas y los conceptos al explorar. Apagado por defecto. */
export function Narrator({ layout }: { layout: PalaceLayout }) {
  const [on, setOn] = useState(readSaved)
  const mode = useStore((s) => s.mode)
  const locked = useStore((s) => s.locked)
  const palace = useStore((s) => s.palace)
  const currentRoomId = useStore((s) => s.currentRoomId)
  const openId = useStore((s) => s.openId)
  const dioramaPhase = useDioramaStore((s) => s.phase)
  const dioramaActiveId = useDioramaStore((s) => s.activeId)
  const portals = useDioramaStore((s) => s.portals)
  const supported = canSpeak()
  // Durante la transición al cuadro (entrar o salir) no se habla.
  const inTransition = dioramaPhase === 'entering' || dioramaPhase === 'leaving'
  const active = on && supported && mode === 'explore' && locked && !inTransition

  const toggle = useCallback(() => {
    setOn((v) => {
      save(!v)
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

  // Al terminar de entrar a un cuadro se anuncia su título.
  const dioramaTitle = dioramaActiveId ? portals[dioramaActiveId]?.diorama.title : undefined
  const spokenDiorama = useRef<string | null>(null)
  useEffect(() => {
    if (dioramaPhase === 'room') spokenDiorama.current = null
    if (!active || dioramaPhase !== 'inside' || !dioramaActiveId) return
    if (spokenDiorama.current === dioramaActiveId) return
    spokenDiorama.current = dioramaActiveId
    speak(`Dentro del cuadro: ${dioramaTitle ?? 'sin título'}`)
  }, [active, dioramaPhase, dioramaActiveId, dioramaTitle])

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
    speak(`${concept.title}.${concept.text ? ` ${concept.text}` : ''}`)
  }, [active, openId, palace])

  if (!supported || mode !== 'explore') return null
  return (
    <button type="button" className="narrator" aria-pressed={on} onClick={toggle}>
      Narrador: {on ? 'activado' : 'desactivado'} <KeyHint k="N" />
    </button>
  )
}
