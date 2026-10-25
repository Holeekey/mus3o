import type { Museum, Room } from '@mus3o/shared'
import { attachComposedDioramas, attachDirectedDioramas } from '../diorama/compose'
import { attachLibraryDioramas } from '../diorama/library'
import { DEFAULT_THEME, roomPalettes } from '../theme'

/**
 * Dioramas de una sala en cuanto llega de la IA, con el mismo criterio que `enterPalace` con el museo completo:
 * primero las directivas de la IA (DIO / D_PROP), luego la biblioteca (si encaja; una entrada solo se usa una vez entre las
 * salas vistas hasta ahora) y, a las que sigan sin diorama, uno compuesto sin IA. Toda sala llega con diorama, sin pasos extra.
 *
 * Recibe las salas ya levantadas (que ya tienen su diorama y no se tocan) y la que llega, y devuelve la sala que se
 * mostrará.
 */
export function attachDioramasToArrivingRoom(existing: Room[], room: Room, title = ''): Room {
  const partial = { title, rooms: [...existing, room] } as Museum
  const withDioramas = completeDioramas(attachLibraryDioramas(attachDirected(partial)))
  return withDioramas.rooms[withDioramas.rooms.length - 1]
}

/** Lo mismo para el museo final: directivas, biblioteca y composición completan las salas sin tocar las que ya tienen diorama. */
export function attachDioramasToFinalMuseum(museum: Museum): Museum {
  return completeDioramas(attachLibraryDioramas(attachDirected(museum)))
}

/** Las salas que la IA pidió con directivas (DIO / D_PROP) se componen con ellas, antes que la biblioteca. */
export function attachDirected(museum: Museum): Museum {
  const pigments = roomPalettes(DEFAULT_THEME, museum.rooms.map((r) => r.name))
  return attachDirectedDioramas(museum, (i) => pigments[i])
}

/** Las salas sin diorama reciben uno compuesto con el pigmento de su fresco (los que ya tienen no cambian), sin llamadas a la IA. */
function completeDioramas(museum: Museum): Museum {
  const pigments = roomPalettes(DEFAULT_THEME, museum.rooms.map((r) => r.name))
  return attachComposedDioramas(museum, (i) => pigments[i])
}
