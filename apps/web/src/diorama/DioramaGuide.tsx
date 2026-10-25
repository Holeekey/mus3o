import { useEffect } from 'react'
import { useStore } from '../store'
import { useDioramaStore } from './dioramaStore'
import { focusGuide, repeatGuide, startGuide, stopGuide, useGuideStore } from './guideStore'

/** Espera tras entrar para que el velo de la transición se levante antes de que Aris hable. */
const INTRO_DELAY_MS = 900

/**
 * Cablea la guía de Aris a la app: presenta la escena al entrar, cuenta cada concepto que se mira
 * y repite con G. No pinta nada: el globo es el de Aris (ArisDialog) y la lógica vive en guideStore.
 */
export function DioramaGuide() {
  const phase = useDioramaStore((s) => s.phase)
  const focusedId = useStore((s) => s.focusedId)
  const locked = useStore((s) => s.locked)
  const focusedProp = useGuideStore((s) => s.focusedProp)

  useEffect(() => {
    if (phase !== 'inside') {
      stopGuide()
      return
    }
    const t = window.setTimeout(startGuide, INTRO_DELAY_MS)
    return () => window.clearTimeout(t)
  }, [phase])

  useEffect(() => {
    if (phase === 'inside') focusGuide(locked ? (focusedId ?? focusedProp) : null)
  }, [phase, focusedId, focusedProp, locked])

  useEffect(() => stopGuide, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyG' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      repeatGuide()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return null
}
