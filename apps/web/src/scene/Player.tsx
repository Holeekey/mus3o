import { PointerLockControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, type ComponentRef } from 'react'
import { Vector3 } from 'three'

import type { Piece } from '@mus3o/shared'
import { canOpenDoor } from '../palace/keys'
import { handleDioramaKey, isDioramaActive, useDioramaStore } from '../diorama/dioramaStore'
import { allowedKeys, findDoor } from '../palace/inputKeys'
import { canListen } from '../lib/voice'
import { roomAt, type PalaceLayout } from '../palace/layout'
import { pieceKind } from '../palace/pieceKind'
import { inExamScope, isDoorOpen, playerPose, useStore } from '../store'
import { introState } from '../intro/store'
import { pointerLock } from './pointerLock'
import { consumeTouchLook, touchInput } from './touchInput'
import { EYE, stepWalk } from './walk'

const REACH = 3.2

const onLock = () => useStore.getState().set({ locked: true })
const onUnlock = () => useStore.getState().set({ locked: false })

export { pointerLock }

export function Player({ layout }: { layout: PalaceLayout }) {
  const camera = useThree((s) => s.camera)
  const controls = useRef<ComponentRef<typeof PointerLockControls>>(null)
  const keys = useRef<Record<string, boolean>>({})
  const forward = useRef(new Vector3())
  // Concepto enfocado, para que el handler de teclas conozca su tipo sin depender de su texto.
  const focusedConcept = useRef<Piece | null>(null)
  // El handler de teclas se registra una vez: lee el layout vigente desde esta ref, no el del primer render.
  const layoutRef = useRef(layout)
  layoutRef.current = layout

  useEffect(() => {
    camera.rotation.order = 'YXZ'
    camera.position.set(layout.spawn.x, EYE, layout.spawn.z)
    camera.rotation.set(0, layout.spawn.yaw, 0)
    pointerLock.lock = () => {
      if (touchInput.isTouchDevice) {
        useStore.getState().set({ locked: true })
      }
      controls.current?.lock()
    }
    pointerLock.unlock = () => {
      if (touchInput.isTouchDevice) {
        useStore.getState().set({ locked: false })
      }
      controls.current?.unlock()
    }
  }, [camera, layout])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      keys.current[e.code] = true
      // Cuadro-portal: E entra al diorama, Q vuelve (ver diorama/dioramaStore.ts)
      if (!introState.active && handleDioramaKey(e.code)) return
      const s = useStore.getState()
      const allowed = allowedKeys({
        introActive: introState.active,
        dioramaPhase: useDioramaStore.getState().phase,
        hasConcept: !!(s.openId ?? s.focusedId),
      })
      if (!allowed.has(e.code)) return
      if (e.code === 'KeyE') {
        if (s.focusedDoorId && !isDoorOpen(s, s.focusedDoorId)) {
          const door = findDoor(layoutRef.current, s.focusedDoorId)
          if (door && canOpenDoor(door, s.hasKey, s.roomKeys)) s.unlockDoor(door.id)
          return
        }
        if (s.openId) s.set({ openId: null })
        else if (s.focusedId) {
          if (focusedConcept.current && pieceKind(focusedConcept.current) === 'key') {
            s.pickupKey()
          }
          s.set({ openId: s.focusedId })
          // Con dictado el puntero sigue bloqueado y se responde en voz alta; sin él hay que escribir.
          if (inExamScope(s, s.focusedId) && !s.exam[s.focusedId] && !canListen()) controls.current?.unlock()
        }
      }
      if (e.code === 'KeyM' && s.mode === 'explore') {
        const id = s.openId ?? s.focusedId
        if (id) s.toggleMemorized(id)
      }
      // Con la tarjeta de examen abierta no se consulta a Aris (T ya no se usa ahí; escribir es Y).
      if (e.code === 'KeyT' && !s.arisPromptOpen && !(s.openId && inExamScope(s, s.openId))) {
        s.setArisPromptOpen(true)
        controls.current?.unlock()
      }
    }
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false
    }
    const clear = () => {
      keys.current = {}
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
  }, [])

  useFrame((_, rawDt) => {
    // Dentro del cuadro, DioramaRuntime lleva el movimiento y el foco.
    if (isDioramaActive()) return
    if (introState.active) return // INTRO: controles desactivados mientras vuela la cámara
    const dt = Math.min(rawDt, 0.05)
    const s = useStore.getState()

    // Rotación táctil de la cámara (yaw y pitch)
    const { dx: lookDx, dy: lookDy } = consumeTouchLook()
    if (lookDx !== 0 || lookDy !== 0) {
      camera.rotation.y -= lookDx
      // Clampear pitch vertical entre -80° y +80° (-1.4 a +1.4 rad)
      const newPitch = Math.max(-1.4, Math.min(1.4, camera.rotation.x - lookDy))
      camera.rotation.x = newPitch
    }

    const k = keys.current
    const f = forward.current
    camera.getWorldDirection(f)
    f.y = 0
    f.normalize()

    if (s.locked) {
      // Físicas: colliders del mapa + puertas cerradas que actúan como obstáculos
      const doorColliders = (layout.doors ?? [])
        .filter((d) => !isDoorOpen(s, d.id))
        .map((d) => ({ x: d.x, z: d.z, w: d.w, d: d.d, h: 4 }))
      stepWalk(camera, f, k, dt, [...layout.colliders, ...doorColliders])
    }

    playerPose.x = camera.position.x
    playerPose.z = camera.position.z
    playerPose.yaw = Math.atan2(f.x, f.z)

    const room = roomAt(layout, camera.position.x, camera.position.z)
    if (room && room.id !== s.currentRoomId) s.set({ currentRoomId: room.id })

    // Puerta a la que se está mirando y que está al alcance
    let bestDoor: string | null = null
    let bestDoorDist = 3.8
    for (const d of layout.doors ?? []) {
      const vx = d.x - camera.position.x
      const vz = d.z - camera.position.z
      const dist = Math.hypot(vx, vz)
      if (dist > bestDoorDist) continue
      if ((vx * f.x + vz * f.z) / dist < 0.5) continue
      bestDoor = d.id
      bestDoorDist = dist
    }
    if (bestDoor !== s.focusedDoorId) {
      s.set({ focusedDoorId: bestDoor })
    }

    // Pedestal al que se está mirando y que está al alcance.
    let best: string | null = null
    let bestConcept: Piece | null = null
    let bestDist = REACH
    for (const p of room?.pedestals ?? []) {
      const vx = p.x - camera.position.x
      const vz = p.z - camera.position.z
      const dist = Math.hypot(vx, vz)
      if (dist > bestDist || dist < 0.01) continue
      if ((vx * f.x + vz * f.z) / dist < 0.8) continue
      best = p.concept.id
      bestConcept = p.concept
      bestDist = dist
    }
    focusedConcept.current = bestConcept
    if (best !== s.focusedId) {
      // Al alejarse, la tarjeta de exploración se cierra sola.
      const closeCard = s.openId && s.mode === 'explore' && s.openId !== best
      s.set(closeCard ? { focusedId: best, openId: null } : { focusedId: best })
    }
  })

  // El selector no coincide con nada a propósito: sin él, drei bloquea el puntero con
  // cualquier clic del documento (incluidos los botones del HUD). Bloqueamos a mano.
  return <PointerLockControls ref={controls} selector="#manual-lock-only" onLock={onLock} onUnlock={onUnlock} />
}
