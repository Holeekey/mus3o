/** Qué está haciendo Aris respecto al jugador. Decide hacia dónde mira y si muestra el indicador de "pensando". */
export type ArisActivity = 'idle' | 'listening' | 'thinking' | 'speaking'

/** Lo máximo que se muestra "pensando" sin que llegue voz (respuesta silenciada, error de red...). */
export const ARIS_PENDING_MAX_MS = 8000

/**
 * Prioridad: escuchándote manda (siempre te mira, aunque estuviera hablando), luego hablando, luego pensando.
 * `pending` = pregunta enviada y aún sin voz de respuesta.
 */
export function arisActivity(i: { listening: boolean; pending: boolean; speaking: boolean }): ArisActivity {
  if (i.listening) return 'listening'
  if (i.speaking) return 'speaking'
  if (i.pending) return 'thinking'
  return 'idle'
}

/** ¿Sigue vigente una pregunta pendiente (`since` en ms, o null)? */
export function isArisPending(since: number | null, now: number): boolean {
  return since !== null && now - since < ARIS_PENDING_MAX_MS
}

/**
 * Dirección (plano XZ, unitaria) con la que Aris mira de perfil: 90° respecto a "mirarte", ni de frente ni de
 * espaldas. De los dos perfiles posibles elige el que mira hacia el centro de la vista (el lado contrario al hombro
 * donde flota) para que el giro se vea natural. Escribe en `out` para no crear objetos en cada fotograma.
 */
export function profileFacing(
  toUserX: number,
  toUserZ: number,
  rightX: number,
  rightZ: number,
  sideSign: number,
  out: { x: number; z: number } = { x: 0, z: 0 },
): { x: number; z: number } {
  const len = Math.hypot(toUserX, toUserZ) || 1
  const ux = toUserX / len
  const uz = toUserZ / len
  // Giro de +90° en Y: (x, z) → (z, -x). El otro perfil es el opuesto.
  const ax = uz
  const az = -ux
  const turnsTowardCenter = (ax * rightX + az * rightZ) * sideSign < 0
  out.x = turnsTowardCenter ? ax : -ax
  out.z = turnsTowardCenter ? az : -az
  return out
}
