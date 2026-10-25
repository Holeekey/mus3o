import { describe, expect, it } from 'vitest'
import { MuseumSchema, parseMus3oDSL } from '@mus3o/shared'
import { attachDioramasToArrivingRoom, attachDioramasToFinalMuseum } from './liveDioramas'

const DSL = [
  'ROOM: junin | Batalla de Junín | ancient | #a8322d | #1c1203 | torus | | diorama |',
  'PIECE: Bolívar | box | Un jinete | horse | Líder patriota.',
  'PIECE: Páez | box | Una carga | horse | Jefe de caballería.',
  'DIO: battle | night',
  'D_PROP: center | figure | pointing | 1 | p1 | Bolívar',
  'D_PROP: front | rider | charging | 6 | p2 | Carga de Páez',
  'D_PROP: flanks | cannon | - | 2 | - | Artillería',
].join('\n')

describe('del micro-DSL al diorama', () => {
  const museum = MuseumSchema.parse(parseMus3oDSL(DSL))

  it('las directivas de la IA ya no componen un mundo con los conceptos: la sala espera su foto real', () => {
    expect(museum.rooms[0].dioramaDirectives).toBeTruthy()
    const room = attachDioramasToArrivingRoom([], museum.rooms[0], museum.title)
    expect(room.diorama).toBeUndefined()
  })

  it('el museo final produce el mismo diorama que la sala en vivo', () => {
    const live = attachDioramasToArrivingRoom([], museum.rooms[0], museum.title)
    const final = attachDioramasToFinalMuseum(museum)
    expect(final.rooms[0].diorama).toEqual(live.diorama)
  })
})
