import { PointerLockControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type ComponentRef } from 'react'
import { Raycaster, Vector2, Vector3 } from 'three'
import type { PalaceLayout, RoomLayout } from '../palace/layout'
import { AIM_MAX_DIST, aimedFounder, openProfile, type FounderTag } from './founderAim'
import { EYE, lobbyColliders, stepWalk } from './walk'

/** off: la cámara es del scroll · walking: primera persona · using: frente al panel, con el mouse libre. */
export type LobbyMode = 'off' | 'walking' | 'using'

/** Lo que la landing (DOM) necesita: el pointer lock solo se puede pedir desde un gesto del usuario. */
export type WalkApi = { lock: () => void; exit: () => void }

/** Panel de la pared: desde dónde se usa y cuándo se está lo bastante cerca para usarlo. */
export type PanelSpot = {
  /** Pose de la cámara al usarlo: encuadra el panel de frente. */
  viewFrom: [number, number, number]
  viewAt: [number, number, number]
  /** Si el visitante, en (x, z) y mirando hacia `forward`, está frente al panel. */
  isNear: (x: number, z: number, forward: Vector3) => boolean
}

// Centro de la pantalla (la mira) en coordenadas normalizadas.
const CENTER = new Vector2(0, 0)

/**
 * Primera persona dentro del lobby, con la misma caminata que el museo (`stepWalk`).
 * No toca el store del palacio: solo avisa a la landing del modo, de si hay un panel al alcance
 * y de a qué retrato de Founders apunta la mira (un clic abre su perfil).
 */
export function LobbyWalker({
  layout,
  room,
  panel,
  api,
  onModeChange,
  onNearPanelChange,
  onAimFounderChange,
}: {
  layout: PalaceLayout
  room: RoomLayout
  panel: PanelSpot
  api: { current: WalkApi }
  onModeChange: (mode: LobbyMode) => void
  onNearPanelChange: (near: boolean) => void
  onAimFounderChange: (founder: FounderTag | null) => void
}) {
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const controls = useRef<ComponentRef<typeof PointerLockControls>>(null)
  const keys = useRef<Record<string, boolean>>({})
  const forward = useRef(new Vector3())
  const mode = useRef<LobbyMode>('off')
  // E pide usar el panel: al soltarse el puntero se pasa a "using" en vez de salir del lobby.
  const wantsPanel = useRef(false)
  const near = useRef(false)
  const aimed = useRef<FounderTag | null>(null)
  const raycaster = useMemo(() => {
    const r = new Raycaster()
    r.far = AIM_MAX_DIST
    return r
  }, [])
  const colliders = useMemo(() => lobbyColliders(layout, room), [layout, room])
  const view = useMemo(() => ({ from: new Vector3(...panel.viewFrom), at: new Vector3(...panel.viewAt), look: new Vector3() }), [panel])

  const setAimed = (founder: FounderTag | null) => {
    if (founder?.profile === aimed.current?.profile) return
    aimed.current = founder
    onAimFounderChange(founder)
  }

  const setMode = (next: LobbyMode) => {
    mode.current = next
    keys.current = {}
    if (next !== 'walking' && near.current) {
      near.current = false
      onNearPanelChange(false)
    }
    if (next !== 'walking') setAimed(null)
    onModeChange(next)
  }

  const lock = () => {
    // El vuelo del scroll deja la cámara inclinada: se nivela a la altura de los ojos.
    camera.rotation.setFromQuaternion(camera.quaternion, 'YXZ')
    camera.rotation.z = 0
    camera.position.y = EYE
    controls.current?.lock()
  }

  useEffect(() => {
    api.current = {
      lock,
      exit: () => {
        if (mode.current === 'walking') controls.current?.unlock()
        else setMode('off')
      },
    }
  })

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (mode.current === 'off') return
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
      if (mode.current === 'using') {
        // Frente al panel: E vuelve a caminar (es un gesto válido para el pointer lock); Esc sale del lobby.
        if (e.code === 'Escape') setMode('off')
        else if (e.code === 'KeyE' && !typing) lock()
        return
      }
      keys.current[e.code] = true
      // Flechas y espacio desplazarían la página detrás del lobby.
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault()
      if (e.code === 'KeyE' && near.current) {
        wantsPanel.current = true
        controls.current?.unlock()
      }
    }
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false
    }
    const clear = () => {
      keys.current = {}
    }
    // Con el puntero bloqueado, un clic sobre un retrato abre su perfil. La pestaña nueva suelta el puntero
    // y onUnlock devuelve el lobby al scroll; se suelta también a mano por si el navegador no lo hace.
    const click = (e: MouseEvent) => {
      if (mode.current !== 'walking' || e.button !== 0 || !aimed.current) return
      openProfile(aimed.current.profile)
      controls.current?.unlock()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    window.addEventListener('click', click)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
      window.removeEventListener('click', click)
    }
  })

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    if (mode.current === 'using') {
      // La cámara se acomoda frente al panel.
      const k = Math.min(1, dt * 5)
      camera.position.lerp(view.from, k)
      camera.getWorldDirection(view.look).add(camera.position)
      view.look.lerp(view.at, k)
      camera.lookAt(view.look)
      return
    }
    if (mode.current !== 'walking') return
    const f = forward.current
    camera.getWorldDirection(f)
    f.y = 0
    f.normalize()
    stepWalk(camera, f, keys.current, dt, colliders)
    const isNear = panel.isNear(camera.position.x, camera.position.z, f)
    if (isNear !== near.current) {
      near.current = isNear
      onNearPanelChange(isNear)
    }
    // Mira: el impacto más cercano decide, así los muros u otros objetos delante tapan el retrato.
    raycaster.setFromCamera(CENTER, camera)
    setAimed(aimedFounder(raycaster.intersectObjects(scene.children, true)))
  })

  const onUnlock = () => {
    const toPanel = wantsPanel.current
    wantsPanel.current = false
    setMode(toPanel ? 'using' : 'off')
  }

  // Igual que en el museo: el selector no coincide con nada y el bloqueo se pide a mano (desde la landing).
  return <PointerLockControls ref={controls} selector="#manual-lock-only" onLock={() => setMode('walking')} onUnlock={onUnlock} />
}
