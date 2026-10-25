import { create } from 'zustand'
import type { Museum, Piece } from '@mus3o/shared'
import { fetchWikiInfo, peekWikiInfo } from '../lib/info'
import { readNarratorOn } from '../lib/narratorPref'
import { canSpeak, speak, stopSpeaking } from '../lib/voice'
import { useStore } from '../store'
import { useDioramaStore } from './dioramaStore'
import { peekMainImage } from '../lib/images'
import { buildIntro, buildPhotoIntro, buildPieceNarration, buildPropNarration, createVisitTracker, DIORAMA_SPAWN, matchConcept, relativeDirection, speechMs, type IntroItem, type PhotoItem } from './guide'
import { getDioramaModel } from './model'

// Estado de la guía de Aris dentro de los cuadros. Vive en un store (no en un componente) para que
// el globo HTML de hoy y un panel 3D mañana (VR) lean lo mismo: `line` es lo que Aris dice ahora.
// El globo es el existente de Aris (`arisMessage`); la voz sale por el narrador solo si está activo (N).

export type GuideLine = { kind: 'intro' | 'piece'; id: string; text: string }

/** `prop:N` = prop rotulado N del diorama activo (dioramas de foto, sin pieza enlazada). */
export const propGuideId = (index: number) => `prop:${index}`

type GuideState = {
  line: GuideLine | null
  /** Prop rotulado que se mira ahora (lo escribe el runtime del diorama). */
  focusedProp: string | null
}

export const useGuideStore = create<GuideState>(() => ({ line: null, focusedProp: null }))

/** Tiempo que la mirada debe quedarse en un concepto antes de que Aris hable (evita parloteo al barrer la vista). */
export const DWELL_MS = 650

const visit = createVisitTracker()
let busyUntil = 0
let timer: ReturnType<typeof setTimeout> | null = null
let wanted: string | null = null
let spoke = false

const now = () => Date.now()

function findPiece(palace: Museum | null, id: string): Piece | undefined {
  return palace?.rooms.flatMap((r) => r.pieces).find((p) => p.id === id)
}

function say(line: GuideLine) {
  const st = useStore.getState()
  // Voz: solo si el narrador está activo, Aris no está silenciada y el navegador puede hablar.
  const voiced = readNarratorOn() && !st.arisMuted && canSpeak()
  useGuideStore.setState({ line })
  busyUntil = now() + speechMs(line.text, voiced)
  st.set({ arisMessage: line.text })
  if (voiced) {
    spoke = true
    speak(line.text)
  }
}

/** Lo que dice Aris al entrar: escena, sala, periodo y conceptos a la vista con su dirección. */
export function composeIntro(): GuideLine | null {
  const ds = useDioramaStore.getState()
  const portal = ds.activeId ? ds.portals[ds.activeId] : undefined
  if (!portal) return null
  const palace = useStore.getState().palace
  const room = palace?.rooms.find((r) => r.id === portal.roomId)
  const model = getDioramaModel(portal.diorama)
  const from = { x: DIORAMA_SPAWN.x, z: DIORAMA_SPAWN.z }
  if (portal.diorama.backdrop) {
    // Mundo recreado desde la foto real: se dice de qué imagen sale y qué se ve (rótulos de los props).
    const image = room?.imageSearch ? peekMainImage(room.id, room.imageSearch) : undefined
    const seen: PhotoItem[] = (model.layout.labelled ?? []).map((l) => ({
      label: l.label,
      direction: relativeDirection(DIORAMA_SPAWN.yaw, from, l),
      d: Math.hypot(l.x - from.x, l.z - from.z),
    }))
    seen.sort((a, b) => (a.d ?? 0) - (b.d ?? 0))
    const text = buildPhotoIntro({ imageTitle: image?.title, artist: image?.artist, dioramaTitle: portal.diorama.title, items: seen })
    return { kind: 'intro', id: portal.id, text }
  }
  const items: Array<IntroItem & { d: number }> = []
  const used = new Set<string>()
  for (const l of model.layout.linked) {
    if (used.has(l.pieceId)) continue
    const piece = findPiece(palace, l.pieceId)
    if (!piece) continue
    used.add(l.pieceId)
    items.push({ title: piece.title, direction: relativeDirection(DIORAMA_SPAWN.yaw, from, l), d: Math.hypot(l.x - from.x, l.z - from.z) })
  }
  items.sort((a, b) => a.d - b.d)
  const text = buildIntro({ dioramaTitle: portal.diorama.title, roomTitle: room?.name, period: room?.period, items })
  return { kind: 'intro', id: portal.id, text }
}

