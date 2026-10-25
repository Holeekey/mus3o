// Selección del objetivo mirado: rayo desde la cabeza contra esferas, rectángulos y el suelo.
// Geometría analítica (sin raycast de three): barata y probable. Todo en metros.

export type V3 = readonly [number, number, number]
export type Ray = { o: V3; d: V3 } // d normalizado

export type Shape =
  | { type: 'sphere'; c: V3; r: number }
  /** Rectángulo orientado: centro, ejes unitarios `right` y `up`, semiancho y semialto. Visible por ambas caras. */
  | { type: 'quad'; c: V3; right: V3; up: V3; hw: number; hh: number }

/** ui = botones del panel; blocker = el cuerpo del panel (tapa lo que hay detrás, no hace nada). */
export type GazeKind = 'ui' | 'exit' | 'pedestal' | 'portal' | 'door' | 'blocker' | 'floor'

/** Menor número = gana un empate de distancia. */
export const KIND_RANK: Record<GazeKind, number> = { ui: 0, exit: 0, pedestal: 1, portal: 1, door: 2, blocker: 3, floor: 9 }

export type GazeCandidate = {
  key: string
  kind: GazeKind
  shape: Shape
  /** Más lejos que esto no se puede mirar. */
  maxDist: number
  /** Cuánto puede estar un muro por delante y aun así contar (puertas pegadas a su collider). */
  occludeTol?: number
  /** Datos que la acción necesita (id de concepto, destino...). */
  data?: Record<string, unknown>
}

export type GazeHit = { cand: GazeCandidate; t: number; point: V3 }

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const at = (r: Ray, t: number): V3 => [r.o[0] + r.d[0] * t, r.o[1] + r.d[1] * t, r.o[2] + r.d[2] * t]

/** Distancia a la que el rayo entra en la esfera, o null. */
export function raySphere(r: Ray, c: V3, rad: number): number | null {
  const oc = sub(r.o, c)
  const b = dot(oc, r.d)
  const cc = dot(oc, oc) - rad * rad
  const disc = b * b - cc
  if (disc < 0) return null
  const s = Math.sqrt(disc)
  const t = -b - s
  if (t >= 0) return t
  const t2 = -b + s // origen dentro de la esfera
  return t2 >= 0 ? t2 : null
}

export function rayQuad(r: Ray, q: Extract<Shape, { type: 'quad' }>): number | null {
  const n = cross(q.right, q.up)
  const denom = dot(r.d, n)
  if (Math.abs(denom) < 1e-6) return null
  const t = dot(sub(q.c, r.o), n) / denom
  if (t < 0) return null
  const rel = sub(at(r, t), q.c)
  return Math.abs(dot(rel, q.right)) <= q.hw && Math.abs(dot(rel, q.up)) <= q.hh ? t : null
}

/** Distancia al suelo (plano y = 0), o null si se mira hacia arriba. */
export function rayFloor(r: Ray): number | null {
  if (r.d[1] >= -1e-4) return null
  const t = -r.o[1] / r.d[1]
  return t > 0 ? t : null
}

type BoxLike = { x: number; z: number; w: number; d: number; h: number; y?: number }

/** Caja alineada a los ejes (planta x,z y altura h): distancia de entrada del rayo, o null. */
export function rayBox(r: Ray, b: BoxLike): number | null {
  const y0 = b.y ?? 0
  const min: V3 = [b.x - b.w / 2, y0, b.z - b.d / 2]
  const max: V3 = [b.x + b.w / 2, y0 + b.h, b.z + b.d / 2]
  let t0 = 0
  let t1 = Infinity
  for (let i = 0; i < 3; i++) {
    const o = r.o[i]
    const d = r.d[i]
    if (Math.abs(d) < 1e-9) {
      if (o < min[i] || o > max[i]) return null
      continue
    }
    let a = (min[i] - o) / d
    let c = (max[i] - o) / d
    if (a > c) [a, c] = [c, a]
    t0 = Math.max(t0, a)
    t1 = Math.min(t1, c)
    if (t0 > t1) return null
  }
  return t0
}

export function rayShape(r: Ray, s: Shape): number | null {
  return s.type === 'sphere' ? raySphere(r, s.c, s.r) : rayQuad(r, s)
}

/** Distancia al primer muro que tapa el rayo, o Infinity. */
export function occluderDistance(r: Ray, boxes: readonly BoxLike[]): number {
  let best = Infinity
  for (const b of boxes) {
    const t = rayBox(r, b)
    if (t !== null && t < best) best = t
  }
  return best
}

export type PickOptions = {
  /** Distancia al primer muro (ver occluderDistance). Por defecto nada tapa. */
  wallDistance?: number
  /** Alcance del suelo. */
  floorMax?: number
  /** Más cerca que esto el suelo no es objetivo (mirarse los pies). */
  floorMin?: number
}

/**
 * Elige el objetivo mirado.
 * 1. Ignora lo fuera de alcance y lo tapado por un muro.
 * 2. Gana el más cercano; en empate (±2 cm) manda KIND_RANK. Un panel delante tapa lo que tiene detrás.
 * 3. El suelo solo cuenta si ningún otro objetivo está antes que él.
 */
export function pickGazeTarget(ray: Ray, cands: readonly GazeCandidate[], opts: PickOptions = {}): GazeHit | null {
  const wall = opts.wallDistance ?? Infinity
  let best: GazeHit | null = null
  for (const cand of cands) {
    if (cand.kind === 'floor') continue
    const t = rayShape(ray, cand.shape)
    if (t === null || t > cand.maxDist) continue
    if (t > wall + (cand.occludeTol ?? 0.15)) continue
    if (!best || t < best.t - 0.02 || (Math.abs(t - best.t) <= 0.02 && KIND_RANK[cand.kind] < KIND_RANK[best.cand.kind])) {
      best = { cand, t, point: at(ray, t) }
    }
  }
  const tf = rayFloor(ray)
  const fmax = opts.floorMax ?? 10
  const fmin = opts.floorMin ?? 1
  if (tf !== null && tf <= fmax && tf >= fmin && tf < wall - 0.05 && (!best || tf < best.t)) {
    const point = at(ray, tf)
    return { cand: { key: 'floor', kind: 'floor', shape: { type: 'sphere', c: point, r: 0 }, maxDist: fmax, data: {} }, t: tf, point }
  }
  return best
}
