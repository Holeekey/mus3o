import * as THREE from 'three'
import { darken, lighten, mat, mixHex } from '../../geo'
import { fbm, noise2, range } from '../../random'
import type { Built, PropCtx } from '../common'
import { alignY, blob, Kit, lathe, rngOf, sstepN, surface, TAU, tube, v3 } from './util'

// Medicina y anatomía: estilizado pero reconocible. Cada función devuelve un Built cuyo origen es el
// suelo, con el frente (la cara que se mira) hacia +z.

export const TISSUE = {
  flesh: '#b5514a',
  fleshDeep: '#6f2a2e',
  tendon: '#ead7bd',
  leaflet: '#eeb5a5',
  vein: '#6b5aa8',
  artery: '#cf4a44',
  fat: '#e8cf93',
} as const

// --- Válvula cardíaca ---------------------------------------------------------------------

/** Radio del anillo (m, escala 1) según la válvula. */
export const VALVE_RADIUS = { tricuspid: 1.25, mitral: 1.05, pulmonary: 0.85, aortic: 0.8 } as const

export function buildValve(ctx: PropCtx): Built {
  const type = ctx.prop?.valveType ?? 'tricuspid'
  const n = type === 'mitral' ? 2 : 3
  const R = VALVE_RADIUS[type]
  const cy = R * 1.3
  const base = ctx.color ?? TISSUE.flesh
  const kit = new Kit()
  // `spread` > 0 = modelo de corte suelto (sin tabique grande); 0 = montado en un tabique que llena la cavidad.
  const specimen = (ctx.prop?.spread ?? 0) > 0
  const plateOuter = specimen ? Math.max(1.8, ctx.prop!.spread) : 7

  // Tabique alrededor del anillo: tejido muscular con fibras radiales, más pálido junto al anillo.
  const bands = [
    { a: 1.0, b: 1.5, c: TISSUE.tendon },
    { a: 1.5, b: 2.6, c: mixHex(base, TISSUE.tendon, 0.28) },
    { a: 2.6, b: 4.8, c: base },
    { a: 4.8, b: 8, c: darken(base, 0.14) },
  ]
    .filter((b) => b.a < plateOuter - 0.2)
    .map((b) => ({ ...b, b: Math.min(b.b, plateOuter) }))
  for (const band of bands) {
    kit.b.add(
      surface(
        72,
        5,
        (u, v) => {
          const rr = (band.a + (band.b - band.a) * v) * R
          const th = u * TAU
          const k = rr / R
          const dome = 0.34 * R * (1 - sstepN(1, 2.4, k))
          const fibers = 0.07 * R * Math.sin(th * 24 + k * 0.9) * sstepN(1.5, 3, k) * (0.6 + noise2(th * 2, k, ctx.seed) * 0.8)
          return [Math.cos(th) * rr, cy + Math.sin(th) * rr, dome + fibers]
        },
        true,
      ),
      new THREE.Matrix4(),
      { color: band.c, jitter: 0.07 },
    )
  }
  // Anillo fibroso (toro).
  kit.b.add(
    surface(
      48,
      8,
      (u, v) => {
        const th = u * TAU
        const ph = v * TAU
        const rr = R * 1.03 + Math.cos(ph) * R * 0.13
        return [Math.cos(th) * rr, cy + Math.sin(th) * rr, 0.07 * R + Math.sin(ph) * R * 0.13]
      },
      true,
    ),
    new THREE.Matrix4(),
    { color: lighten(TISSUE.tendon, 0.1), jitter: 0.03, double: true },
  )

  // Ventrículo detrás: cámara oscura que se estrecha; más profunda = más negra.
  const depth = (specimen ? 3.6 : 6) * R
  const rings = 7
  for (let s = 0; s < rings; s++) {
    kit.b.add(
      surface(
        40,
        3,
        (u, v) => {
          const t = (s + v) / rings
          const th = u * TAU
          const rr = R * (1.02 + 0.85 * Math.sin(Math.PI * Math.pow(t, 0.85))) * (1 - 0.92 * sstepN(0.86, 1, t)) * (1 + 0.1 * (noise2(th * 3, t * 9, ctx.seed + 4) - 0.5))
          return [Math.cos(th) * rr, cy + Math.sin(th) * rr, -t * depth]
        },
        false,
      ),
      new THREE.Matrix4(),
      { color: mixHex(mixHex(TISSUE.fleshDeep, TISSUE.flesh, 0.25), '#4a1618', Math.min(1, s / (rings - 0.6))), jitter: 0.12 },
    )
  }
  // Músculos papilares: conos carnosos que sostienen las cuerdas.
  const zFix = -3.1 * R
  const ang0 = -Math.PI / 2
  for (let k = 0; k < n; k++) {
    const a = ang0 + (k + 0.5) * (TAU / n) + (n === 2 ? 0.0 : 0.0)
    const tip = v3(Math.cos(a) * R * 1.35, cy + Math.sin(a) * R * 1.35, zFix)
    const root = v3(Math.cos(a) * R * 1.75, cy + Math.sin(a) * R * 1.75, zFix - 1.2 * R)
    kit.b.limb(root, tip, 0.3 * R, 0.1 * R, 7, { color: mixHex(TISSUE.fleshDeep, TISSUE.flesh, 0.35), jitter: 0.08 })
  }

  // Valvas: pétalos que se abren con el latido (GPU), con cuerdas tendinosas ancladas a los papilares.
  const leafPart = kit.part([1, R, cy, 0])
  const chordPart = kit.part([2, R, cy, zFix])
  const half = Math.PI / n - 0.05
  for (let k = 0; k < n; k++) {
    const a = ang0 + (k + 0.5) * (TAU / n)
    leafPart.add(
      surface(
        10,
        7,
        (u, v) => {
          const th = a + (u - 0.5) * 2 * half
          const rr = R * (0.99 - 0.94 * v)
          return [Math.cos(th) * rr, cy + Math.sin(th) * rr, 0.1 * R * Math.sin(Math.PI * v) * (1 - Math.abs(u - 0.5) * 0.6)]
        },
        true,
      ),
      new THREE.Matrix4(),
      { color: '#f1e1d2', jitter: 0.03, double: true },
    )
    const papTip = v3(Math.cos(a) * R * 1.35, cy + Math.sin(a) * R * 1.35, zFix)
    for (let c = -1; c <= 1; c++) {
      const th = a + c * half * 0.5
      const top = v3(Math.cos(th) * R * 0.5, cy + Math.sin(th) * R * 0.5, 0.02)
      chordPart.limb(papTip, top, 0.03 * R, 0.04 * R, 5, { color: '#f2e6d0', jitter: 0.02 })
    }
  }

  const top = cy + R * 2
  return { geometry: kit.build(), radius: 0, height: top, motion: 'none', science: { shader: true } }
}

