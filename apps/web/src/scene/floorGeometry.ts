import { BufferGeometry, Color, Float32BufferAttribute } from 'three'
import { hash, type FloorStyle } from '../palace/layout'

// Suelos procedurales del Teatro: una sola BufferGeometry con color por vértice por sala (una draw call).
// Todo sale del título de la sala y de su tamaño; nada aleatorio al render. Coordenadas locales (centro de la sala).
// Los colores derivan del pigmento del suelo y de la moldura de la sala: contraste suave, sin neón.

export type FloorColors = { floor: string; trim: string }

type V = [number, number, number]

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

class Soup {
  pos: number[] = []
  col: number[] = []
  // Triángulo con la normal hacia +Y, sin importar el orden recibido.
  tri(a: V, b: V, c: V, color: Color) {
    const up = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]) > 0
    for (const v of up ? [a, b, c] : [a, c, b]) {
      this.pos.push(v[0], v[1], v[2])
      this.col.push(color.r, color.g, color.b)
    }
  }
  quad(a: V, b: V, c: V, d: V, color: Color) {
    this.tri(a, b, c, color)
    this.tri(a, c, d, color)
  }
  geometry() {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new Float32BufferAttribute(this.pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3))
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3))
    return g
  }
}

const hexPoint = (r: number, k: number, y: number): V => {
  const a = (k / 6) * Math.PI * 2
  return [Math.cos(a) * r, y, Math.sin(a) * r]
}

const Y = 0.012 // los dibujos van apenas por encima de la losa base
const YL = Y + 0.004 // y las líneas, sobre ellos

/** Paleta del suelo: losa base (juntas), dos tonos de baldosa y el color de las líneas. */
export function floorTones({ floor, trim }: FloorColors) {
  const f = new Color(floor)
  const t = new Color(trim)
  return {
    base: f.clone().multiplyScalar(0.62),
    a: f.clone().lerp(t, 0.2),
    b: f.clone().multiplyScalar(0.86),
    line: f.clone().lerp(t, 0.55),
  }
}

export function buildFloorGeometry(room: { title: string; w: number; d: number; floorStyle: FloorStyle }, colors: FloorColors): BufferGeometry {
  const rand = rng(hash(room.title + '#floorgeo'))
  const tones = floorTones(colors)
  const hw = room.w / 2 - 0.3
  const hd = room.d / 2 - 0.3
  const s = new Soup()
  // Losa base de toda la sala (sustituye al antiguo bloque liso): el dibujo se apoya encima.
  s.quad([-room.w / 2, 0, -room.d / 2], [room.w / 2, 0, -room.d / 2], [room.w / 2, 0, room.d / 2], [-room.w / 2, 0, room.d / 2], tones.base)

  switch (room.floorStyle) {
    case 'checker': {
      // Mármol de dos tonos con junta fina.
      const nx = Math.max(2, Math.round((hw * 2) / 2))
      const nz = Math.max(2, Math.round((hd * 2) / 2))
      const sx = (hw * 2) / nx
      const sz = (hd * 2) / nz
      const g = 0.04
      for (let j = 0; j < nz; j++)
        for (let i = 0; i < nx; i++) {
          const x0 = -hw + i * sx + g
          const x1 = -hw + (i + 1) * sx - g
          const z0 = -hd + j * sz + g
          const z1 = -hd + (j + 1) * sz - g
          s.quad([x0, Y, z0], [x1, Y, z0], [x1, Y, z1], [x0, Y, z1], (i + j) % 2 === 0 ? tones.a : tones.b)
        }
      break
    }
    case 'hexRings': {
      // Anillos hexagonales concéntricos, con un filete de moldura en el borde interior de cada uno.
      const maxR = Math.min(hw, hd)
      const step = 1.5
      for (let k = 0, r0 = 0.9; r0 + step <= maxR + 0.01; k++, r0 += step) {
        const r1 = r0 + step
        const tone = k % 2 === 0 ? tones.a : tones.b
        if (k === 0) for (let v = 0; v < 6; v++) s.tri([0, Y, 0], hexPoint(r0, v, Y), hexPoint(r0, v + 1, Y), tones.a)
        for (let v = 0; v < 6; v++) {
          s.quad(hexPoint(r0 + 0.1, v, Y), hexPoint(r0 + 0.1, v + 1, Y), hexPoint(r1, v + 1, Y), hexPoint(r1, v, Y), tone)
          s.quad(hexPoint(r0, v, YL), hexPoint(r0, v + 1, YL), hexPoint(r0 + 0.1, v + 1, YL), hexPoint(r0 + 0.1, v, YL), tones.line)
        }
      }
      break
    }
    case 'radial': {
      // Rosetón: sectores alternos que llegan al borde, con un radio fino de moldura en cada uno.
      const n = 14
      const edge = (a: number) => Math.min(hw / Math.max(Math.abs(Math.cos(a)), 1e-4), hd / Math.max(Math.abs(Math.sin(a)), 1e-4))
      const a0 = rand() * 0.4
      for (let k = 0; k < n; k++) {
        const a = a0 + (k / n) * Math.PI * 2
        const b = a0 + ((k + 1) / n) * Math.PI * 2
        const ra = edge(a)
        const rb = edge(b)
        s.tri([0, Y, 0], [Math.cos(a) * ra, Y, Math.sin(a) * ra], [Math.cos(b) * rb, Y, Math.sin(b) * rb], k % 2 === 0 ? tones.a : tones.b)
        const r0 = 1.4
        const r1 = ra - 0.2
        const nxv = -Math.sin(a) * 0.04
        const nzv = Math.cos(a) * 0.04
        s.quad(
          [Math.cos(a) * r0 + nxv, YL, Math.sin(a) * r0 + nzv],
          [Math.cos(a) * r1 + nxv, YL, Math.sin(a) * r1 + nzv],
          [Math.cos(a) * r1 - nxv, YL, Math.sin(a) * r1 - nzv],
          [Math.cos(a) * r0 - nxv, YL, Math.sin(a) * r0 - nzv],
          tones.line,
        )
      }
      break
    }
  }
  const g = s.geometry()
  g.computeBoundingSphere()
  return g
}
