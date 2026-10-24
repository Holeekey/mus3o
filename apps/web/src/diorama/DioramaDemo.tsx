import { useMemo } from 'react'
import { PortalPainting } from '../scene/PortalPainting'
import type { PalaceLayout, Side } from '../palace/layout'
import { roomPalettes, type Theme } from '../theme'
import { CARABOBO } from './carabobo'
import { DioramaRuntime } from './DioramaRuntime'

// La pintura real (dominio público) que se disuelve en el diorama. CORS abierto en Wikimedia.
export const CARABOBO_IMAGE = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e1/Batalla_de_Carabobo.JPG/960px-Batalla_de_Carabobo.JPG'

const SIDES: Side[] = ['n', 's', 'e', 'w']

/**
 * Instancia de prueba para ?demo: cuelga El Campo de Carabobo en un muro sin puerta de la
 * primera sala. El resto del equipo la sustituye por un PortalPainting por sala, en el hueco
 * principal del cuadro; DioramaRuntime se monta una sola vez por mundo.
 */
export function DioramaDemo({ layout, theme }: { layout: PalaceLayout; theme: Theme }) {
  const room = layout.rooms[0]
  const palette = useMemo(() => roomPalettes(theme, layout.rooms.map((r) => r.title))[0], [theme, layout])
  const placement = useMemo(() => {
    // La inscripción de la sala ocupa el primer muro sin puerta; el cuadro va en el siguiente.
    const free = SIDES.filter((s) => !room.doors.includes(s))
    const side = free[1] ?? free[0] ?? 's'
    const inset = 0.2 + 0.02
    const y = 2.0
    switch (side) {
      case 'n':
        return { position: [room.x, y, room.z - room.d / 2 + inset] as [number, number, number], rotationY: 0 }
      case 's':
        return { position: [room.x, y, room.z + room.d / 2 - inset] as [number, number, number], rotationY: Math.PI }
      case 'e':
        return { position: [room.x + room.w / 2 - inset, y, room.z] as [number, number, number], rotationY: -Math.PI / 2 }
      default:
        return { position: [room.x - room.w / 2 + inset, y, room.z] as [number, number, number], rotationY: Math.PI / 2 }
    }
  }, [room])
  return (
    <>
      <PortalPainting
        id="demo-carabobo"
        diorama={CARABOBO}
        imageUrl={CARABOBO_IMAGE}
        position={placement.position}
        rotationY={placement.rotationY}
        width={3.2}
        height={2.0}
        palette={{ trim: palette.trim, ink: '#1f1411', wall: palette.wall }}
        roomId={room.id}
        title="Batalla de Carabobo (1887) · Martín Tovar y Tovar"
      />
      <DioramaRuntime layout={layout} theme={theme} />
    </>
  )
}
