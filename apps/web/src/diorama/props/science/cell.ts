import * as THREE from 'three'
import { darken, mat, mixHex } from '../../geo'
import { noise2, range } from '../../random'
import type { Built, PropCtx } from '../common'
import { alignY, blob, carve, flip, Kit, rngOf, surface, TAU, v3 } from './util'

// Biología celular. Todo a escala "encogida": una mitocondria mide como una persona.

export const CELL = {
  nucleus: '#a283c9',
  nucleusIn: '#dccdf0',
  chromatin: '#6a4a9c',
  nucleolus: '#4a2f7a',
  mito: '#e8854f',
  mitoIn: '#f6c79a',
  er: '#7f9cdc',
  golgi: '#f08fa6',
  ribo: '#e4bf55',
  riboSmall: '#c98a3c',
  atpBase: '#4f7fc4',
  atpSugar: '#58a865',
  phosphate: '#ef6a3a',
  lipid: '#f1c46a',
} as const

const randomDir = (r: () => number) => {
  const a = r() * TAU
  const e = Math.asin(range(r, -1, 1))
  return v3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e))
}

// --- Núcleo --------------------------------------------------------------------------------

export function buildNucleus(ctx: PropCtx): Built {
  const R = 6
  const cy = R * 0.92
  const kit = new Kit()
  const r = rngOf(ctx.seed, 11)
  const cut = v3(0.3, 0.2, 0.93).normalize()
  const open = 0.52 // cos del semiángulo del corte
  const keep = (x: number, y: number, z: number) => {
    const l = Math.hypot(x, y, z) || 1
    return (x * cut.x + y * cut.y + z * cut.z) / l < open
  }
  const shell = carve(blob(5, (x, y, z) => 1 + 0.025 * Math.sin(x * 6 + z * 4) * Math.cos(y * 5)), keep)
  kit.b.add(shell, mat(0, cy, 0, 0, 0, 0, R), { color: ctx.color ?? CELL.nucleus, jitter: 0.05 })
  // membrana interna (cara hacia dentro) con aspecto de cromatina
  kit.b.add(flip(shell), mat(0, cy, 0, 0, 0, 0, R * 0.955), { color: ctx.secondary ?? CELL.nucleusIn, jitter: 0.07 })
  // borde del corte: aro entre la membrana externa e interna
  // poros nucleares
  const pore = new THREE.TorusGeometry(0.34, 0.1, 4, 8)
  pore.rotateX(Math.PI / 2)
  let placed = 0
  for (let i = 0; i < 400 && placed < 54; i++) {
    const d = randomDir(r)
    if ((d.x * cut.x + d.y * cut.y + d.z * cut.z) > open - 0.1) continue
    kit.b.add(pore, alignY(d.clone().multiplyScalar(R * 1.0).add(v3(0, cy, 0)), d), { color: '#2e2150', jitter: 0.02 })
    placed++
  }
  // cromatina: ovillos oscuros pegados a la pared interna
  for (let i = 0; i < 36; i++) {
    const d = randomDir(r)
    if ((d.x * cut.x + d.y * cut.y + d.z * cut.z) > 0.8) continue
    const s = range(r, 0.35, 0.8)
    kit.b.ico(s, mat(d.x * R * 0.9, cy + d.y * R * 0.9, d.z * R * 0.9, r() * 3, r() * 3, 0, 1.3, 0.8, 1), { color: mixHex(CELL.chromatin, '#d8c8ee', r() * 0.25), jitter: 0.08 }, 0)
  }
  // nucleolo y cromatina laxa en el interior
  kit.b.add(blob(3, (x, y, z) => 1 + 0.12 * noise2(x * 4 + 3, y * 4 + z * 3, ctx.seed)), mat(-0.9, cy - 0.5, 0.2, 0, 0, 0, 1.9), { color: CELL.nucleolus, jitter: 0.08 })
  for (let i = 0; i < 14; i++) {
    const a = r() * TAU
    const rr = range(r, 1.2, 3.6)
    kit.b.ico(range(r, 0.2, 0.45), mat(Math.cos(a) * rr, cy + range(r, -2.2, 2.2), Math.sin(a) * rr), { color: CELL.chromatin, jitter: 0.1 }, 0)
  }
  return { geometry: kit.build(), radius: R * 0.92, height: cy + R, motion: 'none' }
}

