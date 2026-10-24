import { DIORAMA_HALF, type Diorama, type DioramaKind, type DioramaProp } from './dioramaSchema'
import { hashStr, mulberry32 } from './random'
import type { HeightField } from './terrain'
import { variantsFor } from './props'
import { SCIENCE_COLLIDER, SCIENCE_HEIGHT } from './props/science' // science-kit

// Colocación determinista de los props: formaciones para tropas, dispersión para el resto.
// Función pura (sin GL) para poder probarla y para que la escena y el jugador compartan datos.

export type Inst = { x: number; y: number; z: number; rotY: number; scale: number; phase: number; variant: number }
export type Placed = { index: number; prop: DioramaProp; variants: number; instances: Inst[] }
export type Circle = { x: number; z: number; r: number }
export type Linked = { pieceId: string; label: string; x: number; y: number; z: number; labelY: number; propIndex: number }
export type DioramaLayout = { placed: Placed[]; colliders: Circle[]; linked: Linked[] }

const COLLIDER: Partial<Record<DioramaKind, number>> = {
  tree: 0.4, rock: 0.75, cannon: 1.0, tent: 1.8, house: 3.3, church: 5, ship: 2.4, column: 0.6, campfire: 0.75, custom: 0.6, flag: 0.15,
  ...SCIENCE_COLLIDER, // science-kit
}
export const HEIGHT: Record<DioramaKind, number> = {
  figure: 1.9, rider: 2.9, horse: 2.1, flag: 4.0, cannon: 1.5, tree: 5.5, rock: 1, tent: 2.4, house: 4.5, church: 11, ship: 9, column: 4.5, arch: 7, campfire: 1.4, custom: 2,
  ...SCIENCE_HEIGHT, // science-kit
}
const TROOP: DioramaKind[] = ['figure', 'rider', 'horse']

const clampHalf = (v: number) => Math.max(-DIORAMA_HALF, Math.min(DIORAMA_HALF, v))

export function layoutDiorama(d: Diorama, field: HeightField): DioramaLayout {
  const placed: Placed[] = []
  const colliders: Circle[] = []
  const linked: Linked[] = []

  d.props.forEach((prop, index) => {
    const rnd = mulberry32(hashStr(`${d.title}|${index}|${prop.kind}`))
    const [cx, cz] = prop.pos
    const n = prop.count
    const s = prop.scale
    const variants = variantsFor(prop.kind, n)
    const spots: Array<{ x: number; z: number; rot: number }> = []

    if (n === 1) {
      spots.push({ x: cx, z: cz, rot: prop.rotY })
    } else if (TROOP.includes(prop.kind)) {
      // Formación en filas, mirando hacia rotY.
      const cols = Math.max(1, Math.min(n, Math.ceil(Math.sqrt(n * 2.2))))
      const rows = Math.ceil(n / cols)
      const base = (prop.kind === 'figure' ? 1.05 : 1.9) * s
      const sx = Math.max(base, (prop.spread * 2) / Math.max(cols, 1))
      const sz = sx * (prop.kind === 'figure' ? 1.1 : 1.35)
      const cr = Math.cos(prop.rotY)
      const sr = Math.sin(prop.rotY)
      for (let i = 0; i < n; i++) {
        const row = Math.floor(i / cols)
        const col = i % cols
        const inRow = row === rows - 1 ? n - row * cols : cols
        const lx = (col - (inRow - 1) / 2) * sx + (rnd() - 0.5) * sx * 0.18
        const lz = -(row - (rows - 1) / 2) * sz + (rnd() - 0.5) * sz * 0.18
        spots.push({
          x: clampHalf(cx + lx * cr + lz * sr),
          z: clampHalf(cz - lx * sr + lz * cr),
          rot: prop.pose === 'fallen' ? rnd() * Math.PI * 2 : prop.rotY + (rnd() - 0.5) * 0.12,
        })
      }
    } else {
      // Dispersión con separación mínima (dardos).
      const radius = prop.spread > 0 ? prop.spread : 2.5 + Math.sqrt(n) * 0.9
      const minD = Math.max(0.9, (COLLIDER[prop.kind] ?? 0.8) * 2.2 * s)
      for (let i = 0; i < n; i++) {
        let best = { x: cx, z: cz }
        for (let tries = 0; tries < 14; tries++) {
          const a = rnd() * Math.PI * 2
          const r = Math.sqrt(rnd()) * radius
          const x = clampHalf(cx + Math.cos(a) * r)
          const z = clampHalf(cz + Math.sin(a) * r)
          best = { x, z }
          if (spots.every((p) => Math.hypot(p.x - x, p.z - z) >= minD)) break
        }
        spots.push({ ...best, rot: rnd() * Math.PI * 2 })
      }
    }

    const instances: Inst[] = spots.map((p, i) => {
      const ground = field.heightAt(p.x, p.z)
      const y = (prop.kind === 'ship' ? (field.waterLevel ?? 0) : ground) + prop.y // science-kit: prop.y = elevación
      return { x: p.x, y, z: p.z, rotY: p.rot, scale: s * (n > 1 && !TROOP.includes(prop.kind) ? 0.85 + rnd() * 0.3 : 1), phase: rnd() * Math.PI * 2, variant: i % variants }
    })
    placed.push({ index, prop, variants, instances })

    const r = COLLIDER[prop.kind]
    if (r) for (const i of instances) colliders.push({ x: i.x, z: i.z, r: r * i.scale })
    if (prop.kind === 'arch') {
      for (const i of instances) {
        for (const side of [-1, 1]) {
          colliders.push({ x: i.x + Math.cos(i.rotY) * 2.4 * side * i.scale, z: i.z - Math.sin(i.rotY) * 2.4 * side * i.scale, r: 0.65 * i.scale })
        }
      }
    }
    if (prop.pieceId && instances[0]) {
      const i = instances[0]
      const h = (prop.pose === 'fallen' ? 0.6 : HEIGHT[prop.kind]) * i.scale
      linked.push({ pieceId: prop.pieceId, label: prop.label ?? '', x: i.x, y: i.y, z: i.z, labelY: i.y + h + 0.45, propIndex: index })
    }
  })
  return { placed, colliders, linked }
}
