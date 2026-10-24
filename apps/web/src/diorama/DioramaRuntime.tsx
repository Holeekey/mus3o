import { MeshPortalMaterial, Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { freeSpotInFront, moveWithCollisions, type PalaceLayout } from '../palace/layout'
import { conceptIdSet } from '../palace/conceptIds'
import { playerPose, useStore } from '../store'
import { roomPalettes, type Theme } from '../theme'
import { DioramaScene } from './DioramaScene'
import { dioramaFx, dioramaRequest, useDioramaStore } from './dioramaStore'
import { DIORAMA_SPAWN } from './guide'
import { getDioramaModel } from './model'
import { RoomEcho } from './RoomEcho'

// El mundo del diorama vive muy lejos del palacio, en el mismo Canvas: así el cambio de
// mundo es solo mover la cámara y no hay segundo renderer ni recarga.
export const DIORAMA_ORIGIN = new THREE.Vector3(1500, 0, 1500)

const EYE = 1.7
const WALK = 5
const RUN = 9
const REACH = 7
const BOUND = 13.4
const PLAYER_R = 0.4
const SPAWN_Z: number = DIORAMA_SPAWN.z
const GATE_Z = 13.2
const ENTER_SECS = 1.05
const LEAVE_SECS = 0.8
const FADE_IN_SECS = 0.85

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const easeOut = (u: number) => 1 - Math.pow(1 - u, 3)
const easeIn = (u: number) => u * u
const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const lerpAngle = (a: number, b: number, t: number) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI
  if (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

type Transition =
  | { kind: 'enter'; t: number; from: THREE.Vector3; fromYaw: number; fromPitch: number; to: THREE.Vector3; yaw: number; dur: number }
  | { kind: 'leave'; t: number; from: THREE.Vector3; to: THREE.Vector3; fromYaw: number; fromPitch: number; dur: number }
  | { kind: 'reveal'; t: number; frames: number }

/** Gran marco de regreso: una ventana a la sala del palacio, detrás del punto de aparición. */
function ReturnGate({ layout, theme, roomId, center, rotationY }: { layout: PalaceLayout; theme: Theme; roomId?: string; center: [number, number, number]; rotationY: number }) {
  const room = layout.rooms.find((r) => r.id === roomId) ?? layout.rooms[0]
  const palette = useMemo(() => roomPalettes(theme, layout.rooms.map((r) => r.title))[room.index], [theme, layout, room.index])
  const plaster = theme.scene.pedestal.color
  const W = 3.0
  const H = 3.4
  return (
    <group position={[0, 0, GATE_Z]} rotation={[0, Math.PI, 0]}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (W / 2 + 0.3), (H + 0.4) / 2, 0.1]} castShadow receiveShadow>
          <boxGeometry args={[0.6, H + 0.4, 0.7]} />
          <meshStandardMaterial color={plaster} roughness={0.95} flatShading />
        </mesh>
      ))}
      <mesh position={[0, H + 0.2, 0.1]} castShadow receiveShadow>
        <boxGeometry args={[W + 1.5, 0.6, 0.8]} />
        <meshStandardMaterial color={plaster} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[0, 0.06, 0.1]} receiveShadow>
        <boxGeometry args={[W + 1.7, 0.12, 0.95]} />
        <meshStandardMaterial color={palette.trim} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[0, H / 2 + 0.12, 0]}>
        <planeGeometry args={[W, H]} />
        <MeshPortalMaterial resolution={768} blur={0}>
          <RoomEcho room={room} palette={palette} theme={theme} wall={[center[0], center[2]]} rotationY={rotationY} />
        </MeshPortalMaterial>
      </mesh>
      <Suspense fallback={null}>
        <Text position={[0, H + 0.2, 0.52]} font="/fonts/Gloock.ttf" fontSize={0.26} color={palette.ink} anchorY="middle" letterSpacing={0.04}>
          {room.title}
        </Text>
      </Suspense>
    </group>
  )
}

