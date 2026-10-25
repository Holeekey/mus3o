import { useEffect, useState, type RefObject } from 'react'

type ScrollBox = { scrollHeight: number; scrollTop: number; clientHeight: number }

/** Queda contenido por debajo de lo visible (con margen para el redondeo de subpíxeles). */
export function hasMoreBelow(el: ScrollBox): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight > 4
}

/**
 * Con el puntero bloqueado, la rueda llega a la escena 3D y no a la ficha. Devuelve la ficha a desplazar,
 * o null si el mouse ya está sobre ella (ahí el navegador la desplaza solo).
 */
export function wheelScrollTarget<T extends { contains: (target: never) => boolean }>(card: T | null, target: unknown): T | null {
  if (!card) return null
  return card.contains(target as never) ? null : card
}

const LINE_PX = 16

/**
 * Píxeles a desplazar por un evento de rueda. Firefox manda la rueda en líneas (`deltaMode` 1, unas 3 por
 * muesca) y a veces en páginas (2): usado tal cual, la ficha bajaría 3 px por giro y parecería trabada.
 */
export function wheelPixels(e: { deltaY: number; deltaMode: number }, pageHeight: number): number {
  if (e.deltaMode === 1) return e.deltaY * LINE_PX
  if (e.deltaMode === 2) return e.deltaY * pageHeight
  return e.deltaY
}

/**
 * Desplazamiento de una ficha larga: la rueda la mueve aunque se esté mirando la escena, y `more`
 * indica si queda contenido abajo (para mostrar el aviso). Se recalcula al cargar imágenes o fuentes.
 */
export function useCardScroll(ref: RefObject<HTMLElement | null>): boolean {
  const [more, setMore] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setMore(hasMoreBelow(el))
    const onWheel = (e: WheelEvent) => {
      const card = wheelScrollTarget(el, e.target)
      if (card) card.scrollBy({ top: wheelPixels(e, card.clientHeight) })
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('wheel', onWheel, { passive: true })
    // El contenido crece después de abrir (imagen, "Para saber más"): se observa cada hijo.
    const resize = new ResizeObserver(update)
    const watch = () => Array.from(el.children).forEach((c) => resize.observe(c))
    watch()
    const mutations = new MutationObserver(() => {
      watch()
      update()
    })
    mutations.observe(el, { childList: true, subtree: true })
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('wheel', onWheel)
      resize.disconnect()
      mutations.disconnect()
    }
  }, [ref])
  return more
}
