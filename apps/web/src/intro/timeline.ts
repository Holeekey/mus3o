import { roomAt, type PalaceLayout } from '../palace/layout'

/**
 * "El palacio se levanta": línea de tiempo pura y determinista de la entrada al palacio.
 * Fases: construcción (BUILD_START..BUILD_END, con la cámara aérea) y descenso (hasta TOTAL).
 */
export const AERIAL_END = 1.2
export const BUILD_START = 0.4
export const BUILD_END = 4.6
export const DESCENT_START = BUILD_END
export const DESCENT_END = 6.1
export const TOTAL = DESCENT_END
const ROOM_DUR_MAX = 1.6

export type Span = { start: number; end: number }

export const floorKey = (roomId: string) => `floor:${roomId}`
export const wallsKey = (roomId: string) => `walls:${roomId}`
export const monumentKey = (roomId: string) => `monument:${roomId}`
export const paintingsKey = (roomId: string) => `paintings:${roomId}`
export const pedestalKey = (conceptId: string) => `pedestal:${conceptId}`
export const objectKey = (conceptId: string) => `object:${conceptId}`
export const corridorKey = (index: number) => `corridor:${index}`
export const titleKey = (roomId: string) => `title:${roomId}`

export type IntroTimeline = {
  /** Salas en el orden en que se levantan (recorrido en anchura desde la sala de inicio). */
  order: string[]
  spans: Record<string, Span>
  total: number
  descentStart: number
}

/** Salas vecinas: las que tocan los extremos de un pasillo. */
function corridorRooms(layout: PalaceLayout, index: number): string[] {
  const f = layout.corridors[index].floor
  const horizontal = f.w > f.d
  const ends = horizontal
    ? [[f.x - f.w / 2 - 0.3, f.z], [f.x + f.w / 2 + 0.3, f.z]]
    : [[f.x, f.z - f.d / 2 - 0.3], [f.x, f.z + f.d / 2 + 0.3]]
  const ids: string[] = []
  for (const [x, z] of ends) {
    const r = roomAt(layout, x, z)
    if (r && !ids.includes(r.id)) ids.push(r.id)
  }
  return ids
}

export function introTimeline(layout: PalaceLayout): IntroTimeline {
  const rooms = layout.rooms
  const n = rooms.length
  const spans: Record<string, Span> = {}
  if (n === 0) return { order: [], spans, total: TOTAL, descentStart: DESCENT_START }

  // Grafo de salas por pasillos.
  const adj = new Map<string, Set<string>>()
  for (const r of rooms) adj.set(r.id, new Set())
  const corrRooms = layout.corridors.map((_, i) => corridorRooms(layout, i))
  for (const ids of corrRooms) {
    if (ids.length === 2) {
      adj.get(ids[0])?.add(ids[1])
      adj.get(ids[1])?.add(ids[0])
    }
  }
  const idx = new Map(rooms.map((r) => [r.id, r.index]))
  const start = roomAt(layout, layout.spawn.x, layout.spawn.z) ?? rooms[0]
  const order: string[] = []
  const seen = new Set<string>()
  const visit = (rootId: string) => {
    const queue = [rootId]
    seen.add(rootId)
    while (queue.length) {
      const id = queue.shift() as string
      order.push(id)
      const next = [...(adj.get(id) ?? [])].filter((x) => !seen.has(x)).sort((a, b) => (idx.get(a) ?? 0) - (idx.get(b) ?? 0))
      for (const x of next) {
        seen.add(x)
        queue.push(x)
      }
    }
  }
  visit(start.id)
  for (const r of [...rooms].sort((a, b) => a.index - b.index)) if (!seen.has(r.id)) visit(r.id)

  const window = BUILD_END - BUILD_START
  const rd = Math.min(ROOM_DUR_MAX, window)
  const step = n > 1 ? (window - rd) / (n - 1) : 0
  const roomStart = new Map<string, number>()
  const span = (t0: number, a: number, b: number): Span => ({ start: t0 + a, end: t0 + b })

  order.forEach((id, k) => {
    const room = rooms.find((r) => r.id === id)
    if (!room) return
    const t0 = BUILD_START + k * step
    roomStart.set(id, t0)
    spans[floorKey(id)] = span(t0, 0, 0.3 * rd)
    spans[wallsKey(id)] = span(t0, 0.1 * rd, 0.55 * rd)
    spans[monumentKey(id)] = span(t0, 0.3 * rd, 0.65 * rd)
    spans[paintingsKey(id)] = span(t0, 0.55 * rd, 0.95 * rd)
    spans[titleKey(id)] = span(t0, 0.1 * rd, Math.min(0.1 * rd + 1.2, rd))
    const m = room.pedestals.length
    const stagger = m > 1 ? (0.3 * rd) / (m - 1) : 0
    room.pedestals.forEach((p, j) => {
      const s = t0 + 0.3 * rd + j * stagger
      spans[pedestalKey(p.concept.id)] = { start: s, end: s + 0.2 * rd }
      spans[objectKey(p.concept.id)] = { start: s + 0.15 * rd, end: s + 0.35 * rd }
    })
  })

  // Un pasillo se levanta cuando su sala de origen ya está de pie y conecta con la siguiente.
  layout.corridors.forEach((_, i) => {
    const ids = corrRooms[i]
    const t0 = Math.min(...ids.map((id) => roomStart.get(id) ?? BUILD_START))
    const s = Math.min(Number.isFinite(t0) ? t0 + 0.6 * rd : BUILD_START, BUILD_END - 0.5)
    spans[corridorKey(i)] = { start: s, end: Math.min(s + 0.5, BUILD_END) }
  })

  return { order, spans, total: TOTAL, descentStart: DESCENT_START }
}

export const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3)

/** Avance 0..1 (con ease-out, sin rebote) de un elemento en el instante t. Lo desconocido está ya levantado. */
export function revealProgress(tl: IntroTimeline | null, key: string, t: number): number {
  if (!tl) return 1
  const s = tl.spans[key]
  if (!s) return 1
  if (t >= s.end) return 1
  if (t <= s.start) return 0
  return easeOutCubic((t - s.start) / (s.end - s.start))
}
