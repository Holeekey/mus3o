import { useState } from 'react'
import { calibState, formatFov, formatSep, reloadCalib, resetCalib, saveValues, stepFov, stepSep } from './calib'
import { comfortView, reloadComfort, saveComfort } from './comfort'

/** Ajustes del visor, para tocarlos ANTES de ponerse el teléfono (panel de pausa). Solo cardboard; en WebXR el visor se elige en Chrome. */
export function VrCalibration() {
  const [, bump] = useState(0)
  const [open, setOpen] = useState(false)
  if (!open) reloadCalib()
  const refresh = () => bump((n) => n + 1)
  const c = calibState.calib
  const w = window.visualViewport?.width ?? window.innerWidth
  const stepper = (label: string, value: string, less: () => void, more: () => void) => (
    <div className="vr-cal-step">
      <button type="button" className="btn btn-ghost" onClick={() => { less(); refresh() }} aria-label={`${label}: menos`}>−</button>
      <span>{label}: {value}</span>
      <button type="button" className="btn btn-ghost" onClick={() => { more(); refresh() }} aria-label={`${label}: más`}>+</button>
    </div>
  )
  return (
    <div className="vr-cal">
      <button type="button" className="btn btn-ghost" aria-expanded={open} onClick={() => { reloadComfort(); setOpen(!open) }}>
        Ajustar el visor
      </button>
      {open && (
        <div className="vr-cal-body">
          {stepper('Separación', formatSep(c, w), () => saveValues({ sep: stepSep(calibState.calib, w, -1) }), () => saveValues({ sep: stepSep(calibState.calib, w, 1) }))}
          {stepper('Zoom', formatFov(c), () => saveValues({ fov: stepFov(calibState.calib, -1) }), () => saveValues({ fov: stepFov(calibState.calib, 1) }))}
          <button type="button" className="btn btn-ghost" onClick={() => { resetCalib(); refresh() }}>
            Restablecer
          </button>
          <label className="vr-cal-check">
            <input type="checkbox" checked={comfortView.on} onChange={(e) => { saveComfort(e.target.checked); refresh() }} />
            <span>Modo cómodo (marcha lenta y bordes oscuros al moverse)</span>
          </label>
          <p className="vr-cal-hint">Separación: distancia entre los centros de las dos lentes. Si ves doble, ajusta hasta que las dos imágenes se junten.</p>
        </div>
      )}
    </div>
  )
}