// --- Mitocondria ---------------------------------------------------------------------------

export function buildMitochondrion(ctx: PropCtx, variant: number): Built {
  const r = rngOf(ctx.seed, 12 + variant)
  const L = range(r, 3.0, 3.6) // semieje largo
  const W = range(r, 1.35, 1.6)
  const cy = W * 1.05
  const kit = new Kit()
  const cutZ = 0.25
  const outer = carve(blob(4, (x, y, z) => 1 + 0.03 * Math.sin(x * 7 + y * 3)), (_x, _y, z) => z < cutZ / W)
  kit.b.add(outer, mat(0, cy, 0, 0, 0, 0, L, W, W), { color: ctx.color ?? CELL.mito, jitter: 0.05 })
  kit.b.add(flip(outer), mat(0, cy, 0, 0, 0, 0, L * 0.94, W * 0.9, W * 0.9), { color: ctx.secondary ?? CELL.mitoIn, jitter: 0.04 })
  // borde de corte (grosor de las dos membranas)
  const a0 = Math.sqrt(1 - (cutZ / W) ** 2)
  kit.b.add(
    surface(
      36,
      1,
      (u, v) => {
        const th = u * TAU
        const k = 0.9 + 0.1 * v
        return [Math.cos(th) * L * a0 * (v ? 1 : 0.94) * (v ? 1 : 1), cy + Math.sin(th) * W * a0 * k, cutZ]
      },
      false,
    ),
    new THREE.Matrix4(),
    { color: darken(ctx.color ?? CELL.mito, 0.12), jitter: 0.03, double: true },
  )
  // crestas: tabiques de la membrana interna, alternando arriba y abajo
  const n = 8
  for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) / n - 0.5) * 2 * L * 0.82
    const fall = Math.sqrt(Math.max(0.05, 1 - (x / L) ** 2))
    const side = i % 2 ? 1 : -1
    kit.b.add(
      blob(3, (px, py, pz) => 1 + 0.12 * Math.sin(py * 9 + pz * 7 + i) + 0.05 * px),
      mat(x, cy + side * W * 0.38 * fall, -W * 0.28 * fall, 0, 0, 0, 0.1, W * 0.62 * fall, W * 0.78 * fall),
      { color: mixHex(ctx.secondary ?? CELL.mitoIn, CELL.mito, 0.35), jitter: 0.06 },
    )
  }
  // gránulos de la matriz
  for (let i = 0; i < 6; i++) kit.b.ico(0.1, mat(range(r, -L * 0.7, L * 0.7), cy + range(r, -0.5, 0.5), range(r, -W * 0.6, -0.1)), { color: '#8a4a3a' }, 0)
  return { geometry: kit.build(), radius: L * 0.6, height: cy + W, motion: 'none' }
}

// --- Ribosoma -------------------------------------------------------------------------------

export function buildRibosome(ctx: PropCtx, variant: number): Built {
  const kit = new Kit()
  const r = rngOf(ctx.seed, 13 + variant)
  const bump = (x: number, y: number, z: number) => 1 + 0.07 * Math.sin(x * 8 + y * 5) * Math.cos(z * 7)
  kit.b.add(blob(3, bump), mat(0, 0.55, 0, 0, 0, 0, 0.5, 0.38, 0.42), { color: ctx.color ?? CELL.ribo, jitter: 0.06 })
  kit.b.add(blob(3, bump), mat(0.03, 0.88, 0.01, 0, 0, 0.1, 0.36, 0.23, 0.32), { color: ctx.secondary ?? CELL.riboSmall, jitter: 0.06 })
  // hebra de ARNm que pasa entre las dos subunidades
  const pts = Array.from({ length: 9 }, (_, i) => v3((i - 4) * 0.22, 0.74 + Math.sin(i * 1.3 + r()) * 0.05, 0.3 + (i % 2) * 0.02))
  for (let i = 0; i < pts.length - 1; i++) kit.b.limb(pts[i], pts[i + 1], 0.03, 0.03, 4, { color: '#c0433b' })
  return { geometry: kit.build(), radius: 0, height: 1.4, motion: 'drift' }
}

// --- Retículo endoplasmático rugoso -----------------------------------------------------------

