import { useEffect, useState } from 'react'
import { useIntro } from '../intro/store'
import { useStore } from '../store'

const TOAST_MS = 9000

/**
 * Avisos de un palacio que se levanta en vivo: lo que hace la IA mientras llegan las salas, y al final el
 * resumen de fuentes verificadas o el aviso de que la IA se cortó. Discreto: una sola línea.
 */
export function BuildNotice() {
  const build = useStore((s) => s.build)
  const phase = useIntro((s) => s.phase)
  const arrived = useIntro((s) => s.arrived)

  // Mensaje de estado (mientras dure) o aviso final (se retira solo).
  const live =
    build.status === 'building'
      ? phase === 'done'
        ? 'Aris sigue levantando salas…'
        : arrived === 0
          ? 'Aris está trazando el museo…'
          : `Aris está levantando el museo · ${arrived} ${arrived === 1 ? 'sala' : 'salas'}`
      : null
  const final = phase === 'done' ? (build.status === 'cut' ? build.notice : build.status === 'done' ? build.summary : null) : null

  const [hidden, setHidden] = useState<string | null>(null)
  useEffect(() => {
    if (!final) return
    const timer = setTimeout(() => setHidden(final), TOAST_MS)
    return () => clearTimeout(timer)
  }, [final])

  const text = live ?? (final && hidden !== final ? final : null)
  if (!text) return null
  return (
    <div className={live ? 'build-note build-note-live' : 'build-note'} role="status" aria-live="polite">
      <span>{text}</span>
      {!live && (
        <button type="button" className="build-note-close" aria-label="Cerrar aviso" onClick={() => setHidden(final)}>
          ×
        </button>
      )}
    </div>
  )
}
