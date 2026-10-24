import { useEffect } from 'react'
import { DEFAULT_THEME } from '../theme'
import { skipIntro, useIntro } from './store'
import { KeyHint } from '../ui/KeyHint'

const FADE_MS = 450

/** Botón "Saltar" (y Espacio / Enter / Esc) durante la intro; con movimiento reducido, solo un fundido corto. */
export function IntroOverlay() {
  const phase = useIntro((s) => s.phase)
  const reduced = useIntro((s) => s.reduced)
  const playing = phase === 'playing'

  useEffect(() => {
    if (!playing) return
    if (reduced) {
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
  }, [playing, reduced])

  if (!playing) return null
  if (reduced) {
    return (
      <div
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
  return (
    <button type="button" className="btn btn-ghost intro-skip" onClick={skipIntro} aria-label="Saltar la introducción">
      Saltar <KeyHint k="Espacio" />
    </button>
  )
}
