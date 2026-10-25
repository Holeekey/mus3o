import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { nextPreset, selectPreset, calibState } from './calib'
import { exitVr } from './enter'
import { useVr } from './runtime'
import './vr.css'

/**
 * Avisos y salida del modo cardboard. Va en el body (el HUD se oculta mientras dura la VR).
 * En WebXR no se necesita: el navegador del visor ya trae su propia salida.
 */
export function VrOverlay() {
  const kind = useVr((s) => s.kind)
  const sensors = useVr((s) => s.sensors)
  const [portrait, setPortrait] = useState(false)

  useEffect(() => {
    if (kind !== 'cardboard') return
    const check = () => setPortrait(window.innerHeight > window.innerWidth)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [kind])

  // La barra de Safari y el indicador de inicio cambian el alto visible: el lienzo se ajusta al área visual real (si no, la división en dos ojos se corre).
  useEffect(() => {
    if (kind !== 'cardboard') return
    const vv = window.visualViewport
    const apply = () => {
      const r = document.documentElement.style
      r.setProperty('--vr-w', `${vv?.width ?? window.innerWidth}px`)
      r.setProperty('--vr-h', `${vv?.height ?? window.innerHeight}px`)
    }
    apply()
    vv?.addEventListener('resize', apply)
    window.addEventListener('resize', apply)
    return () => {
      vv?.removeEventListener('resize', apply)
      window.removeEventListener('resize', apply)
      document.documentElement.style.removeProperty('--vr-w')
      document.documentElement.style.removeProperty('--vr-h')
    }
  }, [kind])

  if (kind !== 'cardboard') return null
  return createPortal(
    <>
      <button type="button" className="vr-ui vr-exit" onClick={exitVr} aria-label="Salir de VR">
        ✕
      </button>
      <button type="button" className="vr-ui vr-exit vr-preset" onClick={() => selectPreset(nextPreset(calibState.preset))} aria-label="Cambiar de preajuste del visor">
        ◐
      </button>
      {portrait && (
        <div className="vr-ui vr-rotate" role="status">
          <p>Gira el teléfono a horizontal y colócalo en el visor.</p>
        </div>
      )}
      {!portrait && (sensors === 'denied' || sensors === 'none') && (
        <p className="vr-ui vr-note" role="status">
          {sensors === 'denied' ? 'Sin permiso para los sensores de movimiento.' : 'Este dispositivo no tiene sensores de movimiento.'} Arrastra para mirar.
        </p>
      )}
    </>,
    document.body,
  )
}
