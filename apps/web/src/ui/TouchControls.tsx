import { useEffect, useRef, useState } from 'react'
import type { PalaceLayout } from '../palace/layout'
import { canOpenDoor } from '../palace/keys'
import { isDoorOpen, useStore } from '../store'
import { resetTouchMove, touchInput } from '../scene/touchInput'

const RADIUS = 50

export function TouchControls({ layout }: { layout: PalaceLayout }) {
  const [touchReady, setTouchReady] = useState(false)
  const locked = useStore((s) => s.locked)
  const focusedId = useStore((s) => s.focusedId)
  const focusedDoorId = useStore((s) => s.focusedDoorId)
  const openId = useStore((s) => s.openId)
  const hasKey = useStore((s) => s.hasKey)
  const roomKeys = useStore((s) => s.roomKeys)
  const unlockedDoors = useStore((s) => s.unlockedDoors)
  const freeExplore = useStore((s) => s.freeExplore)

  const joystickId = useRef<number | null>(null)
  const lookId = useRef<number | null>(null)
  const center = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const lastLook = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  const baseRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Activa la capa si el dispositivo soporta coarse pointer o evento touch
    if (touchInput.isTouchDevice || window.matchMedia?.('(pointer: coarse)').matches) {
      setTouchReady(true)
    }
    const onTouch = () => {
      touchInput.isTouchDevice = true
      setTouchReady(true)
    }
    window.addEventListener('touchstart', onTouch, { once: true, passive: true })
    return () => window.removeEventListener('touchstart', onTouch)
  }, [])

  if (!touchReady || !locked || !!openId) return null

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
      center.current = { x: e.clientX, y: e.clientY }
      if (baseRef.current && knobRef.current) {
        baseRef.current.style.display = 'block'
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
      if (baseRef.current) baseRef.current.style.display = 'none'
    } else if (e.pointerId === lookId.current) {
      lookId.current = null
    }
  }

  // Acciones táctiles
  const handleActionE = () => {
    const s = useStore.getState()
    if (s.focusedDoorId && !isDoorOpen({ freeExplore, unlockedDoors }, s.focusedDoorId)) {
      const door = layout.doors?.find((d) => d.id === s.focusedDoorId)
      if (door && canOpenDoor(door, hasKey, roomKeys)) s.unlockDoor(door.id)
      return
    }
    if (s.openId) s.set({ openId: null })
    else if (s.focusedId) {
      s.set({ openId: s.focusedId })
    }
  }

  const handleActionM = () => {
    const s = useStore.getState()
    const id = s.openId ?? s.focusedId
    if (id) s.toggleMemorized(id)
  }

  const handleActionT = () => {
    useStore.getState().setArisPromptOpen(true)
  }

  const canInteract = !!(focusedId || focusedDoorId || openId)

  return (
    <div
      className="touch-controls-layer"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Joystick dinámico */}
      <div ref={baseRef} className="touch-joystick-base" style={{ display: 'none' }}>
        <div ref={knobRef} className="touch-joystick-knob" />
      </div>

      {/* Botones de acción táctiles en la esquina inferior derecha */}
      <div className="touch-actions-cluster">
        <button
          type="button"
          className="touch-action-btn touch-btn-aris"
          onClick={handleActionT}
          aria-label="Consultar a Aris"
        >
          🤖
        </button>
        <button
          type="button"
          className="touch-action-btn touch-btn-memorize"
          onClick={handleActionM}
          aria-label="Marcar memorizado"
        >
          ✓
        </button>
        <button
          type="button"
          className={`touch-action-btn touch-btn-primary ${canInteract ? 'is-active' : ''}`}
          onClick={handleActionE}
          aria-label="Interactuar o examinar"
        >
          👁️
        </button>
      </div>
    </div>
  )
}
