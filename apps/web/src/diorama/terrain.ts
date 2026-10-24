import * as THREE from 'three'
import type { DioramaTerrain } from '@mus3o/shared'
import { clamp01, rgb, smooth } from './geo'
import { fbm, hashStr, noise2, ridged } from './random'
import { buildScienceTerrain, isScienceTerrain, scienceHeightField } from './terrain/science' // science-kit

export const TERRAIN_EXTENT = 130 // medio lado del suelo, en m
const SEGMENTS = 160

export type HeightField = {
  heightAt: (x: number, z: number) => number
  /** Nivel del agua, si el terreno tiene (río, costa). */
  waterLevel: number | null
  /** Hay agua en (x, z)? Sirve para colocar barcos y para no caminar sobre el río. */
  isWater: (x: number, z: number) => boolean
}

const riverZ = (x: number) => -1.5 + 3.4 * Math.sin(x * 0.2) + 1.4 * Math.sin(x * 0.53 + 1.1)
export const shoreZ = (x: number) => -11 + 2.2 * Math.sin(x * 0.17) + 1.1 * Math.sin(x * 0.41 + 2)

export function heightField(terrain: DioramaTerrain, seed: number): HeightField {
  if (isScienceTerrain(terrain)) return scienceHeightField(terrain, seed) // science-kit
  const s = seed & 0xffff
  // Margen de la "mesa" jugable: la zona central es casi plana y el relieve crece hacia afuera,
  // más hacia el fondo (-z) para que el horizonte tenga composición.
  const rim = (x: number, z: number, a = 17, b = 55) => smooth(a, b, Math.hypot(x, z * 0.9)) * 0.75 + smooth(6, 42, -z) * 0.45
  const base = (x: number, z: number, amp = 0.35) => (fbm(x * 0.09, z * 0.09, s, 3) - 0.5) * amp * 2

  let heightAt: (x: number, z: number) => number
  let waterLevel: number | null = null
  let isWater: (x: number, z: number) => boolean = () => false

  switch (terrain) {
    case 'hills':
      heightAt = (x, z) => base(x, z) + rim(x, z, 12, 50) * (4.5 + 11 * fbm(x * 0.03 + 7, z * 0.03, s + 1, 3))
      break
    case 'mountains':
      heightAt = (x, z) => base(x, z, 0.3) + rim(x, z, 20, 60) * (10 + 46 * ridged(x * 0.017, z * 0.017, s + 3, 4))
      break
    case 'coast':
      waterLevel = -0.18
      heightAt = (x, z) => {
        const d = z - shoreZ(x) // > 0 tierra
        const beach = smooth(-9, 1.5, d) // 0 mar → 1 playa
        const land = base(x, z) + 0.35
        const flanks = smooth(30, 80, Math.abs(x)) * beach * 8 * fbm(x * 0.04, z * 0.04, s + 9, 3)
        return lerpN(-3.2, land, beach) + flanks
      }
      isWater = (x, z) => z - shoreZ(x) < -0.4
      break
    case 'river':
      waterLevel = -0.22
      heightAt = (x, z) => {
        const d = Math.abs(z - riverZ(x))
        const channel = Math.exp(-Math.pow(d / 2.6, 2)) * 1.35
        return base(x, z) + rim(x, z, 16, 55) * (3 + 6 * fbm(x * 0.03, z * 0.03, s + 2, 3)) - channel
      }
      isWater = (x, z) => Math.abs(z - riverZ(x)) < 1.9
      break
    case 'forest':
      heightAt = (x, z) => base(x, z, 0.5) + rim(x, z, 16, 55) * (3 + 6 * fbm(x * 0.04, z * 0.04, s + 4, 3))
      break
    case 'desert':
      heightAt = (x, z) => {
        const dunes = Math.sin(x * 0.11 + fbm(x * 0.05, z * 0.05, s, 2) * 5) * 0.55 + Math.sin(z * 0.07 + x * 0.04) * 0.4
        return dunes * 0.7 + rim(x, z, 16, 55) * (5 + 9 * fbm(x * 0.025, z * 0.025, s + 6, 3))
      }
      break
    case 'city':
    case 'interior':
    case 'abstract':
      heightAt = () => 0
      break
    case 'plain':
    default:
      heightAt = (x, z) => base(x, z) + rim(x, z, 20, 70) * (1.2 + 2.6 * fbm(x * 0.035, z * 0.035, s + 8, 3))
  }
  return { heightAt, waterLevel, isWater }
}

const lerpN = (a: number, b: number, t: number) => a + (b - a) * t

const SAND = new THREE.Color('#d8c795')
const WET_SAND = new THREE.Color('#d8c795').multiplyScalar(0.75)
const ROCK = new THREE.Color('#8c8678')
const SNOW = new THREE.Color('#f2efe8')
const DUST = new THREE.Color('#8b7448')

type Ramp = { dark: THREE.Color; light: THREE.Color; accent: THREE.Color; ground: THREE.Color; tileA: THREE.Color; tileB: THREE.Color; tileLine: THREE.Color; ring: THREE.Color }

