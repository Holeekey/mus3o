import { useState } from 'react'
import { calibState, nextPreset, PRESET_ORDER, PRESETS, reloadCalib, saveValues, selectPreset, type PresetId } from './calib'
import { comfortView, reloadComfort, saveComfort } from './comfort'

/** Ajustes del visor, para tocarlos ANTES de ponerse el teléfono (panel de pausa). Solo cardboard; en WebXR el visor se elige en Chrome. */
export function VrCalibration() {
  const [, bump] = useState(0)
  const [open, setOpen] = useState(false)
  if (!open) reloadCalib()
  const refresh = () => bump((n) => n + 1)
  const c = calibState.calib
  const field = (key: 'fov' | 'ipd' | 'k1' | 'k2' | 'lens', label: string, step: number, shown: number, toStored: (n: number) => number = (n) => n) => (
    <label className="vr-cal-field">
      <span>{label}</span>
      <input
        type="number"
        step={step}
        value={Number.isFinite(shown) ? shown : 0}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (!Number.isFinite(n)) return
          saveValues({ [key]: toStored(n) })
          refresh()
        }}
      />
    </label>
  )
  return (
    <div className="vr-cal">
      <button type="button" className="btn btn-ghost" aria-expanded={open} onClick={() => { reloadComfort(); setOpen(!open) }}>
        Ajustar el visor
      </button>
      {open && (
        <div className="vr-cal-body">
          <div className="vr-cal-presets" role="group" aria-label="Preajustes del visor">
            {PRESET_ORDER.map((id: PresetId) => (
              <button
                key={id}
                type="button"
                className={`btn btn-ghost${calibState.preset === id ? ' is-on' : ''}`}
                onClick={() => {
                  selectPreset(id)
                  refresh()
                }}
              >
                {PRESETS[id].label}
              </button>
            ))}
          </div>
          <div className="vr-cal-fields">
            {field('fov', 'FOV (°)', 1, c.fov)}
            {field('ipd', 'Ojos (mm)', 1, Math.round(c.ipd * 1000), (n) => n / 1000)}
            {field('k1', 'k1', 0.01, c.k1)}
            {field('k2', 'k2', 0.01, c.k2)}
            {field('lens', 'Lente (mm)', 1, c.lens)}
          </div>
          <label className="vr-cal-check">
            <input type="checkbox" checked={comfortView.on} onChange={(e) => { saveComfort(e.target.checked); refresh() }} />
            <span>Modo cómodo (marcha lenta y bordes oscuros al moverse)</span>
          </label>
          <p className="vr-cal-hint">«Lente» es la distancia del centro de la pantalla al centro de cada lente (en un VR Box, unos 32 mm). Cambia de preajuste dentro del visor con el botón ◐.</p>
        </div>
      )}
    </div>
  )
}

export { nextPreset }
