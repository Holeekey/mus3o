import { useLayoutEffect, useMemo, useRef } from 'react'
import type * as THREE from 'three'
import type { RoomLayout } from '../palace/layout'
import type { RoomPalette, Theme } from '../theme'

// Versión ligera de la sala (suelo, muros de color, pedestales y monumento) para verla por el
// marco de regreso. Omite el muro donde cuelga el cuadro, que sería la "pared" de la ventana.
export function RoomEcho({ room, palette, theme, wall, rotationY }: { room: RoomLayout; palette: RoomPalette; theme: Theme; wall: [number, number]; rotationY: number }) {
  const { scene } = theme
  const sun = useRef<THREE.DirectionalLight>(null)
  // El objetivo de la luz debe estar en el grafo para que su matriz se actualice.
  useLayoutEffect(() => {
    const l = sun.current
    const parent = l?.parent
    if (!l || !parent) return
    l.target.position.set(room.x, 0, room.z)
    parent.add(l.target)
    return () => {
      parent.remove(l.target)
    }
  }, [room.x, room.z])
  // El cuadro mira a (sin ry, cos ry); la ventana mira hacia -z local, así que se gira π - ry.
  const theta = Math.PI - rotationY
  const pos = useMemo(() => {
    const c = Math.cos(theta)
    const s = Math.sin(theta)
    // R·P con la rotación de Euler Y de three.
    const rx = wall[0] * c + wall[1] * s
    const rz = -wall[0] * s + wall[1] * c
    return [-rx, -1.7, -rz] as [number, number, number]
  }, [theta, wall])
  const walls = room.walls.filter((w) => {
    const hx = w.w / 2 + 0.6
    const hz = w.d / 2 + 0.6
    return !(Math.abs(wall[0] - w.x) < hx && Math.abs(wall[1] - w.z) < hz && !w.y)
  })
  const span = Math.max(room.w, room.d) / 2 + 2
  return (
    <>
      <color attach="background" args={[scene.background]} />
      <fog attach="fog" args={[scene.fog.color, scene.fog.near, scene.fog.far]} />
      <hemisphereLight args={[scene.ambient.sky, scene.ambient.ground, scene.ambient.intensity * 1.6]} />
      <group rotation={[0, theta, 0]} position={pos}>
        <directionalLight
          ref={sun}
          color={scene.sun.color}
          intensity={scene.sun.intensity}
          position={[room.x + scene.sun.position[0] * 2, scene.sun.position[1] * 2, room.z + scene.sun.position[2] * 2]}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0006}
          shadow-normalBias={0.04}
          shadow-camera-left={-span}
          shadow-camera-right={span}
          shadow-camera-top={span}
          shadow-camera-bottom={-span}
          shadow-camera-near={1}
          shadow-camera-far={80}
        />
        <mesh position={[room.x, -0.05, room.z]} receiveShadow>
          <boxGeometry args={[room.w, 0.1, room.d]} />
          <meshStandardMaterial color={palette.floor} flatShading roughness={1} />
        </mesh>
        {walls.map((w, i) => (
          <mesh key={i} position={[w.x, (w.y ?? 0) + w.h / 2, w.z]} castShadow receiveShadow>
            <boxGeometry args={[w.w, w.h, w.d]} />
            <meshStandardMaterial color={palette.wall} flatShading roughness={1} />
          </mesh>
        ))}
        <group position={[room.x, 0, room.z]}>
          <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[1.1, 1.3, 0.6, 8]} />
            <meshStandardMaterial color={scene.pedestal.color} flatShading roughness={0.95} />
          </mesh>
          <mesh position={[0, 2.0, 0]} castShadow receiveShadow>
            <icosahedronGeometry args={[0.8, 0]} />
            <meshStandardMaterial color={scene.object.color} flatShading roughness={0.95} />
          </mesh>
        </group>
        {room.pedestals.map((p) => (
          <group key={p.concept.id} position={[p.x, 0, p.z]}>
            <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.38, 0.48, 1, 8]} />
              <meshStandardMaterial color={scene.pedestal.color} flatShading roughness={0.95} />
            </mesh>
            <mesh position={[0, 1.4, 0]} castShadow receiveShadow>
              <icosahedronGeometry args={[0.3, 0]} />
              <meshStandardMaterial color={scene.object.color} flatShading roughness={0.95} />
            </mesh>
          </group>
        ))}
      </group>
    </>
  )
}
