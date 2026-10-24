import * as THREE from 'three'
import type { DioramaPose } from '../dioramaSchema'
import { Builder, darken, lighten, mat } from '../geo'
import { mulberry32, pick } from '../random'
import { IRON, SKIN, STEEL, WOOD, type Built, type PropCtx } from './common'

// Humano low-poly: torso, cabeza, brazos y piernas articulados. La pose son rotaciones de
// articulaciones (positivo = hacia adelante, +z). Mira hacia +z, pies en y = 0.

export type Hat = 'shako' | 'llanero' | 'tricorn' | 'cap' | 'none'

export type FigureOpts = {
  uniform: string
  trim: string
  skin: string
  hat: Hat
  hatColor?: string
  pose: DioramaPose
  /** Arma automática según la pose. */
  weapon: 'auto' | 'none'
  ride?: boolean
  lean?: number
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)

type Joint = { M2: THREE.Matrix4; elbow: THREE.Vector3; end: THREE.Vector3; root: THREE.Vector3 }

// Cadena de dos huesos (brazo o pierna) con esfera en la articulación.
function chain(
  b: Builder,
  M: THREE.Matrix4,
  at: THREE.Vector3,
  swing: number,
  abduct: number,
  bend: number,
  L1: number,
  L2: number,
  r: [number, number, number],
  c1: string,
  c2: string,
): Joint {
  const M1 = M.clone().multiply(mat(at.x, at.y, at.z, -swing, 0, abduct))
  const root = V().applyMatrix4(M1)
  const elbow = V(0, -L1, 0).applyMatrix4(M1)
  const M2 = M1.clone().multiply(mat(0, -L1, 0, -bend, 0, 0))
  const end = V(0, -L2, 0).applyMatrix4(M2)
  b.limb(root, elbow, r[0], r[1], 6, { color: c1 })
  b.limb(elbow, end, r[1], r[2], 6, { color: c2 })
  b.sph(r[1] * 1.08, mat(elbow.x, elbow.y, elbow.z), { color: c1 }, 5, 4)
  return { M2, elbow, end, root }
}

const rotOnly = (m: THREE.Matrix4) => new THREE.Matrix4().extractRotation(m)

