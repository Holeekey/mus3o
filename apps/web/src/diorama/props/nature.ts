import * as THREE from 'three'
import { Builder, darken, lighten, mat, mixHex, swayAbove } from '../geo'
import { mulberry32, range } from '../random'
import { WOOD, type Built, type PropCtx } from './common'

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)

type TreeKind = 'broadleaf' | 'umbrella' | 'palm' | 'pine'

function treeKindFor(ctx: PropCtx, variant: number): TreeKind {
  switch (ctx.terrain) {
    case 'mountains':
      return variant % 3 === 0 ? 'broadleaf' : 'pine'
    case 'coast':
      return 'palm'
    case 'desert':
      return variant % 2 ? 'palm' : 'umbrella'
    case 'forest':
      return variant % 3 === 1 ? 'pine' : 'broadleaf'
    case 'plain':
    case 'hills':
      return variant % 2 === 0 ? 'umbrella' : 'broadleaf' // samán de sabana / árbol de copa redonda
    default:
      return 'broadleaf'
  }
}

export function buildTree(ctx: PropCtx, variant: number): Built {
  const rnd = mulberry32(ctx.seed + variant * 193)
  const b = new Builder()
  const kind = treeKindFor(ctx, variant)
  const leaf = ctx.color ?? mixHex(darken(ctx.ground, 0.22), '#2f6a2a', 0.6)
  const bark = ctx.secondary ?? mixHex(WOOD, '#3c2a1a', 0.2)
  let height = 5

  if (kind === 'broadleaf') {
    const h = range(rnd, 2.0, 2.8)
    b.cyl(0.14, 0.26, h, 6, mat(0, h / 2, 0, 0, 0, (rnd() - 0.5) * 0.08), { color: bark })
    const blobs = 4 + Math.floor(rnd() * 3)
    for (let i = 0; i < blobs; i++) {
      const a = (i / blobs) * Math.PI * 2 + rnd()
      const r = i === 0 ? 0 : range(rnd, 0.7, 1.2)
      const R = range(rnd, 0.95, 1.4)
      const y = h + 0.5 + (i === 0 ? 0.7 : range(rnd, 0, 0.7))
      b.ico(R, mat(Math.cos(a) * r, y, Math.sin(a) * r, rnd(), rnd() * 3, 0, 1, 0.85, 1), {
        color: lighten(leaf, (rnd() - 0.4) * 0.18),
        wind: swayAbove(h - 0.2, 3.4, 0.12),
      }, 1)
    }
    height = h + 3
  } else if (kind === 'umbrella') {
    // copa ancha y plana, característica de los samanes
    const h = range(rnd, 3.0, 3.8)
    const lean = (rnd() - 0.5) * 0.18
    b.cyl(0.16, 0.34, h, 6, mat(0, h / 2, 0, 0, 0, lean), { color: bark })
    for (const s of [-1, 1]) b.limb(V(Math.sin(lean) * -h * 0.8, h * 0.78, 0), V(s * 1.4, h + 0.7, range(rnd, -0.5, 0.5)), 0.09, 0.05, 5, { color: bark })
    const cx = -Math.sin(lean) * h
    const blobs = 6
    for (let i = 0; i < blobs; i++) {
      const a = (i / blobs) * Math.PI * 2 + rnd() * 0.4
      const r = i === 0 ? 0 : range(rnd, 1.3, 2.1)
      b.ico(range(rnd, 1.3, 1.9), mat(cx + Math.cos(a) * r, h + 0.9 + range(rnd, -0.2, 0.3), Math.sin(a) * r, rnd(), rnd() * 3, 0, 1.35, 0.5, 1.35), {
        color: lighten(leaf, (rnd() - 0.4) * 0.15),
        wind: swayAbove(h - 0.3, 2.0, 0.08),
      }, 1)
    }
    height = h + 2
  } else if (kind === 'palm') {
    const h = range(rnd, 4.5, 6)
    const bendX = (rnd() - 0.5) * 1.2
    const seg = 6
    let prev = V(0, 0, 0)
    for (let i = 1; i <= seg; i++) {
      const t = i / seg
      const p = V(bendX * t * t, h * t, 0)
      b.limb(prev, p, 0.22 - 0.1 * ((i - 1) / seg), 0.22 - 0.1 * (i / seg), 6, { color: i % 2 ? bark : lighten(bark, 0.12) })
      prev = p
    }
    const top = prev
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rnd() * 0.3
      const len = range(rnd, 1.9, 2.5)
      const g = new THREE.PlaneGeometry(0.55, len, 1, 4)
      const bend = new THREE.Matrix4().makeRotationX(0)
      // fronda: se arquea hacia abajo con la distancia
      const p = g.getAttribute('position')
      for (let k = 0; k < p.count; k++) {
        const along = len / 2 - p.getY(k)
        p.setZ(k, -0.22 * along * along)
        p.setX(k, p.getX(k) * (1 - along / (len * 1.3)))
      }
      g.rotateX(-Math.PI / 2)
      g.translate(0, 0, len / 2)
      b.add(g, mat(top.x, top.y, top.z, 0, a, 0).multiply(bend), { color: lighten(leaf, (rnd() - 0.4) * 0.12), double: true, wind: swayAbove(top.y - 0.4, 2.2, 0.18) })
    }
    for (let i = 0; i < 3; i++) b.sph(0.11, mat(top.x + (i - 1) * 0.14, top.y - 0.12, 0.08), { color: '#6b4a24' }, 5, 4)
    height = h + 1
  } else {
    // pino: tres conos apilados
    const h = range(rnd, 4.5, 6.5)
    b.cyl(0.1, 0.2, 1.3, 5, mat(0, 0.65, 0), { color: bark })
    const tiers = 4
    for (let i = 0; i < tiers; i++) {
      const t = i / tiers
      b.cone((1.5 - t * 0.95) * (h / 5.5), h * 0.34, 7, mat(0, 1.0 + t * h * 0.62, 0, 0, rnd(), 0), {
        color: lighten(darken(leaf, 0.18), t * 0.16 + (rnd() - 0.5) * 0.06),
        wind: swayAbove(0.8, h, 0.1),
      })
    }
    height = h + 1
  }
  return { geometry: b.build(), radius: 0.4, height, motion: 'none' }
}

