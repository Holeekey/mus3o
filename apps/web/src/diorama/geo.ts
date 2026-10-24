import * as THREE from 'three'

// Constructor de geometría para props: junta primitivas transformadas en UNA sola
// BufferGeometry no indexada, con color por vértice y pesos de viento (aWind).
// Un prop entero = un draw call, y con InstancedMesh un pelotón entero también.

export type Wind = (x: number, y: number, z: number) => [number, number]

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}

const _tmp = new THREE.Color()
export const rgb = (hex: string) => new THREE.Color(hex)
export const mixHex = (a: string, b: string, t: number) => '#' + _tmp.set(a).lerp(new THREE.Color(b), t).getHexString()
export const darken = (hex: string, f: number) => mixHex(hex, '#000000', f)
export const lighten = (hex: string, f: number) => mixHex(hex, '#ffffff', f)

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()

/** Matriz desde posición, rotación XYZ (rad) y escala. */
export function mat(px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx): THREE.Matrix4 {
  _e.set(rx, ry, rz, 'YXZ')
  _q.setFromEuler(_e)
  _p.set(px, py, pz)
  _s.set(sx, sy, sz)
  return new THREE.Matrix4().compose(_p, _q, _s)
}

// Hash determinista barato para variar el tono de cada cara.
function hash3(x: number, y: number, z: number) {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
  return n - Math.floor(n)
}

const geoCache = new Map<string, THREE.BufferGeometry>()
function cached(key: string, make: () => THREE.BufferGeometry) {
  let g = geoCache.get(key)
  if (!g) {
    g = make()
    geoCache.set(key, g)
  }
  return g
}

export type AddOpts = {
  /** Color del primitivo (hex). */
  color: string
  /** Variación de tono por cara, 0–0.1. */
  jitter?: number
  wind?: Wind
  /** Añade también las caras reversas (telas). */
  double?: boolean
}

const flatCache = new WeakMap<THREE.BufferGeometry, Float32Array>()
/** Posiciones no indexadas de una geometría, cacheadas (las primitivas se reutilizan mucho). */
function flatPositions(geo: THREE.BufferGeometry): Float32Array {
  let a = flatCache.get(geo)
  if (!a) {
    const g = geo.index ? geo.toNonIndexed() : geo
    a = new Float32Array(g.getAttribute('position').array)
    flatCache.set(geo, a)
    if (g !== geo) g.dispose()
  }
  return a
}

const colorCache = new Map<string, THREE.Color>()
function colorOf(hex: string) {
  let c = colorCache.get(hex)
  if (!c) {
    c = new THREE.Color(hex)
    colorCache.set(hex, c)
  }
  return c
}

export class Builder {
  private pos: number[] = []
  private col: number[] = []
  private wind: number[] = []

  /** Añade una geometría ya hecha, transformada por `m`. */
  add(geo: THREE.BufferGeometry, m: THREE.Matrix4, o: AddOpts) {
    // Las geometrías cacheadas se aplanan una sola vez; las sueltas (extrusiones, lathe) también se leen aquí.
    const src = flatPositions(geo)
    const e = m.elements
    const base = colorOf(o.color)
    const jit = o.jitter ?? 0.035
    const n = src.length
    const tx = new Float32Array(9)
    const w2 = [0, 0]
    for (let i = 0; i < n; i += 9) {
      let cx = 0
      let cy = 0
      let cz = 0
      for (let k = 0; k < 3; k++) {
        const x = src[i + k * 3]
        const y = src[i + k * 3 + 1]
        const z = src[i + k * 3 + 2]
        const X = e[0] * x + e[4] * y + e[8] * z + e[12]
        const Y = e[1] * x + e[5] * y + e[9] * z + e[13]
        const Z = e[2] * x + e[6] * y + e[10] * z + e[14]
        tx[k * 3] = X
        tx[k * 3 + 1] = Y
        tx[k * 3 + 2] = Z
        cx += X
        cy += Y
        cz += Z
      }
      const f = 1 + (hash3((cx / 3) * 9.1, (cy / 3) * 7.3, (cz / 3) * 5.7) - 0.5) * 2 * jit
      const r = Math.min(1, base.r * f)
      const gC = Math.min(1, base.g * f)
      const bC = Math.min(1, base.b * f)
      const emit = (flip: boolean) => {
        for (let k = 0; k < 3; k++) {
          const kk = flip ? (k === 0 ? 0 : k === 1 ? 2 : 1) : k
          const X = tx[kk * 3]
          const Y = tx[kk * 3 + 1]
          const Z = tx[kk * 3 + 2]
          this.pos.push(X, Y, Z)
          this.col.push(r, gC, bC)
          if (o.wind) {
            const w = o.wind(X, Y, Z)
            this.wind.push(w[0], w[1])
          } else this.wind.push(w2[0], w2[1])
        }
      }
      emit(false)
      if (o.double) emit(true)
    }
    return this
  }

