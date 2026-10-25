import { useTexture } from '@react-three/drei'
import { Suspense, useMemo } from 'react'
import { SRGBColorSpace, type Texture } from 'three'
import type { RoomLayout, Side } from '../palace/layout'
import { TEAM } from '../ui/team'
import { LabelPlate } from './LabelPlate'

const FONT = '/fonts/PublicSansVariable.ttf'
const WALL_T = 0.4 // mismo grosor que palace/layout
const OFFSET = 0.06 // separación del muro, como los cuadros

const PHOTO_W = 1.2
const PHOTO_H = 1.6 // retrato 3:4, igual que las fotos de public/team
const MAT = 0.1
const FRAME = 0.07
const DEPTH = 0.08
const GAP = 0.7
const CENTER_Y = 2.5

const FRAME_COLOR = '#2B211C'
const MAT_COLOR = '#F4F1EA'
const BRASS = '#C9963A'
const INK = '#2B211C'

// Posición y giro de un punto en la cara interior de un muro, mirando al centro de la sala.
function wallAnchor(room: RoomLayout, side: Side): { position: [number, number, number]; rotY: number } {
  const inset = WALL_T / 2 + OFFSET
  switch (side) {
    case 'n': return { position: [room.x, 0, room.z - room.d / 2 + inset], rotY: 0 }
    case 's': return { position: [room.x, 0, room.z + room.d / 2 - inset], rotY: Math.PI }
    case 'e': return { position: [room.x + room.w / 2 - inset, 0, room.z], rotY: -Math.PI / 2 }
    default: return { position: [room.x - room.w / 2 + inset, 0, room.z], rotY: Math.PI / 2 }
  }
}

// Recorte "cover" a 3:4; `focus` (0-100, como en la página del equipo) elige la altura del recorte.
function coverCrop(texture: Texture, focus = 40) {
  const img = texture.image as { width: number; height: number }
  const aspect = img.width / img.height
  const target = PHOTO_W / PHOTO_H
  texture.colorSpace = SRGBColorSpace
  if (aspect > target) {
    texture.repeat.set(target / aspect, 1)
    texture.offset.set((1 - texture.repeat.x) / 2, 0)
  } else {
    texture.repeat.set(1, aspect / target)
    // La UV y crece hacia arriba: focus 0 muestra el borde superior de la foto.
    texture.offset.set(0, (1 - texture.repeat.y) * (1 - focus / 100))
  }
  texture.needsUpdate = true
}

function Portrait({ texture, name, x }: { texture: Texture; name: string; x: number }) {
  const outerW = PHOTO_W + MAT * 2 + FRAME * 2
  const outerH = PHOTO_H + MAT * 2 + FRAME * 2
  return (
    <group position={[x, CENTER_Y, 0]}>
      <mesh position={[0, 0, DEPTH / 2]} castShadow>
        <boxGeometry args={[outerW, outerH, DEPTH]} />
        <meshStandardMaterial color={FRAME_COLOR} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, DEPTH + 0.002]}>
        <planeGeometry args={[PHOTO_W + MAT * 2, PHOTO_H + MAT * 2]} />
        <meshStandardMaterial color={MAT_COLOR} roughness={1} />
      </mesh>
      <mesh position={[0, 0, DEPTH + 0.004]}>
        <planeGeometry args={[PHOTO_W, PHOTO_H]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      {/* Placa con el nombre, centrada bajo el marco. */}
      <group position={[0, -outerH / 2 - 0.28, 0.02]}>
        <LabelPlate font={FONT} fontSize={0.13} maxWidth={outerW} surface={BRASS} ink={INK}>
          {name}
        </LabelPlate>
      </group>
    </group>
  )
}

function FoundersWall({ room, side }: { room: RoomLayout; side: Side }) {
  const textures = useTexture(TEAM.map((m) => `/team/${m.photo}.jpg`))
  useMemo(() => textures.forEach((t, i) => coverCrop(t, TEAM[i].focus)), [textures])
  const { position, rotY } = wallAnchor(room, side)
  const step = PHOTO_W + MAT * 2 + FRAME * 2 + GAP
  const first = -((TEAM.length - 1) * step) / 2
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {/* Título de la obra sobre los cinco retratos. */}
      <group position={[0, CENTER_Y + PHOTO_H / 2 + MAT + FRAME + 0.6, 0.02]}>
        <LabelPlate font={FONT} fontSize={0.42} surface={MAT_COLOR} ink={INK}>
          Founders
        </LabelPlate>
      </group>
      {TEAM.map((m, i) => (
        <Portrait key={m.photo} texture={textures[i]} name={m.name} x={first + i * step} />
      ))}
    </group>
  )
}

/** Muro de los fundadores: cinco retratos enmarcados con su nombre, bajo el título "Founders". */
export function Founders({ room, side }: { room: RoomLayout; side: Side }) {
  return (
    <Suspense fallback={null}>
      <FoundersWall room={room} side={side} />
    </Suspense>
  )
}