export function rockGeometry(rnd: () => number, detail = 1): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, detail)
  const p = g.getAttribute('position')
  const seen = new Map<string, number>()
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`
    let f = seen.get(key)
    if (f === undefined) {
      f = 0.78 + rnd() * 0.42
      seen.set(key, f)
    }
    p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f)
  }
  return g
}

export function buildRock(ctx: PropCtx, variant: number): Built {
  const rnd = mulberry32(ctx.seed + variant * 151)
  const b = new Builder()
  const tone = ctx.color ?? mixHex('#948e82', ctx.ground, 0.18)
  const n = 2 + Math.floor(rnd() * 2)
  for (let i = 0; i < n; i++) {
    const s = i === 0 ? range(rnd, 0.55, 0.85) : range(rnd, 0.22, 0.4)
    const x = i === 0 ? 0 : range(rnd, -0.7, 0.7)
    const z = i === 0 ? 0 : range(rnd, -0.6, 0.6)
    b.add(rockGeometry(rnd), mat(x, s * 0.45, z, rnd() * 0.5, rnd() * 6, rnd() * 0.5, s * 1.15, s * 0.78, s), { color: lighten(tone, (rnd() - 0.5) * 0.14), jitter: 0.05 })
  }
  return { geometry: b.build(), radius: 0.75, height: 0.9, motion: 'none' }
}

/** Mechón de hierba para InstancedMesh: tres hojas cónicas con balanceo. */
export function buildGrassTuft(color: string): THREE.BufferGeometry {
  const rnd = mulberry32(7)
  const b = new Builder()
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + rnd()
    const h = range(rnd, 0.26, 0.46)
    b.cone(0.036, h, 3, mat(Math.cos(a) * 0.07, h / 2, Math.sin(a) * 0.07, (rnd() - 0.5) * 0.35, a, (rnd() - 0.5) * 0.35), {
      color: lighten(color, (rnd() - 0.4) * 0.25),
      jitter: 0.02,
      wind: swayAbove(0, h, 0.16),
    })
  }
  return b.build()
}
