import { describe, expect, it } from 'vitest'
import type { Room } from '@mus3o/shared'
import { appendRoomToLayout, buildLayout, emptyLayout, finalizeLayout, STREAM_CELL, streamCell, type PalaceLayout } from './layout'

const room = (i: number, pieces: number): Room => ({
  id: `r${i}`,
  name: `Sala ${i}`,
  description: '',
  monument: 'torus',
  pieces: Array.from({ length: pieces }, (_, k) => ({
    id: `r${i}-p${k + 1}`,
    title: `Concepto ${i}.${k}`,
    text: 'texto',
    fact: 'dato',
    model: { type: 'glyph', shape: 'box' },
  })),
})

const SIZES = [3, 12, 1, 7, 12, 5, 9, 12] // incluye el máximo permitido por sala

function growth(sizes = SIZES) {
  const steps: PalaceLayout[] = []
  let layout = emptyLayout()
  sizes.forEach((n, i) => {
    layout = appendRoomToLayout(layout, room(i, n))
    steps.push(layout)
  })
  return steps
}

describe('appendRoomToLayout', () => {
  it('starts from an empty site with a usable frame and the final spawn', () => {
    const e = emptyLayout()
    expect(e.rooms).toHaveLength(0)
    expect(e.bounds.maxX).toBeGreaterThan(e.bounds.minX)
    expect(Number.isFinite(e.spawn.x)).toBe(true)
  })

  it('never moves or rebuilds a room that is already placed', () => {
    const steps = growth()
    for (let k = 1; k < steps.length; k++) {
      const before = steps[k - 1]
      const after = steps[k]
      expect(after.rooms).toHaveLength(k + 1)
      // La sala anterior a la última conserva incluso su objeto; las demás también.
      for (let i = 0; i < k - 1; i++) expect(after.rooms[i]).toBe(before.rooms[i])
      // La última de `before` ya tenía su puerta reservada: x, z, muros y cuadros no cambian.
      const prev = before.rooms[k - 1]
      expect(after.rooms[k - 1]).toBe(prev)
      expect(after.rooms[k - 1].paintingSlots).toBe(prev.paintingSlots)
    }
  })

  it('places rooms on a fixed serpentine grid that only depends on the index', () => {
    const steps = growth()
    const last = steps[steps.length - 1]
    last.rooms.forEach((r, i) => {
      const { row, col } = streamCell(i)
      expect(r.x).toBe(col * STREAM_CELL)
      expect(r.z).toBe(row * STREAM_CELL)
    })
    // Distinto orden de tamaños, mismas posiciones.
    const other = growth([12, 12, 12, 1, 1, 1, 5, 5])
    other[other.length - 1].rooms.forEach((r, i) => {
      expect([r.x, r.z]).toEqual([last.rooms[i].x, last.rooms[i].z])
    })
  })

  it('never overlaps rooms and leaves a walkable corridor between consecutive rooms, even with max-size rooms', () => {
    const { rooms, corridors } = growth().pop()!
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const a = rooms[i]
        const b = rooms[j]
        const gapX = Math.abs(a.x - b.x) - (a.w + b.w) / 2
        const gapZ = Math.abs(a.z - b.z) - (a.d + b.d) / 2
        expect(Math.max(gapX, gapZ)).toBeGreaterThan(1)
      }
    }
    expect(corridors).toHaveLength(rooms.length - 1)
    for (const c of corridors) expect(Math.max(c.floor.w, c.floor.d)).toBeGreaterThan(2)
  })

  it('links each room to the previous one with doors on facing sides and stable door ids', () => {
    const steps = growth()
    const last = steps[steps.length - 1]
    expect(last.doors.map((d) => d.id)).toEqual(last.rooms.slice(1).map((_, i) => `door-${i}-entrance`))
    last.doors.forEach((d, i) => expect(d.fromRoomId).toBe(`r${i}`))
    // Los ids de puerta de un paso se conservan en el siguiente.
    steps.forEach((s, k) => k > 0 && expect(steps[k].doors.slice(0, k - 1)).toEqual(steps[k - 1].doors.slice(0, k - 1)))
  })

  it('blocks the reserved door of the frontier room until the next one arrives', () => {
    const steps = growth()
    // El muro invisible es el único collider de 3 m de alto (muros de sala 4.5+, pasillos 3.6, pedestales 1, monumento 2).
    const seals = (l: PalaceLayout) => l.colliders.filter((c) => c.h === 3)
    steps.forEach((l) => expect(seals(l)).toHaveLength(1))
    const lastRoom = (l: PalaceLayout) => l.rooms[l.rooms.length - 1]
    steps.forEach((l) => {
      const [seal] = seals(l)
      const r = lastRoom(l)
      expect(Math.abs(seal.x - r.x) <= r.w / 2 + 0.01 && Math.abs(seal.z - r.z) <= r.d / 2 + 0.01).toBe(true)
    })
    // La puerta reservada de la sala k se abre (pasillo) cuando llega k+1.
    expect(steps[3].rooms[0].doors).toHaveLength(1)
    expect(steps[3].rooms[1].doors).toHaveLength(2)
    expect(finalizeLayout(steps[3]).colliders.filter((c) => c.h === 3)).toHaveLength(0)
  })

  it('finalize closes only the last room and keeps every other room object', () => {
    const steps = growth()
    const last = steps[steps.length - 1]
    const done = finalizeLayout(last)
    for (let i = 0; i < last.rooms.length - 1; i++) expect(done.rooms[i]).toBe(last.rooms[i])
    const a = last.rooms[last.rooms.length - 1]
    const b = done.rooms[done.rooms.length - 1]
    expect([b.x, b.z, b.w, b.d]).toEqual([a.x, a.z, a.w, a.d])
    expect(b.doors.length).toBe(a.doors.length - 1)
    expect(done.colliders.length).toBeLessThan(last.colliders.length + 1)
    expect(done.spawn).toBe(last.spawn)
    // Idempotente.
    expect(finalizeLayout(done)).toBe(done)
  })

  it('a single room finalizes into a closed room', () => {
    const one = finalizeLayout(appendRoomToLayout(emptyLayout(), room(0, 4)))
    expect(one.rooms[0].doors).toEqual([])
    expect(one.corridors).toHaveLength(0)
  })

  it('keeps the same spawn from the empty site to the final layout, inside the first room and away from its pedestals', () => {
    const steps = growth()
    const spawn = emptyLayout().spawn
    for (const s of steps) expect(s.spawn).toBe(spawn)
    const first = steps[0].rooms[0]
    expect(Math.abs(spawn.x - first.x)).toBeLessThan(first.w / 2 - 0.6)
    expect(Math.abs(spawn.z - first.z)).toBeLessThan(first.d / 2 - 0.6)
    for (const p of first.pedestals) expect(Math.hypot(p.x - spawn.x, p.z - spawn.z)).toBeGreaterThan(1.2)
  })

  it('bounds grow monotonically to enclose every room', () => {
    const steps = growth()
    steps.forEach((s, k) => {
      if (k === 0) return
      const p = steps[k - 1].bounds
      expect(s.bounds.minX).toBeLessThanOrEqual(p.minX)
      expect(s.bounds.maxX).toBeGreaterThanOrEqual(p.maxX)
      expect(s.bounds.minZ).toBeLessThanOrEqual(p.minZ)
      expect(s.bounds.maxZ).toBeGreaterThanOrEqual(p.maxZ)
    })
  })

  it('keeps buildLayout intact for ordinary palaces (refactor guard)', () => {
    const rooms = SIZES.slice(0, 4).map((n, i) => room(i, n))
    const layout = buildLayout({
      title: 'T',
      theme: { palette: ['#000', '#111'], ambience: 'cathedral' },
      rooms,
      mode: 'education',
      graph: { start: 'r0', edges: [{ from: 'r0', to: 'r1', kind: 'next' }, { from: 'r1', to: 'r2', kind: 'next' }, { from: 'r2', to: 'r3', kind: 'next' }] },
    } as never)
    expect(layout.rooms).toHaveLength(4)
    expect(layout.corridors).toHaveLength(3)
    expect(layout.doors.map((d) => d.id)).toEqual(['door-0-entrance', 'door-1-entrance', 'door-2-entrance'])
  })
})