// --- Glóbulos ------------------------------------------------------------------------------

function discProfile(R: number, seg = 10): [number, number][] {
  const prof: [number, number][] = []
  const h = (rho: number) => 0.5 * R * 0.95 * Math.sqrt(Math.max(0, 1 - rho * rho)) * (0.2072 + 1.0026 * rho * rho - 1.1228 * rho ** 4)
  for (let i = 0; i <= seg; i++) {
    const rho = i / seg
    prof.push([Math.max(0.0001, rho * R), Math.abs(h(rho)) + 0.02 * R])
  }
  for (let i = seg; i >= 0; i--) {
    const rho = i / seg
    prof.push([Math.max(0.0001, rho * R), -Math.abs(h(rho)) - 0.02 * R])
  }
  return prof
}

export function buildBloodCell(ctx: PropCtx): Built {
  const type = ctx.prop?.cell ?? 'red'
  const kit = new Kit()
  const r = rngOf(ctx.seed, 2)
  let radius = 0.55
  if (type === 'red') {
    kit.b.add(lathe(discProfile(0.55, 9), 12, true), new THREE.Matrix4(), { color: ctx.color ?? '#c9323b', jitter: 0.05 })
  } else if (type === 'white') {
    radius = 0.8
    kit.b.add(blob(3, (x, y, z) => 1 + 0.1 * Math.sin(x * 11 + z * 7) * Math.sin(y * 9 + x * 3)), mat(0, 0, 0, 0, 0, 0, 0.8), { color: ctx.color ?? '#e6dff2', jitter: 0.05 })
    // núcleo lobulado asomando bajo la membrana
    for (let i = 0; i < 4; i++) {
      const a = i * 1.7 + r() * 0.5
      kit.b.ico(0.3, mat(Math.cos(a) * 0.56, 0.14 * i - 0.25, Math.sin(a) * 0.56), { color: '#5d4a9c', jitter: 0.07 }, 1)
    }
    for (let i = 0; i < 14; i++) {
      const a = r() * TAU
      const e = Math.asin(range(r, -0.9, 0.9))
      kit.b.ico(0.07, mat(Math.cos(a) * Math.cos(e) * 0.8, Math.sin(e) * 0.8, Math.sin(a) * Math.cos(e) * 0.8), { color: '#c8bfdc' }, 0)
    }
  } else {
    radius = 0.3
    for (let i = 0; i < 2; i++) kit.b.add(lathe(discProfile(0.26, 5), 6, true), mat(0, (i - 0.5) * 0.12, 0, 0.15 * i, 0, 0.3 * i), { color: ctx.color ?? '#b78ac2', jitter: 0.07 })
  }
  const flow = ctx.prop?.flow
  const science = flow ? { dynamicOnly: true, flow: { path: flow.path, speed: flow.speed, gate: flow.gate, radius: Math.max(0.6, ctx.prop?.spread || 1.4) } } : undefined
  return { geometry: kit.build(), radius: 0, height: radius * 2 + 0.5, motion: flow ? 'none' : 'drift', science }
}