export function addFigure(b: Builder, root: THREE.Matrix4, o: FigureOpts, rnd: () => number): { rightHand: THREE.Vector3; leftHand: THREE.Vector3 } {
  const trousers = o.trim
  const jacket = o.uniform
  const boot = '#1d1a18'
  const pose = o.pose

  // --- Pose: ángulos de articulaciones ---
  let R = root.clone()
  let lean = o.lean ?? 0
  let thigh: [number, number] = [0, 0]
  let knee: [number, number] = [0, 0]
  let spread = 0.06
  let arm: { sh: [number, number]; ab: [number, number]; el: [number, number] } = { sh: [0.1, 0.1], ab: [0.12, 0.12], el: [0.15, 0.15] }
  let seat = false
  const jitter = (rnd() - 0.5) * 0.1

  switch (pose) {
    case 'standing':
      arm = { sh: [0.35, 0.05], ab: [0.1, 0.12], el: [1.35, 0.2] } // der. sostiene el fusil
      break
    case 'pointing':
      arm = { sh: [1.55, 0.1], ab: [0.05, 0.1], el: [0.05, 1.5] }
      thigh = [0.18, -0.12]
      lean = 0.05
      break
    case 'charging':
      lean = Math.max(lean, 0.3)
      thigh = [0.75, -0.55]
      knee = [0.15, 1.05]
      arm = { sh: [1.0, 0.9], ab: [0.15, 0.05], el: [0.5, 0.9] }
      R = R.clone().multiply(mat(0, 0.0, 0.04, 0, 0, 0))
      break
    case 'raising-arm':
      arm = { sh: [2.85, 0.1], ab: [0.25, 0.1], el: [0.2, 0.2] }
      thigh = [0.1, -0.1]
      break
    case 'seated':
      seat = true
      R = R.clone().multiply(mat(0, -0.45, 0))
      thigh = [1.5, 1.5]
      knee = [1.55, 1.55]
      arm = { sh: [0.5, 0.5], ab: [0.1, 0.1], el: [1.1, 1.1] }
      spread = 0.07
      break
    case 'fallen':
      R = R.clone().multiply(mat(0.06 + jitter, 0.15, 0.86, -Math.PI / 2, jitter * 3, 0))
      thigh = [0.25, -0.2]
      knee = [0.35, 0.15]
      arm = { sh: [0.2, 0.15], ab: [0.65, 0.9], el: [0.2, 0.6] }
      break
  }
  if (o.ride) {
    R = R.clone().multiply(mat(0, 0.6, 0))
    thigh = [1.0, 1.0]
    knee = [1.35, 1.35]
    arm = { sh: [pose === 'pointing' ? 1.55 : 0.85, 0.85], ab: [0.1, 0.12], el: [pose === 'pointing' ? 0.05 : 0.9, 0.85] }
  }

  // --- Caderas, piernas y botas ---
  const hipY = 0.92
  const legs: Joint[] = []
  for (const [i, s] of [-1, 1].entries()) {
    const j = chain(b, R, V(s * 0.1, hipY, 0), thigh[i], s * (o.ride ? 0.5 : spread), knee[i], 0.45, 0.45, [0.09, 0.075, 0.058], trousers, darken(trousers, 0.04))
    legs.push(j)
    // caña y pie de la bota, orientados con la pierna
    const Mb = j.M2.clone().multiply(mat(0, -0.28, 0.01))
    b.cyl(0.066, 0.06, 0.26, 6, Mb, { color: boot })
    const Mf = j.M2.clone().multiply(mat(0, -0.42, 0.06, o.ride ? -0.0 : 0))
    b.box(0.11, 0.08, 0.27, Mf, { color: boot })
  }
  b.cyl(0.18, 0.17, 0.2, 8, R.clone().multiply(mat(0, hipY + 0.02, 0, 0, 0, 0, 1, 1, 0.7)), { color: trousers })

  // --- Torso (gira sobre la cadera para inclinarse) ---
  const T = R.clone().multiply(mat(0, hipY, 0, -lean, 0, 0))
  b.cyl(0.215, 0.165, 0.62, 8, T.clone().multiply(mat(0, 0.33, 0, 0, 0, 0, 1, 1, 0.66)), { color: jacket })
  // cinturón y tahalíes cruzados sobre el pecho
  b.cyl(0.172, 0.172, 0.05, 8, T.clone().multiply(mat(0, 0.06, 0, 0, 0, 0, 1, 1, 0.7)), { color: darken(jacket, 0.5) })
  for (const s of [-1, 1]) b.box(0.05, 0.62, 0.02, T.clone().multiply(mat(0, 0.34, 0.125, 0, 0, s * 0.5)), { color: o.trim === jacket ? lighten(jacket, 0.4) : lighten(o.trim, 0.5) })
  b.cyl(0.07, 0.07, 0.06, 6, T.clone().multiply(mat(0, 0.66, 0)), { color: lighten(jacket, 0.15) }) // cuello
  // cabeza
  const head = T.clone().multiply(mat(0, 0.78, 0.01, 0.0, 0, 0))
  b.ell(0.095, 0.115, 0.105, head, { color: o.skin }, 7, 5)
  b.box(0.03, 0.04, 0.03, head.clone().multiply(mat(0, -0.01, 0.1)), { color: darken(o.skin, 0.1) }) // nariz
  addHat(b, head, o)

  // --- Brazos ---
  const arms: Joint[] = []
  for (const [i, s] of [-1, 1].entries()) {
    b.sph(0.065, T.clone().multiply(mat(s * 0.225, 0.56, 0)), { color: jacket }, 5, 4)
    const j = chain(b, T, V(s * 0.23, 0.56, 0), arm.sh[i], s * arm.ab[i], arm.el[i], 0.3, 0.27, [0.055, 0.047, 0.04], jacket, jacket)
    arms.push(j)
    b.sph(0.045, new THREE.Matrix4().makeTranslation(j.end.x, j.end.y, j.end.z), { color: o.skin }, 5, 4)
  }

  // --- Arma según la pose ---
  if (o.weapon === 'auto') {
    const hand = arms[1].end // derecha
    const Rrot = rotOnly(R)
    const Trot = rotOnly(T)
    const dir = (m: THREE.Matrix4, x: number, y: number, z: number) => V(x, y, z).applyMatrix4(m)
    const musket = (p0: THREE.Vector3, p1: THREE.Vector3) => {
      const mid = p0.clone().lerp(p1, 0.42)
      b.limb(p0, mid, 0.03, 0.022, 5, { color: WOOD })
      b.limb(mid, p1, 0.014, 0.014, 5, { color: STEEL })
      const tip = p1.clone().add(p1.clone().sub(p0).normalize().multiplyScalar(0.36))
      b.limb(p1, tip, 0.012, 0.002, 4, { color: STEEL })
    }
    if (pose === 'standing' && !o.ride) {
      musket(hand.clone().add(dir(Rrot, 0.02, -0.7, 0.02)), hand.clone().add(dir(Rrot, 0, 0.62, 0)))
    } else if (pose === 'charging' && !o.ride) {
      musket(hand.clone().add(dir(Trot, 0.0, 0.0, -0.5)), hand.clone().add(dir(Trot, -0.02, -0.18, 0.75)))
    } else if (pose === 'raising-arm') {
      const tip = hand.clone().add(dir(Rrot, 0, 0.8, 0.05))
      b.limb(hand.clone().add(dir(Rrot, 0, -0.08, 0)), tip, 0.014, 0.01, 4, { color: STEEL })
      b.box(0.1, 0.02, 0.025, new THREE.Matrix4().makeTranslation(hand.x, hand.y + 0.02, hand.z), { color: '#c9a24b' })
    } else if (pose === 'fallen') {
      const a = dir(root, 0.62, 0.04, -0.6)
      const c = dir(root, 0.48, 0.06, 1.0)
      musket(a, c)
    } else if (pose === 'seated' && !o.ride) {
      b.box(0.5, 0.45, 0.42, root.clone().multiply(mat(0, 0.225, -0.05)), { color: '#d9d3c4' }) // asiento de piedra
    }
  }
  return { rightHand: arms[1].end, leftHand: arms[0].end }
}

