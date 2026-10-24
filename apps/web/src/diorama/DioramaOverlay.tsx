import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import { dioramaFx, useDioramaStore } from './dioramaStore'

/**
 * Capa DOM del cuadro: velo de transición, invitación "E · Entrar al cuadro" y recordatorio de
 * salida. Se monta junto al Hud (fuera del Canvas) y usa las clases .hint / .plaque existentes.
 */
export function DioramaOverlay() {
  const veil = useRef<HTMLDivElement>(null)
  const phase = useDioramaStore((s) => s.phase)
  const hintId = useDioramaStore((s) => s.hintId)
  const nearReturn = useDioramaStore((s) => s.nearReturn)
  const title = useDioramaStore((s) => (s.hintId ? s.portals[s.hintId]?.diorama.title : s.activeId ? s.portals[s.activeId]?.diorama.title : undefined))
  const locked = useStore((s) => s.locked)
  const openId = useStore((s) => s.openId)

  // El velo se anima fuera de React: dioramaFx.fade se escribe cada frame desde el Canvas.
  useEffect(() => {
    let raf = 0
    let last = -1
    const tick = () => {
      const el = veil.current
      if (el && dioramaFx.fade !== last) {
        last = dioramaFx.fade
        el.style.opacity = String(last)
        el.style.backgroundColor = dioramaFx.color
        el.style.visibility = last > 0.002 ? 'visible' : 'hidden'
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <>
      <div ref={veil} aria-hidden style={{ position: 'absolute', inset: 0, opacity: 0, visibility: 'hidden', pointerEvents: 'none', zIndex: 40 }} />
      <div className="hud" style={{ zIndex: 30 }}>
        {locked && phase === 'room' && hintId && (
          <p className="hint" style={{ bottom: '24%', whiteSpace: 'nowrap' }}>
            <kbd>E</kbd> Entrar al cuadro
            {title && <span style={{ fontWeight: 400, opacity: 0.75 }}> · {title}</span>}
          </p>
        )}
        {phase === 'inside' && (
          <>
            {/* El título del diorama sustituye al de la sala mientras se está dentro. */}
            <style>{'.hud > .plaque:not(.diorama-plaque){display:none}'}</style>
            <div className="plaque diorama-plaque" style={{ ['--wall' as string]: '#1f1411', ['--wall-ink' as string]: '#f6efe8' }}>
              <p className="plaque-meta">Dentro del cuadro</p>
              <p className="plaque-title">{title}</p>
            </div>
            {locked && !openId && (
              <p className="hint" style={{ bottom: nearReturn ? '30%' : '12%', whiteSpace: 'nowrap' }}>
                <kbd>Q</kbd> Volver a la sala
                {nearReturn && <span style={{ fontWeight: 400, opacity: 0.75 }}> · o cruza el marco</span>}
              </p>
            )}
          </>
        )}
      </div>
    </>
  )
}
