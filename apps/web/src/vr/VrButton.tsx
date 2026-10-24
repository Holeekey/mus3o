import { useEffect } from 'react'
import { detectVr, enterVr, loadXr } from './enter'
import { useVr } from './runtime'

/**
 * "Ver en VR" para el panel de pausa. Solo aparece en móvil/tableta o si el navegador ofrece WebXR
 * (en escritorio sin WebXR no hay nada que mostrar; ?vr=cardboard lo fuerza para probar).
 */
export function VrButton() {
  const available = useVr((s) => s.available)
  const xrReady = useVr((s) => s.xrReady)
  const error = useVr((s) => s.error)

  useEffect(() => {
    void detectVr().then((mode) => {
      if (mode === 'xr') void loadXr() // la sesión se pide dentro del clic: el módulo debe estar listo
    })
  }, [])

  if (available === 'none' || available === 'checking') return null
  const waiting = available === 'xr' && !xrReady
  return (
    <>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={waiting}
        onClick={() => void enterVr(available)}
        title={available === 'xr' ? 'Realidad virtual con tu visor' : 'Pon el teléfono en el visor y mira un objetivo 1,5 s para activarlo'}
      >
        {waiting ? 'Preparando VR…' : 'Ver en VR'}
      </button>
      {error && (
        <p className="vr-entry-error" role="alert">
          {error}
        </p>
      )}
    </>
  )
}