// --- Boca de un vaso ------------------------------------------------------------------------

export function buildVesselMouth(ctx: PropCtx): Built {
  const R = 2.1
  const col = ctx.color ?? '#8d4468'
  const kit = new Kit()
  const cy = R * 1.15
  // Manguito de tejido que enmarca la abertura.
  for (const band of [
    { a: 1.0, b: 1.55, c: lighten(col, 0.22) },
    { a: 1.55, b: 2.6, c: mixHex(col, TISSUE.flesh, 0.5) },
    { a: 2.6, b: 4.4, c: TISSUE.flesh },
  ]) {
    kit.b.add(
      surface(
        48,
        4,
        (u, v) => {
          const rr = (band.a + (band.b - band.a) * v) * R
          const th = u * TAU
          const k = rr / R
          return [Math.cos(th) * rr, cy + Math.sin(th) * rr, 0.5 * R * (1 - sstepN(1, 3.2, k)) + 0.05 * Math.sin(th * 14)]
        },
        true,
      ),
      new THREE.Matrix4(),
      { color: band.c, jitter: 0.07 },
    )
  }
  // Labio redondeado.
  kit.b.add(
    surface(
      40,
      8,
      (u, v) => {
        const th = u * TAU
        const ph = v * TAU
        const rr = R * 1.02 + Math.cos(ph) * 0.3
        return [Math.cos(th) * rr, cy + Math.sin(th) * rr, 0.52 * R + Math.sin(ph) * 0.3]
      },
      true,
    ),
    new THREE.Matrix4(),
    { color: lighten(col, 0.1), jitter: 0.04, double: true },
  )
  // Túnel hacia dentro: se oscurece con la profundidad.
  const len = 10
  const segs = 6
  for (let s = 0; s < segs; s++) {
    kit.b.add(
      surface(
        28,
        1,
        (u, v) => {
          const th = u * TAU
          const z = -((s + v) / segs) * len + 0.5 * R
          const rr = R * (1 + 0.04 * Math.sin(th * 5 + s))
          return [Math.cos(th) * rr, cy + Math.sin(th) * rr, z]
        },
        false,
      ),
      new THREE.Matrix4(),
      { color: mixHex(darken(col, 0.15), '#12060a', s / segs), jitter: 0.06 },
    )
  }
  return { geometry: kit.build(), radius: 0, height: cy + R * 1.6, motion: 'none' }
}

// --- Nodo sinusal ---------------------------------------------------------------------------

