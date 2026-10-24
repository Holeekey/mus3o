import type { Museum, Room } from '@mus3o/shared'
import { attachLibraryDioramas } from '../diorama/library'

/**
 * PUNTO DE ENGANCHE de la construcción en vivo: lo que se hace con los dioramas de una sala en cuanto
 * llega de la IA. Hoy recupera uno de la biblioteca si encaja (igual que `enterPalace` con el museo completo,
 * pero con las salas vistas hasta ahora: una entrada de la biblioteca solo se usa una vez).
 *
 * Si se añade un paso que componga dioramas por sala (p. ej. `composeDiorama`), se cambia solo esta función:
 * recibe las salas ya levantadas y la que llega, y devuelve la sala que se mostrará.
 */
export function attachDioramasToArrivingRoom(existing: Room[], room: Room): Room {
  const partial = attachLibraryDioramas({ rooms: [...existing, room] } as Museum)
  return partial.rooms[partial.rooms.length - 1]
}

/** Lo mismo para el museo final: completa las salas que aún no tengan diorama sin tocar las que ya lo tienen. */
export function attachDioramasToFinalMuseum(museum: Museum): Museum {
  return attachLibraryDioramas(museum)
}
