import type { Camera, Vector3 } from 'three'
import { DOOR_W, moveWithCollisions, WALL_T, type Box, type PalaceLayout, type RoomLayout } from '../palace/layout'
import { moveAxes } from './moveInput'

// Caminata en primera persona: la comparten el museo (Player) y el lobby de la landing (LobbyWalker).
export const EYE = 1.7
export const WALK = 4.5
export const RUN = 8

/**
 * Avanza la cámara un frame según teclado (WASD/flechas, Shift para correr) o joystick táctil,
 * deslizándose contra los colliders. `forward` llega ya aplanado y normalizado.
 */
export function stepWalk(camera: Camera, forward: Vector3, keys: Record<string, boolean>, dt: number, colliders: Box[]) {
  const { ax, az, running } = moveAxes(keys)
  if (ax === 0 && az === 0) return
  const speed = (running ? RUN : WALK) * dt
  // derecha = forward × up = (-f.z, 0, f.x)
  let dx = forward.x * az - forward.z * ax
  let dz = forward.z * az + forward.x * ax
  const len = Math.hypot(dx, dz)
  if (len <= 0.001) return
  const mag = Math.min(1, len)
  dx = (dx / len) * speed * mag
  dz = (dz / len) * speed * mag
  const next = moveWithCollisions(colliders, camera.position.x, camera.position.z, dx, dz)
  camera.position.x = next.x
  camera.position.z = next.z
}

/** Muros que tapan los huecos de puerta de una sala: el lobby no tiene pasillos detrás. */
export function doorFillers(room: RoomLayout): Box[] {
  return room.doors.map((side) => {
    const ns = side === 'n' || side === 's'
    const x = side === 'e' ? room.x + room.w / 2 : side === 'w' ? room.x - room.w / 2 : room.x
    const z = side === 's' ? room.z + room.d / 2 : side === 'n' ? room.z - room.d / 2 : room.z
    return { x, z, w: ns ? DOOR_W : WALL_T, d: ns ? WALL_T : DOOR_W, h: room.height }
  })
}

// Pedestal del logo en el centro del lobby (donde iba el monumento); cubre también el giro de las letras (1.8 m).
export const LOGO_PEDESTAL = { w: 1.9, d: 1.9, h: 2 }

/**
 * Colliders del lobby: muros que caen dentro de la sala, el pedestal central del logo y las puertas tapiadas.
 * Los pedestales de conceptos no se dibujan en el lobby, así que no bloquean.
 */
export function lobbyColliders(layout: PalaceLayout, room: RoomLayout): Box[] {
  const inside = (b: Box) => Math.abs(b.x - room.x) <= room.w / 2 + WALL_T && Math.abs(b.z - room.z) <= room.d / 2 + WALL_T
  const pedestal = (b: Box) => room.pedestals.some((p) => p.x === b.x && p.z === b.z)
  const center = (b: Box) => b.x === room.x && b.z === room.z
  return [
    ...layout.colliders.filter((b) => inside(b) && !pedestal(b) && !center(b)),
    { x: room.x, z: room.z, ...LOGO_PEDESTAL },
    ...doorFillers(room),
  ]
}