function makeRamp(ground: string, accent: string): Ramp {
  const g = new THREE.Color(ground)
  return {
    ground: g,
    dark: g.clone().lerp(new THREE.Color('#000000'), 0.12),
    light: g.clone().lerp(new THREE.Color('#ffffff'), 0.1),
    accent: new THREE.Color(accent),
    tileA: g.clone().lerp(new THREE.Color('#ffffff'), 0.08),
    tileB: g.clone().lerp(new THREE.Color('#000000'), 0.06),
    tileLine: g.clone().lerp(new THREE.Color('#000000'), 0.3),
    ring: g.clone().lerp(new THREE.Color(accent), 0.18),
  }
}

/** Color plano de una cara del suelo, escrito en `out` sin reservar memoria. */
function terrainColor(out: THREE.Color, r: Ramp, terrain: DioramaTerrain, x: number, z: number, y: number, slope: number, seed: number, waterLevel: number | null) {
  if (terrain === 'city' || terrain === 'interior') {
    const cell = (Math.floor(x / 2) + Math.floor(z / 2)) & 1
    out.copy(cell ? r.tileA : r.tileB)
    const gx = Math.abs((((x % 2) + 2) % 2) - 1)
    const gz = Math.abs((((z % 2) + 2) % 2) - 1)
    if (gx > 0.94 || gz > 0.94) out.lerp(r.tileLine, 0.4)
    return out
  }
  if (terrain === 'abstract') return out.copy(Math.floor(Math.hypot(x, z) / 3) % 2 ? r.ring : r.ground)
  const n = fbm(x * 0.12, z * 0.12, seed, 3)
  out.copy(r.dark).lerp(r.light, n)
  // parches secos / pisoteados
  const patch = noise2(x * 0.22 + 40, z * 0.22, seed + 3)
  if (patch > 0.68) out.lerp(r.accent, 0.16 * smooth(0.68, 0.85, patch))
  if (terrain === 'hills' || terrain === 'plain') {
    const trampled = 1 - smooth(5, 16, Math.hypot(x, z + 1))
    if (trampled > 0.01) out.lerp(DUST, 0.28 * trampled * smooth(0.35, 0.65, noise2(x * 0.35, z * 0.35, seed + 11)))
  }
  if (terrain === 'desert') {
    out.lerp(SAND, 0.4)
    if (slope > 0.5) out.multiplyScalar(0.88)
  }
  // roca en pendientes fuertes y altura
  out.lerp(ROCK, smooth(0.55, 1.1, slope) * (terrain === 'mountains' ? 0.9 : 0.55))
  if (terrain === 'mountains') {
    out.lerp(ROCK, smooth(8, 22, y) * 0.8)
    out.lerp(SNOW, smooth(26, 38, y + (n - 0.5) * 8))
  } else if (y > 6) {
    out.lerp(ROCK, smooth(6, 16, y) * 0.6)
  }
  if (waterLevel !== null) {
    out.lerp(SAND, (1 - smooth(waterLevel + 0.1, waterLevel + 0.9, y)) * 0.9)
    if (y < waterLevel) out.lerp(WET_SAND, 0.6)
  }
  return out
}

/** Suelo facetado: un triángulo = un color plano, para el aspecto low-poly. */
export function buildTerrainGeometry(terrain: DioramaTerrain, ground: string, accent: string, seedStr: string): { geometry: THREE.BufferGeometry; field: HeightField } {
  if (isScienceTerrain(terrain)) return buildScienceTerrain(terrain, ground, accent, seedStr) // science-kit
  const seed = hashStr(seedStr)
  const field = heightField(terrain, seed)
  const grid = new THREE.PlaneGeometry(TERRAIN_EXTENT * 2, TERRAIN_EXTENT * 2, SEGMENTS, SEGMENTS)
  grid.rotateX(-Math.PI / 2)
  const p = grid.getAttribute('position')
  for (let i = 0; i < p.count; i++) p.setY(i, field.heightAt(p.getX(i), p.getZ(i)))
  const g = grid.toNonIndexed()
  const pos = g.getAttribute('position')
  const col = new Float32Array(pos.count * 3)
  const ramp = makeRamp(ground, accent)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i += 3) {
    const y0 = pos.getY(i)
    const y1 = pos.getY(i + 1)
    const y2 = pos.getY(i + 2)
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3
    const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3
    const dy = Math.max(y0, y1, y2) - Math.min(y0, y1, y2)
    terrainColor(c, ramp, terrain, cx, cz, (y0 + y1 + y2) / 3, dy / 1.3, seed & 0xfff, field.waterLevel)
    for (let k = 0; k < 3; k++) {
      col[(i + k) * 3] = c.r
      col[(i + k) * 3 + 1] = c.g
      col[(i + k) * 3 + 2] = c.b
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.computeVertexNormals()
  g.computeBoundingSphere()
  grid.dispose()
  return { geometry: g, field }
}

export { clamp01, rgb }
