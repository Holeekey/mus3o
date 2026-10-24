import * as THREE from 'three'
import { Builder, mat, waveAlongX } from '../geo'
import { mulberry32 } from '../random'
import { GOLD, WOOD, type Built, type PropCtx } from './common'

// Bandera sobre asta. La tela es un plano subdividido por franjas; el movimiento lo hace el
// shader de viento (aWind.y), así que no cuesta CPU. Por defecto: amarillo, azul y rojo.
// Con `pattern: 'saltire'` es un aspa: campo `color` y aspa `secondary` (la Cruz de Borgoña
// española: campo blanco y aspa roja "nudosa", hecha de troncos con los muñones de las ramas).
export function buildFlag(ctx: PropCtx, variant: number): Built {
  const rnd = mulberry32(ctx.seed + variant * 71)
  const b = new Builder()
  const stripes: Array<[string, number]> = [
    [ctx.color ?? '#f2c200', 0.5],
    [ctx.secondary ?? '#1f3fa0', 0.25],
    [ctx.accent && ctx.accent !== '#c9963a' ? ctx.accent : '#c8102e', 0.25],
  ]
  const tilt = (rnd() - 0.5) * 0.12
  const root = mat(0, 0, 0, 0, 0, tilt)
  const H = 3.6 // alto del asta
  const poleTop = new THREE.Vector3(0, H, 0).applyMatrix4(root)
  b.limb(new THREE.Vector3(0, 0, 0), poleTop, 0.04, 0.026, 6, { color: WOOD })
  b.sph(0.05, new THREE.Matrix4().makeTranslation(poleTop.x, poleTop.y + 0.02, poleTop.z), { color: GOLD }, 6, 4)
  b.cone(0.045, 0.2, 5, mat(poleTop.x, poleTop.y + 0.14, poleTop.z, 0, 0, tilt), { color: GOLD })

  const W = 1.7
  const FH = 1.1
  const top = H - 0.2
  if (ctx.pattern === 'saltire') {
    const wind = waveAlongX(0.04, W, 0.13)
    const field = ctx.color ?? '#efe8d8'
    const cross = ctx.secondary ?? '#b3262d'
    const cx = 0.04 + W / 2
    const cy = top - FH / 2
    const g = new THREE.PlaneGeometry(W, FH, 14, 7)
    b.add(g, root.clone().multiply(mat(cx, cy, 0)), { color: field, double: true, jitter: 0.012, wind })
    // dos troncos en diagonal, cada uno en tramos desiguales con muñones en las uniones
    const L = Math.hypot(W, FH) - 0.12
    const ang = Math.atan2(FH, W)
    const K = 7
    const wid = 0.1
    for (const sign of [1, -1]) {
      const a = ang * sign
      const dx = Math.cos(a)
      const dy = Math.sin(a)
      for (let i = 0; i < K; i++) {
        const t = ((i + 0.5) / K - 0.5) * L
        const wob = (i % 2 ? 1 : -1) * 0.018 // el tronco no es recto
        const px = cx + dx * t - dy * wob
        const py = cy + dy * t + dx * wob
        const len = (L / K) * 1.12
        const seg = new THREE.PlaneGeometry(len, wid, Math.max(2, Math.ceil(len * 5)), 1)
        for (const z of [0.006, -0.006]) b.add(seg, root.clone().multiply(mat(px, py, z, 0, 0, a + (i % 2 ? 0.07 : -0.07))), { color: cross, double: true, jitter: 0.02, wind })
        // muñón de una rama cortada, cruzado en cada unión
        if (i > 0) {
          const jt = (i / K - 0.5) * L
          const jx = cx + dx * jt
          const jy = cy + dy * jt
          const stub = new THREE.PlaneGeometry(0.2, 0.05, 2, 1)
          for (const z of [0.007, -0.007]) b.add(stub, root.clone().multiply(mat(jx, jy, z, 0, 0, a + (i % 2 ? 1 : -1) * 1.0)), { color: cross, double: true, jitter: 0.02, wind })
        }
      }
    }
  }
  let y = top
  for (const [color, frac] of stripes) {
    if (ctx.pattern === 'saltire') break
    const h = FH * frac
    const segY = Math.max(2, Math.round(h * 6))
    const g = new THREE.PlaneGeometry(W, h, 14, segY)
    b.add(g, root.clone().multiply(mat(0.04 + W / 2, y - h / 2, 0)), { color, double: true, jitter: 0.015, wind: waveAlongX(0.04, W, 0.13) })
    y -= h
  }
  // moño de cordón en el asta
  b.cyl(0.05, 0.05, 0.05, 6, root.clone().multiply(mat(0, top - FH * 0.5, 0)), { color: GOLD })
  return { geometry: b.build(), radius: 0.15, height: H + 0.3, motion: 'none' }
}
