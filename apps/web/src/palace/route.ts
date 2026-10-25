import type { Side } from './layout'

/**
 * Recorrido de estudio de una sala: los tótems siguen el orden del contenido, empiezan junto a la entrada
 * y avanzan en un mismo sentido (método de loci: siempre la misma ruta, en la misma secuencia).
 */

const TAU = Math.PI * 2
// Muestras del desfase dentro de un paso del anillo: basta para alejar los tótems de las puertas.
const SAMPLES = 48

/** Ángulo del anillo (cos → x, sin → z) que apunta a cada pared. */
export function angleOfSide(side: Side): number {
  return { e: 0, s: Math.PI / 2, w: Math.PI, n: -Math.PI / 2 }[side]
}

const gap = (a: number, b: number) => {
  const d = Math.abs((((a - b) % TAU) + TAU) % TAU)
  return Math.min(d, TAU - d)
}

/**
 * Ángulos de los `count` tótems: el primero a menos de un paso de la entrada y los demás en orden. Dentro de ese
 * paso se elige el desfase que más los aleja de las puertas; a igualdad, el más cercano a la entrada.
 */
export function ringAngles(count: number, entryAngle: number, doorAngles: number[]): number[] {
  const n = Math.max(count, 1)
  const step = TAU / n
  const at = (t: number) => Array.from({ length: n }, (_, k) => entryAngle + (t + k) * step)
  let best = 0.5
  let bestScore = -1
  for (let i = 1; i < SAMPLES; i++) {
    const t = i / SAMPLES
    const score = doorAngles.length ? Math.min(...at(t).flatMap((a) => doorAngles.map((d) => gap(a, d)))) : Math.PI
    if (score > bestScore + 1e-9) {
      best = t
      bestScore = score
    }
  }
  return at(best).slice(0, count)
}

/** Índice del próximo tótem del recorrido: el primero sin memorizar, o null si la sala está completa. */
export function nextStop(ids: string[], memorized: Record<string, unknown>): number | null {
  const k = ids.findIndex((id) => !memorized[id])
  return k === -1 ? null : k
}

/** Número del primer tótem de cada sala: el museo es una sola secuencia (sala 1: 1–3, sala 2: 4–6…). */
export function routeStarts(rooms: { pieces: unknown[] }[]): number[] {
  let next = 1
  return rooms.map((room) => {
    const first = next
    next += room.pieces.length
    return first
  })
}

type RouteRoom = { id: string; index: number; title: string; firstOrder: number; pedestals: { concept: { id: string; title: string } }[] }
/** Próximo tótem del recorrido. `room` solo aparece cuando hay que pasar a otra sala (la actual ya está completa). */
export type RouteNext = { number: number; title: string; fresh: boolean; room?: string }

/**
 * Siguiente paso de estudio desde la sala actual: su primer tótem sin memorizar; si ya está completa, el primero
 * pendiente del museo en el orden de las salas. `fresh`: la sala no se empezó y toca su primer tótem.
 */
export function routeNext(rooms: RouteRoom[], currentRoomId: string | null, memorized: Record<string, unknown>): RouteNext | null {
  const ids = (r: RouteRoom) => r.pedestals.map((p) => p.concept.id)
  const here = rooms.find((r) => r.id === currentRoomId)
  if (here) {
    const k = nextStop(ids(here), memorized)
    if (k !== null) {
      const fresh = k === 0 && ids(here).every((id) => !memorized[id])
      return { number: here.firstOrder + k, title: here.pedestals[k].concept.title, fresh }
    }
  }
  for (const r of [...rooms].sort((a, b) => a.index - b.index)) {
    const k = nextStop(ids(r), memorized)
    if (k !== null) return { number: r.firstOrder + k, title: r.pedestals[k].concept.title, fresh: false, room: r.title }
  }
  return null
}

/** Aviso del recorrido: empezar la sala, seguir con el siguiente, o pasar a la próxima sala. */
export function routeHintText(next: RouteNext): string {
  if (next.room) return `Sala completa → sigue en «${next.room}»: ${next.number} · ${next.title}`
  return next.fresh ? `Empieza por el ${next.number} · ${next.title}` : `Siguiente: ${next.number} · ${next.title}`
}
