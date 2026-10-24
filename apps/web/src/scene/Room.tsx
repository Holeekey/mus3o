import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useRef } from 'react'
import type { Mesh, Object3D } from 'three'
import { assignPaintings, type Box, type PedestalLayout, RoomLayout, Side } from '../palace/layout'
import { useConceptLevel } from '../memory/hooks'
import { spinOf } from '../memory/shown'
import { inExamScope, useStore } from '../store'
import { DynamicTotem } from './DynamicTotem'
import { DecayWrap, FadingFloor, WallFlakes } from './Decay'
import { LabelPlate } from './LabelPlate'
import { Painting } from './Painting'
import type { RoomPalette, Theme } from '../theme'
import { AssetWall } from './DungeonAssets'
import { Centerpiece } from './Centerpiece'
import { RoomDecor } from './RoomDecor'
import ProceduralModel from './ProceduralModel'
import { ShapeGeometry } from './Shapes'
import { StaticMerge } from './StaticMerge'
import { useIntro } from '../intro/store'
import { Reveal } from '../intro/Reveal' // INTRO: aparición al entrar al palacio
import { floorKey, monumentKey, objectKey, paintingsKey, pedestalKey, wallsKey } from '../intro/timeline'

export const FONT_BODY = '/fonts/HankenGrotesk.ttf'
export const FONT_DISPLAY = '/fonts/Gloock.ttf'

const CORNICE_H = 0.28
const PLINTH_H = 0.35

export function Wall({ box, color }: { box: Box; color: string }) {
  return <AssetWall box={box} color={color} />
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

// El título de la sala va como inscripción en un muro sin puerta, mirando al interior.
function Inscription({ room, palette }: { room: RoomLayout; palette: RoomPalette }) {
  const isIntroPlaying = useIntro((s) => s.phase === 'playing')
  if (isIntroPlaying) return null

  const side: Side = (['n', 's', 'w', 'e'] as Side[]).find((s) => !room.doors.includes(s)) ?? 'n'
  const inset = 0.2 + 0.03 // mitad del muro + holgura
  const pos: [number, number, number] =
    side === 'n'
      ? [room.x, 3.85, room.z - room.d / 2 + inset]
      : side === 's'
        ? [room.x, 3.85, room.z + room.d / 2 - inset]
        : side === 'e'
          ? [room.x + room.w / 2 - inset, 3.85, room.z]
          : [room.x - room.w / 2 + inset, 3.85, room.z]
  const rotY = side === 'n' ? 0 : side === 's' ? Math.PI : side === 'e' ? -Math.PI / 2 : Math.PI / 2
  return (
    <Suspense fallback={null}>
      {/* Placa pintada con el pigmento de la sala: se lee sobre piedra oscura o fresco. */}
      <group position={pos} rotation={[0, rotY, 0]}>
        <LabelPlate
          font={FONT_DISPLAY}
          fontSize={0.42}
          maxWidth={Math.min(room.w, room.d) * 0.6}
          surface={palette.wall}
          ink={palette.ink}
        >
          {room.title}
        </LabelPlate>
      </group>
    </Suspense>
  )
}

// Modelos de la IA miden ~2 m; sobre el pedestal se escalan a ~0.9 m.
const MODEL_SCALE = 0.45
const PEDESTAL_TOP = 1.05
const LABEL_CULL = 14 // m: más lejos la etiqueta del pedestal no se lee ni se ve (muros de por medio)
// El modelo externo ya viene normalizado a ~0,7 m; se agranda un poco para leerse sobre el pedestal.
const DYNAMIC_SCALE = 1.3
// La etiqueta se apaga a medida que el recuerdo se debilita.
const LABEL_OPACITY = { new: 0.85, intact: 0.85, cracked: 0.65, broken: 0.5, forgotten: 0.4 } as const

function Pedestal({ p, palette, theme }: { p: PedestalLayout; palette: RoomPalette; theme: Theme }) {
  const isIntroPlaying = useIntro((s) => s.phase === 'playing')
  const ref = useRef<Object3D>(null)
  const model = p.concept.model?.type === 'procedural' ? p.concept.model : null
  const memorized = useStore((s) => !!s.memorized[p.concept.id])
  const focused = useStore((s) => s.focusedId === p.concept.id)
  const asked = useStore((s) => inExamScope(s, p.concept.id))
  const result = useStore((s) => s.exam[p.concept.id])
  const level = useConceptLevel(p.concept.id)
  useFrame((_, dt) => {
    if (!ref.current) return
    // Gira lento; sin flotación para que la sombra quede firme sobre el pedestal.
    ref.current.rotation.y += dt * (focused ? 0.9 : 0.35)
    spinOf.set(p.concept.id, ref.current.rotation.y)
  })

  const k = focused ? 1.1 : 1
  const dynamic = p.concept.dynamicAsset
  const fallback = model ? (
    <group position={[0, PEDESTAL_TOP + 0.05, 0]} scale={k}>
      <group scale={MODEL_SCALE}>
        <ProceduralModel parts={model.parts} />
      </group>
    </group>
  ) : (
    <mesh position={[0, 1.55, 0]} scale={k} castShadow receiveShadow>
      <ShapeGeometry shape={p.shape} size={0.3} />
      <Plaster theme={theme} color={focused ? '#FFFFFF' : undefined} />
    </mesh>
  )

  const hidden = asked && !result
  const label = hidden ? '???' : p.concept.title
  const tokens = theme.ui.tokens
  const band = asked && result ? (result === 'ok' ? tokens.ok : tokens.danger) : memorized ? palette.trim : null

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
      <Reveal id={objectKey(p.concept.id)} mode="drop">
      <DecayWrap id={p.concept.id}>
      <group ref={ref}>
        {dynamic ? (
          <group position={[0, PEDESTAL_TOP + 0.05, 0]} scale={k * DYNAMIC_SCALE}>
            <DynamicTotem url={dynamic.url} fallback={fallback} />
          </group>
        ) : (
          fallback
        )}
      </group>
      </DecayWrap>
      </Reveal>
      {!isIntroPlaying && (
        <Reveal id={objectKey(p.concept.id)} mode="pop" origin={[0, 2.2, 0]}>
        <Suspense fallback={null}>
          <Billboard position={[0, model || dynamic ? 2.3 : 2.15, 0]}>
            <LabelPlate
              font={FONT_BODY}
              fontSize={0.17}
              maxWidth={2}
              cullDistance={LABEL_CULL}
              surface={theme.ui.tokens.surface}
              ink={theme.ui.tokens.ink}
              opacity={focused ? 1 : Math.max(LABEL_OPACITY[level], 0.75)}
            >
              {label}
            </LabelPlate>
            {!hidden && (level === 'new' || level === 'forgotten') && (
              <group position={[0, -0.27, 0]}>
                <LabelPlate
                  font={FONT_BODY}
                  fontSize={0.1}
                  cullDistance={LABEL_CULL}
                  surface={level === 'forgotten' ? theme.ui.tokens.danger : theme.ui.tokens.accent}
                  ink={level === 'forgotten' ? theme.ui.tokens['bg-ink'] : theme.ui.tokens.ink}
                >
                  {level === 'new' ? 'nuevo' : 'olvidado'}
                </LabelPlate>
              </group>
            )}
          </Billboard>
        </Suspense>
        </Reveal>
      )}
    </group>
  )
}

