import * as THREE from 'three'
import { Builder, darken, lighten, mat, mixHex, swayAbove, waveAlongX } from '../geo'
import { mulberry32, range } from '../random'
import { GOLD, IRON, WOOD, type Built, type PropCtx } from './common'
import { rockGeometry } from './nature'

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)
const PLASTER = '#ece6d6'
const TILE = '#b4532f'

/** Prisma triangular (gable): sección w×h en XY, extruida d en Z, centrada en z. */
function prism(w: number, h: number, d: number) {
  const s = new THREE.Shape()
  s.moveTo(-w / 2, 0)
  s.lineTo(w / 2, 0)
  s.lineTo(0, h)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false })
  g.translate(0, 0, -d / 2)
  return g
}

export function buildCannon(ctx: PropCtx): Built {
  const b = new Builder()
  const wood = ctx.color ?? '#6b4a2b'
  const metal = ctx.secondary ?? '#3d3c3a'
  // ruedas
  for (const s of [-1, 1]) {
    const x = s * 0.62
    b.add(new THREE.TorusGeometry(0.48, 0.06, 5, 12), mat(x, 0.54, 0, 0, Math.PI / 2, 0), { color: wood })
    b.cyl(0.1, 0.1, 0.2, 6, mat(x, 0.54, 0, 0, 0, Math.PI / 2), { color: darken(wood, 0.3) })
    for (let k = 0; k < 4; k++) b.box(0.05, 0.92, 0.06, mat(x, 0.54, 0, (k * Math.PI) / 4, 0, 0), { color: wood })
  }
  b.cyl(0.05, 0.05, 1.4, 6, mat(0, 0.54, 0, 0, 0, Math.PI / 2), { color: IRON })
  // afuste: dos gualderas y la cola apoyada en el suelo
  for (const s of [-1, 1]) b.box(0.11, 0.26, 1.5, mat(s * 0.27, 0.72, -0.1, -0.06, 0, 0), { color: wood })
  b.box(0.18, 0.13, 1.45, mat(0, 0.3, -1.18, 0.2, 0, 0), { color: darken(wood, 0.1) })
  b.box(0.7, 0.1, 0.1, mat(0, 0.48, -0.6), { color: wood })
  // tubo torneado
  const profile: THREE.Vector2[] = [
    [0.0, -0.74], [0.13, -0.72], [0.19, -0.58], [0.215, -0.25], [0.2, 0.15], [0.16, 0.5], [0.135, 0.72], [0.175, 0.76], [0.175, 0.85], [0.125, 0.87], [0.0, 0.87],
  ].map(([r, y]) => new THREE.Vector2(r, y))
  b.add(new THREE.LatheGeometry(profile, 9), mat(0, 1.0, 0.3, Math.PI / 2 - 0.12, 0, 0), { color: metal, jitter: 0.02 })
  b.cyl(0.225, 0.225, 0.05, 9, mat(0, 0.98, -0.12, Math.PI / 2 - 0.12, 0, 0), { color: GOLD })
  // balas apiladas y lanada
  const balls: Array<[number, number, number]> = [[0.95, 0.1, 0.5], [1.15, 0.1, 0.34], [1.05, 0.1, 0.18], [1.05, 0.26, 0.38]]
  for (const [x, y, z] of balls) b.sph(0.1, mat(x, y, z), { color: IRON }, 6, 4)
  b.limb(V(-1.0, 0.04, -0.4), V(-1.1, 0.06, 1.3), 0.03, 0.03, 5, { color: WOOD })
  return { geometry: b.build(), radius: 0.95, height: 1.5, motion: 'none' }
}

