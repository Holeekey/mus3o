import { useEffect, useRef, type RefObject } from 'react'

// Tramo del scroll (0..1) que tarda la maqueta en abrirse y en cerrarse.
const RAMP = 0.35

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

/** Cuánto está abierta la maqueta (0 cerrada, 1 a pantalla completa) según el avance del scroll. */
export function openAmount(progress: number): number {
  const p = Math.min(1, Math.max(0, progress))
  if (p < RAMP) return easeInOut(p / RAMP)
  if (p > 1 - RAMP) return easeInOut((1 - p) / RAMP)
  return 1
}

/**
 * Escribe --open en la sección mientras se hace scroll, sin re-renderizar React.
 * Devuelve el mismo valor en un ref para que la cámara 3D lo lea en cada frame.
 */
export function useShowcaseScroll(ref: RefObject<HTMLElement | null>): RefObject<number> {
  const open = useRef(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      open.current = 1
      return
    }
    let raf = 0
    const update = () => {
      raf = 0
      const rect = el.getBoundingClientRect()
      const distance = rect.height - window.innerHeight
      const progress = distance > 0 ? -rect.top / distance : 0
      open.current = openAmount(progress)
      el.style.setProperty('--open', open.current.toFixed(4))
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [ref])
  return open
}