export function buildRoughER(ctx: PropCtx): Built {
  const kit = new Kit()
  const r = rngOf(ctx.seed, 14)
  const sheets = 4
  const Lx = 3.4
  const Lz = 2.2
  for (let s = 0; s < sheets; s++) {
    const y0 = 0.55 + s * 0.95
    const ph = s * 1.3
    const f = (u: number, v: number): [number, number, number] => {
      const x = (u - 0.5) * 2 * Lx
      const z = (v - 0.5) * 2 * Lz
      const taper = 1 - 0.18 * Math.pow(Math.abs(v - 0.5) * 2, 3)
      const y = y0 + 0.28 * Math.sin(u * TAU * 1.5 + ph) + 0.16 * Math.sin(v * TAU + ph * 2) * taper
      return [x * taper, y, z]
    }
    kit.b.add(surface(26, 10, f, true), new THREE.Matrix4(), { color: mixHex(ctx.color ?? CELL.er, '#ffffff', s * 0.05), jitter: 0.045, double: true })
    // ribosomas pegados a la cara superior
    for (let i = 0; i < 26; i++) {
      const u = r()
      const v = r()
      const [x, y, z] = f(u, v)
      kit.b.ico(0.2, mat(x, y + 0.13, z, r() * 3, r() * 3, 0, 1.2, 0.8, 1), { color: i % 3 ? CELL.ribo : CELL.riboSmall }, 0)
    }
  }
  // pliegue de conexión: un lado curvo une las láminas (cisternas continuas)
  for (let s = 0; s < sheets - 1; s++) {
    const y0 = 0.55 + s * 0.95
    kit.b.add(
      surface(
        16,
        6,
        (u, v) => {
          const a = Math.PI * u
          return [Lx - 0.03 + Math.sin(a) * 0.45, y0 + 0.5 + (1 - Math.cos(a)) * 0.47 - 0.45, (v - 0.5) * 2 * Lz * 0.82]
        },
        true,
      ),
      new THREE.Matrix4(),
      { color: darken(ctx.color ?? CELL.er, 0.1), jitter: 0.05, double: true },
    )
  }
  return { geometry: kit.build(), radius: 2.6, height: 4.3, motion: 'none' }
}

// --- Aparato de Golgi ------------------------------------------------------------------------

export function buildGolgi(ctx: PropCtx): Built {
  const kit = new Kit()
  const r = rngOf(ctx.seed, 15)
  const n = 6
  for (let s = 0; s < n; s++) {
    const t = s / (n - 1)
    const w = 3.0 - t * 0.6
    const y = 0.75 + s * 0.62
    kit.b.add(
      surface(
        22,
        8,
        (u, v) => {
          const a = (u - 0.5) * 2.1 // arco
          const rad = 3.0 + (v - 0.5) * 0.1
          const wv = (v - 0.5) * 2 * w
          const bow = 0.5 * (1 - (2 * u - 1) ** 2) // abomba hacia arriba al centro
          const lip = 0.18 * Math.pow(Math.abs(2 * u - 1), 6) // bordes ensanchados
          return [Math.sin(a) * rad, y + bow * 0.55 * (1 - t * 0.2) - 0.1 * (1 - Math.abs(2 * v - 1)) + lip, wv * Math.cos(a * 0.5) - Math.cos(a) * 0.0]
        },
        true,
      ),
      new THREE.Matrix4(),
      { color: mixHex(ctx.color ?? CELL.golgi, '#f2c06a', t * 0.6), jitter: 0.05, double: true },
    )
    // ampollas en los bordes
    for (let k = 0; k < 2; k++) {
      const side = k ? 1 : -1
      for (let q = 0; q < 2; q++) {
        kit.b.ico(range(r, 0.14, 0.3), mat(side * (3.0 * Math.sin(1.05) + range(r, 0.05, 0.4)), y + 0.5 + range(r, -0.1, 0.25), range(r, -w * 0.5, w * 0.5)), { color: mixHex(ctx.color ?? CELL.golgi, '#ffffff', 0.15), jitter: 0.05 }, 1)
      }
    }
  }
  // vesículas que se desprenden de la cara trans
  for (let i = 0; i < 5; i++) kit.b.ico(range(r, 0.25, 0.4), mat(range(r, 3.4, 4.6), 1.5 + i * 0.5, range(r, -1.5, 1.5)), { color: '#f7b4c2', jitter: 0.05 }, 1)
  return { geometry: kit.build(), radius: 2.4, height: 4.8, motion: 'none' }
}