export function buildTent(ctx: PropCtx): Built {
  const b = new Builder()
  const canvas = ctx.color ?? '#eae3cf'
  const w = 2.8
  const h = 2.1
  const d = 3.6
  b.add(prism(w, h, d), mat(0, 0, 0), { color: canvas, jitter: 0.02 })
  // franja de color en los faldones
  for (const s of [-1, 1]) b.box(0.07, 0.14, d + 0.02, mat(s * (w / 2 - 0.05), 0.05, 0), { color: ctx.secondary ?? '#a8322d' })
  b.box(w + 0.02, 0.1, 0.06, mat(0, 0.05, d / 2 + 0.01), { color: ctx.secondary ?? '#a8322d' })
  // puerta: triángulo oscuro algo adelantado
  b.add(prism(1.0, 1.55, 0.04), mat(0, 0, d / 2 + 0.02), { color: '#2b241c', jitter: 0 })
  // mástil de cumbrera y estacas
  b.cyl(0.04, 0.04, d + 0.5, 5, mat(0, h, 0, Math.PI / 2, 0, 0), { color: WOOD })
  for (const s of [-1, 1]) b.cyl(0.03, 0.03, h + 0.1, 5, mat(0, (h + 0.1) / 2, s * (d / 2 + 0.15)), { color: WOOD })
  // banderín en la cumbrera
  b.add(new THREE.PlaneGeometry(0.7, 0.4, 6, 2), mat(0.38, h + 0.12, -d / 2 - 0.2, 0, Math.PI / 2, 0), {
    color: ctx.accent,
    double: true,
    wind: waveAlongX(-0.35, 0.7, 0.07),
  })
  return { geometry: b.build(), radius: 1.9, height: h + 0.3, motion: 'none' }
}

export function buildHouse(ctx: PropCtx, variant: number): Built {
  const rnd = mulberry32(ctx.seed + variant * 11)
  const b = new Builder()
  const wall = ctx.color ?? PLASTER
  const shutter = ctx.secondary ?? '#2f5d8a'
  const L = 5.2
  const D = 3.8
  const H = 2.7
  b.box(L, 0.35, D + 0.1, mat(0, 0.17, 0), { color: darken(wall, 0.18) }) // zócalo
  b.box(L, H, D, mat(0, H / 2 + 0.2, 0), { color: wall })
  // techo a dos aguas con ridge sobre x
  const roofH = 1.5
  const run = D / 2 + 0.55
  const slope = Math.atan2(roofH, run)
  const slopeLen = Math.hypot(roofH, run)
  for (const s of [-1, 1]) {
    b.box(L + 0.7, 0.14, slopeLen, mat(0, H + 0.2 + roofH / 2 + 0.05, s * run * 0.5, s * slope, 0, 0), { color: lighten(TILE, s > 0 ? 0.06 : -0.02) })
  }
  b.box(L + 0.75, 0.17, 0.22, mat(0, H + 0.2 + roofH + 0.1, 0), { color: darken(TILE, 0.15) })
  for (const s of [-1, 1]) b.add(prism(D, roofH, 0.1), mat(s * (L / 2 - 0.05), H + 0.2, 0, 0, Math.PI / 2, 0), { color: wall })
  // puerta y ventanas al frente (+z)
  b.box(0.95, 1.95, 0.12, mat(0, 1.2, D / 2 + 0.01), { color: '#3a2618' })
  for (const s of [-1, 1]) {
    const x = s * 1.7
    b.box(0.75, 1.0, 0.1, mat(x, 1.9, D / 2 + 0.01), { color: '#1d2a33' })
    b.box(0.85, 0.07, 0.2, mat(x, 1.36, D / 2 + 0.06), { color: darken(wall, 0.2) })
    for (const t of [-1, 1]) b.box(0.28, 1.05, 0.06, mat(x + t * 0.52, 1.9, D / 2 + 0.05), { color: shutter })
  }
  // porche con pilares de madera
  b.box(L - 1.2, 0.1, 1.25, mat(0, H - 0.1, D / 2 + 0.62, -0.05, 0, 0), { color: darken(TILE, 0.05) })
  for (const x of [-1, 0, 1]) b.cyl(0.08, 0.09, H - 0.35, 6, mat(x * (L / 2 - 0.9), (H - 0.35) / 2 + 0.2, D / 2 + 1.1), { color: WOOD })
  if (rnd() > 0.5) b.box(0.45, 1.3, 0.45, mat(-L / 2 + 0.8, H + 0.8, -0.5), { color: darken(wall, 0.08) }) // chimenea
  return { geometry: b.build(), radius: 3.3, height: H + roofH, motion: 'none' }
}

