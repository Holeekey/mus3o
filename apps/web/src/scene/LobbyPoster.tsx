import { useTexture } from '@react-three/drei'
import { Suspense, useMemo } from 'react'
import { SRGBColorSpace } from 'three'
import { DOOR_W, WALL_T, type RoomLayout } from '../palace/layout'

const OFFSET = 0.06 // separación del muro, como los cuadros
const CORNER_MARGIN = 0.6 // aire hasta cada esquina (y hasta el hueco de una puerta)
const BOTTOM = 0.9 // borde inferior mínimo sobre el piso
const CORNICE_CLEAR = 0.28 + 0.35 // cornisa + aire bajo ella
const FRAME = 0.12
const DEPTH = 0.08
const FRAME_COLOR = '#2B211C' // el mismo marco oscuro de Founders

// Tramo libre del muro oeste a lo largo de Z (coordenadas del mundo); si tiene puerta, la mitad más larga.
function freeSpan(room: RoomLayout): [number, number] {
  const a = room.z - room.d / 2 + WALL_T / 2 + CORNER_MARGIN
  const b = room.z + room.d / 2 - WALL_T / 2 - CORNER_MARGIN
  if (!room.doors.includes('w')) return [a, b]
  const gapA = room.z - DOOR_W / 2 - CORNER_MARGIN
  const gapB = room.z + DOOR_W / 2 + CORNER_MARGIN
  return gapA - a >= b - gapB ? [a, gapA] : [gapB, b]
}

function Poster({ room, src }: { room: RoomLayout; src: string }) {
  const texture = useTexture(src)
  useMemo(() => {
    texture.colorSpace = SRGBColorSpace
    texture.needsUpdate = true
  }, [texture])
  const img = texture.image as { width: number; height: number }
  const aspect = img.width / img.height

  const [z0, z1] = freeSpan(room)
  const top = room.height - CORNICE_CLEAR
  // Lo más grande que quepa en el tramo libre y en la banda vertical, sin deformar la imagen.
  const maxW = z1 - z0 - FRAME * 2
  const maxH = top - BOTTOM - FRAME * 2
  const w = Math.min(maxW, maxH * aspect)
  const h = w / aspect
  const outerW = w + FRAME * 2
  const outerH = h + FRAME * 2
  const x = room.x - room.w / 2 + WALL_T / 2 + OFFSET
  const z = (z0 + z1) / 2
  const y = (BOTTOM + top) / 2

  return (
    // Muro oeste: mira hacia +x, al interior de la sala.
    <group position={[x, y, z]} rotation={[0, Math.PI / 2, 0]}>
      <mesh position={[0, 0, DEPTH / 2]} castShadow>
        <boxGeometry args={[outerW, outerH, DEPTH]} />
        <meshStandardMaterial color={FRAME_COLOR} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, DEPTH + 0.002]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** Cuadro grande del lobby en el muro oeste (a la derecha de Founders, mirándolos). */
export function LobbyPoster({ room, src }: { room: RoomLayout; src: string }) {
  return (
    <Suspense fallback={null}>
      <Poster room={room} src={src} />
    </Suspense>
  )
}
