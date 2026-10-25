import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { calibState, PRESET_ORDER, PRESETS, saveValues, selectPreset } from './calib'
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

/** Distancia (mm) del centro de la pantalla al centro de cada mitad: lo que equivale a "sin ajuste de lente". */
function halfCenterMm(): number {
  const w = window.visualViewport?.width ?? window.innerWidth
  return (w / 4) * calibState.calib.mmPerPx
}

/**
 * Ajuste del visor con botones grandes, pensado para hacerse con el teléfono en la mano antes de meterlo al visor.
 * Todo se aplica en vivo (el render lee `calibState` cada frame) y se guarda.
 */
function VrAdjust({ onDone }: { onDone: () => void }) {
  const [, redraw] = useState(0)
  const c = calibState.calib
  const bump = (values: Parameters<typeof saveValues>[0]) => {
    saveValues(values)
    redraw((n) => n + 1)
  }
  const lens = c.lens > 0 ? c.lens : halfCenterMm()
  return (
    <div className="vr-ui vr-adjust" role="dialog" aria-label="Ajustar el visor">
      <p className="vr-adjust-title">Ajusta hasta ver una sola imagen nítida y cómoda</p>
      <div className="vr-adjust-row">
        {PRESET_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            className={`vr-adjust-btn${calibState.preset === id ? ' is-on' : ''}`}
            onClick={() => {
              selectPreset(id)
              redraw((n) => n + 1)
            }}
          >
            {PRESETS[id].label}
          </button>
        ))}
      </div>
      <Stepper label="Separación" hint="si ves doble" onLess={() => bump({ lens: Math.max(1, lens - 1) })} onMore={() => bump({ lens: lens + 1 })} />
      <Stepper label="Zoom" hint="si se ve muy cerca o lejos" onLess={() => bump({ fov: c.fov + 4 })} onMore={() => bump({ fov: c.fov - 4 })} />
      <Stepper
        label="Curvatura"
        hint="si los bordes se doblan"
        onLess={() => bump({ k1: Math.max(0, +(c.k1 - 0.05).toFixed(2)), k2: Math.max(0, +(c.k2 - 0.02).toFixed(2)) })}
        onMore={() => bump({ k1: +(c.k1 + 0.05).toFixed(2), k2: +(c.k2 + 0.02).toFixed(2) })}
      />
      <button type="button" className="vr-adjust-btn vr-adjust-done" onClick={onDone}>
        Listo, poner en el visor
      </button>
    </div>
  )
}

function Stepper({ label, hint, onLess, onMore }: { label: string; hint: string; onLess: () => void; onMore: () => void }) {
  return (
    <div className="vr-adjust-row">
      <button type="button" className="vr-adjust-btn vr-adjust-step" onClick={onLess} aria-label={`${label}: menos`}>
        −
      </button>
      <span className="vr-adjust-label">
        {label}
        <small>{hint}</small>
      </span>
      <button type="button" className="vr-adjust-btn vr-adjust-step" onClick={onMore} aria-label={`${label}: más`}>
        +
      </button>
    </div>
  )
}
