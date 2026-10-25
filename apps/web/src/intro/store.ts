import { create } from 'zustand'
import type { PalaceLayout, RoomLayout } from '../palace/layout'
import { introTimeline, liveArrival, liveFinish, liveTimeline, type IntroTimeline } from './timeline'

/**
 * Estado de "El palacio se levanta". `introState` es mutable y se lee por frame (sin re-render);
 * `useIntro` solo cambia al empezar, al llegar una sala y al terminar (UI).
 *
 * Dos modos: `fixed` (reloj fijo de ~6 s sobre un layout completo) y `build` (guiado por datos: cada
 * sala empieza a levantarse cuando llega de la IA y el descenso espera a que termine todo).
 */
export const introState: {
  active: boolean
  /** Segundos de intro transcurridos. */
  t: number
  timeline: IntroTimeline | null
  /** ?introAt=<s>: congela el reloj en ese instante (solo capturas y depuración). */
  frozenAt: number | null
  mode: 'fixed' | 'build'
  /** build: ya llegó el evento `done`. */
  buildDone: boolean
  /** build: el usuario pidió saltar; la cámara lo atiende en su próximo frame. */
  skipRequested: boolean
  /** build: tras saltar, el reloj sigue corriendo para que las salas que aún llegan se levanten solas. */
  popin: boolean
} = { active: false, t: 0, timeline: null, frozenAt: null, mode: 'fixed', buildDone: false, skipRequested: false, popin: false }

type Phase = 'idle' | 'playing' | 'done'
type IntroUi = { phase: Phase; reduced: boolean; /** build: aún llegan salas. */ building: boolean; /** build: salas llegadas. */ arrived: number }
const IDLE_UI: IntroUi = { phase: 'idle', reduced: false, building: false, arrived: 0 }
export const useIntro = create<IntroUi>(() => ({ ...IDLE_UI }))
// beginIntro se llama durante el render de World: la UI se actualiza fuera de él.
const setUi = (ui: Partial<IntroUi>) => queueMicrotask(() => useIntro.setState({ ...IDLE_UI, ...ui }))

const played = new Set<string>()
let startedFor: PalaceLayout | null = null

export type IntroOptions = {
  /** Identifica el palacio: la intro solo corre la primera vez que se entra en él en esta sesión. */
  key: string
  /** 'on' (?intro=1) fuerza; 'off' (?intro=0) desactiva. */
  force?: 'on' | 'off' | null
  reducedMotion?: boolean
  frozenAt?: number | null
}

function resetBuildFlags() {
  introState.mode = 'fixed'
  introState.buildDone = false
  introState.skipRequested = false
  introState.popin = false
}

/** Idempotente por layout (StrictMode). Devuelve si hay intro con vuelo. */
export function beginIntro(layout: PalaceLayout, opts: IntroOptions): boolean {
  if (startedFor === layout) return introState.active
  startedFor = layout
  resetBuildFlags()
  const replay = opts.force === 'on'
  if (opts.force === 'off' || (!replay && played.has(opts.key))) {
    introState.active = false
    setUi({ phase: 'done' })
    return false
  }
  played.add(opts.key)
  if (opts.reducedMotion) {
    // Sin vuelo: todo ya está construido; solo un fundido corto (IntroOverlay).
    introState.active = false
    setUi({ phase: 'playing', reduced: true })
    return false
  }
  introState.timeline = introTimeline(layout)
  introState.t = 0
  introState.frozenAt = opts.frozenAt ?? null
  introState.active = true
  setUi({ phase: 'playing' })
  return true
}

/**
 * Empieza la intro guiada por datos: cámara aérea sobre un solar vacío y reloj en marcha, sin final
 * programado. Las salas se registran con `introRoomArrived` y el descenso con `introBuildDone`.
 * Con movimiento reducido no hay vuelo: cada sala llega con un fundido corto (IntroOverlay).
 */
export function beginBuildIntro(opts: { reducedMotion?: boolean; frozenAt?: number | null } = {}): boolean {
  startedFor = null
  resetBuildFlags()
  introState.mode = 'build'
  introState.timeline = liveTimeline()
  introState.t = 0
  introState.frozenAt = opts.frozenAt ?? null
  introState.active = !opts.reducedMotion
  useIntro.setState({ phase: 'playing', reduced: !!opts.reducedMotion, building: true, arrived: 0 })
  return introState.active
}

/** Una sala llegó: su levantamiento empieza ahora (en el reloj de la intro), no en un instante fijado de antemano. */
export function introRoomArrived(room: RoomLayout, index: number) {
  const tl = introState.timeline
  if (introState.mode !== 'build' || !tl) return
  liveArrival(tl, room, index, introState.t)
  useIntro.setState({ arrived: index + 1 })
}

/** Ya no llegan más salas (terminó o se cortó): programa el descenso al terminar lo que aún se levanta. */
export function introBuildDone() {
  if (introState.mode !== 'build') return
  introState.buildDone = true
  if (introState.timeline) liveFinish(introState.timeline, introState.t)
  useIntro.setState({ building: false })
}

/** Salta al estado más reciente: todo levantado y la cámara en el punto de entrada. */
export function skipIntro() {
  if (introState.mode === 'build' && introState.active && introState.timeline) {
    introState.frozenAt = null
    if (introState.buildDone) introState.t = introState.timeline.total
    // Sin ninguna sala aún no hay nada a donde saltar.
    else if (useIntro.getState().arrived > 0) introState.skipRequested = true
    return
  }
  if (introState.active && introState.timeline) {
    introState.frozenAt = null
    introState.t = introState.timeline.total
  } else if (useIntro.getState().phase === 'playing') {
    useIntro.setState({ phase: 'done' })
  }
}

export function finishIntro() {
  introState.active = false
  useIntro.setState({ phase: 'done' })
}

/** Corta una intro en curso (al salir del palacio). No toca el registro de palacios ya vistos en la sesión. */
export function abortIntro() {
  const wasActive = introState.active
  introState.active = false
  resetBuildFlags()
  startedFor = null
  if (wasActive) useIntro.setState({ phase: 'done', building: false })
}

/** Solo pruebas. */
export function resetIntroForTests() {
  played.clear()
  startedFor = null
  introState.active = false
  introState.t = 0
  introState.timeline = null
  introState.frozenAt = null
  resetBuildFlags()
  useIntro.setState({ ...IDLE_UI })
}