// --- ADN ------------------------------------------------------------------------------------------

export function buildDnaHelix(ctx: PropCtx): Built {
  const kit = new Kit()
  const spin = kit.part([3, 0.35, 0, 0])
  const H = 6.5
  const R = 0.85
  const pitch = 2.6
  const steps = 96
  const a = ctx.color ?? '#3f78d0'
  const b = ctx.secondary ?? '#e0603c'
  const at = (y: number, off: number) => v3(Math.cos((y / pitch) * TAU + off) * R, y, Math.sin((y / pitch) * TAU + off) * R)
  for (let i = 0; i < steps; i++) {
    const y0 = 0.2 + (i / steps) * H
    const y1 = 0.2 + ((i + 1) / steps) * H
    spin.limb(at(y0, 0), at(y1, 0), 0.13, 0.13, 5, { color: a, jitter: 0.03 })
    spin.limb(at(y0, Math.PI), at(y1, Math.PI), 0.13, 0.13, 5, { color: b, jitter: 0.03 })
  }
  const bases: [string, string][] = [['#e8c64a', '#58b36b'], ['#58b36b', '#e8c64a'], ['#d65a7a', '#5a86d6'], ['#5a86d6', '#d65a7a']]
  const rungs = 26
  for (let i = 0; i < rungs; i++) {
    const y = 0.35 + (i / (rungs - 1)) * (H - 0.3)
    const p = at(y, 0)
    const q = at(y, Math.PI)
    const m = p.clone().lerp(q, 0.5)
    const [c1, c2] = bases[(i * 7 + ctx.seed) % 4]
    spin.limb(p.clone().lerp(m, 0.08), m, 0.075, 0.075, 4, { color: c1, jitter: 0.02 })
    spin.limb(m, q.clone().lerp(m, 0.08), 0.075, 0.075, 4, { color: c2, jitter: 0.02 })
  }
  return { geometry: kit.build(), radius: 0.7, height: H + 0.5, motion: 'none', science: { shader: true } }
}

// --- ATP ------------------------------------------------------------------------------------------

export function buildAtp(ctx: PropCtx): Built {
  const kit = new Kit()
  const hex = (x: number, y: number, z: number, rad: number, seg: number, c: string, rot = 0) => kit.b.cyl(rad, rad, 0.1, seg, mat(x, y, z, Math.PI / 2, 0, rot), { color: c, jitter: 0.03 })
  // adenina: hexágono + pentágono fusionados
  hex(-0.9, 0.85, 0, 0.3, 6, CELL.atpBase)
  hex(-0.55, 1.2, 0, 0.24, 5, mixHex(CELL.atpBase, '#ffffff', 0.15), 0.3)
  kit.b.sph(0.09, mat(-1.18, 1.1, 0.06), { color: '#2d4fa3' }, 6, 4)
  // ribosa
  hex(-0.1, 0.85, 0, 0.26, 5, CELL.atpSugar)
  kit.b.limb(v3(-0.58, 0.9, 0), v3(-0.3, 0.88, 0), 0.05, 0.05, 4, { color: '#aab' })
  // cadena de tres fosfatos
  let prev = v3(0.2, 0.85, 0)
  for (let i = 0; i < 3; i++) {
    const p = v3(0.55 + i * 0.55, 0.85 + (i % 2 ? 0.1 : -0.04), 0)
    kit.b.limb(prev, p, 0.05, 0.05, 4, { color: '#aab' })
    kit.b.sph(0.22, mat(p.x, p.y, p.z), { color: ctx.color ?? CELL.phosphate, jitter: 0.04 }, 8, 6)
    for (const [dx, dy, dz] of [[0, 0.2, 0.14], [0, -0.2, -0.12], [0.1, 0, 0.22]] as const) kit.b.sph(0.07, mat(p.x + dx, p.y + dy, p.z + dz), { color: '#f4d3c2' }, 5, 4)
    prev = p
  }
  return { geometry: kit.build(), radius: 0, height: 1.8, motion: 'drift' }
}

