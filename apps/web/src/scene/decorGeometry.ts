import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Matrix4, TorusGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { DecorItem, DecorKind, RoomDecor } from '../palace/roomIdentity'

// Geometría de la decoración de una sala, fundida en una sola malla con color por vértice (una draw call por sala).
// Yeso en los cuerpos y moldura en los remates, como el resto del Teatro. Coordenadas de mundo.

export type DecorColors = { plaster: string; trim: string; recess: string }

type Part = { geo: BufferGeometry; color: Color }

const place = (geo: BufferGeometry, color: Color, x: number, y: number, z: number, rot: number, depthScale = 1): Part => {
  const m = new Matrix4().makeRotationY(rot).setPosition(x, y, z)
  if (depthScale !== 1) m.multiply(new Matrix4().makeScale(1, 1, depthScale))
  return { geo: geo.applyMatrix4(m), color }
}

// Posición en mundo de un punto local del elemento (lx a lo largo, lz hacia el interior).
const at = (it: DecorItem, lx: number, lz: number) => ({
  x: it.x + Math.cos(it.rot) * lx + Math.sin(it.rot) * lz,
  z: it.z - Math.sin(it.rot) * lx + Math.cos(it.rot) * lz,
})

const box = (w: number, h: number, d: number) => new BoxGeometry(w, h, d)

function partsOf(kind: DecorKind, it: DecorItem, height: number, c: { plaster: Color; trim: Color; recess: Color }): Part[] {
  const { x, z, rot } = it
  switch (kind) {
    case 'columns': {
      const shaftH = height - 0.22 - 0.3
      return [
        place(box(0.84, 0.22, 0.84), c.trim, x, 0.11, z, 0),
        place(new CylinderGeometry(0.34, 0.38, shaftH, 8), c.plaster, x, 0.22 + shaftH / 2, z, 0),
        place(box(0.84, 0.3, 0.84), c.trim, x, height - 0.15, z, 0),
      ]
    }
    case 'arches': {
      const parts: Part[] = []
      for (const lx of [-0.8, 0.8]) {
        const p = at(it, lx, 0)
        parts.push(place(box(0.3, 2.8, 0.5), c.plaster, p.x, 1.4, p.z, rot))
        parts.push(place(box(0.4, 0.14, 0.6), c.trim, p.x, 2.87, p.z, rot))
      }
      // Arco de medio punto (aro de moldura) sobre un fondo hundido.
      parts.push(place(new TorusGeometry(0.8, 0.07, 5, 10, Math.PI), c.trim, x, 2.8, z, rot, 3.5))
      const back = at(it, 0, -0.18)
      parts.push(place(box(1.6, 2.8, 0.05), c.recess, back.x, 1.4, back.z, rot))
      return parts
    }
    case 'niches': {
      // Zócalo de yeso y marco de moldura con el hueco hundido por delante.
      const base = at(it, 0, 0)
      const inner = at(it, 0, 0.09)
      return [
        place(box(0.9, 0.35, 0.45), c.plaster, base.x, 0.175, base.z, rot),
        place(box(1.1, 2.4, 0.14), c.trim, x, 0.35 + 1.2, z, rot),
        place(box(0.84, 2.1, 0.05), c.recess, inner.x, 0.35 + 1.2, inner.z, rot),
      ]
    }
  }
}

/** Una malla con todos los elementos de la decoración, o null si la sala no tiene. Quien la crea debe liberarla. */
export function buildDecorGeometry(decor: RoomDecor, height: number, colors: DecorColors): BufferGeometry | null {
  const kind = decor.kind
  if (!kind || decor.items.length === 0) return null
  const c = { plaster: new Color(colors.plaster), trim: new Color(colors.trim), recess: new Color(colors.recess) }
  const geos = decor.items
    .flatMap((it) => partsOf(kind, it, height, c))
    .map(({ geo, color }) => {
      const g = geo.index ? geo.toNonIndexed() : geo
      g.deleteAttribute('uv')
      const n = g.getAttribute('position').count
      const col = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) color.toArray(col, i * 3)
      g.setAttribute('color', new Float32BufferAttribute(col, 3))
      return g
    })
  const merged = mergeGeometries(geos, false)
  for (const g of geos) g.dispose()
  merged?.computeBoundingSphere()
  return merged
}
