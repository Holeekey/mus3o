import { useRef, useState } from 'react'
import { useDioramaStore } from '../diorama/dioramaStore'
import type { PalaceLayout } from '../palace/layout'
import { interact, openAris, toggleMemorize } from '../scene/actions'
import { useStore } from '../store'
import { resetTouchMove, touchInput } from '../scene/touchInput'
import { useIsTouch } from './useIsTouch'

const RADIUS = 50
const TIP_KEY = 'mus3o-touch-tip'

function tipSeen(): boolean {
  try {
    return window.localStorage.getItem(TIP_KEY) === '1'
  } catch {
    return false
  }
}

export function TouchControls({ layout }: { layout: PalaceLayout }) {
  const touch = useIsTouch()
  const locked = useStore((s) => s.locked)
  const focusedId = useStore((s) => s.focusedId)
  const focusedDoorId = useStore((s) => s.focusedDoorId)
  const openId = useStore((s) => s.openId)
  const paintingId = useDioramaStore((s) => s.hintId)
  const [tip, setTip] = useState(() => !tipSeen())

  const joystickId = useRef<number | null>(null)
  const lookId = useRef<number | null>(null)
  const center = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const lastLook = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  const baseRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)

  if (!touch || !locked || !!openId) return null

  const onPointerDown = (e: React.PointerEvent) => {
    // Ignora si el toque fue sobre los botones de acción
    if ((e.target as HTMLElement).closest('.touch-action-btn')) return

    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Ignorar en entornos que no soporten capture
    }

    const mid = window.innerWidth / 2
    if (e.clientX < mid && joystickId.current === null) {
      joystickId.current = e.pointerId
      if (tip) {
        setTip(false)
        try {
          window.localStorage.setItem(TIP_KEY, '1')
        } catch {
          /* sin almacenamiento: la ayuda vuelve en la próxima visita */
        }
      }
      center.current = { x: e.clientX, y: e.clientY }
      if (baseRef.current && knobRef.current) {
        baseRef.current.classList.remove('is-idle')
        baseRef.current.style.transform = `translate3d(${e.clientX - RADIUS}px, ${e.clientY - RADIUS}px, 0)`
        knobRef.current.style.transform = 'translate3d(0, 0, 0)'
      }
    } else if (e.clientX >= mid && lookId.current === null) {
      lookId.current = e.pointerId
      lastLook.current = { x: e.clientX, y: e.clientY }
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerId === joystickId.current) {
      const dx = e.clientX - center.current.x
      const dy = e.clientY - center.current.y
      const dist = Math.hypot(dx, dy)
      const clampedDist = Math.min(dist, RADIUS)
      const angle = Math.atan2(dy, dx)
      const clampedX = Math.cos(angle) * clampedDist
      const clampedY = Math.sin(angle) * clampedDist

      if (knobRef.current) {
        knobRef.current.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0)`
      }

      const normX = clampedX / RADIUS
      const normY = clampedY / RADIUS
      touchInput.moveX = normX
      touchInput.moveZ = -normY // Arriba en pantalla (-Y) es avanzar (+Z hacia el frente)
      touchInput.isRunning = dist / RADIUS >= 0.8
      touchInput.active = true
    } else if (e.pointerId === lookId.current) {
      const dx = e.clientX - lastLook.current.x
      const dy = e.clientY - lastLook.current.y
      lastLook.current = { x: e.clientX, y: e.clientY }

      // Sensibilidad angular táctil (rad/pixel)
      touchInput.lookDx += dx * 0.0035
      touchInput.lookDy += dy * 0.0035
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
    } catch {
      // Ignorar
    }
    if (e.pointerId === joystickId.current) {
      joystickId.current = null
      resetTouchMove()
      // El joystick vuelve a su lugar de reposo (abajo a la izquierda) y sigue visible.
      if (baseRef.current) {
        baseRef.current.style.transform = ''
        baseRef.current.classList.add('is-idle')
      }
      if (knobRef.current) knobRef.current.style.transform = ''
    } else if (e.pointerId === lookId.current) {
      lookId.current = null
    }
  }

  const canInteract = !!(focusedId || focusedDoorId || openId || paintingId)

  return (
    <div
      className="touch-controls-layer"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Joystick: visible en reposo abajo a la izquierda; al tocar la mitad izquierda se centra en el dedo. */}
      <div ref={baseRef} className="touch-joystick-base is-idle" aria-hidden>
        <div ref={knobRef} className="touch-joystick-knob" />
      </div>

      {tip && <p className="touch-tip">Arrastra a la izquierda para moverte · desliza a la derecha para mirar</p>}

      {/* Botones de acción táctiles en la esquina inferior derecha */}
      <div className="touch-actions-cluster">
        <button
          type="button"
          className="touch-action-btn touch-btn-aris"
          onClick={() => openAris({ unlock: false })}
          aria-label="Consultar a Aris"
        >
          🤖
        </button>
        <button
          type="button"
          className="touch-action-btn touch-btn-memorize"
          onClick={toggleMemorize}
          aria-label="Marcar memorizado"
        >
          ✓
        </button>
        <button
          type="button"
          className={`touch-action-btn touch-btn-primary ${canInteract ? 'is-active' : ''}`}
          onClick={() => interact(layout)}
          aria-label="Interactuar o examinar"
        >
          👁️
        </button>
      </div>
    </div>
  )
}
