import { Billboard, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useRef } from 'react'
import type { Mesh, Object3D } from 'three'
import type { Box, PedestalLayout, RoomLayout, Side } from '../palace/layout'
import { useStore } from '../store'
import type { RoomPalette, Theme } from '../theme'
import ProceduralModel from './ProceduralModel'
import { ShapeGeometry } from './Shapes'

export const FONT_BODY = '/fonts/HankenGrotesk.ttf'
export const FONT_DISPLAY = '/fonts/Gloock.ttf'

const CORNICE_H = 0.28
const PLINTH_H = 0.35

export function Wall({ box, color }: { box: Box; color: string }) {
  const y = box.y ?? 0
  return (
    <mesh position={[box.x, y + box.h / 2, box.z]} castShadow receiveShadow>
      <boxGeometry args={[box.w, box.h, box.d]} />
      <meshStandardMaterial color={color} flatShading roughness={1} />
    </mesh>
  )
}

// Cornisa (arriba) y zócalo (abajo): dos molduras del color de "trim" que enmarcan el muro.
function Moldings({ box, color, cornice, plinth }: { box: Box; color: string; cornice: boolean; plinth: boolean }) {
  const y = box.y ?? 0
  return (
    <>
      {cornice && (
        <mesh position={[box.x, y + box.h - CORNICE_H / 2, box.z]} castShadow receiveShadow>
          <boxGeometry args={[box.w + 0.16, CORNICE_H, box.d + 0.16]} />
          <meshStandardMaterial color={color} flatShading roughness={0.9} />
        </mesh>
      )}
      {plinth && !box.y && (
        <mesh position={[box.x, PLINTH_H / 2, box.z]} castShadow receiveShadow>
          <boxGeometry args={[box.w + 0.1, PLINTH_H, box.d + 0.1]} />
          <meshStandardMaterial color={color} flatShading roughness={0.9} />
        </mesh>
      )}
    </>
  )
}

// Yeso mate: el material de todo objeto, pedestal y monumento.
function Plaster({ theme, color }: { theme: Theme; color?: string }) {
  return <meshStandardMaterial color={color ?? theme.scene.object.color} roughness={theme.scene.object.roughness} flatShading />
}

function Monument({ room, theme }: { room: RoomLayout; theme: Theme }) {
  const ref = useRef<Mesh>(null)
  useFrame((_, dt) => {
    if (ref.current) {
      ref.current.rotation.y += dt * 0.25
      ref.current.rotation.x += dt * 0.1
    }
  })
  return (
    <group position={[room.x, 0, room.z]}>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.1, 1.3, 0.6, theme.scene.pedestal.segments]} />
        <meshStandardMaterial color={theme.scene.pedestal.color} roughness={theme.scene.object.roughness} flatShading />
      </mesh>
      <mesh ref={ref} position={[0, 2.2, 0]} castShadow receiveShadow>
        <ShapeGeometry shape={room.monument} size={1} />
        <Plaster theme={theme} />
      </mesh>
    </group>
  )
}

// El título de la sala va como inscripción en un muro sin puerta, mirando al interior.
function Inscription({ room, palette }: { room: RoomLayout; palette: RoomPalette }) {
  const side: Side = (['n', 's', 'w', 'e'] as Side[]).find((s) => !room.doors.includes(s)) ?? 'n'
  const inset = 0.2 + 0.03 // mitad del muro + holgura
  const pos: [number, number, number] =
    side === 'n'
      ? [room.x, 3.1, room.z - room.d / 2 + inset]
      : side === 's'
        ? [room.x, 3.1, room.z + room.d / 2 - inset]
        : side === 'e'
          ? [room.x + room.w / 2 - inset, 3.1, room.z]
          : [room.x - room.w / 2 + inset, 3.1, room.z]
  const rotY = side === 'n' ? 0 : side === 's' ? Math.PI : side === 'e' ? -Math.PI / 2 : Math.PI / 2
  return (
    <Suspense fallback={null}>
      <Text
        position={pos}
        rotation={[0, rotY, 0]}
        font={FONT_DISPLAY}
        fontSize={0.7}
        color={palette.ink}
        anchorY="middle"
        maxWidth={Math.min(room.w, room.d) * 0.8}
        textAlign="center"
        letterSpacing={0.04}
      >
        {room.title}
      </Text>
    </Suspense>
  )
}

