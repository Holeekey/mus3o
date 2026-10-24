import { Canvas } from '@react-three/fiber'
import { useMemo } from 'react'
import type { PalaceLayout } from '../palace/layout'
import { DEFAULT_THEME, roomPalettes, type Theme } from '../theme'
import { Player } from './Player'
import { Room, Wall } from './Room'

// Un sol de mediodía cuya cámara de sombra cubre todo el palacio.
function Sun({ layout, theme }: { layout: PalaceLayout; theme: Theme }) {
  const { sun, shadows } = theme.scene
  const { minX, maxX, minZ, maxZ } = layout.bounds
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2
  const half = Math.hypot(maxX - minX, maxZ - minZ) / 2 + 4
  const [sx, sy, sz] = sun.position
  const len = Math.hypot(sx, sy, sz)
  const dist = half * 2 + 20
  return (
    <>
      <directionalLight
        color={sun.color}
        intensity={sun.intensity}
        position={[cx + (sx / len) * dist, (sy / len) * dist, cz + (sz / len) * dist]}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-left={-half}
        shadow-camera-right={half}
        shadow-camera-top={half}
        shadow-camera-bottom={-half}
        shadow-camera-near={1}
        shadow-camera-far={dist * 2 + 20}
      >
        <object3D attach="target" position={[cx, 0, cz]} />
      </directionalLight>
    </>
  )
}

export function World({ layout, theme = DEFAULT_THEME }: { layout: PalaceLayout; theme?: Theme }) {
  const { scene } = theme
  const palettes = useMemo(
    () => roomPalettes(theme, layout.rooms.map((r) => r.title)),
    [theme, layout],
  )
  return (
    <Canvas camera={{ fov: 70, near: 0.1, far: 300 }} dpr={[1, 2]} shadows={scene.shadows} flat>
      <color attach="background" args={[scene.background]} />
      <fog attach="fog" args={[scene.fog.color, scene.fog.near, scene.fog.far]} />
      <hemisphereLight args={[scene.ambient.sky, scene.ambient.ground, scene.ambient.intensity]} />
      <Sun layout={layout} theme={theme} />
      {layout.rooms.map((r, i) => (
        <Room key={r.id} room={r} palette={palettes[i]} theme={theme} />
      ))}
      {layout.corridors.map((c, i) => (
        <group key={i}>
          <mesh position={[c.floor.x, -0.05, c.floor.z]} receiveShadow>
            <boxGeometry args={[c.floor.w, 0.1, c.floor.d]} />
            <meshStandardMaterial color={scene.corridor.floor} flatShading roughness={1} />
          </mesh>
          {c.walls.map((w, j) => (
            <Wall key={j} box={w} color={scene.corridor.wall} />
          ))}
        </group>
      ))}
      <Player layout={layout} />
    </Canvas>
  )
}
