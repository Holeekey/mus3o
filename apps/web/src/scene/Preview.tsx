import { OrthographicCamera } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { Group } from 'three'
import type { Box, PalaceLayout } from '../palace/layout'
import { DEFAULT_THEME, roomPalettes, type Theme } from '../theme'
import { ShapeGeometry } from './Shapes'

// Maqueta isométrica del palacio: paredes bajas para ver el plano completo.
const LOW = 1.2

function LowWall({ box, color, trim }: { box: Box; color: string; trim?: string }) {
  if (box.y) return null
  return (
    <group>
      <mesh position={[box.x, LOW / 2, box.z]} castShadow receiveShadow>
        <boxGeometry args={[box.w, LOW, box.d]} />
        <meshStandardMaterial color={color} flatShading roughness={1} />
      </mesh>
      {trim && (
        <mesh position={[box.x, LOW + 0.06, box.z]} castShadow>
          <boxGeometry args={[box.w + 0.12, 0.12, box.d + 0.12]} />
          <meshStandardMaterial color={trim} flatShading roughness={0.9} />
        </mesh>
      )}
    </group>
  )
}

function Model({ layout, theme }: { layout: PalaceLayout; theme: Theme }) {
  const ref = useRef<Group>(null)
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.12
  })
  const palettes = useMemo(() => roomPalettes(theme, layout.rooms.map((r) => r.title)), [theme, layout])
  const { minX, maxX, minZ, maxZ } = layout.bounds
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2
  const span = Math.max(maxX - minX, maxZ - minZ, 20)
  const scale = 22 / span
  const { scene } = theme

  return (
    <group ref={ref} scale={scale}>
      <group position={[-cx, 0, -cz]}>
        {layout.rooms.map((r, ri) => {
          const pal = palettes[ri]
          return (
            <group key={r.id}>
              <mesh position={[r.x, -0.1, r.z]} receiveShadow>
                <boxGeometry args={[r.w, 0.2, r.d]} />
                <meshStandardMaterial color={pal.floor} flatShading roughness={1} />
              </mesh>
              {r.walls.map((w, i) => (
                <LowWall key={i} box={w} color={pal.wall} trim={scene.architecture.cornice ? pal.trim : undefined} />
              ))}
              <mesh position={[r.x, 2, r.z]} castShadow receiveShadow>
                <ShapeGeometry shape={r.monument} size={1.1} />
                <meshStandardMaterial color={scene.object.color} roughness={scene.object.roughness} flatShading />
              </mesh>
              {r.pedestals.map((p) => (
                <mesh key={p.concept.id} position={[p.x, 0.6, p.z]} castShadow receiveShadow>
                  <cylinderGeometry args={[0.35, 0.45, 1.2, scene.pedestal.segments]} />
                  <meshStandardMaterial color={scene.pedestal.color} roughness={scene.object.roughness} flatShading />
                </mesh>
              ))}
            </group>
          )
        })}
        {layout.corridors.map((c, i) => (
          <group key={i}>
            <mesh position={[c.floor.x, -0.1, c.floor.z]} receiveShadow>
              <boxGeometry args={[c.floor.w, 0.2, c.floor.d]} />
              <meshStandardMaterial color={scene.corridor.floor} flatShading roughness={1} />
            </mesh>
            {c.walls.map((w, j) => (
              <LowWall key={j} box={w} color={scene.corridor.wall} />
            ))}
          </group>
        ))}
      </group>
    </group>
  )
}

// Fondo transparente: el marco de la landing decide el color de fondo.
export function Preview({ layout, theme = DEFAULT_THEME }: { layout: PalaceLayout | null; theme?: Theme }) {
  const { sun, ambient } = theme.scene
  return (
    <Canvas dpr={[1, 2]} shadows={theme.scene.shadows} flat gl={{ alpha: true }}>
      <OrthographicCamera makeDefault position={[20, 20, 20]} zoom={18} near={-100} far={200} onUpdate={(c) => c.lookAt(0, 0, 0)} />
      <hemisphereLight args={[ambient.sky, ambient.ground, ambient.intensity]} />
      <directionalLight
        color={sun.color}
        intensity={sun.intensity}
        position={sun.position}
        castShadow={theme.scene.shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={1}
        shadow-camera-far={60}
      />
      {layout && <Model layout={layout} theme={theme} />}
    </Canvas>
  )
}
