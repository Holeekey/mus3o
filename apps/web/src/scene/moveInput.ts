import { consumeTouchLook, touchInput } from './touchInput'

/**
 * Entrada de movimiento combinada: teclado (WASD, flechas, Shift) o joystick táctil (analógico).
 * La usan el palacio (Player) y el interior del cuadro (DioramaRuntime), así ambos se mueven igual.
 */
export function moveAxes(k: Record<string, boolean | undefined>): { ax: number; az: number; running: boolean } {
  const keyAx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0)
  const keyAz = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0)
  return {
    ax: keyAx !== 0 ? keyAx : touchInput.moveX,
    az: keyAz !== 0 ? keyAz : touchInput.moveZ,
    running: !!(k.ShiftLeft || k.ShiftRight) || touchInput.isRunning,
  }
}

/** Aplica el deslizamiento táctil pendiente a la cámara (yaw y pitch, pitch entre -80° y +80°). */
export function applyTouchLook(camera: { rotation: { x: number; y: number } }) {
  const { dx, dy } = consumeTouchLook()
  if (dx === 0 && dy === 0) return
  camera.rotation.y -= dx
  camera.rotation.x = Math.max(-1.4, Math.min(1.4, camera.rotation.x - dy))
}