// --- Proteína de membrana en una bicapa ------------------------------------------------------------

export function buildMembraneProtein(ctx: PropCtx): Built {
  const kit = new Kit()
  const r = rngOf(ctx.seed, 17)
  const Z = 3.4 // semiancho (z)
  const Hh = 3.6 // alto
  const cy = Hh / 2 + 0.3
  const gap = 1.02
  const headCol = ctx.color ?? CELL.lipid
  // lípidos: cabeza hidrofílica hacia fuera, dos colas hacia dentro. Normal de la membrana = x.
  const step = 0.46
  for (let iz = -Math.floor(Z / step); iz <= Math.floor(Z / step); iz++) {
    for (let iy = 0; iy < Math.floor(Hh / step); iy++) {
      const z = iz * step + (iy % 2) * step * 0.5
      const y = 0.4 + iy * step
      if (Math.hypot(z, y - cy) < gap) continue
      for (const side of [-1, 1]) {
        const jx = r() * 0.05
        kit.b.ico(0.16, mat(side * (0.62 + jx), y, z), { color: headCol, jitter: 0.05 }, 0)
        for (const t of [-1, 1]) kit.b.box(0.5, 0.045, 0.045, mat(side * 0.34, y + t * 0.07, z, 0, 0, side * t * 0.05), { color: mixHex(headCol, '#b0763c', 0.55), jitter: 0.04 })
      }
    }
  }
  // canal proteico: cilindro hueco con una hélice de bandas, atraviesa la bicapa
  const ch = surface(
    20,
    1,
    (u, v) => {
      const th = u * TAU
      const rr = 0.98 + 0.12 * Math.sin(th * 4)
      return [(v - 0.5) * 1.9, cy + Math.cos(th) * rr, Math.sin(th) * rr]
    },
    true,
  )
  kit.b.add(ch, new THREE.Matrix4(), { color: ctx.secondary ?? '#7b5ac0', jitter: 0.06 })
  kit.b.add(
    surface(
      20,
      1,
      (u, v) => {
        const th = u * TAU
        return [(v - 0.5) * 1.9, cy + Math.cos(th) * 0.5, Math.sin(th) * 0.5]
      },
      false,
    ),
    new THREE.Matrix4(),
    { color: '#2c1a52', jitter: 0.03 },
  )
  // aros de salida
  for (const s of [-1, 1]) {
    kit.b.add(new THREE.TorusGeometry(0.76, 0.2, 5, 12).rotateY(Math.PI / 2), mat(s * 0.95, cy, 0), { color: mixHex(ctx.secondary ?? '#7b5ac0', '#ffffff', 0.2), jitter: 0.05 })
  }
  // un ion que atraviesa el poro
  kit.b.sph(0.18, mat(0.2, cy, 0.0), { color: '#ffd64a' }, 8, 6)
  return { geometry: kit.build(), radius: 0, height: Hh + 0.6, motion: 'none' }
}

// --- Vesícula --------------------------------------------------------------------------------------

export function buildVesicle(ctx: PropCtx, variant: number): Built {
  const kit = new Kit()
  const r = rngOf(ctx.seed, 18 + variant)
  const R = range(r, 0.85, 1.15)
  const base = ctx.color ?? '#f1b0c6'
  // Vesícula con cubierta de proteínas: una membrana esférica salpicada de receptores (simetría total:
  // se ve igual desde cualquier lado, también cuando flota a la deriva con rotación libre).
  kit.b.add(blob(3, (x, y, z) => 1 + 0.035 * Math.sin(x * 7 + z * 6) * Math.cos(y * 5)), mat(0, R, 0, 0, 0, 0, R), { color: base, jitter: 0.05 })
  const coat = darken(base, 0.22)
  for (let i = 0; i < 22; i++) {
    const d = randomDir(r)
    kit.b.ico(0.11 * R, mat(d.x * R * 1.0, R + d.y * R * 1.0, d.z * R * 1.0, r() * 3, r() * 3, 0, 1, 1.3, 1), { color: i % 3 ? coat : '#8fc7a4', jitter: 0.06 }, 0)
  }
  return { geometry: kit.build(), radius: 0, height: R * 2 + 0.3, motion: 'drift' }
}