export function buildPacemaker(ctx: PropCtx): Built {
  const kit = new Kit()
  const r = rngOf(ctx.seed, 3)
  const cy = 2.6
  const wall = ctx.color ?? '#c9786a'
  // Almohadilla de pared sobre la que descansa el nodo (más clara que el resto del tejido).
  kit.b.add(blob(4, (x, y) => 1 + 0.04 * Math.sin(x * 8 + y * 6)), mat(0, cy, -0.1, 0, 0, 0, 3.7, 3.2, 0.95), { color: wall, jitter: 0.06 })
  // Cresta terminal: banda muscular que bordea el nodo.
  kit.b.add(blob(3, () => 1), mat(-1.55, cy, 0.55, 0, 0, 0.12, 0.42, 2.7, 0.4), { color: darken(wall, 0.16), jitter: 0.06 })
  // El nodo: una media luna alargada de tejido claro, hecha de lóbulos solapados.
  const lobes = 11
  for (let i = 0; i < lobes; i++) {
    const t = i / (lobes - 1)
    const a = (t - 0.5) * 2.5
    const x = Math.sin(a) * 1.15
    const y = cy + 0.1 + Math.cos(a) * 0.9 - 0.9 + (r() - 0.5) * 0.1
    const s = 0.5 - Math.abs(t - 0.5) * 0.45 + r() * 0.06
    kit.b.add(blob(2, (px, py, pz) => 1 + 0.08 * Math.sin(px * 6 + pz * 5)), mat(x, y, 0.78, r() * 0.4, r() * 0.4, -a * 0.9, s * 1.2, s * 0.8, s * 0.7), { color: mixHex('#f4e7bd', '#fffaf0', t * 0.4), jitter: 0.04 })
  }
  // Arteria del nodo: una venita roja que lo cruza.
  kit.b.limb(v3(-0.4, cy + 1.7, 0.7), v3(0.3, cy - 1.4, 0.85), 0.07, 0.05, 5, { color: TISSUE.artery })
  return { geometry: kit.build(), radius: 0, height: cy + 2.2, motion: 'none', science: { pulse: { y: cy, radius: 1.0 } } }
}

// --- Pared muscular ------------------------------------------------------------------------

export function buildMuscleWall(ctx: PropCtx): Built {
  const W = 7
  const H = 4.6
  const stripes = 16
  const kit = new Kit()
  const base = ctx.color ?? '#b24a49'
  const cy = H / 2 + 0.3
  const part = kit.part([6, 0.22, 4.2, cy])
  for (let s = 0; s < stripes; s++) {
    const u0 = s / stripes
    const u1 = (s + 1) / stripes
    const tone = fbm(s * 0.9, 3, ctx.seed, 2)
    const c = s % 2 ? mixHex(base, '#f0b49a', 0.3 + tone * 0.15) : darken(base, 0.2 + tone * 0.12)
    part.add(
      surface(
        2,
        14,
        (u, v) => {
          const uu = u0 + (u1 - u0) * u
          const x = (uu - 0.5) * W
          const y = 0.3 + v * H
          // haces oblicuos: la fibra se inclina y el borde de cada haz abulta
          const slant = (x + (y - cy) * 0.35) * 2.4
          const bundle = 0.16 * Math.sin(slant) + 0.06 * Math.sin(slant * 2.3 + 1)
          const bulge = 0.5 * (1 - Math.pow((uu - 0.5) * 2, 2)) * (1 - Math.pow((v - 0.5) * 2, 2))
          return [x, y, bulge + bundle + 0.1 * noise2(x * 0.7, y * 0.7, ctx.seed)]
        },
        true,
      ),
      new THREE.Matrix4(),
      { color: c, jitter: 0.06 },
    )
  }
  return { geometry: kit.build(), radius: 0, height: H + 0.4, motion: 'none', science: { shader: true } }
}

// --- Neurona -------------------------------------------------------------------------------

function curveTube(kit: Kit, pts: THREE.Vector3[], r0: number, r1: number, color: string) {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal')
  kit.b.add(
    tube(curve, (u) => r0 + (r1 - r0) * u, 16, 5),
    new THREE.Matrix4(),
    { color, jitter: 0.04 },
  )
  return curve
}

