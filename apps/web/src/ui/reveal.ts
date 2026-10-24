import { useEffect, type RefObject } from 'react'

/**
 * Marca con data-visible cada [data-reveal] dentro de `ref` cuando entra en pantalla.
 * El CSS hace el fade-up; sin JS o con movimiento reducido todo se ve desde el inicio.
 */
export function useReveal(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const items = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'))
    const show = (el: Element) => el.setAttribute('data-visible', 'true')
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      items.forEach(show)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          show(e.target)
          io.unobserve(e.target)
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    )
    items.forEach((el) => io.observe(el))
    // Solo se ocultan si el observer quedó listo: así nunca quedan invisibles.
    root.classList.add('reveal-ready')
    return () => io.disconnect()
  }, [ref])
}
