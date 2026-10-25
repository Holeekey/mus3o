import type { Box } from '../palace/layout'
import { ARIS_OFFSET } from './arisAnchor'

export const ARIS_RADIUS = 0.25

export type ArisPlacement = {
  x: number
  y: number
  z: number
  sideSign: number
}

function collides(x: number, z: number, colliders: readonly Box[], radius = ARIS_RADIUS): boolean {
  for (let i = 0; i < colliders.length; i++) {
    const b = colliders[i]
    if (Math.abs(x - b.x) < b.w / 2 + radius && Math.abs(z - b.z) < b.d / 2 + radius) {
      return true
    }
  }
  return false
}

/**
 * Calcula la posición meta de Aris evitando obstáculos (muros, pedestales, piezas):
 * 1. Prueba el hombro preferido a distancia completa.
 * 2. Si colisiona, prueba el hombro opuesto a distancia completa.
 * 3. Si ambos colisionan, repliega la distancia hacia el jugador progresivamente.
 * 4. Si el entorno es muy estrecho, se ubica cerca del jugador sin atravesar obstáculos.
 */
export function computeArisPosition(
  cameraPos: { x: number; y: number; z: number },
  forward: { x: number; z: number },
  right: { x: number; z: number },
  preferredSide: number,
  colliders: readonly Box[] = [],
  offset = ARIS_OFFSET,
): ArisPlacement {
  if (colliders.length === 0) {
    const s = preferredSide >= 0 ? 1 : -1
    return {
      x: cameraPos.x + forward.x * offset.forward + right.x * (s * offset.side),
      y: cameraPos.y - offset.down,
      z: cameraPos.z + forward.z * offset.forward + right.z * (s * offset.side),
      sideSign: s,
    }
  }

  const pref = preferredSide >= 0 ? 1 : -1
  const opp = -pref
  const scales = [1.0, 0.65, 0.35]

  for (let i = 0; i < scales.length; i++) {
    const s = scales[i]
    const fDist = offset.forward * s
    const sDist = offset.side * s

    // 1. Probar lado preferido
    const x1 = cameraPos.x + forward.x * fDist + right.x * (pref * sDist)
    const z1 = cameraPos.z + forward.z * fDist + right.z * (pref * sDist)
    if (!collides(x1, z1, colliders)) {
      return { x: x1, y: cameraPos.y - offset.down * s, z: z1, sideSign: pref }
    }

    // 2. Probar lado alternativo
    const x2 = cameraPos.x + forward.x * fDist + right.x * (opp * sDist)
    const z2 = cameraPos.z + forward.z * fDist + right.z * (opp * sDist)
    if (!collides(x2, z2, colliders)) {
      return { x: x2, y: cameraPos.y - offset.down * s, z: z2, sideSign: opp }
    }
  }

  // 3. Si ambos lados a corta distancia colisionan, probar justo al frente cerca
  const closeF = 0.3
  const xClose = cameraPos.x + forward.x * closeF
  const zClose = cameraPos.z + forward.z * closeF
  if (!collides(xClose, zClose, colliders)) {
    return { x: xClose, y: cameraPos.y - offset.down * 0.5, z: zClose, sideSign: pref }
  }

  // Fallback seguro: pegado al jugador (que ya está en espacio seguro)
  return {
    x: cameraPos.x,
    y: cameraPos.y - offset.down * 0.5,
    z: cameraPos.z,
    sideSign: pref,
  }
}
