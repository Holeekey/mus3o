import { Html } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Vector3 } from 'three'
import { WALL_T, type PalaceLayout, type RoomLayout } from '../palace/layout'
import { DEFAULT_THEME, type RoomPalette, type Theme } from '../theme'
import type { FounderTag } from './founderAim'
import { Founders } from './Founders'
import { LogoSculpture } from './LogoSculpture'
import { LobbyPoster } from './LobbyPoster'
import { LobbyWalker, type LobbyMode, type PanelSpot, type WalkApi } from './LobbyWalker'
import { Room, Wall } from './Room'
import { doorFillers, EYE } from './walk'

// Lobby de museo: paredes beige-gris, molduras de yeso claro y piso de piedra clara.
const LOBBY: RoomPalette = {
  name: 'Lobby',
  wall: '#D6CFC2',
  floor: '#C9C2B4',
  trim: '#EDE8DE',
  ink: '#3A2E28',
}
// La cámara entra por la esquina noroeste y mira al sureste: la pared sur queda de frente.
const FOUNDERS_WALL = 's'
// Paneles de "Crea tu palacio" centrados en la pared este, con marco (en el centro de la sala está el logo).
// drei Html en modo transform: 1 m = 400 / distanceFactor px.
const PANEL_DF = 2
export const PANEL_PX = { w: 1040, h: 760 }
const PANEL_W = (PANEL_PX.w * PANEL_DF) / 400
const PANEL_H = (PANEL_PX.h * PANEL_DF) / 400
const PANEL_Y = 2.4
const PANEL_VIEW_DIST = 3.4
// Mismo marco oscuro que Founders y el cartel; el panel va delante del marco para que "blending" no lo tape.
const PANEL_FRAME = 0.12
const PANEL_FRAME_DEPTH = 0.08
const PANEL_FRAME_COLOR = '#2B211C'

function eastPanel(room: RoomLayout): PanelSpot & { position: [number, number, number]; wallX: number } {
  const wallX = room.x + room.w / 2 - WALL_T / 2
  const x = wallX - PANEL_FRAME_DEPTH - 0.01
  const z = room.z
  return {
    wallX,
    position: [x, PANEL_Y, z],
    viewFrom: [x - PANEL_VIEW_DIST, PANEL_Y, z],
    viewAt: [x, PANEL_Y, z],
    isNear: (px, pz, f) => px > x - 4 && Math.abs(pz - z) < PANEL_W / 2 + 0.3 && f.x > 0.55,
  }
}
const CARPET = '#8E2A1E'
const CARPET_BORDER = '#C9963A'

/** Alfombra roja con ribete dorado en el centro del lobby, bajo el logo. */
function LobbyCarpet({ room }: { room: RoomLayout }) {
  const w = room.w * 0.72
  const d = room.d * 0.72
  return (
    <group position={[room.x, 0, room.z]}>
      <mesh position={[0, 0.006, 0]} receiveShadow>
        <boxGeometry args={[w + 0.24, 0.012, d + 0.24]} />
        <meshStandardMaterial color={CARPET_BORDER} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.014, 0]} receiveShadow>
        <boxGeometry args={[w, 0.012, d]} />
        <meshStandardMaterial color={CARPET} roughness={1} />
      </mesh>
    </group>
  )
}

// Sala donde aparece el jugador: la vista final es la misma que al entrar al palacio.
function startRoom(layout: PalaceLayout): RoomLayout {
  const { x, z } = layout.spawn
  return (
    layout.rooms.find((r) => Math.abs(x - r.x) <= r.w / 2 && Math.abs(z - r.z) <= r.d / 2) ?? layout.rooms[0]
  )
}

// drei Html crea su propia raíz de React y la recrea si cambia el contenedor (events.connected llega
// después del primer render) o si StrictMode repite el montaje. Si esa raíz se desmonta durante un render,
// el desmontaje diferido deja vacía a la nueva. Montarla un frame después de conectar los eventos lo evita.
function MountWhenConnected({ children }: { children: ReactNode }) {
  const connected = useThree((s) => !!s.events.connected)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!connected) return
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [connected])
  return ready ? <>{children}</> : null
}

