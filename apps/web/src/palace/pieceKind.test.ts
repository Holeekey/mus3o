import { describe, it, expect } from 'vitest'
import type { Piece } from '@mus3o/shared'
import { pieceKind } from './pieceKind'

const base = { id: 'x', title: 'Monkey', text: 'texto', fact: '' }

describe('pieceKind', () => {
  it('no confunde títulos que contienen "key" con una llave', () => {
    const piece: Piece = { ...base, title: 'Hockey y monkeys' }
    expect(pieceKind(piece)).toBe('standard')
  })

  it('reconoce los tipos del catálogo dungeon', () => {
    const piece = (id: string): Piece => ({ ...base, model: { type: 'catalog', id } })
    expect(pieceKind(piece('dungeon_key'))).toBe('key')
    expect(pieceKind(piece('dungeon_chest'))).toBe('chest')
    expect(pieceKind(piece('dungeon_spikes'))).toBe('trap')
    expect(pieceKind(piece('dungeon_door'))).toBe('door')
  })

  it('usa standard para catálogos desconocidos y modelos glyph', () => {
    expect(pieceKind({ ...base, model: { type: 'catalog', id: 'otro' } })).toBe('standard')
    expect(pieceKind({ ...base, model: { type: 'glyph', shape: 'box' } } as Piece)).toBe('standard')
  })
})
