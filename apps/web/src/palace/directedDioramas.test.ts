import { describe, expect, it } from 'vitest'
import { MuseumSchema, parseMus3oDSL } from '@mus3o/shared'
import { attachDioramasToArrivingRoom, attachDioramasToFinalMuseum } from './liveDioramas'

const DSL = [
  'ROOM: carabobo | Batalla de Carabobo | ancient | #a8322d | #1c1203 | torus | | diorama |',
  'PIECE: Bolívar | box | Un jinete | horse | Líder patriota.',
  'PIECE: Páez | box | Una carga | horse | Jefe de caballería.',
  'DIO: battle | night',
  'D_PROP: center | figure | pointing | 1 | p1 | Bolívar',
  'D_PROP: front | rider | charging | 6 | p2 | Carga de Páez',
  'D_PROP: flanks | cannon | - | 2 | - | Artillería',
].join('\n')

describe('del micro-DSL al diorama', () => {
  const museum = MuseumSchema.parse(parseMus3oDSL(DSL))

  it('la sala que llega en vivo se compone con las directivas de la IA', () => {
    const room = attachDioramasToArrivingRoom([], museum.rooms[0], museum.title)
    expect(room.diorama?.time).toBe('night')
    const kinds = room.diorama!.props.map((p) => p.kind)
    expect(kinds).toContain('rider')
    expect(kinds).toContain('cannon')
    expect(room.diorama!.props.filter((p) => p.pieceId).map((p) => p.label)).toContain('Carga de Páez')
  })

  it('el museo final produce el mismo diorama que la sala en vivo', () => {
    const live = attachDioramasToArrivingRoom([], museum.rooms[0], museum.title)
    const final = attachDioramasToFinalMuseum(museum)
    expect(final.rooms[0].diorama).toEqual(live.diorama)
  })
})