/**
 * Gestiona todo lo del cuadro dentro del Canvas: transición de entrada y salida, el mundo a
 * escala real con su jugador (movimiento acotado, colisiones, foco en conceptos) y el marco
 * de regreso. Monta una vez; solo trabaja cuando hay algún PortalPainting registrado.
 */
export function DioramaRuntime({ layout, theme }: { layout: PalaceLayout; theme: Theme }) {
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const phase = useDioramaStore((s) => s.phase)
  const activeId = useDioramaStore((s) => s.activeId)
  const portal = useDioramaStore((s) => (s.activeId ? s.portals[s.activeId] : undefined))
  const mode = useStore((s) => s.mode)
  const focusedId = useStore((s) => s.focusedId)
  const insideRef = useRef<THREE.Group>(null)
  const tr = useRef<Transition | null>(null)
  const keys = useRef<Record<string, boolean>>({})
  const loc = useRef({ x: 0, z: SPAWN_Z })
  const saved = useRef<{ bg: THREE.Scene['background']; fog: THREE.Scene['fog']; lights: THREE.Object3D[] } | null>(null)
  const model = useMemo(() => (portal ? getDioramaModel(portal.diorama) : null), [portal])
  const focusedPiece = useRef<string | null>(null)
  const locals = useMemo(() => ({ fwd: new THREE.Vector3(), tmp: new THREE.Vector3() }), [])

  // --- Teclado propio para caminar dentro (Player no corre mientras hay un cuadro activo) ---
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      keys.current[e.code] = true
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

  // Si el cuadro desaparece o el mundo se desmonta con el jugador dentro, no se le deja atrapado.
  useEffect(
    () => () => {
      const s = useDioramaStore.getState()
      if (s.phase !== 'room') s.setPhase('room', null)
      s.setHint(null)
      s.setNearReturn(false)
      dioramaFx.fade = 0
    },
    [],
  )

  // --- Cambio de ambiente: fondo, niebla y luces del palacio ↔ las del diorama ---
  const inside = phase === 'inside' || phase === 'leaving'
  useEffect(() => {
    if (!inside || !model) return
    saved.current = { bg: scene.background, fog: scene.fog, lights: [] }
    const { atmo } = model
    scene.background = new THREE.Color(atmo.skyHorizon)
    scene.fog = new THREE.Fog(atmo.fog, atmo.fogNear, atmo.fogFar)
    for (const o of scene.children) {
      if ((o as THREE.Light).isLight && o.visible) {
        o.visible = false
        saved.current.lights.push(o)
      }
    }
    return () => {
      const s = saved.current
      if (!s) return
      scene.background = s.bg
      scene.fog = s.fog
      for (const o of s.lights) o.visible = true
      saved.current = null
    }
  }, [inside, model, scene])

  const enter = (id: string) => {
    const info = useDioramaStore.getState().portals[id]
    if (!info) return
    const st = useStore.getState()
    st.set({ openId: null })
    const n = new THREE.Vector3(Math.sin(info.rotationY), 0, Math.cos(info.rotationY))
    const to = new THREE.Vector3(...info.center).addScaledVector(n, 0.75)
    to.y = info.center[1]
    dioramaFx.color = '#' + new THREE.Color(getDioramaModel(info.diorama).atmo.skyHorizon).getHexString()
    const quick = reducedMotion()
    tr.current = { kind: 'enter', t: 0, from: camera.position.clone(), fromYaw: camera.rotation.y, fromPitch: camera.rotation.x, to, yaw: info.rotationY, dur: quick ? 0.35 : ENTER_SECS }
    useDioramaStore.getState().setPhase('entering', id)
    useDioramaStore.getState().setHint(null)
  }

  const leave = () => {
    const info = activeId ? useDioramaStore.getState().portals[activeId] : undefined
    if (!info || tr.current) return
    useStore.getState().set({ openId: null, focusedId: null })
    dioramaFx.color = theme.scene.background
    const quick = reducedMotion()
    const to = camera.position.clone()
    to.x = DIORAMA_ORIGIN.x
    to.z = DIORAMA_ORIGIN.z + GATE_Z - 0.2
    tr.current = { kind: 'leave', t: 0, from: camera.position.clone(), to: quick ? camera.position.clone() : to, fromYaw: camera.rotation.y, fromPitch: camera.rotation.x, dur: quick ? 0.35 : LEAVE_SECS }
    useDioramaStore.getState().setPhase('leaving')
  }


  // --- Bucle principal ---
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const ds = useDioramaStore.getState()

    if (dioramaRequest.enter && ds.phase === 'room') {
      const id = dioramaRequest.enter
      dioramaRequest.enter = null
      enter(id)
    }
    dioramaRequest.enter = null
    if (dioramaRequest.leave) {
      dioramaRequest.leave = false
      if (ds.phase === 'inside') leave()
    }

    if (ds.phase !== 'room' && (!ds.activeId || !ds.portals[ds.activeId])) {
      tr.current = null
      dioramaFx.fade = 0
      ds.setPhase('room', null)
      return
    }

    const t = tr.current
    if (t?.kind === 'enter') {
      t.t += dt
      const u = Math.min(1, t.t / t.dur)
      const e = reducedMotion() ? 0 : easeOut(u)
      camera.position.lerpVectors(t.from, t.to, e)
      camera.rotation.y = lerpAngle(t.fromYaw, t.yaw, e)
      camera.rotation.x = t.fromPitch * (1 - e)
      dioramaFx.fade = reducedMotion() ? u : smooth(0.6, 1, u)
      if (u >= 1) {
        // Pantalla en velo completo: se salta al mundo del diorama.
        loc.current = { x: 0, z: SPAWN_Z }
        camera.rotation.set(0, 0, 0, 'YXZ')
        tr.current = { kind: 'reveal', t: 0, frames: 0 }
        useDioramaStore.getState().setPhase('inside')
      }
    } else if (t?.kind === 'leave') {
      t.t += dt
      const u = Math.min(1, t.t / t.dur)
      const le = reducedMotion() ? 0 : easeIn(u)
      camera.position.lerpVectors(t.from, t.to, le)
      camera.rotation.y = lerpAngle(t.fromYaw, Math.PI, le)
      camera.rotation.x = t.fromPitch * (1 - le)
      dioramaFx.fade = reducedMotion() ? u : smooth(0.25, 1, u)
      if (u >= 1) {
        const info = activeId ? ds.portals[activeId] : undefined
        if (info) {
          const n = new THREE.Vector3(Math.sin(info.rotationY), 0, Math.cos(info.rotationY))
          // Delante del cuadro, pero nunca dentro de un pedestal o de la pieza central.
          const spot = freeSpotInFront(layout, info.center[0], info.center[2], n.x, n.z)
          camera.position.set(spot.x, EYE, spot.z)
          camera.rotation.set(0, info.rotationY, 0, 'YXZ')
        }
        tr.current = { kind: 'reveal', t: 0, frames: 0 }
        useDioramaStore.getState().setPhase('room', null)
        focusedPiece.current = null
        ds.setNearReturn(false)
      }
    } else if (t?.kind === 'reveal') {
      t.frames++
      // Espera a que el nuevo mundo haya pintado y compilado antes de levantar el velo.
      if (t.frames > 4) t.t += dt
      dioramaFx.fade = 1 - easeOut(Math.min(1, t.t / FADE_IN_SECS))
      if (t.t >= FADE_IN_SECS) {
        dioramaFx.fade = 0
        tr.current = null
      }
    }

    // --- Dentro del diorama: caminar, colisiones, foco ---
    if (ds.phase !== 'inside' || !model || (t && t.kind !== 'reveal')) return
    const k = keys.current
    const f = locals.fwd
    camera.getWorldDirection(f)
    f.y = 0
    f.normalize()
    const locked = useStore.getState().locked
    if (locked && t?.kind !== 'reveal') {
      const ax = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0)
      const az = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0)
      if (ax || az) {
        const speed = (k.ShiftLeft || k.ShiftRight ? RUN : WALK) * dt
        let dx = f.x * az - f.z * ax
        let dz = f.z * az + f.x * ax
        const len = Math.hypot(dx, dz)
        dx = (dx / len) * speed
        dz = (dz / len) * speed
        // Límites invisibles + obstáculos circulares (árboles, cañones...) + el agua.
        const boxes = [
          { x: 0, z: -BOUND - 5, w: 80, d: 10, h: 9 },
          { x: 0, z: BOUND + 5 + 0.9, w: 80, d: 10, h: 9 },
          { x: -BOUND - 5, z: 0, w: 10, d: 80, h: 9 },
          { x: BOUND + 5, z: 0, w: 10, d: 80, h: 9 },
          ...model.layout.colliders.map((c) => ({ x: c.x, z: c.z, w: c.r * 2 - PLAYER_R * 1.2, d: c.r * 2 - PLAYER_R * 1.2, h: 2 })),
        ]
        const p = loc.current
        const next = moveWithCollisions(boxes, p.x, p.z, dx, dz)
        if (!model.field.isWater(next.x, next.z)) loc.current = next
      }
    }
    const p = loc.current
    const ground = model.field.heightAt(p.x, p.z)
    const targetY = EYE + Math.max(ground, model.field.waterLevel ?? -99)
    const cy = Math.abs(camera.position.y - targetY) > 4 ? targetY : camera.position.y + (targetY - camera.position.y) * Math.min(1, dt * 10)
    camera.position.set(DIORAMA_ORIGIN.x + p.x, cy, DIORAMA_ORIGIN.z + p.z)
    // Pose local para el minimapa del diorama (Player no la escribe mientras se está dentro).
    playerPose.x = p.x
    playerPose.z = p.z
    playerPose.yaw = Math.atan2(f.x, f.z)

    // Marco de regreso
    const nearGate = p.z > 9.2 && Math.abs(p.x) < 3.2
    if (nearGate !== ds.nearReturn) ds.setNearReturn(nearGate)
    if (locked && !tr.current && p.z > GATE_Z - 1.1 && Math.abs(p.x) < 1.5) leave()

    // Concepto enlazado al que se mira: reutiliza focusedId, así ConceptCard y la tecla E funcionan igual.
    const st = useStore.getState()
    let best: string | null = null
    let bestD = REACH
    const ids = conceptIdSet(st.palace)
    for (const l of model.layout.linked) {
      if (!ids.has(l.pieceId)) continue
      const vx = l.x - p.x
      const vz = l.z - p.z
      const d = Math.hypot(vx, vz)
      if (d > bestD || d < 0.01) continue
      if ((vx * f.x + vz * f.z) / d < 0.9) continue
      best = l.pieceId
      bestD = d
    }
    if (best !== st.focusedId) {
      const closeCard = st.openId && st.mode === 'explore' && st.openId !== best
      st.set(closeCard ? { focusedId: best, openId: null } : { focusedId: best })
    }
    focusedPiece.current = best
  })

  // La luz de enfoque y las etiquetas siguen al modo (en examen los títulos se ocultan).
  return (
    <>
      {(phase === 'inside' || phase === 'leaving' || phase === 'entering') && portal && (
        <group ref={insideRef} position={DIORAMA_ORIGIN}>
          {phase !== 'entering' && (
            <>
              <DioramaScene diorama={portal.diorama} labels={mode === 'explore'} focusedPieceId={focusedId} followSky shadowMapSize={2048} />
              <ReturnGate layout={layout} theme={theme} roomId={portal.roomId} center={portal.center} rotationY={portal.rotationY} />
            </>
          )}
        </group>
      )}
    </>
  )
}
