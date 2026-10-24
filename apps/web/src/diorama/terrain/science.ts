import * as THREE from 'three'
import type { Atmosphere } from '../atmosphere'
import type { Diorama } from '@mus3o/shared'
import { darken, lighten, mixHex, smooth } from '../geo'
import { fbm, hashStr, mulberry32, noise2, range, ridged } from '../random'
import type { HeightField } from '../terrain'

// Entornos de interior para el kit de ciencia. A diferencia de los terrenos de exterior, cada uno
// es una cavidad CERRADA (suelo + paredes + techo en una sola malla facetada), pensada para
// verse tanto desde dentro (a escala real) como a través de la ventana del cuadro.
//   organic  – cámara carnosa (aurícula, estómago...): superelipse con muros que suben y techo bajo
//   cellular – citoplasma: el suelo es el fondo de una membrana esférica enorme con lípidos
//   vessel   – luz de un vaso sanguíneo: tubo grande que serpentea hacia el fondo

export const SCIENCE_TERRAINS = ['organic', 'cellular', 'vessel'] as const
export type ScienceTerrain = (typeof SCIENCE_TERRAINS)[number]
export const isScienceTerrain = (t: string): t is ScienceTerrain => (SCIENCE_TERRAINS as readonly string[]).includes(t)

// --- Geometría de cada entorno (constantes en metros) ---
const ORG = { ax: 15.5, az: 26, z0: -6, wall: 12, ceil: 16 }
const CELL_R = 60
const VES = { r: 22, z0: -95, z1: 42 }

/** Superelipse (p = 4): 0 en el centro, 1 en el borde. */
const orgRho = (x: number, z: number) => Math.pow(Math.pow(Math.abs(x) / ORG.ax, 4) + Math.pow(Math.abs(z - ORG.z0) / ORG.az, 4), 0.25)
const vesselCx = (z: number) => 5 * Math.sin(z * 0.045) + 2 * Math.sin(z * 0.11 + 1)

function organicFloor(x: number, z: number, s: number): number {
  const rho = Math.min(1, orgRho(x, z))
  const rim = 1 - smooth(0.93, 1, rho)
  // crestas verticales en el muro (músculos pectíneos): desplazan el umbral del muro en horizontal
  const th = Math.atan2(z - ORG.z0, x)
  const ridge = 0.035 * Math.sin(th * 17 + fbm(x * 0.1, z * 0.1, s, 2) * 5) * smooth(0.7, 0.9, rho) * (1 - smooth(0.95, 1, rho))
  const wall = ORG.wall * Math.pow(smooth(0.78, 1.0, rho - ridge), 1.5)
  const lumps = (fbm(x * 0.12, z * 0.12, s, 3) - 0.5) * 1.1 * (0.25 + smooth(0.15, 0.8, rho))
  const folds = (ridged(x * 0.19, z * 0.19, s + 3, 3) - 0.35) * 0.9 * smooth(0.35, 0.9, rho)
  return wall + (lumps + folds) * rim
}
function organicCeil(x: number, z: number, s: number): number {
  const rho = Math.min(1, orgRho(x, z))
  const rim = 1 - smooth(0.9, 1, rho)
  const dome = Math.sqrt(Math.max(0, 1 - rho * rho * rho * rho)) * (ORG.ceil - ORG.wall)
  const lumps = (fbm(x * 0.14 + 9, z * 0.14, s + 5, 3) - 0.5) * 2.2 + (ridged(x * 0.16, z * 0.16, s + 8, 3) - 0.4) * 1.6
  return ORG.wall + dome + lumps * rim
}

const cellFloor = (x: number, z: number) => {
  const d = Math.min(Math.hypot(x, z), CELL_R * 0.97)
  return CELL_R - Math.sqrt(CELL_R * CELL_R - d * d)
}