export function buildNeuron(ctx: PropCtx): Built {
  const kit = new Kit()
  const r = rngOf(ctx.seed, 4)
  const soma = ctx.color ?? '#e6a7bf'
  const dend = ctx.secondary ?? '#d889a9'
  const cy = 2.9
  kit.b.add(blob(2, (x, y, z) => 1 + 0.06 * Math.sin(x * 7 + y * 4) + 0.04 * Math.cos(z * 9)), mat(0, cy, 0, 0, 0, 0, 1.25, 1.1, 1.2), { color: soma, jitter: 0.06 })
  // núcleo asomando y nucleolo
  kit.b.sph(0.55, mat(0.55, cy + 0.1, 0.7), { color: darken(soma, 0.28), jitter: 0.05 }, 8, 6)
  kit.b.sph(0.18, mat(0.7, cy + 0.15, 1.1), { color: '#6b3d5b' }, 6, 4)
  // dendritas: ramas que se bifurcan
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + range(r, -0.2, 0.2)
    const up = range(r, 0.2, 1.1)
    const L = range(r, 3.0, 4.2)
    const p0 = v3(Math.cos(a) * 1.0, cy + (up - 0.4) * 0.6, Math.sin(a) * 1.0 + 0.4)
    const p1 = v3(Math.cos(a) * (L * 0.5), cy + up * 1.3, Math.sin(a) * (L * 0.5) + 0.6)
    const p2 = v3(Math.cos(a + 0.25) * L, cy + up * 2.2 + range(r, 0, 0.8), Math.sin(a + 0.25) * L + 0.8)
    const c = curveTube(kit, [p0, p1, p2], 0.26, 0.05, dend)
    for (let k = 0; k < 2; k++) {
      const u = 0.45 + k * 0.28
      const q = c.getPointAt(u)
      const da = a + (k ? 0.7 : -0.7)
      curveTube(kit, [q, q.clone().add(v3(Math.cos(da) * 0.8, 0.5, Math.sin(da) * 0.8)), q.clone().add(v3(Math.cos(da) * 1.7, 1.1 + k * 0.4, Math.sin(da) * 1.7))], 0.1, 0.03, dend)
    }
  }
  // axón largo hacia -z con vainas de mielina
  const axonPts = [v3(0, cy, -1.0), v3(1.4, cy - 0.3, -4.5), v3(-1.2, cy + 0.2, -8.5), v3(0.8, cy - 0.1, -12.5), v3(0, cy, -15)]
  const axon = curveTube(kit, axonPts, 0.24, 0.17, mixHex(dend, '#fff1d8', 0.35))
  const sheaths = 7
  for (let i = 0; i < sheaths; i++) {
    const u = 0.14 + (i / (sheaths - 1)) * 0.74
    const p = axon.getPointAt(u)
    const t = axon.getTangentAt(u)
    kit.b.ell(0.5, 0.95, 0.5, alignY(p, t), { color: '#f4ecd8', jitter: 0.03 }, 8, 6)
  }
  // terminal: botones sinápticos
  const end = axon.getPointAt(1)
  for (let i = 0; i < 3; i++) {
    const a = (i - 1) * 0.55
    const tip = end.clone().add(v3(Math.sin(a) * 1.3, -0.35 - Math.abs(i - 1) * 0.1, -1.4 - Math.cos(a) * 0.4))
    curveTube(kit, [end, end.clone().lerp(tip, 0.55).add(v3(0, 0.15, 0)), tip], 0.14, 0.07, dend)
    kit.b.sph(0.3, mat(tip.x, tip.y, tip.z), { color: '#ef8da4' }, 8, 6)
  }
  const points = Array.from({ length: 28 }, (_, i) => axon.getPointAt(i / 27))
  return { geometry: kit.build(), radius: 0.9, height: cy + 3.6, motion: 'none', science: { impulse: { points, speed: 6, radius: 0.5 } } }
}

// --- Órganos ---------------------------------------------------------------------------------

