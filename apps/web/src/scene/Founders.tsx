import { useTexture } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Raycaster, SRGBColorSpace, type Texture } from 'three'
import type { RoomLayout, Side } from '../palace/layout'
import { TEAM, type TeamMember } from '../ui/team'
import { aimedFounder, openProfile, type FounderTag } from './founderAim'
import { LabelPlate } from './LabelPlate'

const FONT = '/fonts/PublicSansVariable.ttf'
const WALL_T = 0.4 // mismo grosor que palace/layout
const OFFSET = 0.06 // separación del muro, como los cuadros

const PHOTO_W = 1.2
const PHOTO_H = 1.6 // retrato 3:4, igual que las fotos de public/team
const MAT = 0.1
const FRAME = 0.07
const DEPTH = 0.08
const GAP = 0.4 // juntos para que los extremos no queden tras las columnas de las esquinas
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

type PortraitEvents = {
  onClick?: (e: ThreeEvent<MouseEvent>) => void
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void
}

function Portrait({ texture, member, x, events }: { texture: Texture; member: TeamMember; x: number; events: PortraitEvents }) {
  const outerW = PHOTO_W + MAT * 2 + FRAME * 2
  const outerH = PHOTO_H + MAT * 2 + FRAME * 2
  const name = member.name
  // La etiqueta permite al LobbyWalker saber a quién apunta la mira (raycast desde la cámara).
  const founder = useMemo<FounderTag>(() => ({ name, profile: member.profile }), [name, member.profile])
  return (
    <group position={[x, CENTER_Y, 0]} userData={{ founder }} {...events}>
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

/**
 * Con el puntero normal (modo scroll) los retratos se pueden clicar. Los eventos de R3F solo ven objetos con
 * handlers, así que se vuelve a lanzar el rayo contra toda la escena: un muro o el logo delante lo tapan.
 */
function usePortraitPointer(interactive: boolean) {
  const scene = useThree((s) => s.scene)
  const canvas = useThree((s) => s.gl.domElement)
  const raycaster = useMemo(() => new Raycaster(), [])
  const hovering = useRef(false)

  const setHover = (on: boolean) => {
    if (hovering.current === on) return
    hovering.current = on
    canvas.style.cursor = on ? 'pointer' : ''
  }
  // Al empezar a caminar (o al desmontar) el cursor vuelve a la normalidad.
  useEffect(() => {
    if (!interactive) setHover(false)
  }, [interactive])
  useEffect(() => () => setHover(false), [])

  const visibleFounder = (e: ThreeEvent<MouseEvent | PointerEvent>) => {
    raycaster.ray.copy(e.ray)
    return aimedFounder(raycaster.intersectObjects(scene.children, true), Infinity)
  }

  if (!interactive) return {}
  return {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      const founder = visibleFounder(e)
      if (founder) openProfile(founder.profile)
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      setHover(!!visibleFounder(e))
    },
    onPointerOut: () => setHover(false),
  } satisfies PortraitEvents
}

function FoundersWall({ room, side, interactive }: { room: RoomLayout; side: Side; interactive: boolean }) {
  const events = usePortraitPointer(interactive)
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
        <Portrait key={m.photo} texture={textures[i]} member={m} x={first + i * step} events={events} />
      ))}
    </group>
  )
}

/**
 * Muro de los fundadores: cinco retratos enmarcados con su nombre, bajo el título "Founders".
 * Cada retrato abre el LinkedIn de la persona: con clic si `interactive` (modo scroll), o con la mira al caminar.
 */
export function Founders({ room, side, interactive = false }: { room: RoomLayout; side: Side; interactive?: boolean }) {
  return (
    <Suspense fallback={null}>
      <FoundersWall room={room} side={side} interactive={interactive} />
    </Suspense>
  )
}