/** Cámara que baja desde una vista aérea de la sala hasta los ojos del visitante según `open` (0..1). */
function ScrollCamera({
  layout,
  room,
  open,
  endLook,
  walking,
}: {
  layout: PalaceLayout
  room: RoomLayout
  open: RefObject<number>
  /** Hacia dónde mira el visitante al final del vuelo. */
  endLook: [number, number, number]
  /** Mientras se camina, la cámara es del LobbyWalker. */
  walking: RefObject<boolean>
}) {
  const camera = useThree((s) => s.camera)
  const rig = useMemo(() => {
    const span = Math.max(room.w, room.d)
    const { x, z } = layout.spawn
    // De la entrada hacia el centro: la diagonal por la que se mira la sala.
    const dx = room.x - x
    const dz = room.z - z
    const len = Math.hypot(dx, dz) || 1
    return {
      fromPos: new Vector3(x - (dx / len) * span * 0.4, span * 1.5, z - (dz / len) * span * 0.4),
      fromLook: new Vector3(room.x, 0, room.z),
      toPos: new Vector3(x, EYE, z),
      toLook: new Vector3(...endLook),
      pos: new Vector3(),
      look: new Vector3(),
      t: -1,
      // 1 = sigue el recorrido del scroll; < 1 = volviendo a él desde donde quedó la caminata.
      blend: 1,
      fromWalkPos: new Vector3(),
      fromWalkLook: new Vector3(),
    }
  }, [layout, room, endLook])

  useFrame((_, dt) => {
    if (walking.current) {
      rig.blend = 0
      return
    }
    if (rig.blend === 0) {
      // Recién salió de caminar: se guarda la pose para volver suave al recorrido.
      rig.fromWalkPos.copy(camera.position)
      camera.getWorldDirection(rig.fromWalkLook).multiplyScalar(6).add(camera.position)
    }
    const target = open.current ?? 0
    // Amortiguado: el scroll del trackpad llega a saltos.
    rig.t = rig.t < 0 ? target : rig.t + (target - rig.t) * Math.min(1, dt * 8)
    const k = rig.t * rig.t * (3 - 2 * rig.t)
    rig.pos.lerpVectors(rig.fromPos, rig.toPos, k)
    rig.look.lerpVectors(rig.fromLook, rig.toLook, k)
    if (rig.blend < 1) {
      rig.blend = Math.min(1, rig.blend + dt * 1.6)
      const b = rig.blend * rig.blend * (3 - 2 * rig.blend)
      rig.pos.lerpVectors(rig.fromWalkPos, rig.pos, b)
      rig.look.lerpVectors(rig.fromWalkLook, rig.look, b)
    }
    camera.position.copy(rig.pos)
    camera.lookAt(rig.look)
  })
  return null
}

