import { describe, expect, it } from 'vitest'
import type { Museum } from '@mus3o/shared'
import { buildLayout } from './layout'

const room = (id: string, n: number) => ({
  id,
  name: id,
  description: '',
  pieces: Array.from({ length: n }, (_, i) => ({ id: `${id}-p${i}`, title: `${id} ${i}`, text: 't', fact: '' })),
})

describe('museos grandes y no lineales', () => {
  it('12 salas con ramas y cruces generan un layout sin salas superpuestas y con puertas únicas', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `r${i}`)
    const museum: Museum = {
      title: 'Grande',
      mode: 'education',
      rooms: ids.map((id, i) => room(id, 3 + (i % 5))),
      graph: {
        start: 'r0',
        edges: [
          ...ids.slice(1).map((id, i) => ({ from: ids[Math.floor(i / 2)], to: id, kind: 'prerequisite' as const })),
          { from: 'r5', to: 'r11', kind: 'related' as const },
          { from: 'r4', to: 'r9', kind: 'related' as const },
        ],
      },
    }
    const layout = buildLayout(museum)
    expect(layout.rooms).toHaveLength(12)
    const centers = new Set(layout.rooms.map((r) => `${r.x},${r.z}`))
    expect(centers.size).toBe(12)
    for (const r of layout.rooms) {
      expect(new Set(r.doors).size).toBe(r.doors.length)
      expect(r.doors.length).toBeGreaterThan(0)
    }
    expect(layout.rooms.reduce((n, r) => n + r.pedestals.length, 0)).toBe(museum.rooms.reduce((n, r) => n + r.pieces.length, 0))
  })
})
