import * as THREE from 'three'
import { Builder } from '../../geo'
import { mulberry32, type Rng } from '../../random'

export const TAU = Math.PI * 2

// --- Latido: ~70 lpm. La misma curva vive en GLSL (material.ts) y aquí (flujo, pruebas). ---
export const BPM = 70
export const BEAT = 60 / BPM
/** Desfase para que, congelado (prefers-reduced-motion), la válvula se vea abierta. */
export const PHASE0 = 0.6
const sstep = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
export const heartPhase = (t: number) => (((t / BEAT + PHASE0) % 1) + 1) % 1
/** 0 = válvula auriculoventricular cerrada (sístole), 1 = abierta (diástole). */
export const valveOpenness = (p: number) => sstep(0.4, 0.55, p) * (1 - sstep(0.8, 1.0, p))
/** Pulso "lub-dub" 0..~1. */
export const thump = (p: number) => {
  const g = (c: number, w: number) => Math.exp(-(((p - c) / w) ** 2))
  return g(0.03, 0.06) + 0.55 * g(0.4, 0.07) + g(1.03, 0.06)
}

// --- Geometría auxiliar ---

/** Voltea el sentido de giro de los triángulos (cara hacia adentro). Devuelve una geometría nueva no indexada. */
export function flip(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo.clone()
  const p = g.getAttribute('position')
  const a = p.array as Float32Array
  for (let i = 0; i < a.length; i += 9) {
    for (let k = 0; k < 3; k++) {
      const t = a[i + 3 + k]
      a[i + 3 + k] = a[i + 6 + k]
      a[i + 6 + k] = t
    }
  }
  p.needsUpdate = true
  return g
}

/** Superficie paramétrica no indexada. Con `inward` invierte el giro. */
export function surface(nu: number, nv: number, f: (u: number, v: number) => [number, number, number], inward = false): THREE.BufferGeometry {
  const pos: number[] = []
  const grid: number[][][] = []
  for (let i = 0; i <= nu; i++) {
    grid.push([])
    for (let j = 0; j <= nv; j++) grid[i].push(f(i / nu, j / nv))
  }
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = grid[i][j]
      const b = grid[i + 1][j]
      const c = grid[i + 1][j + 1]
      const d = grid[i][j + 1]
      if (inward) pos.push(...a, ...c, ...b, ...a, ...d, ...c)
      else pos.push(...a, ...b, ...c, ...a, ...c, ...d)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  return g
}

/** Esfera facetada deformada: `radius(dir)` multiplica el radio unitario en cada dirección. */
export function blob(detail: number, radius: (x: number, y: number, z: number) => number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, detail)
  const p = g.getAttribute('position')
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    const z = p.getZ(i)
    const l = Math.hypot(x, y, z) || 1
    const r = radius(x / l, y / l, z / l)
    p.setXYZ(i, (x / l) * r, (y / l) * r, (z / l) * r)
  }
  return g
}

/** Se queda con los triángulos cuyo centroide cumple `keep`. */
export function carve(geo: THREE.BufferGeometry, keep: (x: number, y: number, z: number) => boolean): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo
  const a = g.getAttribute('position').array as Float32Array
  const out: number[] = []
  for (let i = 0; i < a.length; i += 9) {
    const cx = (a[i] + a[i + 3] + a[i + 6]) / 3
    const cy = (a[i + 1] + a[i + 4] + a[i + 7]) / 3
    const cz = (a[i + 2] + a[i + 5] + a[i + 8]) / 3
    if (keep(cx, cy, cz)) for (let k = 0; k < 9; k++) out.push(a[i + k])
  }
  const r = new THREE.BufferGeometry()
  r.setAttribute('position', new THREE.Float32BufferAttribute(out, 3))
  return r
}

/** Tubo con radio variable a lo largo de una curva. Cara hacia fuera. */
export function tube(curve: THREE.Curve<THREE.Vector3>, radius: (u: number) => number, tub = 24, rad = 6): THREE.BufferGeometry {
  const frames = curve.computeFrenetFrames(tub, false)
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= tub; i++) pts.push(curve.getPointAt(i / tub))
  return surface(
    tub,
    rad,
    (u, v) => {
      const i = Math.round(u * tub)
      const a = v * TAU
      const r = radius(u)
      const n = frames.normals[i]
      const b = frames.binormals[i]
      const p = pts[i]
      return [p.x + (n.x * Math.cos(a) + b.x * Math.sin(a)) * r, p.y + (n.y * Math.cos(a) + b.y * Math.sin(a)) * r, p.z + (n.z * Math.cos(a) + b.z * Math.sin(a)) * r]
    },
    true,
  )
}