function addHat(b: Builder, head: THREE.Matrix4, o: FigureOpts) {
  const hc = o.hatColor ?? '#1c1c1f'
  switch (o.hat) {
    case 'shako':
      b.cyl(0.098, 0.108, 0.22, 8, head.clone().multiply(mat(0, 0.2, -0.005)), { color: hc })
      b.cyl(0.11, 0.11, 0.035, 8, head.clone().multiply(mat(0, 0.1, -0.005)), { color: o.trim })
      b.box(0.15, 0.015, 0.09, head.clone().multiply(mat(0, 0.1, 0.1, 0.12)), { color: '#101010' }) // visera
      b.cone(0.04, 0.12, 5, head.clone().multiply(mat(0, 0.38, -0.005)), { color: o.uniform }) // plumero
      break
    case 'llanero':
      b.cyl(0.255, 0.255, 0.014, 10, head.clone().multiply(mat(0, 0.1, 0, 0.05, 0, 0.05)), { color: '#cfae72' })
      b.cyl(0.085, 0.115, 0.13, 8, head.clone().multiply(mat(0, 0.17, 0)), { color: '#d9ba7e' })
      b.cyl(0.118, 0.12, 0.035, 8, head.clone().multiply(mat(0, 0.125, 0)), { color: o.trim })
      break
    case 'tricorn':
      b.cyl(0.19, 0.19, 0.07, 3, head.clone().multiply(mat(0, 0.13, 0, 0, Math.PI / 6, 0)), { color: hc })
      b.cyl(0.2, 0.2, 0.012, 3, head.clone().multiply(mat(0, 0.1, 0, 0, Math.PI / 6, 0)), { color: '#c9a24b' })
      break
    case 'cap':
      b.ell(0.11, 0.075, 0.115, head.clone().multiply(mat(0, 0.08, 0)), { color: hc }, 7, 4)
      b.box(0.14, 0.012, 0.07, head.clone().multiply(mat(0, 0.06, 0.1)), { color: hc })
      break
    default:
      b.ell(0.1, 0.07, 0.11, head.clone().multiply(mat(0, 0.07, -0.01)), { color: '#2a1d16' }, 6, 4) // cabello
  }
}

/** Figura suelta (o variante de un pelotón). */
export function buildFigure(ctx: PropCtx, variant: number): Built {
  const rnd = mulberry32(ctx.seed + variant * 977)
  const b = new Builder()
  const pose = ctx.pose ?? 'standing'
  const uniform = ctx.color ?? pick(rnd, ['#2f4d8f', '#7a1f1f', '#4a5d3a'])
  const trim = ctx.secondary ?? '#e8e3d3'
  const skin = SKIN[(variant + Math.floor(rnd() * 3)) % SKIN.length]
  const hat: Hat = variant % 3 === 2 ? 'cap' : 'shako'
  addFigure(b, new THREE.Matrix4(), { uniform, trim, skin, hat, pose, weapon: 'auto', hatColor: variant % 3 === 1 ? '#2a2a30' : '#1c1c1f' }, rnd)
  return { geometry: b.build(), radius: 0, height: pose === 'fallen' ? 0.3 : pose === 'seated' ? 1.25 : 1.75, motion: pose === 'standing' || pose === 'pointing' ? 'breath' : 'none' }
}

export { IRON }
