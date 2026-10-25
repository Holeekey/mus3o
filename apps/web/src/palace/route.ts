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