/** La sala de inicio del palacio vestida de lobby de museo, vista con la cámara del scroll. */
export function RoomPeek({
  layout,
  open,
  walkApi,
  mode,
  onModeChange,
  onNearPanelChange,
  onAimFounderChange,
  wallPanel,
  theme = DEFAULT_THEME,
}: {
  layout: PalaceLayout
  open: RefObject<number>
  /** La landing llama a `walkApi.current.lock()` desde un clic para empezar a caminar. */
  walkApi: { current: WalkApi }
  mode: LobbyMode
  onModeChange: (mode: LobbyMode) => void
  onNearPanelChange: (near: boolean) => void
  /** Retrato de Founders bajo la mira mientras se camina (null si ninguno). */
  onAimFounderChange: (founder: FounderTag | null) => void
  /** Los componentes de "Crea tu palacio" (los mismos elementos que abajo) para colgar en la pared. */
  wallPanel: ReactNode
  theme?: Theme
}) {
  const { scene } = theme
  const room = useMemo(() => startRoom(layout), [layout])
  // El vuelo termina mirando el muro de Founders, a la altura de los retratos.
  const endLook = useMemo<[number, number, number]>(() => [room.x, 2.4, room.z + room.d / 2], [room])
  const fillers = useMemo(() => doorFillers(room), [room])
  const panel = useMemo(() => eastPanel(room), [room])
  // Fuera del scroll (caminando o usando el panel) la cámara no es del ScrollCamera.
  const inLobby = useRef(false)
  const handleMode = useCallback(
    (next: LobbyMode) => {
      inLobby.current = next !== 'off'
      onModeChange(next)
    },
    [onModeChange],
  )
  return (
    // isolation: los z-index de drei Html quedan dentro del canvas y no tapan los overlays de la landing.
    <Canvas
      camera={{ fov: 70, near: 0.1, far: 300 }}
      dpr={[1, 2]}
      shadows={scene.shadows}
      flat
      gl={{ alpha: true }}
      style={{ isolation: 'isolate', cursor: mode === 'off' ? 'pointer' : undefined }}
      onPointerDown={() => {
        if (mode === 'off') {
          walkApi.current.lock()
        }
      }}
    >
      <color attach="background" args={[scene.background]} />
      <hemisphereLight args={[scene.ambient.sky, scene.ambient.ground, scene.ambient.intensity]} />
      <directionalLight
        color={scene.sun.color}
        intensity={scene.sun.intensity}
        position={[room.x + scene.sun.position[0], scene.sun.position[1], room.z + scene.sun.position[2]]}
        castShadow={scene.shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      >
        <object3D attach="target" position={[room.x, 0, room.z]} />
      </directionalLight>
      {/* Solo el cascarón de la sala: nada del palacio de ejemplo (pedestales, cuadros, títulos, monumento). */}
      <Room room={room} palette={LOBBY} theme={theme} plainWalls bareWall={FOUNDERS_WALL} shellOnly />
      <LogoSculpture x={room.x} z={room.z} color={LOBBY.ink} pedestalColor={LOBBY.trim} />
      <LobbyCarpet room={room} />
      {/* Retratos y diorama: desactivados en scroll para entrar al lobby en vez de abrir enlaces externos */}
      <Founders room={room} side={FOUNDERS_WALL} interactive={false} />
      {/* A la derecha de Founders (mirándolos): el muro oeste con el diorama interactivo de la guacamaya. */}
      <LobbyPoster room={room} interactive={false} />
      {/* El lobby no tiene pasillos: sus puertas se tapian con muro liso. */}
      {fillers.map((b, i) => (
        <Wall key={i} box={b} color={LOBBY.wall} plain />
      ))}
      {/* Panel real (DOM) en la pared; "blending" deja que el logo lo tape y que reciba clics. */}
      <mesh position={[panel.wallX - PANEL_FRAME_DEPTH / 2, PANEL_Y, panel.position[2]]} castShadow>
        <boxGeometry args={[PANEL_FRAME_DEPTH, PANEL_H + PANEL_FRAME * 2, PANEL_W + PANEL_FRAME * 2]} />
        <meshStandardMaterial color={PANEL_FRAME_COLOR} roughness={0.6} />
      </mesh>
      <MountWhenConnected>
        <Html
          transform
          occlude="blending"
          distanceFactor={PANEL_DF}
          position={panel.position}
          rotation={[0, -Math.PI / 2, 0]}
          pointerEvents={mode === 'using' ? 'auto' : 'none'}
        >
          <div className="lobby-wall" style={{ width: PANEL_PX.w, height: PANEL_PX.h }}>
            {wallPanel}
          </div>
        </Html>
      </MountWhenConnected>
      <ScrollCamera layout={layout} room={room} open={open} endLook={endLook} walking={inLobby} />
      <LobbyWalker
        layout={layout}
        room={room}
        panel={panel}
        api={walkApi}
        onModeChange={handleMode}
        onNearPanelChange={onNearPanelChange}
        onAimFounderChange={onAimFounderChange}
      />
    </Canvas>
  )
}
