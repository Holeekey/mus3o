import { useEffect, type RefObject } from 'react'

// Tramos según dónde está el centro del bloque en la pantalla (1 = borde inferior, 0 = borde superior):
// entra creciendo hasta SHOW_FROM, se queda entero hasta SHOW_TO y se achica al salir por arriba.
const ENTER_AT = 1
const SHOW_FROM = 0.65
const SHOW_TO = 0.2
const LEAVE_AT = -0.15

const smooth = (t: number) => t * t * (3 - 2 * t)

/** Cuánto se ve el bloque (0 oculto, 1 entero) según la posición de su centro en la pantalla. */
export function fadeAmount(center: number): number {
  if (center >= ENTER_AT || center <= LEAVE_AT) return 0
  if (center > SHOW_FROM) return smooth((ENTER_AT - center) / (ENTER_AT - SHOW_FROM))
  if (center < SHOW_TO) return smooth((center - LEAVE_AT) / (SHOW_TO - LEAVE_AT))
  return 1
}

/** Escribe --fade (0..1) en el elemento mientras se hace scroll, sin re-renderizar React. */
export function useScrollFade(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.style.setProperty('--fade', '1')
      return
    }
    let raf = 0
    const update = () => {
      raf = 0
      const rect = el.getBoundingClientRect()
      const center = (rect.top + rect.height / 2) / window.innerHeight
      el.style.setProperty('--fade', fadeAmount(center).toFixed(4))
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
}
