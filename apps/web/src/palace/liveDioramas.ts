import type { Museum, Room } from '@mus3o/shared'
import { attachLibraryDioramas } from '../diorama/library'

/**
 * Dioramas de una sala en cuanto llega de la IA, con el mismo criterio que `enterPalace` con el museo completo:
 * solo los hechos a mano de la biblioteca (si encajan; una entrada solo se usa una vez entre las salas vistas hasta
 * ahora). Los demás cuadros piden recrear su foto real cuando la imagen se resuelve (`diorama/usePhotoDiorama`):
 * ya no se compone un mundo con los conceptos de la sala.
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