export function buildOrgan(ctx: PropCtx): Built {
  const which = ctx.prop?.organ ?? 'heart'
  const kit = new Kit()
  let height = 3

  if (which === 'heart') {
    const cy = 1.7
    const beat = kit.part([4, 0.05, cy, 0])
    const muscle = ctx.color ?? '#b6403f'
    // ventrículos: cono romo inclinado hacia abajo-izquierda
    beat.add(blob(4, (x, y, z) => 1 - 0.1 * Math.max(0, -y) + 0.02 * Math.sin(x * 11)), mat(0.1, cy - 0.15, 0, 0, 0, -0.5, 1.0, 1.35, 0.95), { color: muscle, jitter: 0.05 })
    // surco interventricular con grasa y arterias coronarias
    beat.limb(v3(0.15, cy + 0.6, 0.85), v3(-0.45, cy - 1.1, 0.7), 0.07, 0.04, 5, { color: TISSUE.fat })
    beat.limb(v3(0.0, cy + 0.2, 0.9), v3(-0.9, cy - 0.5, 0.55), 0.04, 0.03, 4, { color: TISSUE.artery })
    // aurículas
    beat.add(blob(3, () => 1), mat(-0.85, cy + 0.95, 0.15, 0, 0, 0, 0.6, 0.55, 0.62), { color: '#8a5aa0', jitter: 0.05 })
    beat.add(blob(3, () => 1), mat(0.95, cy + 0.85, 0.05, 0, 0, 0, 0.55, 0.5, 0.58), { color: '#b04a58', jitter: 0.05 })
    // grandes vasos
    const aorta = new THREE.CatmullRomCurve3([v3(0.25, cy + 0.9, 0.1), v3(0.3, cy + 1.9, 0), v3(-0.2, cy + 2.4, -0.15), v3(-0.75, cy + 1.9, -0.25)])
    beat.add(tube(aorta, () => 0.3, 14, 7), new THREE.Matrix4(), { color: TISSUE.artery, jitter: 0.04 })
    const pulm = new THREE.CatmullRomCurve3([v3(-0.3, cy + 0.8, 0.55), v3(-0.45, cy + 1.6, 0.6), v3(-0.9, cy + 2.1, 0.45)])
    beat.add(tube(pulm, () => 0.27, 12, 7), new THREE.Matrix4(), { color: '#6577c4', jitter: 0.04 })
    const vc = new THREE.CatmullRomCurve3([v3(-0.95, cy + 1.2, 0.0), v3(-1.0, cy + 2.2, -0.1), v3(-1.0, cy + 2.8, -0.1)])
    beat.add(tube(vc, () => 0.27, 12, 7), new THREE.Matrix4(), { color: '#6b5aa8', jitter: 0.04 })
    height = cy + 3.4
  } else if (which === 'lung') {
    const cy = 1.8
    const breathe = kit.part([5, 0.035, cy, 0])
    const tone = ctx.color ?? '#e8a1a6'
    for (const s of [-1, 1]) {
      const lobes = s < 0 ? 3 : 2
      for (let i = 0; i < lobes; i++) {
        const y = cy + 0.8 - i * (lobes === 3 ? 0.75 : 1.1)
        breathe.add(
          blob(4, (x, yy, z) => 1 + 0.03 * Math.sin(x * 12 + yy * 7) - 0.12 * Math.max(0, x * s * -1)),
          mat(s * 1.15, y - 0.05, -0.05, 0, 0, s * -0.08, 0.78, lobes === 3 ? 0.85 : 1.0, 0.62),
          { color: mixHex(tone, '#b86f7c', i * 0.12), jitter: 0.04 },
        )
      }
    }
    // tráquea y bronquios
    kit.b.add(
      tube(new THREE.CatmullRomCurve3([v3(0, cy + 2.7, 0), v3(0, cy + 1.2, 0)]), () => 0.17, 8, 6),
      new THREE.Matrix4(),
      { color: '#efe6d2', jitter: 0.03 },
    )
    for (const s of [-1, 1]) {
      const br = new THREE.CatmullRomCurve3([v3(0, cy + 1.2, 0), v3(s * 0.5, cy + 0.7, 0.05), v3(s * 0.95, cy + 0.1, 0.1), v3(s * 1.1, cy - 0.7, 0.15)])
      kit.b.add(tube(br, (u) => 0.12 * (1 - u * 0.6), 12, 5), new THREE.Matrix4(), { color: '#efe6d2', jitter: 0.03 })
      for (let k = 0; k < 3; k++) {
        const q = br.getPointAt(0.45 + k * 0.18)
        kit.b.limb(q, q.clone().add(v3(s * 0.5, -0.35 - k * 0.2, 0.18)), 0.05, 0.02, 4, { color: '#efe6d2' })
      }
    }
    height = cy + 2.9
  } else if (which === 'kidney') {
    const cy = 1.4
    kit.b.add(
      blob(4, (x, y, z) => {
        const notch = 0.55 * Math.exp(-((x + 0.95) ** 2 * 6 + z * z * 6 + y * y * 1.2))
        return 1 - notch + 0.02 * Math.sin(y * 10)
      }),
      mat(0, cy, 0, 0, 0, 0.2, 0.85, 1.35, 0.7),
      { color: ctx.color ?? '#8f3d3f', jitter: 0.05 },
    )
    kit.b.add(blob(2, () => 1), mat(0.15, cy + 1.35, 0, 0, 0, 0, 0.55, 0.28, 0.45), { color: TISSUE.fat, jitter: 0.05 }) // glándula suprarrenal
    kit.b.limb(v3(-0.75, cy + 0.15, 0.1), v3(-1.7, cy + 0.9, 0.05), 0.12, 0.1, 6, { color: TISSUE.artery })
    kit.b.limb(v3(-0.75, cy - 0.1, -0.05), v3(-1.7, cy + 0.55, -0.1), 0.15, 0.12, 6, { color: TISSUE.vein })
    const ureter = new THREE.CatmullRomCurve3([v3(-0.7, cy - 0.25, 0.15), v3(-0.9, cy - 0.9, 0.2), v3(-0.5, cy - 1.7, 0.2), v3(-0.6, cy - 1.4 - 1.0, 0.2)])
    kit.b.add(tube(ureter, () => 0.07, 12, 5), new THREE.Matrix4(), { color: '#e7d58f' })
    height = cy + 1.9
  } else if (which === 'brain') {
    const cy = 1.6
    const tone = ctx.color ?? '#e4aeb0'
    for (const s of [-1, 1]) {
      kit.b.add(
        blob(7, (x, y, z) => {
          // circunvoluciones: surcos que serpentean sobre la superficie
          const gy = 1 + 0.06 * Math.sin(x * 15 + Math.sin(z * 7 + y * 3) * 2.2) * Math.sin(y * 13 + z * 6 + x * 2) + 0.025 * Math.cos(z * 19)
          return gy * (1 - 0.2 * Math.max(0, -y) - 0.08 * Math.max(0, x * s))
        }),
        mat(s * 0.43, cy, 0, 0, 0, 0, 0.8, 0.88, 1.28),
        { color: mixHex(tone, '#c28f94', 0.08 + 0.06 * (s + 1)), jitter: 0.04 },
      )
    }
    // cerebelo con surcos horizontales
    kit.b.add(blob(6, (x, y) => 1 + 0.07 * Math.sin(y * 26)), mat(0, cy - 0.65, -1.15, 0, 0, 0, 0.9, 0.5, 0.55), { color: '#cf9097', jitter: 0.04 })
    // tronco encefálico
    kit.b.limb(v3(0, cy - 0.5, -0.5), v3(0, cy - 1.5, -0.7), 0.26, 0.18, 8, { color: '#e9cbb5' })
    height = cy + 1.4
  } else {
    const cy = 1.3
    const tone = ctx.color ?? '#7e3b2e'
    kit.b.add(blob(5, (x, y, z) => 1 - 0.18 * Math.max(0, x) + 0.02 * Math.sin(z * 9)), mat(0.35, cy, 0, 0, 0, 0.12, 1.5, 0.78, 0.95), { color: tone, jitter: 0.05 })
    kit.b.add(blob(4, () => 1), mat(-1.25, cy - 0.12, 0.1, 0, 0, 0.15, 0.72, 0.5, 0.65), { color: darken(tone, 0.06), jitter: 0.05 })
    // vesícula biliar y vena porta
    kit.b.add(blob(3, (x, y, z) => 1 + 0.25 * Math.max(0, y)), mat(0.5, cy - 0.7, 0.55, 0.3, 0, 0, 0.26, 0.45, 0.26), { color: '#7a9a4a' })
    kit.b.limb(v3(0.1, cy - 0.15, 0.55), v3(0.1, cy - 1.2, 0.9), 0.14, 0.1, 6, { color: TISSUE.vein })
    kit.b.limb(v3(0.4, cy + 0.2, 0.5), v3(0.3, cy + 1.3, 0.2), 0.16, 0.12, 6, { color: '#5b6fb5' })
    height = cy + 1.6
  }
  const shader = kit.shader
  return { geometry: kit.build(), radius: 0.9, height, motion: 'none', science: shader ? { shader: true } : undefined }
}