/** Perfil de revolución (r, y) alrededor de Y. Recorrido antihorario en (r, y) = caras hacia fuera; con `inward` se invierte. */
export function lathe(profile: [number, number][], seg = 12, inward = false): THREE.BufferGeometry {
  const n = profile.length - 1
  return surface(
    seg,
    n,
    (u, v) => {
      const k = Math.min(n, Math.round(v * n))
      const a = u * TAU
      return [Math.cos(a) * profile[k][0], profile[k][1], -Math.sin(a) * profile[k][0]]
    },
    inward,
  )
}

/** Volumen firmado de una malla cerrada (> 0 = caras hacia fuera). Para pruebas. */
export function signedVolume(geo: THREE.BufferGeometry): number {
  const g = geo.index ? geo.toNonIndexed() : geo
  const a = g.getAttribute('position').array as Float32Array
  let v = 0
  for (let i = 0; i < a.length; i += 9) {
    v += (a[i] * (a[i + 4] * a[i + 8] - a[i + 5] * a[i + 7]) - a[i + 1] * (a[i + 3] * a[i + 8] - a[i + 5] * a[i + 6]) + a[i + 2] * (a[i + 3] * a[i + 7] - a[i + 4] * a[i + 6])) / 6
  }
  return v
}

/** Aleatoriedad por prop, determinista. */
export function rngOf(seed: number, salt = 0): Rng {
  return mulberry32((seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0)
}

export const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

const _up = new THREE.Vector3(0, 1, 0)
/** Matriz que lleva el eje +Y local a `dir`, en `pos`, con escala (sx, sy, sz). */
export function alignY(pos: THREE.Vector3, dir: THREE.Vector3, sx = 1, sy = 1, sz = 1): THREE.Matrix4 {
  const q = new THREE.Quaternion().setFromUnitVectors(_up, dir.clone().normalize())
  return new THREE.Matrix4().compose(pos, q, new THREE.Vector3(sx, sy, sz))
}

export const sstepN = sstep

// --- Fusión de piezas con parámetros de animación por vértice (aAnim) ---

export type AnimTag = [number, number, number, number]

/** Constructor de un prop con una parte estática (`b`) y partes animadas en GPU (`part`). */
export class Kit {
  readonly b = new Builder()
  private animated: { b: Builder; tag: AnimTag }[] = []
  part(tag: AnimTag): Builder {
    const b = new Builder()
    this.animated.push({ b, tag })
    return b
  }
  get shader() {
    return this.animated.length > 0
  }
  build(): THREE.BufferGeometry {
    if (!this.animated.length) return this.b.build()
    return mergeAnimated([{ geo: this.b.build() }, ...this.animated.map((a) => ({ geo: a.b.build(), anim: a.tag }))])
  }
}

/** Junta geometrías con position/color/aWind y les añade `aAnim` (modo, a, b, c). */
export function mergeAnimated(parts: { geo: THREE.BufferGeometry; anim?: AnimTag }[]): THREE.BufferGeometry {
  let total = 0
  for (const p of parts) total += p.geo.getAttribute('position').count
  const pos = new Float32Array(total * 3)
  const col = new Float32Array(total * 3)
  const wind = new Float32Array(total * 2)
  const anim = new Float32Array(total * 4)
  let o = 0
  for (const { geo, anim: tag } of parts) {
    const n = geo.getAttribute('position').count
    pos.set(geo.getAttribute('position').array as Float32Array, o * 3)
    col.set(geo.getAttribute('color').array as Float32Array, o * 3)
    const w = geo.getAttribute('aWind')
    if (w) wind.set(w.array as Float32Array, o * 2)
    if (tag) for (let i = 0; i < n; i++) anim.set(tag, (o + i) * 4)
    o += n
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.setAttribute('aWind', new THREE.BufferAttribute(wind, 2))
  g.setAttribute('aAnim', new THREE.BufferAttribute(anim, 4))
  g.computeVertexNormals()
  g.computeBoundingSphere()
  g.computeBoundingBox()
  return g
}
