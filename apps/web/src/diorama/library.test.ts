import { describe, expect, it } from 'vitest'
import type { Museum } from '@mus3o/shared'
import { attachLibraryDioramas, DIORAMA_LIBRARY, fold, remapDiorama } from './library'
import { historiaMuseum as HISTORIA } from '../mocks/historia'
import { medicinaMuseum as MEDICINA } from '../mocks/medicina'

const piece = (id: string, title: string) => ({ id, title, text: 'x', fact: '' })
const museum = (rooms: { name: string; titles: string[] }[]): Museum => ({
  title: 'Prueba',
  rooms: rooms.map((r, i) => ({
    id: `r${i}`,
    name: r.name,
    description: '',
    pieces: r.titles.map((t, j) => piece(`r${i}-p${j}`, t)),
  })),
})

describe('attachLibraryDioramas', () => {
  it('matches by room name, accent-insensitive', () => {
    const out = attachLibraryDioramas(museum([{ name: 'EL CORAZÓN humano', titles: ['Aurícula'] }, { name: 'Otra', titles: ['Algo'] }]))
    expect(out.rooms[0].diorama?.title).toBe(DIORAMA_LIBRARY.find((e) => e.id === 'heart')!.diorama.title)
    expect(out.rooms[1].diorama).toBeUndefined()
    expect(fold('Célula')).toBe('celula')
  })

  it('matches by most piece titles when the name says nothing', () => {
    const out = attachLibraryDioramas(museum([{ name: 'Biología 1', titles: ['Neurona', 'Sinapsis', 'Otra cosa'] }]))
    expect(out.rooms[0].diorama?.title).toBe(DIORAMA_LIBRARY.find((e) => e.id === 'neuron')!.diorama.title)
    const few = attachLibraryDioramas(museum([{ name: 'Biología 1', titles: ['Neurona', 'A', 'B', 'C'] }]))
    expect(few.rooms[0].diorama).toBeUndefined()
  })

  it('returns the same museum when nothing matches', () => {
    const m = museum([{ name: 'Álgebra', titles: ['Ecuaciones'] }])
    expect(attachLibraryDioramas(m)).toBe(m)
  })

  it('uses at most one room per entry and never overrides an existing diorama', () => {
    const out = attachLibraryDioramas(museum([{ name: 'Carabobo I', titles: [] }, { name: 'Carabobo II', titles: [] }]))
    expect(out.rooms.filter((r) => r.diorama).length).toBe(1)
    expect(out.rooms[0].diorama).toBeDefined()

    const custom = { ...museum([{ name: 'Carabobo', titles: [] }]).rooms[0] }
    const withOwn = { title: 'T', rooms: [{ ...custom, diorama: DIORAMA_LIBRARY[1].diorama }] } as Museum
    expect(attachLibraryDioramas(withOwn).rooms[0].diorama).toBe(DIORAMA_LIBRARY[1].diorama)
  })

  it('does not attach an entry again when a room already has that diorama (existing demos)', () => {
    expect(attachLibraryDioramas(HISTORIA).rooms.filter((r) => r.diorama).length).toBe(HISTORIA.rooms.filter((r) => r.diorama).length)
    expect(attachLibraryDioramas(MEDICINA).rooms.map((r) => r.diorama)).toEqual(MEDICINA.rooms.map((r) => r.diorama))
  })

  it('remaps pieceId links by fuzzy title and drops the ones without a piece', () => {
    const room = museum([{ name: 'Carabobo', titles: ['Simón Bolívar', 'Páez, el centauro'] }]).rooms[0]
    const carabobo = DIORAMA_LIBRARY.find((e) => e.id === 'carabobo')!.diorama
    const out = remapDiorama(carabobo, room)
    const byLabel = (l: string) => out.props.find((p) => p.label === l)
    expect(byLabel('Simón Bolívar')?.pieceId).toBe(room.pieces[0].id)
    expect(byLabel('José Antonio Páez')?.pieceId).toBeUndefined()
    expect(byLabel('José Antonio Páez')).toBeDefined()
    expect(byLabel('Miguel de la Torre')?.pieceId).toBeUndefined()
    // Plural vs singular.
    const neuron = DIORAMA_LIBRARY.find((e) => e.id === 'neuron')!.diorama
    const n = remapDiorama(neuron, museum([{ name: 'N', titles: ['Dendrita'] }]).rooms[0])
    expect(n.props.find((p) => p.label === 'Dendritas')?.pieceId).toBe('r0-p0')
  })

  it('never mutates the input museum or the library', () => {
    const m = museum([{ name: 'Carabobo', titles: ['Simón Bolívar'] }])
    const before = JSON.stringify(m)
    const libBefore = JSON.stringify(DIORAMA_LIBRARY.map((e) => e.diorama))
    const out = attachLibraryDioramas(m)
    expect(out).not.toBe(m)
    expect(JSON.stringify(m)).toBe(before)
    expect(JSON.stringify(DIORAMA_LIBRARY.map((e) => e.diorama))).toBe(libBefore)
  })
})