// Células endoteliales del vaso: baldosas con un abultamiento (núcleo) en el centro.
function endo(u: number, z: number, s: number): { edge: number; bump: number; id: number } {
  const N = 14
  const row = Math.floor(z / 4.2)
  const uu = u * N + (row & 1 ? 0.5 : 0)
  const fx = uu - Math.floor(uu)
  const fz = z / 4.2 - row
  const edge = Math.min(fx, 1 - fx, fz, 1 - fz)
  const dx = fx - 0.5
  const dz = fz - 0.5
  const bump = Math.exp(-(dx * dx * 9 + dz * dz * 14))
  return { edge, bump, id: hashStr(`${Math.floor(uu)}|${row}|${s}`) % 997 }
}
function vesselFloor(x: number, z: number, s: number): number {
  const d = Math.max(-VES.r * 0.985, Math.min(VES.r * 0.985, x - vesselCx(z)))
  const base = VES.r - Math.sqrt(VES.r * VES.r - d * d)
  const th = Math.asin(d / VES.r)
  const e = endo((th / (Math.PI * 2) + 1) % 1, z, s)
  return base + e.bump * 0.28
}

export function scienceHeightField(terrain: ScienceTerrain, seed: number): HeightField {
  const s = seed & 0xffff
  const heightAt =
    terrain === 'organic' ? (x: number, z: number) => organicFloor(x, z, s) : terrain === 'cellular' ? cellFloor : (x: number, z: number) => vesselFloor(x, z, s)
  return { heightAt, waterLevel: null, isWater: () => false }
}

// --- Construcción de la malla ---

class Tris {
  pos: number[] = []
  col: number[] = []
  private c = new THREE.Color()
  /** Añade un triángulo; el color se calcula del centroide y la normal. `flipped` invierte el giro. */
  tri(a: number[], b: number[], c: number[], color: (cx: number, cy: number, cz: number, ny: number, nz: number, nx: number) => THREE.Color, flipped = false) {
    const ux = b[0] - a[0]
    const uy = b[1] - a[1]
    const uz = b[2] - a[2]
    const vx = c[0] - a[0]
    const vy = c[1] - a[1]
    const vz = c[2] - a[2]
    let nx = uy * vz - uz * vy
    let ny = uz * vx - ux * vz
    let nz = ux * vy - uy * vx
    const l = Math.hypot(nx, ny, nz)
    if (l < 1e-8) return
    nx /= l
    ny /= l
    nz /= l
    if (flipped) {
      nx = -nx
      ny = -ny
      nz = -nz
    }
    const cx = (a[0] + b[0] + c[0]) / 3
    const cy = (a[1] + b[1] + c[1]) / 3
    const cz = (a[2] + b[2] + c[2]) / 3
    const col = color(cx, cy, cz, ny, nz, nx)
    const order = flipped ? [a, c, b] : [a, b, c]
    for (const p of order) {
      this.pos.push(p[0], p[1], p[2])
      this.col.push(col.r, col.g, col.b)
    }
  }
  grid(nu: number, nv: number, f: (i: number, j: number) => number[], color: Parameters<Tris['tri']>[3], flipped = false) {
    const pts: number[][][] = []
    for (let i = 0; i <= nu; i++) {
      pts.push([])
      for (let j = 0; j <= nv; j++) pts[i].push(f(i, j))
    }
    for (let i = 0; i < nu; i++)
      for (let j = 0; j < nv; j++) {
        this.tri(pts[i][j], pts[i + 1][j], pts[i + 1][j + 1], color, flipped)
        this.tri(pts[i][j], pts[i + 1][j + 1], pts[i][j + 1], color, flipped)
      }
  }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3))
    g.computeVertexNormals()
    g.computeBoundingSphere()
    return g
  }
  out(r: number, g: number, b: number) {
    return this.c.setRGB(r, g, b)
  }
  get scratch() {
    return this.c
  }
}

type Ramp = { base: THREE.Color; dark: THREE.Color; light: THREE.Color; accent: THREE.Color; deep: THREE.Color }
const ramp = (ground: string, accent: string): Ramp => ({
  base: new THREE.Color(ground),
  dark: new THREE.Color(darken(ground, 0.38)),
  light: new THREE.Color(lighten(ground, 0.16)),
  accent: new THREE.Color(accent),
  deep: new THREE.Color(darken(ground, 0.62)),
})

