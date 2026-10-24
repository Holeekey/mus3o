import type { Museum } from '@mus3o/shared'

const EMPTY: ReadonlySet<string> = new Set()
// Una entrada por palacio (por referencia): se descarta sola cuando el palacio deja de usarse.
const cache = new WeakMap<Museum, ReadonlySet<string>>()

/** Ids de todos los conceptos del palacio. Se calcula una vez por palacio, apto para usarse en cada frame. */
export function conceptIdSet(palace: Museum | null): ReadonlySet<string> {
  if (!palace) return EMPTY
  let ids = cache.get(palace)
  if (!ids) {
    ids = new Set(palace.rooms.flatMap((room) => room.pieces.map((piece) => piece.id)))
    cache.set(palace, ids)
  }
  return ids
}
