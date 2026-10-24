import { useEffect } from 'react'
import { DEFAULT_THEME } from '../theme'
import { skipIntro, useIntro } from './store'

const FADE_MS = 450

/**
 * Botón "Saltar" (y Espacio / Enter / Esc) durante la intro. Con movimiento reducido no hay vuelo: un
 * fundido corto (y, si la IA aún escribe, uno por cada sala que llega).
 */
export function IntroOverlay() {
  const phase = useIntro((s) => s.phase)
  const reduced = useIntro((s) => s.reduced)
  const building = useIntro((s) => s.building)
  const arrived = useIntro((s) => s.arrived)
  const playing = phase === 'playing'
  // Mientras no haya ni una sala no hay a dónde saltar.
  const canSkip = !building || arrived > 0

  useEffect(() => {
    if (!playing) return
    if (reduced) {
      // En construcción en vivo el fundido por sala sigue hasta que la IA termina.
      if (building) return
      const timer = setTimeout(skipIntro, FADE_MS + 50)
      return () => clearTimeout(timer)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Escape') {
        e.preventDefault()
        skipIntro()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playing, reduced, building])

  if (!playing) return null
  if (reduced) {
    return (
      <div
        // Una sala nueva remonta el velo: cada llegada se anuncia con su propio fundido.
        key={arrived}
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 60,
          background: DEFAULT_THEME.scene.background,
          pointerEvents: 'none',
          animation: `intro-fade ${FADE_MS}ms ease-out forwards`,
        }}
      />
    )
  }
  if (!canSkip) return null
  return (
    <button type="button" className="btn btn-ghost intro-skip" onClick={skipIntro} aria-label="Saltar la introducción">
      Saltar <kbd>Espacio</kbd>
    </button>
  )
}
