import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Mesh } from 'three'
import type { MonumentType } from '@mus3o/shared'
import type { Monument as LegacyMonument, RoomLayout } from '../palace/layout'
import type { Theme } from '../theme'
import { ShapeGeometry } from './Shapes'

export function ProceduralMonument({
  room,
  theme,
}: {
  room: RoomLayout
  theme: Theme
}) {
  const primaryRef = useRef<Mesh>(null)
  const secondaryRef = useRef<Mesh>(null)

  useFrame((_, dt) => {
    if (primaryRef.current) {
      primaryRef.current.rotation.y += dt * 0.25
      primaryRef.current.rotation.x += dt * 0.12
    }
    if (secondaryRef.current) {
      secondaryRef.current.rotation.y -= dt * 0.35
      secondaryRef.current.rotation.z += dt * 0.18
    }
  })

  const monumentType = room.monument as MonumentType | LegacyMonument
  const primaryColor = room.palette?.primary ?? theme.scene.object.color
  const pedestalColor = theme.scene.pedestal.color

  if (monumentType === 'ring_system') {
    return (
      <group position={[room.x, 0, room.z]}>
        <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.1, 1.3, 0.6, theme.scene.pedestal.segments]} />
          <meshStandardMaterial color={pedestalColor} roughness={theme.scene.object.roughness} flatShading />
        </mesh>
        <group position={[0, 2.2, 0]}>
          <mesh ref={primaryRef} castShadow receiveShadow>
            <torusGeometry args={[1.1, 0.1, 6, 24]} />
            <meshStandardMaterial color={primaryColor} roughness={0.3} metalness={0.6} flatShading />
          </mesh>
          <mesh ref={secondaryRef} rotation={[Math.PI / 3, 0, 0]} castShadow receiveShadow>
            <torusGeometry args={[0.7, 0.08, 6, 20]} />
            <meshStandardMaterial color={pedestalColor} roughness={0.2} metalness={0.8} flatShading />
          </mesh>
          <mesh position={[0, 0, 0]} castShadow receiveShadow>
            <sphereGeometry args={[0.35, 8, 8]} />
            <meshStandardMaterial color={primaryColor} roughness={0.4} flatShading />
          </mesh>
        </group>
      </group>
    )
  }

  if (monumentType === 'crystal') {
    return (
      <group position={[room.x, 0, room.z]}>
        <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.1, 1.3, 0.6, theme.scene.pedestal.segments]} />
          <meshStandardMaterial color={pedestalColor} roughness={theme.scene.object.roughness} flatShading />
        </mesh>
        <mesh ref={primaryRef} position={[0, 2.2, 0]} scale={[0.8, 1.5, 0.8]} castShadow receiveShadow>
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={primaryColor} roughness={0.2} metalness={0.5} flatShading />
        </mesh>
      </group>
    )
  }

  const legacyShape =
    monumentType === 'dodecahedron'
      ? 'dodecahedron'
      : monumentType === 'torus'
      ? 'torus'
      : (monumentType as LegacyMonument)

  return (
    <group position={[room.x, 0, room.z]}>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.1, 1.3, 0.6, theme.scene.pedestal.segments]} />
        <meshStandardMaterial color={pedestalColor} roughness={theme.scene.object.roughness} flatShading />
      </mesh>
      <mesh ref={primaryRef} position={[0, 2.2, 0]} castShadow receiveShadow>
        <ShapeGeometry shape={legacyShape} size={1} />
        <meshStandardMaterial color={primaryColor} roughness={theme.scene.object.roughness} flatShading />
      </mesh>
    </group>
  )
}
