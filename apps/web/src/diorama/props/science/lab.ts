import * as THREE from 'three'
import { darken, lighten, mat, mixHex } from '../../geo'
import type { Built, PropCtx } from '../common'
import { Kit, lathe, rngOf, v3 } from './util'

// Laboratorio: objetos de tamaño humano para el cuadro de una práctica o un descubrimiento.

const BRASS = '#c9a24b'
const ENAMEL = '#2b2f38'

export function buildMicroscope(ctx: PropCtx): Built {
  const kit = new Kit()
  const b = kit.b
  const body = ctx.color ?? ENAMEL
  // base en herradura y pie
  b.box(0.7, 0.1, 0.8, mat(0, 0.05, 0), { color: body })
  b.box(0.62, 0.04, 0.72, mat(0, 0.12, 0), { color: darken(body, 0.2) })
  // brazo curvo (columna) en arco hacia atrás
  const arm = new THREE.CatmullRomCurve3([v3(0, 0.1, -0.28), v3(0, 0.55, -0.4), v3(0, 1.05, -0.32), v3(0, 1.35, -0.1)])
  for (let i = 0; i < 14; i++) {
    const p = arm.getPointAt(i / 14)
    const q = arm.getPointAt((i + 1) / 14)
    b.limb(p, q, 0.11, 0.11, 6, { color: body, jitter: 0.02 })
  }
  // platina con pinzas
  b.box(0.52, 0.04, 0.44, mat(0, 0.5, 0.02), { color: '#3a3f4a' })
  b.box(0.2, 0.01, 0.07, mat(0.0, 0.53, 0.0), { color: '#e8f1f6' }) // portaobjetos
  b.box(0.16, 0.03, 0.03, mat(0.2, 0.55, 0.1), { color: BRASS })
  // tubo óptico, revólver con objetivos
  b.cyl(0.085, 0.085, 0.6, 10, mat(0, 0.95, 0.04, 0.0, 0, 0), { color: body, jitter: 0.02 })
  b.cyl(0.16, 0.16, 0.06, 10, mat(0, 0.66, 0.04), { color: BRASS })
  for (let i = 0; i < 3; i++) {
    const a = -0.7 + i * 0.7
    b.cyl(0.04, 0.05, 0.16 + i * 0.03, 8, mat(Math.sin(a) * 0.12, 0.57 - i * 0.01, 0.04 + Math.cos(a) * 0.08), { color: mixHex(BRASS, '#ffffff', i * 0.15) })
  }
  // ocular inclinado
  b.limb(v3(0, 1.22, 0.03), v3(0, 1.5, 0.18), 0.065, 0.055, 8, { color: body })
  b.cyl(0.07, 0.07, 0.07, 8, mat(0, 1.53, 0.19, 0.5, 0, 0), { color: '#14161c' })
  // tornillos macro/micrométrico
  for (const s of [-1, 1]) b.cyl(0.08, 0.08, 0.07, 10, mat(s * 0.13, 0.78, -0.31, 0, 0, Math.PI / 2), { color: BRASS })
  // espejo / condensador
  b.cyl(0.07, 0.1, 0.12, 8, mat(0, 0.33, 0.02), { color: '#444a56' })
  b.cyl(0.11, 0.11, 0.015, 12, mat(0, 0.22, 0.04, 0.5, 0, 0), { color: lighten('#9fb2bb', 0.2) })
  return { geometry: kit.build(), radius: 0.4, height: 1.7, motion: 'none' }
}

export function buildFlask(ctx: PropCtx): Built {
  const kit = new Kit()
  const liquid = ctx.color ?? '#5cc8a6'
  const glass = ctx.secondary ?? '#d6ebef'
  // Erlenmeyer: base ancha → cuello fino → labio
  const outer: [number, number][] = [[0.0001, 0.0], [0.34, 0.0], [0.45, 0.05], [0.4, 0.2], [0.26, 0.42], [0.14, 0.62], [0.12, 0.78], [0.15, 0.82], [0.15, 0.86], [0.12, 0.86]]
  kit.b.add(lathe(outer.map(([r, y]) => [r * 1.2, y * 1.2] as [number, number]), 12, false), new THREE.Matrix4(), { color: glass, jitter: 0.02 })
  const inner: [number, number][] = [[0.0001, 0.04], [0.31, 0.04], [0.4, 0.09], [0.36, 0.22], [0.27, 0.34]]
  kit.b.add(lathe(inner.map(([r, y]) => [r * 1.2, y * 1.2] as [number, number]), 12, false), new THREE.Matrix4(), { color: liquid, jitter: 0.03 })
  // superficie del líquido
  kit.b.cyl(0.33, 0.33, 0.01, 12, mat(0, 0.4, 0), { color: lighten(liquid, 0.25) })
  // burbujas
  const r = rngOf(ctx.seed, 21)
  for (let i = 0; i < 4; i++) kit.b.ico(0.025, mat((r() - 0.5) * 0.35, 0.12 + r() * 0.2, (r() - 0.5) * 0.35), { color: lighten(liquid, 0.5) }, 0)
  return { geometry: kit.build(), radius: 0.35, height: 1.2, motion: 'none' }
}

export function buildTestTubeRack(ctx: PropCtx): Built {
  const kit = new Kit()
  const wood = ctx.secondary ?? '#8c6a43'
  const cols = ['#e04a4a', '#e8c54a', '#58b36b', '#4a86d6', '#a066cc']
  const w = 1.3
  kit.b.box(w, 0.05, 0.42, mat(0, 0.62, 0), { color: wood, jitter: 0.04 })
  kit.b.box(w, 0.05, 0.42, mat(0, 0.1, 0), { color: wood, jitter: 0.04 })
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.b.box(0.06, 0.62, 0.06, mat(sx * (w / 2 - 0.04), 0.35, sz * 0.17), { color: darken(wood, 0.12) })
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * 0.25
    const c = cols[(i + ctx.seed) % cols.length]
    const tilt = (i % 2 ? 1 : -1) * 0.02
    // vidrio (cuello arriba) + líquido
    kit.b.cyl(0.075, 0.075, 0.5, 8, mat(x, 0.9, 0, tilt, 0, 0), { color: '#d9edf0', jitter: 0.02 })
    kit.b.cyl(0.066, 0.066, 0.3 + (i % 3) * 0.04, 8, mat(x, 0.78 - (i % 3) * -0.02, 0, tilt, 0, 0), { color: c, jitter: 0.03 })
    kit.b.sph(0.075, mat(x, 0.65, 0), { color: c }, 8, 5)
  }
  return { geometry: kit.build(), radius: 0.5, height: 1.35, motion: 'none' }
}