// ----- organic -----
function buildOrganic(ground: string, accent: string, seed: number) {
  const s = seed & 0xffff
  const R = ramp(ground, accent)
  const T = new Tris()
  // Rejilla cartesiana (celdas de ~0,55 m): el relieve de muro se ve como facetas, sin abanicos radiales.
  const STEP = 0.55
  const X0 = -ORG.ax * 1.03
  const Z0 = ORG.z0 - ORG.az * 1.03
  const NX = Math.ceil((ORG.ax * 2.06) / STEP)
  const NZ = Math.ceil((ORG.az * 2.06) / STEP)
  const at = (i: number, j: number, ceiling: boolean) => {
    const x = X0 + i * STEP
    const z = Z0 + j * STEP
    return [x, ceiling ? organicCeil(x, z, s) : organicFloor(x, z, s), z]
  }
  const color = (ceiling: boolean) => (cx: number, cy: number, cz: number, ny: number) => {
    const rho = Math.min(1, orgRho(cx, cz))
    const steep = 1 - Math.abs(ny)
    const th = Math.atan2(cz - ORG.z0, cx)
    // vetas: en los muros siguen la vertical (fibras), en el suelo son manchas
    const streak = noise2(th * 7.5, cy * 0.35, s + 2)
    const blot = fbm(cx * 0.18 + 3, cz * 0.18, s + 7, 3)
    const out = T.scratch.copy(R.base)
    out.lerp(R.dark, 0.45 * (1 - blot) + 0.4 * steep * streak)
    out.lerp(R.light, 0.35 * smooth(0.55, 0.85, blot) * (1 - steep))
    const fat = noise2(cx * 0.31 + 11, cz * 0.31 + cy * 0.2, s + 13)
    if (fat > 0.74) out.lerp(R.accent, 0.3 * smooth(0.74, 0.9, fat))
    // oclusión: más oscuro hacia el borde y en los pliegues hondos
    out.multiplyScalar(1 - 0.24 * smooth(0.7, 1, rho))
    const crease = ridged(cx * 0.19, cz * 0.19, s + 3, 3)
    out.multiplyScalar(0.8 + 0.3 * crease)
    if (ceiling) out.lerp(R.deep, 0.3).multiplyScalar(0.9 + 0.2 * streak)
    // brillo húmedo: unas pocas caras más claras
    const wet = noise2(cx * 1.7, cz * 1.7 + cy, s + 21)
    if (wet > 0.82) out.lerp(R.light, 0.22)
    return out
  }
  T.grid(NX, NZ, (i, j) => at(i, j, false), color(false), true)
  T.grid(NX, NZ, (i, j) => at(i, j, true), color(true), false)
  return T.geometry()
}

