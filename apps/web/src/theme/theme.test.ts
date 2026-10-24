import { describe, expect, it } from 'vitest'
import { roomPalettes } from '.'
import { teatro } from './teatro'

describe('roomPalettes', () => {
  it('uses Public Sans for display and body text', () => {
    expect(teatro.ui.fonts).toEqual({
      display: "'Public Sans', sans-serif",
      body: "'Public Sans', sans-serif",
    })
  })

  it('es estable: el mismo nombre de sala recibe siempre el mismo color', () => {
    const a = roomPalettes(teatro, ['Mitocondria', 'Núcleo'])
    const b = roomPalettes(teatro, ['Mitocondria', 'Núcleo'])
    expect(a).toEqual(b)
  })
  it('no repite color dentro de un palacio mientras haya colores libres', () => {
    const names = Array.from({ length: teatro.rooms.length }, (_, i) => `Sala ${i}`)
    expect(new Set(roomPalettes(teatro, names).map((p) => p.wall)).size).toBe(teatro.rooms.length)
  })
})
