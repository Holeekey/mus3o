import { Quaternion, Vector3 } from 'three'
import { moveWithCollisions, type Box } from '../palace/layout'

// Caminar dentro del cuadro: límites, obstáculos y agua. Pura (sin React) para que DioramaRuntime (teclado, mando) y el
// teletransporte por mirada de VR usen exactamente las mismas colisiones.

/** El mundo del cuadro vive lejos del palacio, en el mismo Canvas. */
export const DIORAMA_ORIGIN_XZ = { x: 1500, z: 1500 }
export const DIORAMA_BOUND = 13.4
export const DIORAMA_PLAYER_R = 0.4
/** Marco de regreso: pisar su zona sale del cuadro, así que el teletransporte no puede aterrizar ahí. */
export const DIORAMA_GATE_Z = 13.2

export type DioramaCollider = { x: number; z: number; r: number }
export type DioramaField = { isWater(x: number, z: number): boolean; heightAt(x: number, z: number): number }

/** Límites invisibles + obstáculos circulares (árboles, cañones...) como cajas, igual que el movimiento normal. */
export function dioramaBoxes(colliders: readonly DioramaCollider[]): Box[] {
  const B = DIORAMA_BOUND
  return [
    { x: 0, z: -B - 5, w: 80, d: 10, h: 9 },
    { x: 0, z: B + 5 + 0.9, w: 80, d: 10, h: 9 },
    { x: -B - 5, z: 0, w: 10, d: 80, h: 9 },
    { x: B + 5, z: 0, w: 10, d: 80, h: 9 },
    ...colliders.map((c) => ({ x: c.x, z: c.z, w: c.r * 2 - DIORAMA_PLAYER_R * 1.2, d: c.r * 2 - DIORAMA_PLAYER_R * 1.2, h: 2 })),
  ]
}

export type DioramaTeleportCheck = { ok: true; x: number; z: number } | { ok: false; reason: 'far' | 'near' | 'bounds' | 'water' | 'blocked' | 'gate' }

/**
 * Valida un salto por mirada dentro del cuadro (coordenadas locales): alcance, dentro de los límites, fuera del agua y de
 * los obstáculos, lejos del marco de regreso y sin obstáculo ni agua en el trayecto (pasos de 25 cm con las colisiones normales).
 */
export function validateDioramaTeleport(
  boxes: readonly Box[],
  field: Pick<DioramaField, 'isWater'>,
  from: { x: number; z: number },
  to: { x: number; z: number },
  opts: { maxDist?: number; minDist?: number } = {},
): DioramaTeleportCheck {
  const { maxDist = 10, minDist = 0.6 } = opts
  const dist = Math.hypot(to.x - from.x, to.z - from.z)
  if (dist > maxDist) return { ok: false, reason: 'far' }
  if (dist < minDist) return { ok: false, reason: 'near' }
  const lim = DIORAMA_BOUND - 0.5
  if (Math.abs(to.x) > lim || Math.abs(to.z) > lim) return { ok: false, reason: 'bounds' }
  if (to.z > DIORAMA_GATE_Z - 1.6 && Math.abs(to.x) < 2.2) return { ok: false, reason: 'gate' }
  if (field.isWater(to.x, to.z)) return { ok: false, reason: 'water' }
  const steps = Math.ceil(dist / 0.25)
  const sx = (to.x - from.x) / steps
  const sz = (to.z - from.z) / steps
  let cx = from.x
  let cz = from.z
  for (let i = 0; i < steps; i++) {
    const n = moveWithCollisions(boxes as Box[], cx, cz, sx, sz)
    if (Math.abs(n.x - (cx + sx)) > 1e-6 || Math.abs(n.z - (cz + sz)) > 1e-6) return { ok: false, reason: 'blocked' }
    cx = n.x
    cz = n.z
    if (field.isWater(cx, cz)) return { ok: false, reason: 'water' }
  }
  return { ok: true, x: to.x, z: to.z }
}

const Y = new Vector3(0, 1, 0)

/**
 * WebXR: la cámara la manda el visor, así que mover al jugador es mover el *rig* (el espacio de referencia de la sesión).
 * Devuelve dónde debe quedar el rig para que la CABEZA esté en `player` (posición local del cuadro + origen del mundo):
 * rig = cabeza_objetivo − R(yaw)·cabeza_física, donde `phys` es la cabeza en el espacio base del visor (el desplazamiento
 * real de la persona en su habitación, que el cuadro no controla).
 */
export function rigForHead(player: { x: number; z: number }, phys: { x: number; z: number }, yaw: number, origin = DIORAMA_ORIGIN_XZ): { x: number; z: number } {
  const p = new Vector3(phys.x, 0, phys.z).applyQuaternion(new Quaternion().setFromAxisAngle(Y, yaw))
  return { x: origin.x + player.x - p.x, z: origin.z + player.z - p.z }
}