export function buildChurch(ctx: PropCtx): Built {
  const b = new Builder()
  const wall = ctx.color ?? PLASTER
  const trim = ctx.secondary ?? '#c9a24b'
  const W = 5.2
  const Lg = 9
  const Hn = 4.4
  // nave
  b.box(W, Hn, Lg, mat(0, Hn / 2, -1), { color: wall })
  const run = W / 2 + 0.4
  const rh = 2.0
  const slope = Math.atan2(rh, run)
  const sl = Math.hypot(rh, run)
  for (const s of [-1, 1]) b.box(sl, 0.16, Lg + 0.6, mat(s * run * 0.5, Hn + rh / 2 + 0.05, -1, 0, 0, -s * slope), { color: s > 0 ? TILE : lighten(TILE, 0.05) })
  b.box(0.25, 0.2, Lg + 0.65, mat(0, Hn + rh + 0.1, -1), { color: darken(TILE, 0.15) })
  // fachada con frontón
  const fz = Lg / 2 - 1 + 0.15
  b.box(W + 0.5, Hn + 1.6, 0.5, mat(0, (Hn + 1.6) / 2, fz), { color: wall })
  b.add(prism(W + 0.9, 1.8, 0.5), mat(0, Hn + 1.6, fz), { color: wall })
  b.add(prism(W + 1.3, 0.28, 0.62), mat(0, Hn + 1.6 + 1.62, fz), { color: darken(wall, 0.12) })
  // portada: arco, puertas y óculo
  b.box(2.1, 2.9, 0.18, mat(0, 1.45, fz + 0.28), { color: '#3a2618' })
  b.add(new THREE.CylinderGeometry(1.05, 1.05, 0.18, 12, 1, false, 0, Math.PI), mat(0, 2.9, fz + 0.28, Math.PI / 2, 0, Math.PI / 2), { color: '#3a2618' })
  b.cyl(0.55, 0.55, 0.12, 10, mat(0, Hn + 0.2, fz + 0.3, Math.PI / 2, 0, 0), { color: '#1d2a33' })
  b.box(0.12, 2.0, 0.1, mat(2.05, 2.5, fz + 0.28), { color: darken(wall, 0.12) })
  b.box(0.12, 2.0, 0.1, mat(-2.05, 2.5, fz + 0.28), { color: darken(wall, 0.12) })
  // campanario
  const tx = -(W / 2 + 1.55)
  const tz = fz - 0.4
  b.box(2.5, 8.2, 2.5, mat(tx, 4.1, tz), { color: wall })
  b.box(2.75, 0.3, 2.75, mat(tx, 8.3, tz), { color: darken(wall, 0.12) })
  for (const [dx, dz, r] of [[0, 1, 0], [0, -1, 0], [1, 0, Math.PI / 2], [-1, 0, Math.PI / 2]] as const)
    b.box(0.9, 1.5, 0.12, mat(tx + dx * 1.25, 7.0, tz + dz * 1.25, 0, r, 0), { color: '#1d2a33' })
  b.cone(1.9, 2.2, 4, mat(tx, 9.5, tz, 0, Math.PI / 4, 0), { color: TILE })
  b.box(0.1, 0.9, 0.1, mat(tx, 11.0, tz), { color: trim })
  b.box(0.5, 0.1, 0.1, mat(tx, 11.2, tz), { color: trim })
  b.cone(0.28, 0.42, 6, mat(tx, 6.7, tz), { color: trim })
  return { geometry: b.build(), radius: 5, height: 11, motion: 'none' }
}

