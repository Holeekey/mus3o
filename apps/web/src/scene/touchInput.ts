/**
 * Almacén mutable de entrada táctil.
 * Se lee directamente en cada frame por `Player.tsx` sin provocar re-renders de React,
 * garantizando 60 FPS con mínimo consumo de CPU y memoria.
 */
export const touchInput = {
  /** Movimiento lateral (-1 izquierda, +1 derecha) */
  moveX: 0,
  /** Movimiento frontal (+1 adelante, -1 atrás) */
  moveZ: 0,
  /** Si el desplazamiento supera el 80% del radio, corre */
  isRunning: false,
  /** Delta acumulado de rotación horizontal (yaw) */
  lookDx: 0,
  /** Delta acumulado de rotación vertical (pitch) */
  lookDy: 0,
  /** Si hay interacción táctil activa en este momento */
  active: false,
  /** Si el dispositivo actual tiene capacidades táctiles activas */
  isTouchDevice:
    typeof window !== 'undefined' &&
    Boolean('ontouchstart' in window && window.matchMedia?.('(pointer: coarse)').matches),
}

export function resetTouchMove() {
  touchInput.moveX = 0
  touchInput.moveZ = 0
  touchInput.isRunning = false
  touchInput.active = false
}

export function consumeTouchLook(): { dx: number; dy: number } {
  const dx = touchInput.lookDx
  const dy = touchInput.lookDy
  touchInput.lookDx = 0
  touchInput.lookDy = 0
  return { dx, dy }
}
