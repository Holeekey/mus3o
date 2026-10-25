import type { Museum, Room } from '@mus3o/shared'
import { attachLibraryDioramas } from '../diorama/library'

/**
 * Dioramas de una sala en cuanto llega de la IA, con el mismo criterio que `enterPalace` con el museo completo:
 * solo la biblioteca hecha a mano (si encaja; una entrada solo se usa una vez entre las salas vistas hasta ahora).
 * NUNCA se compone un mundo con los conceptos de la sala, tampoco con las directivas de la IA (DIO / D_PROP):
 * las demás salas quedan sin diorama y su cuadro principal pide recrear su foto real al resolverse
 * (`diorama/usePhotoDiorama`); si la foto no es una escena, el cuadro queda normal, sin portal.
 *
 * Recibe las salas ya levantadas (que ya tienen su diorama y no se tocan) y la que llega, y devuelve la sala que se
 * mostrará.
 */
export function attachDioramasToArrivingRoom(existing: Room[], room: Room, title = ''): Room {
  const partial = { title, rooms: [...existing, room] } as Museum
  const withDioramas = attachLibraryDioramas(partial)
  return withDioramas.rooms[withDioramas.rooms.length - 1]
}

/** Lo mismo para el museo final: la biblioteca completa las salas sin diorama sin tocar las que ya lo tienen. */
export function attachDioramasToFinalMuseum(museum: Museum): Museum {
  return attachLibraryDioramas(museum)
}