export function buildShip(ctx: PropCtx): Built {
  const b = new Builder()
  const hullC = ctx.color ?? '#4a3320'
  const sailC = ctx.secondary ?? '#eee5cc'
  // Se construye con el eje largo en X (proa +x) y se gira al final para mirar a +z.
  const R = mat(0, 0.35, 0, 0, -Math.PI / 2, 0)
  const sh = new THREE.Shape()
  sh.moveTo(-4.0, 0.65)
  sh.quadraticCurveTo(-3.0, 0.0, -1.0, -0.05)
  sh.lineTo(2.2, 0.0)
  sh.quadraticCurveTo(4.0, 0.3, 5.0, 1.9)
  sh.lineTo(3.6, 1.55)
  sh.lineTo(-3.2, 1.55)
  sh.lineTo(-3.6, 2.5)
  sh.lineTo(-4.4, 2.5)
  sh.lineTo(-4.5, 1.2)
  sh.closePath()
  const g = new THREE.ExtrudeGeometry(sh, { depth: 1.9, bevelEnabled: true, bevelSize: 0.3, bevelThickness: 0.3, bevelSegments: 1 })
  g.translate(0, 0, -0.95)
  const p = g.getAttribute('position')
  for (let i = 0; i < p.count; i++) {
    const k = 1 - 0.78 * Math.pow(Math.min(1, Math.max(0, (Math.abs(p.getX(i) - 0.2) - 1.8) / 3.2)), 1.3)
    p.setZ(i, p.getZ(i) * k * (1 - 0.18 * Math.max(0, 1 - p.getY(i) / 1.5)))
  }
  b.add(g, R, { color: hullC })
  b.box(8.6, 0.12, 1.5, R.clone().multiply(mat(-0.3, 1.82, 0)), { color: '#b0956a' }) // cubierta
  b.box(8.9, 0.07, 2.35, R.clone().multiply(mat(-0.3, 1.5, 0)), { color: lighten(hullC, 0.25) }) // regala
  b.box(1.7, 1.0, 1.7, R.clone().multiply(mat(-3.4, 3.0, 0)), { color: darken(hullC, -0.05) }) // castillo de popa
  const masts: Array<[number, number]> = [[-2.4, 6.2], [0.6, 8.0], [3.1, 5.4]]
  for (const [mx, mh] of masts) {
    b.cyl(0.07, 0.11, mh, 6, R.clone().multiply(mat(mx, 1.9 + mh / 2, 0)), { color: WOOD })
    const levels = mh > 6 ? [0.5, 0.82] : [0.62]
    for (const lv of levels) {
      const y = 1.9 + mh * lv
      const yw = mh > 6 ? 2.6 : 2.1
      b.box(0.07, 0.07, yw + 0.3, R.clone().multiply(mat(mx + 0.05, y + 0.62, 0)), { color: WOOD })
      const sail = new THREE.PlaneGeometry(yw, mh * 0.3, 8, 4)
      const sp = sail.getAttribute('position')
      for (let i = 0; i < sp.count; i++) sp.setZ(i, 0.3 * (1 - Math.pow(sp.getX(i) / (yw / 2), 2)) * (0.6 + 0.4 * (1 - Math.abs(sp.getY(i)) / (mh * 0.15))))
      sail.rotateY(Math.PI / 2) // normal hacia proa
      b.add(sail, R.clone().multiply(mat(mx + 0.05, y - mh * 0.12 + 0.55, 0)), { color: sailC, double: true, jitter: 0.02, wind: (x, y2, z) => [0, 0.07 * Math.min(1, Math.abs(z) / (yw / 2))] })
    }
  }
  b.limb(V(4.4, 2.2, 0).applyMatrix4(R), V(6.1, 3.3, 0).applyMatrix4(R), 0.07, 0.04, 5, { color: WOOD }) // bauprés
  // bandera de popa
  b.add(new THREE.PlaneGeometry(1.0, 0.6, 6, 2), R.clone().multiply(mat(-4.3, 5.3, 0, 0, Math.PI / 2, 0)), { color: ctx.accent, double: true, wind: waveAlongX(-0.5, 1.0, 0.1) })
  b.cyl(0.03, 0.03, 2.2, 5, R.clone().multiply(mat(-4.3, 4.2, 0)), { color: WOOD })
  return { geometry: b.build(), radius: 2.2, height: 9, motion: 'idle', floats: true }
}

