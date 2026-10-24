import { PointerLockControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, type ComponentRef } from 'react'
import { Vector3 } from 'three'

import { handleDioramaKey, isDioramaActive, useDioramaStore } from '../diorama/dioramaStore'
import { allowedKeys } from '../palace/inputKeys'
import { moveWithCollisions, roomAt, type PalaceLayout } from '../palace/layout'
import { isDoorOpen, playerPose, useStore } from '../store'
import { introState } from '../intro/store'
import { pointerLock } from './pointerLock'
import { examine, openAris, toggleMemorize } from './actions'
import { applyTouchLook, moveAxes } from './moveInput'
import { touchInput } from './touchInput'

const EYE = 1.7
const WALK = 4.5
const RUN = 8
const REACH = 3.2

const onLock = () => useStore.getState().set({ locked: true })
const onUnlock = () => useStore.getState().set({ locked: false })

export { pointerLock }

export function Player({ layout }: { layout: PalaceLayout }) {
  const camera = useThree((s) => s.camera)
  const controls = useRef<ComponentRef<typeof PointerLockControls>>(null)
  const keys = useRef<Record<string, boolean>>({})
  const forward = useRef(new Vector3())
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
    // Solo cuando cambia el punto de entrada: un palacio que se levanta en vivo cambia de layout con cada sala.
  }, [camera, layout.spawn.x, layout.spawn.z, layout.spawn.yaw]) // eslint-disable-line react-hooks/exhaustive-deps

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
      if (e.code === 'KeyE') examine(layoutRef.current)
      if (e.code === 'KeyM') toggleMemorize()
      if (e.code === 'KeyT') openAris()
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

  const colliderCache = useRef<{ unlocked: unknown; free: unknown; layout: unknown; list: typeof layout.colliders }>({ unlocked: null, free: null, layout: null, list: [] })

  useFrame((_, rawDt) => {
    // Dentro del cuadro, DioramaRuntime lleva el movimiento y el foco.
    if (isDioramaActive()) return
    if (introState.active) return // INTRO: controles desactivados mientras vuela la cámara
    const dt = Math.min(rawDt, 0.05)
    const s = useStore.getState()

    // Rotación táctil de la cámara (yaw y pitch)
    applyTouchLook(camera)

    const k = keys.current
    const f = forward.current
    camera.getWorldDirection(f)
    f.y = 0
    f.normalize()

    if (s.locked) {
      const { ax, az, running: isRunning } = moveAxes(k)

      if (ax !== 0 || az !== 0) {
        const speed = (isRunning ? RUN : WALK) * dt
        // derecha = forward × up = (-f.z, 0, f.x)
        let dx = f.x * az - f.z * ax
        let dz = f.z * az + f.x * ax
        const len = Math.hypot(dx, dz)
        if (len > 0.001) {
          const mag = Math.min(1, len)
          dx = (dx / len) * speed * mag
          dz = (dz / len) * speed * mag

          // Físicas: colliders del mapa + puertas cerradas que actúan como obstáculos
          // La lista solo se rehace cuando cambian las puertas abiertas (no en cada frame que se camina).
          const cache = colliderCache.current
          if (cache.unlocked !== s.unlockedDoors || cache.free !== s.freeExplore || cache.layout !== layout) {
            const doorColliders = (layout.doors ?? [])
              .filter((d) => !isDoorOpen(s, d.id))
              .map((d) => ({ x: d.x, z: d.z, w: d.w, d: d.d, h: 4 }))
            cache.list = [...layout.colliders, ...doorColliders]
            cache.unlocked = s.unlockedDoors
            cache.free = s.freeExplore
            cache.layout = layout
          }
          const totalColliders = cache.list

          const next = moveWithCollisions(totalColliders, camera.position.x, camera.position.z, dx, dz)
          camera.position.x = next.x
          camera.position.z = next.z
        }
      }
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
    let bestDist = REACH
    for (const p of room?.pedestals ?? []) {
      const vx = p.x - camera.position.x
      const vz = p.z - camera.position.z
      const dist = Math.hypot(vx, vz)
      if (dist > bestDist || dist < 0.01) continue
      if ((vx * f.x + vz * f.z) / dist < 0.8) continue
      best = p.concept.id
      bestDist = dist
    }
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
