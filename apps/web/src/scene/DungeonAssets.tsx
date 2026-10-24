import { Clone, useGLTF } from '@react-three/drei'
import { Suspense } from 'react'
import type { Box } from '../palace/layout'

const WALL_MODEL = '/models/dungeon/wall.gltf'
const FLOOR_MODEL = '/models/dungeon/floor_tile_large.gltf'
const DOORWAY_MODEL = '/models/dungeon/wall_doorway.gltf'
const GATED_MODEL = '/models/dungeon/wall_gated.gltf'

function AssetWallInner({ box }: { box: Box }) {
  const { scene } = useGLTF(WALL_MODEL)
  const y = box.y ?? 0

  // Si la dimensión en Z es mayor que en X, el muro corre Norte-Sur y se rota 90°.
  const isVertical = box.d > box.w
  const length = isVertical ? box.d : box.w
  const thickness = isVertical ? box.w : box.d

  return (
    <group
      position={[box.x, y, box.z]}
      rotation={[0, isVertical ? Math.PI / 2 : 0, 0]}
    >
      <Clone
        object={scene}
        scale={[length / 4, box.h / 4, Math.max(thickness / 1, 0.4)]}
        castShadow
        receiveShadow
      />
    </group>
  )
}

function FallbackWall({ box, color }: { box: Box; color?: string }) {
  const y = box.y ?? 0
  return (
    <mesh position={[box.x, y + box.h / 2, box.z]} castShadow receiveShadow>
      <boxGeometry args={[box.w, box.h, box.d]} />
      <meshStandardMaterial color={color ?? '#4a5568'} flatShading roughness={1} />
    </mesh>
  )
}

export function AssetWall({ box, color }: { box: Box; color?: string }) {
  return (
    <Suspense fallback={<FallbackWall box={box} color={color} />}>
      <AssetWallInner box={box} />
    </Suspense>
  )
}

function AssetFloorInner({ box }: { box: Box }) {
  const { scene } = useGLTF(FLOOR_MODEL)
  return (
    <group position={[box.x, -0.05, box.z]}>
      <Clone
        object={scene}
        scale={[box.w / 4, 1, box.d / 4]}
        receiveShadow
      />
    </group>
  )
}

export function AssetFloor({ box, color }: { box: Box; color?: string }) {
  return (
    <Suspense
      fallback={
        <mesh position={[box.x, -0.05, box.z]} receiveShadow>
          <boxGeometry args={[box.w, 0.1, box.d]} />
          <meshStandardMaterial color={color ?? '#2d3748'} flatShading roughness={1} />
        </mesh>
      }
    >
      <AssetFloorInner box={box} />
    </Suspense>
  )
}

function AssetDoorwayInner({
  position,
  rotation,
  isGated = false,
}: {
  position: [number, number, number]
  rotation: [number, number, number]
  isGated?: boolean
}) {
  const { scene } = useGLTF(isGated ? GATED_MODEL : DOORWAY_MODEL)
  return (
    <group position={position} rotation={rotation}>
      <Clone
        object={scene}
        scale={[2.8 / 4, 3.6 / 4, 0.8]}
        castShadow
        receiveShadow
      />
    </group>
  )
}

export function AssetDoorway({
  position,
  rotation,
  isGated = false,
}: {
  position: [number, number, number]
  rotation: [number, number, number]
  isGated?: boolean
}) {
  return (
    <Suspense fallback={null}>
      <AssetDoorwayInner position={position} rotation={rotation} isGated={isGated} />
    </Suspense>
  )
}

// Precarga de modelos
try {
  useGLTF.preload(WALL_MODEL)
  useGLTF.preload(FLOOR_MODEL)
  useGLTF.preload(DOORWAY_MODEL)
  useGLTF.preload(GATED_MODEL)
} catch {
  // Ignora si corre en entorno sin DOM / SSR
}