export function buildColumn(ctx: PropCtx, variant: number): Built {
  const rnd = mulberry32(ctx.seed + variant * 5)
  const b = new Builder()
  const c = ctx.color ?? '#ece8de'
  const broken = ctx.pose === 'fallen' || variant % 3 === 2
  const shaftH = broken ? range(rnd, 1.6, 2.4) : 3.6
  b.box(1.15, 0.28, 1.15, mat(0, 0.14, 0), { color: darken(c, 0.06) })
  b.cyl(0.5, 0.56, 0.16, 12, mat(0, 0.36, 0), { color: c })
  b.cyl(0.38, 0.46, shaftH, 12, mat(0, 0.44 + shaftH / 2, 0), { color: c })
  if (broken) {
    b.cone(0.38, 0.4, 5, mat(0, 0.44 + shaftH + 0.1, 0, 0.1, 0.5, 0.05), { color: c })
    b.cyl(0.42, 0.42, 0.8, 12, mat(1.1, 0.42, 0.3, 0, 0, Math.PI / 2 + 0.08), { color: c }) // tambor caído
  } else {
    b.cyl(0.52, 0.4, 0.3, 12, mat(0, 0.44 + shaftH + 0.15, 0), { color: c })
    b.box(1.2, 0.2, 1.2, mat(0, 0.44 + shaftH + 0.4, 0), { color: darken(c, 0.04) })
  }
  return { geometry: b.build(), radius: 0.6, height: broken ? shaftH + 0.6 : shaftH + 0.9, motion: 'none' }
}

export function buildArch(ctx: PropCtx): Built {
  const b = new Builder()
  const c = ctx.color ?? '#ece8de'
  const Ri = 1.9
  const Ro = 2.85
  const pierH = 4.0
  for (const s of [-1, 1]) {
    b.box(Ro - Ri, pierH, 1.1, mat(s * ((Ro + Ri) / 2), pierH / 2, 0), { color: c })
    b.box(Ro - Ri + 0.3, 0.3, 1.3, mat(s * ((Ro + Ri) / 2), 0.15, 0), { color: darken(c, 0.08) })
  }
  const sh = new THREE.Shape()
  sh.moveTo(-Ro, 0)
  sh.absarc(0, 0, Ro, Math.PI, 0, true)
  sh.lineTo(Ri, 0)
  sh.absarc(0, 0, Ri, 0, Math.PI, false)
  sh.closePath()
  const g = new THREE.ExtrudeGeometry(sh, { depth: 1.1, bevelEnabled: false, curveSegments: 10 })
  g.translate(0, 0, -0.55)
  b.add(g, mat(0, pierH, 0), { color: c })
  b.box(0.7, 0.9, 1.25, mat(0, pierH + Ri + 0.2, 0), { color: darken(c, 0.06) }) // clave
  b.box(Ro * 2 + 0.6, 0.32, 1.4, mat(0, pierH + Ro + 0.15, 0), { color: darken(c, 0.04) }) // cornisa
  return { geometry: b.build(), radius: 0.7, height: pierH + Ro + 0.4, motion: 'none' }
}

export function buildCampfire(ctx: PropCtx): Built {
  const b = new Builder()
  const rnd = mulberry32(ctx.seed + 3)
  const stone = '#8c867a'
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2
    b.add(rockGeometry(rnd, 0), mat(Math.cos(a) * 0.58, 0.1, Math.sin(a) * 0.58, rnd(), rnd() * 6, 0, 0.17, 0.13, 0.16), { color: lighten(stone, (rnd() - 0.5) * 0.2) })
  }
  b.cyl(0.46, 0.5, 0.05, 9, mat(0, 0.03, 0), { color: '#2a1d16' })
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI + 0.3
    b.cyl(0.07, 0.07, 1.0, 5, mat(0, 0.2, 0, 0.0, a, Math.PI / 2 - 0.35), { color: i % 2 ? '#4a3220' : '#3a2616' })
  }
  const flame = (r: number, h: number, x: number, z: number, color: string) =>
    b.cone(r, h, 6, mat(x, 0.18 + h / 2, z), { color, jitter: 0.02, wind: swayAbove(0.1, h, 0.09) })
  flame(0.26, 0.95, 0, 0, '#d9591a')
  flame(0.17, 0.7, 0.15, 0.1, '#ee8a26')
  flame(0.15, 0.62, -0.14, -0.08, '#ee8a26')
  flame(0.1, 0.5, 0, 0.02, '#f6c850')
  return { geometry: b.build(), radius: 0.7, height: 1.3, motion: 'none', light: { offset: [0, 0.8, 0], color: '#ff9a4a', intensity: 14, distance: 14 } }
}

export { mixHex }
