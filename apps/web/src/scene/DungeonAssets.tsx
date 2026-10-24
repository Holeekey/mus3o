import { Clone, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
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
  isOpen = false,
}: {
  position: [number, number, number]
  rotation: [number, number, number]
  isOpen?: boolean
}) {
  const { scene } = useGLTF(DOORWAY_MODEL)
  // Clonamos el modelo de manera independiente para cada instancia de puerta
  const cloned = useMemo(() => scene.clone(true), [scene])
  const doorRef = useRef<THREE.Object3D | null>(null)

  useEffect(() => {
    const door = cloned.getObjectByName('wall_doorway_door')
    if (door) {
      doorRef.current = door
      door.rotation.y = isOpen ? -Math.PI * 0.48 : 0
    }
  }, [cloned, isOpen])

  // Animación física suave al abrir o cerrar
  useFrame((_, dt) => {
    if (doorRef.current) {
      const target = isOpen ? -Math.PI * 0.48 : 0
      doorRef.current.rotation.y = THREE.MathUtils.damp(
        doorRef.current.rotation.y,
        target,
        7,
        dt,
      )
    }
  })

  return (
    <group position={position} rotation={rotation}>
      <primitive
        object={cloned}
        scale={[2.8 / 4, 3.6 / 4, 0.8]}
        castShadow
        receiveShadow
      />
      {/* Antorcha / Luz cálida que ilumina el arco de la puerta */}
      <pointLight color="#ffb347" intensity={6} distance={6} position={[0, 2.2, 0]} />
    </group>
  )
}

export function AssetDoorway({
  position,
  rotation,
  isOpen = false,
}: {
  position: [number, number, number]
  rotation: [number, number, number]
  isOpen?: boolean
  isGated?: boolean
}) {
  return (
    <Suspense fallback={null}>
      <AssetDoorwayInner position={position} rotation={rotation} isOpen={isOpen} />
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
  // Ignora si corre en entorno sin DOM
}
