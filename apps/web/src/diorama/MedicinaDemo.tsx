import { useMemo } from 'react'
import type { ImageSearch } from '@mus3o/shared'
import { useResolvedImage } from '../lib/images'
import type { PalaceLayout } from '../palace/layout'
import { PortalPainting } from '../scene/PortalPainting'
import { roomPalettes, type Theme } from '../theme'
import type { Diorama } from './dioramaSchema'
import { DioramaRuntime } from './DioramaRuntime'
import { medicinaMuseum } from '../mocks/medicina'
import { CELULA, CORAZON, NEURONA } from './medicina'

// ?demo=medicina: un cuadro-portal por sala, con la imagen real del cuadro principal de cada sala.
// Hasta que la integración monte los portales en los cuadros reales, cada uno tapa el hueco del cuadro principal.

const DIORAMAS: Record<string, Diorama> = { corazon: CORAZON, celula: CELULA, neurona: NEURONA }

function RoomPortal({ layout, theme, index, search }: { layout: PalaceLayout; theme: Theme; index: number; search?: ImageSearch }) {
  const room = layout.rooms[index]
  const palette = useMemo(() => roomPalettes(theme, layout.rooms.map((r) => r.title))[index], [theme, layout, index])
  const image = useResolvedImage(search)
  // El portal tapa el cuadro principal de la sala (su hueco), unos centímetros por delante del muro.
  const placement = useMemo(() => {
    const slot = room.paintingSlots.find((sl) => sl.main) ?? room.paintingSlots[0]
    if (!slot) return null
    const n = [Math.sin(slot.rotationY), Math.cos(slot.rotationY)]
    return { position: [slot.x + n[0] * 0.1, slot.y, slot.z + n[1] * 0.1] as [number, number, number], rotationY: slot.rotationY }
  }, [room])
  const diorama = DIORAMAS[room.id]
  if (!diorama || !placement) return null
  return (
    <PortalPainting
      id={`medicina-${room.id}`}
      diorama={diorama}
      imageUrl={image?.src}
      position={placement.position}
      rotationY={placement.rotationY}
      width={3.2}
      height={2.0}
      palette={{ trim: palette.trim, ink: '#1f1411', wall: palette.wall }}
      roomId={room.id}
      title={diorama.title}
    />
  )
}

const SEARCHES: Record<string, ImageSearch | undefined> = Object.fromEntries(medicinaMuseum.rooms.map((r) => [r.id, r.imageSearch]))

export function MedicinaDemo({ layout, theme }: { layout: PalaceLayout; theme: Theme }) {
  return (
    <>
      {layout.rooms.map((r, i) => (
        <RoomPortal key={r.id} layout={layout} theme={theme} index={i} search={SEARCHES[r.id]} />
      ))}
      <DioramaRuntime layout={layout} theme={theme} />
    </>
  )
}
