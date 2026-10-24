import * as THREE from 'three'
import { Builder, darken, lighten, mat, swayAbove, waveAlongX } from '../geo'
import { mulberry32, pick } from '../random'
import { addFigure, type Hat } from './figure'
import { HORSE, STEEL, WOOD, type Built, type PropCtx } from './common'

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)

type HorseOpts = { coat: string; mane: string; blanket: string; gallop: boolean; fallen?: boolean }

// Caballo mirando a +z, cascos en y = 0, alzada ~1.6 m.
export function addHorse(b: Builder, root: THREE.Matrix4, o: HorseOpts) {
  let R = root.clone()
  if (o.fallen) R = R.multiply(mat(0, 0.4, 0, 0, 0, -Math.PI / 2)).multiply(mat(0, -1.15, 0))
  else if (o.gallop) R = R.multiply(mat(0, 0.22, 0, -0.1, 0, 0))
  const c = { color: o.coat }
  const dark = { color: darken(o.coat, 0.35) }
  // tronco: pecho, vientre y grupa
  b.ell(0.31, 0.34, 0.64, R.clone().multiply(mat(0, 1.15, -0.02)), c, 8, 6)
  b.ell(0.33, 0.37, 0.34, R.clone().multiply(mat(0, 1.19, 0.4)), c, 7, 5)
  b.ell(0.34, 0.36, 0.36, R.clone().multiply(mat(0, 1.2, -0.5)), c, 7, 5)
  // cuello y cabeza
  const nb = V(0, 1.36, 0.56).applyMatrix4(R)
  const nt = V(0, 1.93, 0.98).applyMatrix4(R)
  b.limb(nb, nt, 0.22, 0.12, 6, c)
  const hb = V(0, 1.96, 1.0).applyMatrix4(R)
  const hf = V(0, 1.6, 1.4).applyMatrix4(R)
  b.limb(hb, hf, 0.125, 0.075, 6, c)
  b.ell(0.085, 0.075, 0.11, R.clone().multiply(mat(0, 1.57, 1.43)), dark, 6, 4) // hocico
  for (const s of [-1, 1]) b.cone(0.032, 0.13, 4, R.clone().multiply(mat(s * 0.06, 2.06, 0.95)), c)
  // crines: tiras sobre el cuello, ondean un poco
  for (let i = 0; i < 6; i++) {
    const t = i / 5
    const p = V(0, 1.97 - 0.55 * t, 0.9 - 0.36 * t - 0.04).applyMatrix4(R)
    b.box(0.05, 0.16, 0.09, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z).multiply(new THREE.Matrix4().extractRotation(R)), { color: o.mane, wind: swayAbove(p.y - 0.2, 0.3, 0.03) })
  }
  // cola
  const t0 = V(0, 1.38, -0.8).applyMatrix4(R)
  const t1 = V(0, 0.82, -1.08).applyMatrix4(R)
  b.limb(t0, t1, 0.06, 0.03, 5, { color: o.mane, wind: (x, y, z) => [0.14 * Math.pow(Math.min(1, Math.max(0, (t0.y - y) / 0.6)), 1.3), 0] })
  // manta y silla
  b.box(0.56, 0.05, 0.62, R.clone().multiply(mat(0, 1.5, -0.04)), { color: o.blanket })
  b.box(0.3, 0.08, 0.34, R.clone().multiply(mat(0, 1.55, -0.04)), { color: '#4a2f1f' })
  // patas
  const legs: Array<{ x: number; z: number; sw: number; bend: number; front: boolean }> = o.gallop
    ? [
        { x: -0.17, z: 0.46, sw: 1.0, bend: -0.55, front: true },
        { x: 0.17, z: 0.46, sw: 0.5, bend: -1.35, front: true },
        { x: -0.17, z: -0.5, sw: -0.95, bend: 0.2, front: false },
        { x: 0.17, z: -0.5, sw: -0.25, bend: 1.15, front: false },
      ]
    : o.fallen
      ? [
          { x: -0.17, z: 0.46, sw: 0.5, bend: -0.2, front: true },
          { x: 0.17, z: 0.46, sw: 1.1, bend: -0.5, front: true },
          { x: -0.17, z: -0.5, sw: -0.7, bend: 0.3, front: false },
          { x: 0.17, z: -0.5, sw: -0.3, bend: 0.7, front: false },
        ]
      : [
          { x: -0.17, z: 0.46, sw: 0, bend: 0, front: true },
          { x: 0.17, z: 0.46, sw: 0.0, bend: 0, front: true },
          { x: -0.17, z: -0.5, sw: -0.22, bend: 0.4, front: false },
          { x: 0.17, z: -0.5, sw: -0.22, bend: 0.4, front: false },
        ]
  for (const l of legs) {
    const M1 = R.clone().multiply(mat(l.x, 1.0, l.z, -l.sw, 0, 0))
    const j0 = V().applyMatrix4(M1)
    const j1 = V(0, -0.5, 0).applyMatrix4(M1)
    const M2 = M1.clone().multiply(mat(0, -0.5, 0, -l.bend, 0, 0))
    const j2 = V(0, -0.5, 0).applyMatrix4(M2)
    b.limb(j0, j1, 0.1, 0.06, 6, c)
    b.limb(j1, j2, 0.055, 0.045, 6, dark)
    b.box(0.1, 0.07, 0.12, M2.clone().multiply(mat(0, -0.5, 0.0)), { color: '#1b1714' })
  }
}