/** Lo que dice Aris de un concepto, solo con los datos del museo. */
export function composePiece(id: string): GuideLine | null {
  if (id.startsWith('prop:')) return composeProp(id)
  const piece = findPiece(useStore.getState().palace, id)
  if (!piece) return null
  const wiki = peekWikiInfo(piece.imageSearch)
  if (wiki === undefined) void fetchWikiInfo(piece.imageSearch ?? {}) // para la próxima vez; nunca se espera
  const text = buildPieceNarration({
    title: piece.title,
    text: piece.text,
    sourceLine: piece.source?.line,
    hasSource: !!piece.source,
    unverified: piece.unverified,
    wiki: wiki ? { title: wiki.title, extract: wiki.extract } : null,
  })
  return { kind: 'piece', id, text }
}

/** Prop rotulado de un diorama de foto: su rótulo y, si coincide con un concepto de la sala, sus apuntes y fuente. */
function composeProp(id: string): GuideLine | null {
  const ds = useDioramaStore.getState()
  const portal = ds.activeId ? ds.portals[ds.activeId] : undefined
  const label = portal?.diorama.props[Number(id.slice(5))]?.label?.trim()
  if (!portal || !label) return null
  const room = useStore.getState().palace?.rooms.find((r) => r.id === portal.roomId)
  const piece = room ? matchConcept(label, room.pieces) : undefined
  if (!piece) return { kind: 'piece', id, text: buildPropNarration(label) }
  const wiki = peekWikiInfo(piece.imageSearch)
  const text = buildPropNarration(label, {
    title: piece.title,
    text: piece.text,
    sourceLine: piece.source?.line,
    hasSource: !!piece.source,
    unverified: piece.unverified,
    wiki: wiki ? { title: wiki.title, extract: wiki.extract } : null,
  })
  return { kind: 'piece', id, text }
}

function clearTimer() {
  if (timer) clearTimeout(timer)
  timer = null
}

/** Al terminar de entrar: nueva visita, nada contado todavía, y Aris se presenta. */
export function startGuide() {
  stopGuide()
  const intro = composeIntro()
  if (intro) say(intro)
}

/** Aris mira (o deja de mirar) un concepto: tras un breve instante lo cuenta, una vez por visita. */
export function focusGuide(id: string | null) {
  wanted = id
  clearTimer()
  if (!id || visit.has(id)) return
  const wait = Math.max(DWELL_MS, busyUntil - now())
  timer = setTimeout(() => {
    timer = null
    if (wanted !== id || useDioramaStore.getState().phase !== 'inside') return
    // Con una ficha abierta (E) ya habla el narrador de la ficha: no se pisa.
    if (useStore.getState().openId) return
    if (!visit.claim(id)) return
    const line = composePiece(id)
    if (line) say(line)
  }, wait)
}

/** Tecla G: repite lo del concepto mirado, o la introducción si no se mira ninguno. */
export function repeatGuide() {
  if (useDioramaStore.getState().phase !== 'inside') return
  clearTimer()
  const id = useStore.getState().focusedId ?? useGuideStore.getState().focusedProp
  const line = (id && composePiece(id)) || composeIntro()
  if (line) {
    if (line.kind === 'piece') visit.claim(line.id)
    say(line)
  }
}

/** Al salir (o cambiar de palacio): calla, cierra su globo y olvida lo contado. */
export function stopGuide() {
  clearTimer()
  wanted = null
  busyUntil = 0
  const mine = useGuideStore.getState().line
  if (spoke) stopSpeaking()
  spoke = false
  if (mine && useStore.getState().arisMessage === mine.text) useStore.getState().set({ arisMessage: null })
  useGuideStore.setState({ line: null, focusedProp: null })
  visit.reset()
}