export function Room({ room, palette, theme }: { room: RoomLayout; palette: RoomPalette; theme: Theme }) {
  const { cornice, plinth } = theme.scene.architecture
  const userImages = useStore((s) => s.userImages)
  const paintings = useMemo(() => assignPaintings(room, userImages), [room, userImages])
  return (
    <group>
      <Reveal id={floorKey(room.id)} mode="pop" origin={[room.x, 0, room.z]}>
        <FadingFloor room={room} palette={palette} />
      </Reveal>
      <Reveal id={wallsKey(room.id)} mode="rise">
        <WallFlakes room={room} />
        <RoomDecor room={room} palette={palette} theme={theme} />
        {/* Muros y molduras: estáticos, se unen en pocas mallas por sala (ver StaticMerge). */}
        <StaticMerge>
          {room.walls.map((w, i) => (
            <group key={i}>
              <Wall box={w} color={palette.wall} />
              <Moldings box={w} color={palette.trim} cornice={cornice} plinth={plinth} />
            </group>
          ))}
        </StaticMerge>
        <Inscription room={room} palette={palette} />
      </Reveal>
      {paintings.map((a) => (
        <Reveal key={a.key} id={paintingsKey(room.id)} mode="pop" origin={[a.slot.x, a.slot.y, a.slot.z]}>
          <Painting
            slot={a.slot}
            search={a.search}
            userImage={a.userImage}
            palette={palette}
            theme={theme}
            diorama={a.diorama}
            roomId={a.roomId}
            title={room.title}
          />
        </Reveal>
      ))}
      <Reveal id={monumentKey(room.id)} mode="sink">
        <Centerpiece room={room} theme={theme} />
      </Reveal>
      {/* Las bases de los pedestales son estáticas (el objeto que gira va en DecayWrap, que no se une). */}
      <StaticMerge>
        {room.pedestals.map((p) => (
          <Reveal key={p.concept.id} id={pedestalKey(p.concept.id)} mode="sink">
            <Pedestal p={p} palette={palette} theme={theme} />
          </Reveal>
        ))}
      </StaticMerge>
    </group>
  )
}