export function horseCoat(rnd: () => number, ctx: PropCtx, variant: number) {
  return ctx.color ?? HORSE[(variant * 2 + Math.floor(rnd() * 2)) % HORSE.length]
}

export function buildHorse(ctx: PropCtx, variant: number): Built {
  const rnd = mulberry32(ctx.seed + variant * 313)
  const b = new Builder()
  const pose = ctx.pose ?? 'standing'
  const coat = horseCoat(rnd, ctx, variant)
  addHorse(b, new THREE.Matrix4(), {
    coat,
    mane: darken(coat, 0.55),
    blanket: ctx.secondary ?? pick(rnd, ['#a8322d', '#2f4d8f', '#e8e3d3']),
    gallop: pose === 'charging',
    fallen: pose === 'fallen',
  })
  return { geometry: b.build(), radius: 0, height: pose === 'fallen' ? 0.8 : 2.0, motion: pose === 'charging' ? 'gallop' : 'breath' }
}

/** Jinete: figura sentada sobre el caballo; en carga lleva lanza con banderín. */
export function buildRider(ctx: PropCtx, variant: number): Built {
  const rnd = mulberry32(ctx.seed + variant * 541)
  const b = new Builder()
  const pose = ctx.pose ?? 'charging'
  // Los jefes (brazo en alto o señalando) montan caballo blanco; la tropa, alazanes y bayos.
  const coat = pose === 'raising-arm' || pose === 'pointing' ? '#e2dccd' : HORSE[(variant * 2 + Math.floor(rnd() * 3)) % HORSE.length]
  const gallop = pose === 'charging'
  const I = new THREE.Matrix4()
  addHorse(b, I, { coat, mane: darken(coat, 0.55), blanket: ctx.secondary ?? '#a8322d', gallop })
  // el jinete sigue el cabeceo del galope
  const base = gallop ? mat(0, 0.22, 0, -0.1, 0, 0) : I
  const uniform = ctx.color ?? '#2f4d8f'
  const hat: Hat = 'llanero'
  const hands = addFigure(
    b,
    base.clone().multiply(mat(0, 0.0, -0.06)),
    { uniform, trim: ctx.secondary ?? '#e8e3d3', skin: ['#a06a45', '#6e4630', '#c68a5e'][variant % 3], hat, pose, weapon: 'none', ride: true, lean: gallop ? 0.28 : pose === 'raising-arm' ? 0.05 : 0 },
    rnd,
  )
  const hand = hands.rightHand
  if (gallop) {
    // lanza: empuñada abajo, apunta adelante y un poco hacia el suelo
    const p0 = hand.clone().add(V(0, 0.12, -1.0))
    const p1 = hand.clone().add(V(0.02, -0.4, 2.2))
    b.limb(p0, p1, 0.022, 0.015, 5, { color: WOOD })
    const tip = p1.clone().add(p1.clone().sub(p0).normalize().multiplyScalar(0.3))
    b.limb(p1, tip, 0.02, 0.002, 4, { color: STEEL })
    // banderín triangular detrás de la punta
    const flagGeo = new THREE.BufferGeometry()
    flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -0.5, 0.0, 0.0, -0.5, -0.17, 0.0], 3))
    flagGeo.rotateY(Math.PI / 2)
    b.add(flagGeo, new THREE.Matrix4().makeTranslation(p1.x, p1.y + 0.04, p1.z - 0.05), {
      color: ctx.color ? lighten(ctx.color, 0.2) : '#c8102e',
      double: true,
      jitter: 0,
      wind: (_x, _y, z) => [0, 0.09 * Math.min(1, Math.max(0, (p1.z - z) / 0.5))],
    })
  } else if (pose === 'raising-arm') {
    b.limb(hand.clone().add(V(0, -0.1, 0)), hand.clone().add(V(0, 0.85, 0.05)), 0.014, 0.01, 4, { color: STEEL })
  }
  return { geometry: b.build(), radius: 0, height: 2.7, motion: gallop ? 'gallop' : 'breath' }
}

export { waveAlongX }
