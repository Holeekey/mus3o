import { useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { dioramaFx, dioramaRequest, useDioramaStore } from '../diorama/dioramaStore'
import { introState } from '../intro/store'
import { canOpenDoor } from '../palace/keys'
import { roomAt, type PalaceLayout } from '../palace/layout'
import { pieceKind } from '../palace/pieceKind'
import { isDoorOpen, useStore } from '../store'
import { DWELL_DEFAULTS, dwellIdle, forceDwellFire, updateDwell, type DwellState, type DwellTarget } from './dwell'
import { occluderDistance, pickGazeTarget, type GazeCandidate, type GazeHit, type Ray } from './gaze'
import { head } from './head'
import { rigOffset } from './rig'
import { ConceptPanel, ExitButton } from './VrPanel'
import { FloorMarker, Reticle, Veil } from './Reticle'
import { activeColliders, corridorEnds, doorDestination, validateTeleport } from './teleport'
import { useVr, vrRuntime } from './runtime'
import { EXIT_BUTTON, gazeView, PANEL_BUTTONS, PANEL_DIST, PANEL_H, PANEL_W } from './view'

// Todo el modo VR dentro del Canvas: el "rig" (dónde está el jugador), el dibujado estéreo, la mirada y sus acciones.
//
// Orden de cada frame (prioridades de useFrame):
//  -999  foto de la pose; en cardboard se compone antes con los sensores
//     0  la lógica del juego (Player, DioramaRuntime...) lee y mueve la cámara como siempre
//     1  se integra lo que movió (rig), se procesa la mirada y se recompone la pose
//     2  retícula, panel, marcador y velo se colocan con la pose final
//     3  dibujado (estéreo lado a lado, o el render normal de three / WebXR)
// El rig es la verdad: x, z, y del ojo y giro de la base. En WebXR la cabeza se suma por encima (el visor manda su pose),
// y mover el rig desplaza el espacio de referencia de la sesión.

const EYE = 1.7
const CARDBOARD_FOV = 85
const EYE_SEP = 0.064
const TELEPORT_OUT = 0.18
const TELEPORT_IN = 0.28
const LOOK_AWAY_RAD = THREE.MathUtils.degToRad(55)
const LOOK_AWAY_SECS = 1.2
const Y = new THREE.Vector3(0, 1, 0)

const rig = { x: 0, y: EYE, z: 0, yaw: 0, init: false, skip: false, base: null as XRReferenceSpace | null, lastKey: '' }
const last = { x: 0, z: 0, yaw: 0 }
const snap = { x: 0, y: 0, z: 0, yaw: 0 }
const fullYaw = { v: 0 }
const tele = { phase: 'idle' as 'idle' | 'out' | 'in', x: 0, z: 0 }
const gaze = { dwell: dwellIdle() as DwellState, lookAway: 0, pad: false, hintShown: null as string | null, exitSet: false, exitDir: [0, -1] as [number, number] }

const _e = new THREE.Euler()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _o = new THREE.Vector3()
const _d = new THREE.Vector3()
const _size = new THREE.Vector2()

const camYaw = (cam: THREE.Object3D) => _e.setFromQuaternion(cam.quaternion, 'YXZ').y
const wrap = (a: number) => ((((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI

// ---------- pose ----------

function poseCardboard(cam: THREE.Camera) {
  _q.setFromAxisAngle(Y, rig.yaw)
  cam.quaternion.copy(_q).multiply(head.update())
  cam.position.set(rig.x, rig.y, rig.z)
  cam.updateMatrixWorld(true)
}

/** WebXR: el espacio de referencia de la sesión se desplaza para que el visor quede en el rig. */
function applyXr(gl: THREE.WebGLRenderer) {
  if (!rig.base) return
  const key = `${rig.x.toFixed(3)}|${rig.y.toFixed(3)}|${rig.z.toFixed(3)}|${rig.yaw.toFixed(4)}`
  if (key === rig.lastKey) return
  rig.lastKey = key
  const o = rigOffset(rig)
  const t = new XRRigidTransform({ x: o.position.x, y: o.position.y, z: o.position.z, w: 1 }, { x: o.orientation.x, y: o.orientation.y, z: o.orientation.z, w: o.orientation.w })
  gl.xr.setReferenceSpace(rig.base.getOffsetReferenceSpace(t))
}

// ---------- estéreo ----------

const stereo = new THREE.StereoCamera()
stereo.eyeSep = EYE_SEP
stereo.aspect = 0.5

/** Dos vistas lado a lado. La matriz del mundo se calcula una vez y no dos. */
function renderStereo(gl: THREE.WebGLRenderer, scene: THREE.Scene, cam: THREE.PerspectiveCamera) {
  gl.getSize(_size)
  const w = _size.x
  const h = _size.y
  scene.updateMatrixWorld()
  cam.updateMatrixWorld()
  stereo.update(cam)
  const auto = scene.matrixWorldAutoUpdate
  scene.matrixWorldAutoUpdate = false
  gl.setScissorTest(true)
  gl.setScissor(0, 0, w / 2, h)
  gl.setViewport(0, 0, w / 2, h)
  gl.render(scene, stereo.cameraL)
  gl.setScissor(w / 2, 0, w / 2, h)
  gl.setViewport(w / 2, 0, w / 2, h)
  gl.render(scene, stereo.cameraR)
  gl.setScissorTest(false)
  scene.matrixWorldAutoUpdate = auto
}

// ---------- entradas de pulsación ----------

function pollGamepad() {
  const pads = navigator.getGamepads?.() ?? []
  let down = false
  for (const p of pads) if (p?.buttons.some((b) => b.pressed)) down = true
  if (down && !gaze.pad) vrRuntime.press = true
  gaze.pad = down
}

function usePressInputs(active: boolean) {
  useEffect(() => {
    if (!active) return
    let start: { x: number; y: number } | null = null
    const onDown = (e: PointerEvent) => {
      start = (e.target as HTMLElement | null)?.closest?.('.vr-ui') ? null : { x: e.clientX, y: e.clientY }
    }
    const onUp = (e: PointerEvent) => {
      // Un toque corto es "pulsar"; arrastrar mira alrededor (head.ts) y no dispara.
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 10) vrRuntime.press = true
      start = null
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space' || e.code === 'MediaPlayPause') {
        vrRuntime.press = true
        e.preventDefault()
      }
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('keydown', onKey)
    }
  }, [active])
}

// ---------- mundo mirable ----------

type World = {
  pedestals: GazeCandidate[]
  doors: GazeCandidate[]
  walls: { x: number; z: number; w: number; d: number; h: number; y?: number }[]
  ends: ReturnType<typeof corridorEnds>
}

function buildWorld(layout: PalaceLayout): World {
  const ends = corridorEnds(layout)
  const pedestals: GazeCandidate[] = layout.rooms.flatMap((r) =>
    r.pedestals.map((p) => ({
      key: `ped:${p.concept.id}`,
      kind: 'pedestal' as const,
      shape: { type: 'sphere' as const, c: [p.x, 1.3, p.z] as const, r: 0.8 },
      maxDist: 6,
      data: { conceptId: p.concept.id, title: p.concept.title },
    })),
  )
  const doors: GazeCandidate[] = ends.map((e, i) => {
    const alongX = Math.abs(e.dirX) > 0.5
    return {
      key: `door:${i}`,
      kind: 'door' as const,
      shape: {
        type: 'quad' as const,
        c: [e.x, 1.6, e.z] as const,
        right: (alongX ? [0, 0, 1] : [1, 0, 0]) as readonly [number, number, number],
        up: [0, 1, 0] as const,
        hw: e.width / 2,
        hh: 1.6,
      },
      maxDist: 14,
      occludeTol: 1.2,
      data: { index: i },
    }
  })
  const walls = [
    ...layout.rooms.flatMap((r) => r.walls),
    ...layout.corridors.flatMap((c) => c.walls),
    ...layout.rooms.flatMap((r) => (r.centerpiece ? [{ x: r.x, z: r.z, w: r.centerpiece.footprint[0], d: r.centerpiece.footprint[1], h: r.centerpiece.height }] : [])),
  ]
  return { pedestals, doors, walls, ends }
}

const normalOf = (yaw: number) => [Math.sin(yaw), 0, Math.cos(yaw)] as const
const rightOf = (yaw: number) => [Math.cos(yaw), 0, -Math.sin(yaw)] as const

function panelCandidates(): GazeCandidate[] {
  const p = gazeView.panel
  const n = normalOf(p.yaw)
  const r = rightOf(p.yaw)
  const at = (x: number, y: number, lift: number) => [p.x + r[0] * x + n[0] * lift, p.y + y, p.z + r[2] * x + n[2] * lift] as const
  const btn = (b: (typeof PANEL_BUTTONS)[keyof typeof PANEL_BUTTONS]): GazeCandidate => ({
    key: b.id,
    kind: 'ui',
    shape: { type: 'quad', c: at(b.x, b.y, 0.02), right: r, up: [0, 1, 0], hw: b.w / 2, hh: b.h / 2 },
    maxDist: 8,
  })
  return [
    { key: 'ui:panel', kind: 'blocker', shape: { type: 'quad', c: at(0, 0, 0), right: r, up: [0, 1, 0], hw: PANEL_W / 2, hh: PANEL_H / 2 }, maxDist: 8 },
    btn(PANEL_BUTTONS.memorize),
    btn(PANEL_BUTTONS.close),
  ]
}

// ---------- acciones ----------

function closePanel() {
  if (useVr.getState().panelId) useVr.setState({ panelId: null })
  gaze.lookAway = 0
}

function openPanel(conceptId: string, walls: World['walls']) {
  const st = useStore.getState()
  const concept = st.layout?.rooms.flatMap((r) => r.pedestals).find((p) => p.concept.id === conceptId)?.concept
  if (concept && pieceKind(concept) === 'key') st.pickupKey()
  // El frente real de la cabeza (horizontal); si mira casi vertical, el del rig.
  const fh = new THREE.Vector3(gazeRay.d[0], 0, gazeRay.d[2])
  if (fh.lengthSq() < 0.04) fh.set(-Math.sin(rig.yaw), 0, -Math.cos(rig.yaw))
  fh.normalize()
  const wall = occluderDistance({ o: [gazeRay.o[0], 1.2, gazeRay.o[2]], d: [fh.x, 0, fh.z] }, walls)
  const dist = THREE.MathUtils.clamp(wall - 0.5, 1.1, PANEL_DIST)
  const px = gazeRay.o[0] + fh.x * dist
  const pz = gazeRay.o[2] + fh.z * dist
  gazeView.panel = { x: px, y: gazeRay.o[1] - 0.05, z: pz, yaw: Math.atan2(gazeRay.o[0] - px, gazeRay.o[2] - pz) }
  gaze.lookAway = 0
  useVr.setState({ panelId: conceptId })
}

function requestTeleport(x: number, z: number) {
  if (tele.phase !== 'idle') return
  tele.phase = 'out'
  tele.x = x
  tele.z = z
}

/** Marca de la mirada del frame: se guarda para que las acciones usen el mismo rayo. */
const gazeRay: Ray = { o: [0, EYE, 0], d: [0, 0, -1] }

// Solo en desarrollo: estado interno para las pruebas con navegador (puppeteer).
if (import.meta.env.DEV) (globalThis as unknown as { __vr?: unknown }).__vr = { rig, gazeRay, tele, gaze }

type Described = { hint: string | null; act: (() => void) | null; target: DwellTarget | null }
const NONE: Described = { hint: null, act: null, target: null }

function describe(hit: GazeHit | null, w: World, layout: PalaceLayout, colliders: ReturnType<typeof activeColliders>): Described {
  if (!hit) return NONE
  const c = hit.cand
  const st = useStore.getState()
  const key: DwellTarget = { key: c.key }
  switch (c.kind) {
    case 'blocker':
      return NONE
    case 'ui':
      if (c.key === PANEL_BUTTONS.close.id) return { hint: 'Cerrar', act: closePanel, target: key }
      return {
        hint: st.memorized[useVr.getState().panelId ?? ''] ? 'Quitar marca' : 'Marcar memorizado',
        act: () => {
          const id = useVr.getState().panelId
          if (id) useStore.getState().toggleMemorized(id)
        },
        target: key,
      }
    case 'exit':
      return { hint: 'Salir del cuadro', act: () => void (dioramaRequest.leave = true), target: key }
    case 'pedestal': {
      const id = String(c.data?.conceptId)
      if (useVr.getState().panelId === id) return NONE
      return { hint: `Examinar: ${String(c.data?.title).slice(0, 34)}`, act: () => openPanel(id, w.walls), target: key }
    }
    case 'portal': {
      const id = String(c.data?.portalId)
      return {
        hint: `Entrar al cuadro: ${String(c.data?.title).slice(0, 28)}`,
        act: () => {
          closePanel()
          dioramaRequest.enter = id
        },
        target: key,
      }
    }
    case 'door': {
      const end = w.ends[Number(c.data?.index)]
      if (!end) return NONE
      const door = layout.doors.find((d) => d.corridorIndex === end.corridor)
      if (door && !isDoorOpen(st, door.id)) {
        if (canOpenDoor(door, st.hasKey, st.roomKeys)) return { hint: 'Abrir la compuerta con la llave', act: () => useStore.getState().unlockDoor(door.id), target: key }
        return { hint: 'Compuerta bloqueada: memoriza la sala', act: null, target: null }
      }
      const dest = doorDestination(layout, colliders, end)
      if (!dest) return NONE
      const room = roomAt(layout, dest.x, dest.z)
      return { hint: room ? `Ir a: ${room.title.slice(0, 30)}` : 'Cruzar el pasillo', act: () => requestTeleport(dest.x, dest.z), target: key }
    }
    case 'floor': {
      const check = validateTeleport(layout, colliders, { x: gazeRay.o[0], z: gazeRay.o[2] }, { x: hit.point[0], z: hit.point[2] })
      gazeView.floor = { show: true, valid: check.ok, x: hit.point[0], z: hit.point[2] }
      if (!check.ok) return NONE
      return { hint: 'Ir aquí', act: () => requestTeleport(check.x, check.z), target: { key: 'floor', point: hit.point } }
    }
    default:
      return NONE
  }
}

// ---------- componente ----------

export function VrRuntime({ layout }: { layout: PalaceLayout }) {
  const kind = useVr((s) => s.kind)
  const world = useMemo(() => buildWorld(layout), [layout])
  const setDpr = useThree((s) => s.setDpr)
  const gl = useThree((s) => s.gl)
  const getState = useThree((s) => s.get)
  if (import.meta.env.DEV) (globalThis as unknown as { __vr?: Record<string, unknown> }).__vr!.getThree = getState
  const desktopCam = useMemo(() => ({ cam: null as THREE.Camera | null }), [])
  usePressInputs(kind !== null)

  // Resolución, campo de visión y restauración al salir.
  useEffect(() => {
    if (!kind) return
    const cam = desktopCam.cam as THREE.PerspectiveCamera | null
    const prevFov = cam?.fov ?? 70
    setDpr(Math.min(window.devicePixelRatio || 1, kind === 'cardboard' ? 1.25 : 1))
    if (kind === 'cardboard' && cam) {
      cam.rotation.order = 'YXZ'
      cam.fov = CARDBOARD_FOV
      cam.updateProjectionMatrix()
    }
    return () => {
      const { size } = getState()
      setDpr(Math.min(1.5, window.devicePixelRatio || 1))
      gl.setScissorTest(false)
      gl.setViewport(0, 0, size.width, size.height)
      const dc = desktopCam.cam as THREE.PerspectiveCamera | null
      if (dc) {
        dc.fov = prevFov
        dc.updateProjectionMatrix()
        dc.position.set(rig.x, EYE, rig.z)
        dc.rotation.set(0, fullYaw.v, 0, 'YXZ')
      }
      try {
        gl.xr.setReferenceSpace(null as unknown as XRReferenceSpace)
      } catch {
        /* sin sesión WebXR */
      }
      rig.init = false
      rig.base = null
      rig.lastKey = ''
      tele.phase = 'idle'
      gaze.dwell = dwellIdle()
      gazeView.key = null
      gazeView.progress = 0
      gazeView.floor.show = false
      gazeView.exit.show = false
      gaze.exitSet = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])

  // Antes que la lógica del juego.
  useFrame((state) => {
    const cam = state.camera
    if (!vrRuntime.active) {
      rig.init = false
      desktopCam.cam = cam
      last.x = cam.position.x
      last.z = cam.position.z
      last.yaw = camYaw(cam)
      return
    }
    // WebXR: la sesión se anuncia antes de que three tenga su espacio de referencia; se espera a que presente.
    if (vrRuntime.kind === 'xr' && !rig.init && (!state.gl.xr.isPresenting || !state.gl.xr.getReferenceSpace())) return
    if (!rig.init) {
      rig.init = true
      rig.x = last.x
      rig.z = last.z
      rig.yaw = last.yaw
      if (vrRuntime.kind === 'xr') {
        rig.y = EYE - cam.position.y // altura de ojos fija, sea cual sea la del visor
        rig.base = state.gl.xr.getReferenceSpace()
        rig.skip = true
      } else {
        rig.y = EYE
        head.recenter()
      }
    }
    if (vrRuntime.kind === 'cardboard') poseCardboard(cam)
    snap.x = cam.position.x
    snap.y = cam.position.y
    snap.z = cam.position.z
    snap.yaw = camYaw(cam)
  }, -999)

  // Después de la lógica: integra, mira, actúa y recompone.
  useFrame((state, rawDt) => {
    const cam = state.camera
    if (!vrRuntime.active || !rig.init) return
    const dt = Math.min(rawDt, 0.05)
    if (rig.skip) rig.skip = false
    else {
      rig.x += cam.position.x - snap.x
      rig.y += cam.position.y - snap.y
      rig.z += cam.position.z - snap.z
      rig.yaw += wrap(camYaw(cam) - snap.yaw)
    }
    fullYaw.v = camYaw(cam)

    runGaze(state.camera, dt, world, layout)
    runTeleport(dt)

    if (vrRuntime.kind === 'cardboard') poseCardboard(cam)
    else applyXr(state.gl)
  }, 1)

  // Dibujado.
  useFrame((state) => {
    const { gl, scene, camera } = state
    if (vrRuntime.active && vrRuntime.kind === 'cardboard') renderStereo(gl, scene, camera as THREE.PerspectiveCamera)
    else gl.render(scene, camera)
  }, 3)

  if (!kind) return <Veil />
  return (
    <>
      <Reticle />
      <FloorMarker />
      {/* El texto 3D suspende mientras carga su tipografía: cada pieza en su propio límite para no ocultar el resto. */}
      <Suspense fallback={null}>
        <ConceptPanel layout={layout} />
      </Suspense>
      <Suspense fallback={null}>
        <ExitButton />
      </Suspense>
      <Veil />
    </>
  )
}

// ---------- mirada ----------

function runGaze(cam: THREE.Camera, dt: number, w: World, layout: PalaceLayout) {
  cam.getWorldPosition(_o)
  cam.getWorldDirection(_d)
  gazeRay.o = [_o.x, _o.y, _o.z]
  gazeRay.d = [_d.x, _d.y, _d.z]
  pollGamepad()
  const press = vrRuntime.press
  vrRuntime.press = false

  const ds = useDioramaStore.getState()
  const busy = introState.active || tele.phase !== 'idle' || ds.phase === 'entering' || ds.phase === 'leaving'
  gazeView.floor.show = false

  let hit: GazeHit | null = null
  let desc: Described = NONE
  let wallDist = Infinity

  if (!busy) {
    const st = useStore.getState()
    const closed = layout.doors.filter((d) => !isDoorOpen(st, d.id)).map((d) => ({ x: d.x, z: d.z, w: d.w, d: d.d, h: 4 }))
    wallDist = Math.min(occluderDistance(gazeRay, w.walls), occluderDistance(gazeRay, closed))
    const cands: GazeCandidate[] = []
    if (ds.phase === 'inside') {
      cands.push(exitCandidate())
    } else {
      if (useVr.getState().panelId) cands.push(...panelCandidates())
      cands.push(...w.pedestals, ...w.doors)
      for (const p of Object.values(ds.portals)) {
        const r = p.rotationY
        cands.push({
          key: `portal:${p.id}`,
          kind: 'portal',
          shape: { type: 'quad', c: p.center, right: rightOf(r), up: [0, 1, 0], hw: p.width / 2, hh: p.height / 2 },
          maxDist: 6.5,
          occludeTol: 0.6,
          data: { portalId: p.id, title: p.diorama.title },
        })
      }
    }
    // Dentro del cuadro no hay suelo al que teletransportarse (se camina con el mando o el teclado).
    hit = pickGazeTarget(gazeRay, cands, { wallDistance: ds.phase === 'inside' ? Infinity : wallDist, floorMax: ds.phase === 'inside' ? 0 : 10 })
    const colliders = activeColliders(layout, (id) => isDoorOpen(st, id))
    desc = describe(hit, w, layout, colliders)
  }

  // Dwell o pulsación inmediata.
  const res = press ? forceDwellFire(gaze.dwell, desc.target) : updateDwell(gaze.dwell, desc.target, dt, DWELL_DEFAULTS)
  gaze.dwell = res.state
  gazeView.progress = res.progress
  gazeView.key = hit?.cand.key ?? null
  gazeView.kind = hit?.cand.kind ?? null
  if (res.fired) desc.act?.()

  // Retícula: a la distancia de lo mirado (o de un muro cercano).
  gazeView.dist = hit ? THREE.MathUtils.clamp(hit.t - 0.06, 0.7, 8) : THREE.MathUtils.clamp(Math.min(3, wallDist - 0.1), 0.7, 3)

  // Texto bajo la retícula (solo se escribe en React cuando cambia).
  const hint = busy ? null : desc.hint
  if (hint !== gaze.hintShown) {
    gaze.hintShown = hint
    useVr.setState({ hint })
  }

  // El panel se cierra solo si se aparta la mirada.
  if (useVr.getState().panelId && !busy) {
    _p.set(gazeView.panel.x - _o.x, gazeView.panel.y - _o.y, gazeView.panel.z - _o.z).normalize()
    if (_p.angleTo(_d) > LOOK_AWAY_RAD) {
      gaze.lookAway += dt
      if (gaze.lookAway > LOOK_AWAY_SECS) closePanel()
    } else gaze.lookAway = 0
  }

  // Botón de salida: la dirección se fija al entrar al cuadro (hacia donde mira entonces) y desde ahí lo acompaña
  // a 1,7 m y 1 m por debajo de los ojos, aunque se camine con un mando.
  if (ds.phase === 'inside') {
    // Se ancla cuando la cámara ya está en el mundo del cuadro (a ~1500 m del palacio) y el velo se aclaró.
    if (!gaze.exitSet && Math.abs(_o.x) > 500 && dioramaFx.fade < 0.02) {
      gaze.exitSet = true
      _p.set(_d.x, 0, _d.z)
      if (_p.lengthSq() < 0.01) _p.set(0, 0, -1)
      _p.normalize()
      gaze.exitDir = [_p.x, _p.z]
      gazeView.exit.yaw = Math.atan2(-_p.x, -_p.z)
      gazeView.exit.show = true
    }
    if (gaze.exitSet) {
      gazeView.exit.x = _o.x + gaze.exitDir[0] * 1.7
      gazeView.exit.y = _o.y - 1.0
      gazeView.exit.z = _o.z + gaze.exitDir[1] * 1.7
    }
  } else if (gaze.exitSet) {
    gaze.exitSet = false
    gazeView.exit.show = false
  }
}

function exitCandidate(): GazeCandidate {
  const e = gazeView.exit
  const r = rightOf(e.yaw)
  return {
    key: EXIT_BUTTON.key,
    kind: 'exit',
    shape: { type: 'quad', c: [e.x, e.y, e.z], right: r, up: [0, 1, 0], hw: EXIT_BUTTON.w / 2, hh: EXIT_BUTTON.h / 2 },
    maxDist: 6,
  }
}

// ---------- teletransporte con velo ----------

function runTeleport(dt: number) {
  if (tele.phase === 'out') {
    vrRuntime.fade = Math.min(1, vrRuntime.fade + dt / TELEPORT_OUT)
    if (vrRuntime.fade >= 1) {
      rig.x = tele.x
      rig.z = tele.z
      closePanel()
      tele.phase = 'in'
    }
  } else if (vrRuntime.fade > 0) {
    // Entrada a VR y vuelta del teletransporte: se aclara.
    vrRuntime.fade = Math.max(0, vrRuntime.fade - dt / (tele.phase === 'in' ? TELEPORT_IN : 0.6))
    if (tele.phase === 'in' && vrRuntime.fade <= 0) tele.phase = 'idle'
  } else if (tele.phase === 'in') tele.phase = 'idle'
}
