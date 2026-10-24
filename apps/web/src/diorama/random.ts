// Aleatoriedad determinista: el mismo diorama se ve igual siempre y en cualquier cliente.

export function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Rng = () => number
export const range = (r: Rng, a: number, b: number) => a + (b - a) * r()
export const pick = <T,>(r: Rng, arr: readonly T[]): T => arr[Math.floor(r() * arr.length) % arr.length]

function h2(ix: number, iz: number, seed: number) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** Ruido de valor 2D suave, 0..1. */
export function noise2(x: number, z: number, seed = 0) {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = x - ix
  const fz = z - iz
  const ux = fx * fx * (3 - 2 * fx)
  const uz = fz * fz * (3 - 2 * fz)
  const a = h2(ix, iz, seed)
  const b = h2(ix + 1, iz, seed)
  const c = h2(ix, iz + 1, seed)
  const d = h2(ix + 1, iz + 1, seed)
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz
}

/** Suma de octavas, ~0..1. */
export function fbm(x: number, z: number, seed = 0, oct = 4) {
  let amp = 0.5
  let f = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < oct; i++) {
    sum += amp * noise2(x * f, z * f, seed + i * 17)
    norm += amp
    amp *= 0.5
    f *= 2.03
  }
  return sum / norm
}

/** Cordilleras afiladas, 0..1. */
export function ridged(x: number, z: number, seed = 0, oct = 4) {
  let amp = 0.5
  let f = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < oct; i++) {
    const n = 1 - Math.abs(noise2(x * f, z * f, seed + i * 31) * 2 - 1)
    sum += amp * n * n
    norm += amp
    amp *= 0.5
    f *= 2.1
  }
  return sum / norm
}
