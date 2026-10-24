import type { Museum } from '@mus3o/shared'

const EMPTY_LIST: readonly string[] = []
const EMPTY_SET: ReadonlySet<string> = new Set()
// Una entrada por palacio (por referencia): se descarta sola cuando el palacio deja de usarse.
const lists = new WeakMap<Museum, readonly string[]>()
const sets = new WeakMap<Museum, ReadonlySet<string>>()

/** Ids de todos los conceptos del palacio, en orden de sala y pieza. Se calcula una vez por palacio. */
export function conceptIdList(palace: Museum | null): readonly string[] {
  if (!palace) return EMPTY_LIST
  let ids = lists.get(palace)
  if (!ids) {
    ids = palace.rooms.flatMap((room) => room.pieces.map((piece) => piece.id))
    lists.set(palace, ids)
  }
  return ids
}

/** Los mismos ids como conjunto, para preguntar "¿existe?" en cada frame sin reconstruirlo. */
export function conceptIdSet(palace: Museum | null): ReadonlySet<string> {
  if (!palace) return EMPTY_SET
  let ids = sets.get(palace)
  if (!ids) {
    ids = new Set(conceptIdList(palace))
    sets.set(palace, ids)
  }
  return ids
}
