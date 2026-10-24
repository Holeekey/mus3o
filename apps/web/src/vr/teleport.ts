// Teletransporte: validación del destino contra los colliders del palacio (los mismos que usa Player).
import { moveWithCollisions, roomAt, type Box, type PalaceLayout } from '../palace/layout'

export type XZ = { x: number; z: number }

/** Colliders vigentes: muros + compuertas aún cerradas (igual que Player). */
export function activeColliders(layout: PalaceLayout, isOpen: (doorId: string) => boolean): Box[] {
  const doors = (layout.doors ?? []).filter((d) => !isOpen(d.id)).map((d) => ({ x: d.x, z: d.z, w: d.w, d: d.d, h: 4 }))
  return [...layout.colliders, ...doors]
}

const inBox = (b: Box, x: number, z: number) => Math.abs(x - b.x) <= b.w / 2 && Math.abs(z - b.z) <= b.d / 2

/** ¿Hay suelo ahí? Dentro de una sala o de un pasillo. */
export function isWalkable(layout: PalaceLayout, x: number, z: number): boolean {
  return !!roomAt(layout, x, z) || layout.corridors.some((c) => inBox(c.floor, x, z))
}

/** ¿El punto choca con un collider? Usa el mismo moveWithCollisions: si no puede avanzar ni 1 mm, está bloqueado. */
export function pointBlocked(colliders: readonly Box[], x: number, z: number): boolean {
  const r = moveWithCollisions(colliders as Box[], x, z, 1e-3, 1e-3)
  return r.x === x && r.z === z
}

export type TeleportCheck = { ok: true; x: number; z: number } | { ok: false; reason: 'far' | 'void' | 'blocked' | 'near' }

export type TeleportOptions = {
  maxDist?: number
  minDist?: number
  /** Comprobar también que ningún muro cruza el trayecto (suelo). Para saltos por puerta se desactiva. */
  checkPath?: boolean
}

/**
 * Valida un destino: alcance, suelo existente, sin colliders en el punto y, si se pide, sin muros en el trayecto
 * (se camina el segmento en pasos de 25 cm con las mismas colisiones que el movimiento normal).
 */
export function validateTeleport(layout: PalaceLayout, colliders: readonly Box[], from: XZ, to: XZ, opts: TeleportOptions = {}): TeleportCheck {
  const { maxDist = 12, minDist = 0.6, checkPath = true } = opts
  const dist = Math.hypot(to.x - from.x, to.z - from.z)
  if (dist > maxDist) return { ok: false, reason: 'far' }
  if (dist < minDist) return { ok: false, reason: 'near' }
  if (!isWalkable(layout, to.x, to.z)) return { ok: false, reason: 'void' }
  if (pointBlocked(colliders, to.x, to.z)) return { ok: false, reason: 'blocked' }
  if (checkPath) {
    const steps = Math.ceil(dist / 0.25)
    let cx = from.x
    let cz = from.z
    const sx = (to.x - from.x) / steps
    const sz = (to.z - from.z) / steps
    for (let i = 0; i < steps; i++) {
      const n = moveWithCollisions(colliders as Box[], cx, cz, sx, sz)
      if (Math.abs(n.x - (cx + sx)) > 1e-6 || Math.abs(n.z - (cz + sz)) > 1e-6) return { ok: false, reason: 'blocked' }
      cx = n.x
      cz = n.z
    }
  }
  return { ok: true, x: to.x, z: to.z }
}

export type CorridorEnd = {
  /** Índice del pasillo y extremo (0 = el de menor coordenada). */
  corridor: number
  end: 0 | 1
  /** Centro de la boca del pasillo. */
  x: number
  z: number
  /** Eje del pasillo apuntando hacia dentro. */
  dirX: number
  dirZ: number
  /** Ancho de la boca. */
  width: number
  /** Destino al otro lado: extremo opuesto + `into` metros dentro de la sala vecina. */
  dest: XZ
}

/** Las dos bocas de cada pasillo con su destino al otro lado. */
export function corridorEnds(layout: PalaceLayout, into = 2.2): CorridorEnd[] {
  const out: CorridorEnd[] = []
  layout.corridors.forEach((c, corridor) => {
    const f = c.floor
    const horizontal = f.w > f.d
    const half = (horizontal ? f.w : f.d) / 2
    const width = horizontal ? f.d : f.w
    for (const end of [0, 1] as const) {
      const s = end === 0 ? -1 : 1 // signo del extremo en el eje
      const x = horizontal ? f.x + s * half : f.x
      const z = horizontal ? f.z : f.z + s * half
      const dirX = horizontal ? -s : 0
      const dirZ = horizontal ? 0 : -s
      out.push({
        corridor,
        end,
        x,
        z,
        dirX,
        dirZ,
        width,
        dest: { x: x + dirX * (2 * half + into), z: z + dirZ * (2 * half + into) },
      })
    }
  })
  return out
}

/**
 * Dónde aterrizar al cruzar un pasillo por su boca: al otro lado, a `into` metros dentro de la sala vecina.
 * Si ahí hay un pedestal o la pieza central, se prueba un poco antes, más adentro o a los lados.
 */
export function doorDestination(layout: PalaceLayout, colliders: readonly Box[], end: CorridorEnd): XZ | null {
  const sideX = -end.dirZ // eje lateral al pasillo
  const sideZ = end.dirX
  const axisLen = Math.hypot(end.dest.x - end.x, end.dest.z - end.z) // 2*half + into
  const base = axisLen - 2.2 // largo del pasillo
  for (const into of [2.2, 1.5, 3.2, 4.2]) {
    for (const lateral of [0, 0.9, -0.9, 1.8, -1.8]) {
      const x = end.x + end.dirX * (base + into) + sideX * lateral
      const z = end.z + end.dirZ * (base + into) + sideZ * lateral
      if (isWalkable(layout, x, z) && !pointBlocked(colliders, x, z)) return { x, z }
    }
  }
  return null
}
