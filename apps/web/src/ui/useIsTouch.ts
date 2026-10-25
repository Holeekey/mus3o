import { useEffect, useSyncExternalStore } from 'react'
import { markTouchDevice, subscribeTouchDevice, touchInput } from '../scene/touchInput'

const getTouch = () => touchInput.isTouchDevice

/** true en pantallas táctiles: la interfaz cambia teclas por botones. Se activa con el primer toque. */
export function useIsTouch(): boolean {
  useEffect(() => {
    if (touchInput.isTouchDevice || window.matchMedia?.('(pointer: coarse)').matches) {
      markTouchDevice()
      return
    }
    window.addEventListener('touchstart', markTouchDevice, { once: true, passive: true })
    return () => window.removeEventListener('touchstart', markTouchDevice)
  }, [])
  return useSyncExternalStore(subscribeTouchDevice, getTouch, getTouch)
}