// ----- cellular -----
function buildCellular(ground: string, accent: string, seed: number) {
  const s = seed & 0xffff
  const R = ramp(ground, accent)
  const T = new Tris()
  const LON = 120
  const LAT = 70
  const radius = (dx: number, dy: number, dz: number) => {
    // deformación suave que se anula en el fondo (donde se camina) para que el suelo sea analítico
    const up = smooth(-0.75, 0.15, dy)
    return CELL_R * (1 + up * 0.09 * (fbm(dx * 1.7 + 4, dy * 1.7 + dz * 1.3, s, 3) - 0.5))
  }
  const sph = (i: number, j: number) => {
    const lat = (i / LAT) * Math.PI // 0 = fondo (polo sur), π = tapa
    const lon = (j / LON) * Math.PI * 2
    const dy = -Math.cos(lat)
    const rr = Math.sin(lat)
    const dx = Math.cos(lon) * rr
    const dz = Math.sin(lon) * rr
    const r = radius(dx, dy, dz)
    return [dx * r, CELL_R + dy * r, dz * r]
  }
  const color = (cx: number, cy: number, cz: number, ny: number) => {
    const d = Math.hypot(cx, cz)
    const out = T.scratch.copy(R.base)
    const n = fbm(cx * 0.09, cz * 0.09 + cy * 0.05, s, 3)
    out.lerp(R.dark, 0.35 * (1 - n))
    out.lerp(R.light, 0.25 * smooth(0.5, 0.8, n))
    // hacia la tapa: más lejos y más luminoso (el citoplasma lo velará la niebla)
    out.multiplyScalar(0.92 + 0.08 * (-ny))
    if (d > 24) out.lerp(R.accent, 0.1 * smooth(24, 40, d))
    return out
  }
  T.grid(LAT, LON, (i, j) => sph(i, j % LON), color, true)

  // Cabezas de fosfolípidos: red hexagonal sobre el fondo, el "dibujo" de la bicapa.
  const rnd = mulberry32(seed + 9)
  const head = new THREE.IcosahedronGeometry(1, 0)
  const hp = head.getAttribute('position')
  const sp = 0.5
  const headCol = new THREE.Color(accent)
  const tmp = new THREE.Color()
  for (let row = -34; row <= 34; row++) {
    for (let col = -34; col <= 34; col++) {
      const x = (col + (row & 1 ? 0.5 : 0)) * sp
      const z = row * sp * 0.866
      const d = Math.hypot(x, z)
      if (d > 13) continue
      const jx = (rnd() - 0.5) * 0.1
      const jz = (rnd() - 0.5) * 0.1
      const hx = x + jx
      const hz = z + jz
      const hy = cellFloor(hx, hz) + 0.1 + (rnd() - 0.5) * 0.08
      const rad = 0.17 + rnd() * 0.04
      tmp.copy(headCol).lerp(R.light, rnd() * 0.25).multiplyScalar(1 - 0.3 * smooth(7, 13, d) + (rnd() - 0.5) * 0.1)
      for (let k = 0; k < hp.count; k += 3) {
        for (let q = 0; q < 3; q++) {
          T.pos.push(hx + hp.getX(k + q) * rad, hy + hp.getY(k + q) * rad * 0.55, hz + hp.getZ(k + q) * rad)
          T.col.push(tmp.r, tmp.g, tmp.b)
        }
      }
    }
  }

  // Citoesqueleto: microtúbulos que cruzan el citoplasma.
  const tubeCol = new THREE.Color(mixHex(accent, '#9fd4c4', 0.5))
  for (let i = 0; i < 12; i++) {
    const a = rnd() * Math.PI * 2
    const d0 = range(rnd, 22, 40)
    const p0 = new THREE.Vector3(Math.cos(a) * d0, cellFloor(Math.cos(a) * d0, Math.sin(a) * d0) + 0.3, Math.sin(a) * d0)
    const b = a + range(rnd, -0.9, 0.9)
    const p3 = new THREE.Vector3(Math.cos(b) * range(rnd, 6, 30), range(rnd, 12, 34), Math.sin(b) * range(rnd, 6, 30) - 8)
    const mid = p0.clone().lerp(p3, 0.5).add(new THREE.Vector3(range(rnd, -6, 6), range(rnd, 2, 8), range(rnd, -6, 6)))
    const curve = new THREE.CatmullRomCurve3([p0, p0.clone().lerp(mid, 0.5).add(new THREE.Vector3(0, 3, 0)), mid, p3])
    const TUB = 30
    const RAD = 5
    const frames = curve.computeFrenetFrames(TUB, false)
    const ring = (u: number, v: number) => {
      const idx = Math.round(u * TUB)
      const p = curve.getPointAt(idx / TUB)
      const an = (v / RAD) * Math.PI * 2
      const r = 0.2
      const n = frames.normals[idx]
      const bn = frames.binormals[idx]
      return [p.x + (n.x * Math.cos(an) + bn.x * Math.sin(an)) * r, p.y + (n.y * Math.cos(an) + bn.y * Math.sin(an)) * r, p.z + (n.z * Math.cos(an) + bn.z * Math.sin(an)) * r]
    }
    const c = tubeCol.clone().multiplyScalar(0.85 + rnd() * 0.3)
    T.grid(TUB, RAD, (u, v) => ring(u / TUB, v), () => c, true)
  }
  return T.geometry()
}

