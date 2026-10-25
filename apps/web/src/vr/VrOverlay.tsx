import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { calibState, formatFov, formatSep, resetCalib, saveValues, stepFov, stepSep } from './calib'
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
  // Al entrar en un teléfono se abre el ajuste: es el único momento cómodo para tocar la pantalla, antes del visor.
  const [adjusting, setAdjusting] = useState(false)
  useEffect(() => {
    if (kind === 'cardboard') setAdjusting(window.matchMedia?.('(pointer: coarse)').matches ?? false)
    else setAdjusting(false)
  }, [kind])

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
    // Al añadir viewport-fit=cover iOS reajusta el área visual un instante después: se vuelve a medir.
    const late = window.setTimeout(apply, 350)
    vv?.addEventListener('resize', apply)
    window.addEventListener('resize', apply)
    window.addEventListener('orientationchange', apply)
    return () => {
      window.clearTimeout(late)
      window.removeEventListener('orientationchange', apply)
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
      <button type="button" className="vr-ui vr-exit vr-preset" onClick={() => setAdjusting((v) => !v)} aria-label="Ajustar el visor">
        ⚙
      </button>
      {adjusting && !portrait && <VrAdjust onDone={() => setAdjusting(false)} />}
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

/** Ancho CSS de la pantalla (el mismo que usa el render para repartir las dos mitades). */
const screenWidth = () => window.visualViewport?.width ?? window.innerWidth

/**
 * Ajuste del visor con botones grandes, pensado para hacerse con el teléfono en la mano antes de meterlo al visor.
 * Todo se aplica en vivo (el render lee `calibState` cada frame) y se guarda.
 */
function VrAdjust({ onDone }: { onDone: () => void }) {
  const [, redraw] = useState(0)
  const c = calibState.calib
  const w = screenWidth()
  const apply = (values: Parameters<typeof saveValues>[0]) => {
    saveValues(values)
    redraw((n) => n + 1)
  }
  return (
    <div className="vr-ui vr-adjust" role="dialog" aria-label="Ajustar el visor">
      <p className="vr-adjust-title">Si ves doble, ajusta hasta que las dos imágenes se junten</p>
      <Stepper
        label="Separación"
        value={formatSep(c, w)}
        onLess={() => apply({ sep: stepSep(calibState.calib, screenWidth(), -1) })}
        onMore={() => apply({ sep: stepSep(calibState.calib, screenWidth(), 1) })}
      />
      <Stepper label="Zoom" value={formatFov(c)} onLess={() => apply({ fov: stepFov(calibState.calib, -1) })} onMore={() => apply({ fov: stepFov(calibState.calib, 1) })} />
      <div className="vr-adjust-row">
        <button
          type="button"
          className="vr-adjust-btn"
          onClick={() => {
            resetCalib()
            redraw((n) => n + 1)
          }}
        >
          Restablecer
        </button>
        <button type="button" className="vr-adjust-btn vr-adjust-done" onClick={onDone}>
          Listo, poner en el visor
        </button>
      </div>
    </div>
  )
}

function Stepper({ label, value, onLess, onMore }: { label: string; value: string; onLess: () => void; onMore: () => void }) {
  return (
    <div className="vr-adjust-row">
      <button type="button" className="vr-adjust-btn vr-adjust-step" onClick={onLess} aria-label={`${label}: menos`}>
        −
      </button>
      <span className="vr-adjust-label">
        {label}
        <small>{value}</small>
      </span>
      <button type="button" className="vr-adjust-btn vr-adjust-step" onClick={onMore} aria-label={`${label}: más`}>
        +
      </button>
    </div>
  )
}
