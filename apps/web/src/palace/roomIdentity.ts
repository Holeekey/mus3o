import type { Box } from './layout'

// Identidad visual de cada sala (método de loci: salas que se ven distintas se recuerdan mejor).
// Puro y determinista: el estilo de suelo y la decoración salen del título de la sala y de su geometría,
// nunca de las salas que llegan después. Sin dependencias de three ni de React.

export type FloorStyle = 'checker' | 'radial' | 'hexRings'
export type DecorKind = 'columns' | 'arches' | 'niches'
/** rot: giro en Y. En arcos y nichos el +Z local apunta hacia el interior de la sala. */
export type DecorItem = { x: number; z: number; rot: number }
/** `kind` es null en las salas sin decoración (~25 %). */
export type RoomDecor = { kind: DecorKind | null; items: DecorItem[] }
export type RoomIdentity = { floorStyle: FloorStyle; decorKind: DecorKind | null }

const FLOOR_STYLES: FloorStyle[] = ['checker', 'radial', 'hexRings']
// `null` = sala sin decoración: sale en 1 de cada 4 salas.
const DECOR_OPTIONS: (DecorKind | null)[] = ['columns', 'arches', 'niches', null]

export function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

// Mismo valor de entrada, misma elección; nunca igual a la sala anterior.
function pickDistinct<T>(list: T[], h: number, prev?: T): T {
  const v = list[h % list.length]
  return v === prev ? list[(h + 1) % list.length] : v
}

/** Estilo de suelo y decoración de una sala; distintos de los de la sala anterior (`prev`). */
export function pickIdentity(title: string, prev: RoomIdentity | null): RoomIdentity {
  return {
    floorStyle: pickDistinct(FLOOR_STYLES, hash(title + '#floor'), prev?.floorStyle),
    decorKind: pickDistinct(DECOR_OPTIONS, hash(title + '#decor'), prev ? prev.decorKind : undefined),
  }
}

// Huella en planta (m) de la caja de colisión de cada elemento. Los arcos y nichos van en diagonal en las
// esquinas: la caja alineada a los ejes es algo mayor que la pieza, para no dejar pasar por los costados.
const COLUMN_SIZE = 0.9
const ARCH_SIZE = 1.6
const NICHE_SIZE = 0.9
// Distancia del centro del elemento al eje del muro (el muro mide 0.4: su cara interior está a 0.2).
// Con estas distancias el borde del elemento queda a >= 0.7 m de la cara del muro: un cuadro no se tapa.
const INSET: Record<DecorKind, number> = { columns: 1.4, arches: 1.9, niches: 1.6 }

/** Altura (m) del colisionador de un elemento de decoración. */
const decorHeight = (kind: DecorKind, roomHeight: number) => (kind === 'columns' ? roomHeight : kind === 'arches' ? 3.2 : 2.8)

/** Caja de colisión de un elemento sólido de decoración. */
export function decorBox(kind: DecorKind, it: DecorItem, roomHeight: number): Box {
  const s = kind === 'columns' ? COLUMN_SIZE : kind === 'arches' ? ARCH_SIZE : NICHE_SIZE
  return { x: it.x, z: it.z, w: s, d: s, h: decorHeight(kind, roomHeight) }
}

const overlaps = (a: Box, b: Box, m: number) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 + m && Math.abs(a.z - b.z) < (a.d + b.d) / 2 + m

const CLEARANCE = 0.1 // holgura mínima entre la decoración y cualquier zona reservada

export type DecorInput = { x: number; z: number; w: number; d: number; height: number; kind: DecorKind | null; avoid: Box[] }

/**
 * Decoración de una sala: un elemento por esquina (columnas rectas; arcos y nichos girados hacia el centro).
 * Depende solo de la sala y de las zonas reservadas `avoid` (puertas, cuadros, pedestales, pieza central, punto de
 * entrada): si una puerta nueva cae sobre un elemento, desaparece ese y no se mueve ningún otro.
 */
export function buildDecor(r: DecorInput): RoomDecor {
  if (!r.kind) return { kind: null, items: [] }
  const items: DecorItem[] = []
  for (const sz of [-1, 1])
    for (const sx of [-1, 1]) {
      const inset = INSET[r.kind]
      const it: DecorItem = {
        x: r.x + sx * (r.w / 2 - inset),
        z: r.z + sz * (r.d / 2 - inset),
        rot: r.kind === 'columns' ? 0 : Math.atan2(-sx, -sz),
      }
      const box = decorBox(r.kind, it, r.height)
      if (!r.avoid.some((o) => overlaps(box, o, CLEARANCE))) items.push(it)
    }
  return { kind: r.kind, items }
}
