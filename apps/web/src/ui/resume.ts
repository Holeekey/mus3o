import { useEffect } from 'react'
import { pointerLock } from '../scene/pointerLock'

// Esc no sirve para volver: el navegador no lo cuenta como gesto del usuario y no deja bloquear el puntero con él.
const RESUME_KEYS = new Set(['Enter', 'NumpadEnter', 'Space'])
const INTERACTIVE = 'button, a, input, textarea, select, [contenteditable]'

type Target = { closest?: (selector: string) => unknown } | null

/** Tecla que retoma el palacio. Sobre un botón, enlace o campo, Enter y Espacio hacen lo suyo. */
export function isResumeKey(code: string, target: unknown): boolean {
  if (!RESUME_KEYS.has(code)) return false
  return !(target as Target)?.closest?.(INTERACTIVE)
}

/** Mientras `active`, Enter o Espacio vuelven a bloquear el puntero (pausa, o ficha leída con el mouse). */
export function useResumeKeys(active: boolean) {
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || !isResumeKey(e.code, e.target)) return
      e.preventDefault()
      pointerLock.lock()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])
}
