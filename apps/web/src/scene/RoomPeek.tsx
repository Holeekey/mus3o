import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useMemo, type RefObject } from 'react'
import { Vector3 } from 'three'
import type { PalaceLayout, RoomLayout } from '../palace/layout'
import { DEFAULT_THEME, roomPalettes, type Theme } from '../theme'
import { Room } from './Room'

const EYE = 1.7

// Sala donde aparece el jugador: la vista final es la misma que al entrar al palacio.
function startRoom(layout: PalaceLayout): RoomLayout {
  const { x, z } = layout.spawn
  return (
    layout.rooms.find((r) => Math.abs(x - r.x) <= r.w / 2 && Math.abs(z - r.z) <= r.d / 2) ?? layout.rooms[0]
  )
}

/** Cámara que baja desde una vista aérea de la sala hasta los ojos del visitante según `open` (0..1). */
function ScrollCamera({ layout, room, open }: { layout: PalaceLayout; room: RoomLayout; open: RefObject<number> }) {
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
      toLook: new Vector3(room.x, EYE - 0.2, room.z),
      pos: new Vector3(),
      look: new Vector3(),
      t: -1,
    }
  }, [layout, room])

  useFrame((_, dt) => {
    const target = open.current ?? 0
    // Amortiguado: el scroll del trackpad llega a saltos.
    rig.t = rig.t < 0 ? target : rig.t + (target - rig.t) * Math.min(1, dt * 8)
    const k = rig.t * rig.t * (3 - 2 * rig.t)
    rig.pos.lerpVectors(rig.fromPos, rig.toPos, k)
    rig.look.lerpVectors(rig.fromLook, rig.toLook, k)
    camera.position.copy(rig.pos)
    camera.lookAt(rig.look)
  })
  return null
}

/** La sala de inicio del palacio con sus assets reales, vista con la cámara del scroll. */
export function RoomPeek({ layout, open, theme = DEFAULT_THEME }: { layout: PalaceLayout; open: RefObject<number>; theme?: Theme }) {
  const { scene } = theme
  const room = useMemo(() => startRoom(layout), [layout])
  const palette = useMemo(() => roomPalettes(theme, layout.rooms.map((r) => r.title))[layout.rooms.indexOf(room)], [theme, layout, room])
  return (
    <Canvas camera={{ fov: 70, near: 0.1, far: 300 }} dpr={[1, 2]} shadows={scene.shadows} flat>
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
      <Room room={room} palette={palette} theme={theme} />
      <ScrollCamera layout={layout} room={room} open={open} />
    </Canvas>
  )
}