// ----- vessel -----
function buildVessel(ground: string, accent: string, seed: number) {
  const s = seed & 0xffff
  const R = ramp(ground, accent)
  const T = new Tris()
  const NZ = 120
  const NA = 80
  const zAt = (i: number) => VES.z0 + (i / NZ) * (VES.z1 - VES.z0)
  const pt = (i: number, j: number) => {
    const z = zAt(i)
    const a = (j / NA) * Math.PI * 2
    const u = j / NA
    const e = endo(u, z, s)
    const r = VES.r - e.bump * 0.28
    return [vesselCx(z) + Math.sin(a) * r, VES.r - Math.cos(a) * r, z]
  }
  const color = (cx: number, cy: number, cz: number) => {
    const a = Math.atan2(cx - vesselCx(cz), VES.r - cy)
    const u = (a / (Math.PI * 2) + 1) % 1
    const e = endo(u, cz, s)
    const out = T.scratch.copy(R.base)
    const tone = (e.id % 17) / 17
    out.lerp(R.dark, 0.2 + 0.3 * tone)
    out.lerp(R.light, 0.25 * smooth(0.3, 1, e.bump) + 0.1 * (1 - tone))
    if (e.edge < 0.07) out.lerp(R.deep, 0.55)
    // venita pálida en algunas células (núcleo de la endotelial)
    if (e.bump > 0.85) out.lerp(R.accent, 0.2)
    out.multiplyScalar(0.88 + 0.12 * Math.cos(a)) // algo más claro arriba (techo)
    return out
  }
  T.grid(NZ, NA, (i, j) => pt(i, j % NA), color, false)
  return T.geometry()
}

export function buildScienceTerrain(terrain: ScienceTerrain, ground: string, accent: string, seedStr: string): { geometry: THREE.BufferGeometry; field: HeightField } {
  const seed = hashStr(seedStr)
  const field = scienceHeightField(terrain, seed)
  const geometry = terrain === 'organic' ? buildOrganic(ground, accent, seed) : terrain === 'cellular' ? buildCellular(ground, accent, seed) : buildVessel(ground, accent, seed)
  return { geometry, field }
}

// --- Atmósfera: sin sol ni cielo; la niebla es el "aire" de la cavidad ---
export function scienceAtmosphere(d: Pick<Diorama, 'palette'> & { terrain: ScienceTerrain }): Atmosphere {
  const { sky, ground } = d.palette
  const base = {
    clouds: false,
    cloudColor: '#ffffff',
    stars: false,
    water: sky,
  }
  switch (d.terrain) {
    case 'cellular':
      return {
        ...base,
        skyTop: lighten(sky, 0.25),
        skyHorizon: sky,
        fog: sky,
        fogNear: 14,
        fogFar: 70,
        sunColor: '#fffaf0',
        sunIntensity: 1.7,
        sunDir: [0.25, 0.9, 0.35],
        hemiSky: lighten(sky, 0.7),
        hemiGround: mixHex(sky, ground, 0.55),
        hemiIntensity: 1.9,
      }
    case 'vessel':
      return {
        ...base,
        skyTop: darken(sky, 0.2),
        skyHorizon: sky,
        fog: sky,
        fogNear: 8,
        fogFar: 78,
        sunColor: '#ffe3d6',
        sunIntensity: 1.5,
        sunDir: [0.1, 0.92, 0.38],
        hemiSky: lighten(ground, 0.5),
        hemiGround: darken(ground, 0.5),
        hemiIntensity: 1.7,
      }
    case 'organic':
    default:
      return {
        ...base,
        skyTop: darken(sky, 0.25),
        skyHorizon: sky,
        fog: sky,
        fogNear: 12,
        fogFar: 62,
        sunColor: '#ffd9c8',
        sunIntensity: 1.55,
        sunDir: [0.18, 0.9, 0.42],
        hemiSky: lighten(ground, 0.55),
        hemiGround: darken(ground, 0.55),
        hemiIntensity: 1.75,
      }
  }
}