// Modelos de la IA miden ~2 m; sobre el pedestal se escalan a ~0.9 m.
const MODEL_SCALE = 0.45
const PEDESTAL_TOP = 1.05

function Pedestal({ p, palette, theme }: { p: PedestalLayout; palette: RoomPalette; theme: Theme }) {
  const ref = useRef<Object3D>(null)
  const model = p.concept.model?.type === 'procedural' ? p.concept.model : null
  const memorized = useStore((s) => !!s.memorized[p.concept.id])
  const focused = useStore((s) => s.focusedId === p.concept.id)
  const mode = useStore((s) => s.mode)
  const result = useStore((s) => s.exam[p.concept.id])
  useFrame((_, dt) => {
    if (!ref.current) return
    // Gira lento; sin flotación para que la sombra quede firme sobre el pedestal.
    ref.current.rotation.y += dt * (focused ? 0.9 : 0.35)
  })

  const hidden = mode === 'exam' && !result
  const label = hidden ? '???' : p.concept.title
  const tokens = theme.ui.tokens
  const band = mode === 'exam' && result ? (result === 'ok' ? tokens.ok : tokens.danger) : memorized ? palette.trim : null
  const k = focused ? 1.1 : 1

  return (
    <group position={[p.x, 0, p.z]}>
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.38, 0.48, 1, theme.scene.pedestal.segments]} />
        <meshStandardMaterial color={theme.scene.pedestal.color} roughness={theme.scene.object.roughness} flatShading />
      </mesh>
      <mesh position={[0, 1.02, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.5, 0.5, 0.06, theme.scene.pedestal.segments]} />
        <meshStandardMaterial color={theme.scene.pedestal.color} roughness={theme.scene.object.roughness} flatShading />
      </mesh>
      {band && (
        <mesh position={[0, 0.8, 0]} castShadow>
          <cylinderGeometry args={[0.44, 0.45, 0.09, theme.scene.pedestal.segments]} />
          <meshStandardMaterial color={band} roughness={0.5} metalness={0.35} flatShading />
        </mesh>
      )}
      {model ? (
        <group position={[0, PEDESTAL_TOP + 0.05, 0]} scale={k}>
          <group ref={ref} scale={MODEL_SCALE}>
            <ProceduralModel parts={model.parts} />
          </group>
        </group>
      ) : (
        <mesh ref={ref} position={[0, 1.55, 0]} scale={k} castShadow receiveShadow>
          <ShapeGeometry shape={p.shape} size={0.3} />
          <Plaster theme={theme} color={focused ? '#FFFFFF' : undefined} />
        </mesh>
      )}
      <Suspense fallback={null}>
        <Billboard position={[0, model ? 2.25 : 2.1, 0]}>
          <Text
            font={FONT_BODY}
            fontSize={0.2}
            maxWidth={2.2}
            textAlign="center"
            anchorY="bottom"
            color={palette.ink}
            fillOpacity={focused ? 1 : 0.85}
          >
            {label}
          </Text>
        </Billboard>
      </Suspense>
    </group>
  )
}

export function Room({ room, palette, theme }: { room: RoomLayout; palette: RoomPalette; theme: Theme }) {
  const { cornice, plinth } = theme.scene.architecture
  return (
    <group>
      <mesh position={[room.x, -0.05, room.z]} receiveShadow>
        <boxGeometry args={[room.w, 0.1, room.d]} />
        <meshStandardMaterial color={palette.floor} flatShading roughness={1} />
      </mesh>
      {room.walls.map((w, i) => (
        <group key={i}>
          <Wall box={w} color={palette.wall} />
          <Moldings box={w} color={palette.trim} cornice={cornice} plinth={plinth} />
        </group>
      ))}
      <Inscription room={room} palette={palette} />
      <Monument room={room} theme={theme} />
      {room.pedestals.map((p) => (
        <Pedestal key={p.concept.id} p={p} palette={palette} theme={theme} />
      ))}
    </group>
  )
}