  box(w: number, h: number, d: number, m: THREE.Matrix4, o: AddOpts) {
    return this.add(cached('box', () => new THREE.BoxGeometry(1, 1, 1)), mScale(m, w, h, d), o)
  }
  /** Cilindro/tronco de cono: radio superior, inferior, alto, lados. */
  cyl(rt: number, rb: number, h: number, seg: number, m: THREE.Matrix4, o: AddOpts) {
    const key = `cyl${seg}_${rt.toFixed(3)}_${rb.toFixed(3)}_${h.toFixed(3)}`
    return this.add(cached(key, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1)), m, o)
  }
  sph(r: number, m: THREE.Matrix4, o: AddOpts, ws = 7, hs = 5) {
    return this.add(cached(`sph${ws}x${hs}`, () => new THREE.SphereGeometry(1, ws, hs)), mScale(m, r, r, r), o)
  }
  /** Esfera achatada/estirada (elipsoide). */
  ell(rx: number, ry: number, rz: number, m: THREE.Matrix4, o: AddOpts, ws = 7, hs = 5) {
    return this.add(cached(`sph${ws}x${hs}`, () => new THREE.SphereGeometry(1, ws, hs)), mScale(m, rx, ry, rz), o)
  }
  ico(r: number, m: THREE.Matrix4, o: AddOpts, detail = 0) {
    return this.add(cached(`ico${detail}`, () => new THREE.IcosahedronGeometry(1, detail)), mScale(m, r, r, r), o)
  }
  cone(r: number, h: number, seg: number, m: THREE.Matrix4, o: AddOpts) {
    return this.add(cached(`cone${seg}`, () => new THREE.ConeGeometry(1, 1, seg, 1)), mScale(m, r, h, r), o)
  }
  /** Extremidad entre dos puntos locales: cilindro de radio r1→r2 de a hacia b. */
  limb(a: THREE.Vector3, b: THREE.Vector3, r1: number, r2: number, seg: number, o: AddOpts) {
    const dir = b.clone().sub(a)
    const len = dir.length()
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
    const mid = a.clone().add(b).multiplyScalar(0.5)
    const m = new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1))
    return this.cyl(r2, r1, len, seg, m, o)
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3))
    g.setAttribute('aWind', new THREE.Float32BufferAttribute(this.wind, 2))
    g.computeVertexNormals() // no indexada: normales planas
    g.computeBoundingSphere()
    g.computeBoundingBox()
    return g
  }
}

function mScale(m: THREE.Matrix4, x: number, y: number, z: number) {
  return m.clone().multiply(new THREE.Matrix4().makeScale(x, y, z))
}

// --- Viento ---

/** Balanceo creciente con la altura (árboles, hierba, llamas). */
export const swayAbove = (y0: number, h: number, amp: number): Wind => (_x, y) => [amp * Math.pow(clamp01((y - y0) / h), 1.6), 0]
/** Ondulación de tela creciente con la distancia al asta, a lo largo de +x. */
export const waveAlongX = (x0: number, len: number, amp: number): Wind => (x) => [0, amp * Math.pow(clamp01((x - x0) / len), 0.8)]
