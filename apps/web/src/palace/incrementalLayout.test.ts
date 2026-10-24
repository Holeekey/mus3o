import { describe, expect, it } from 'vitest'
import type { GraphEdge, Room } from '@mus3o/shared'
import { appendRoomToLayout, buildLayout, emptyLayout, finalizeLayout, STREAM_CELL, type PalaceLayout } from './layout'

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

const edge = (a: number, b: number, kind: GraphEdge['kind'] = 'related'): GraphEdge => ({ from: `r${a}`, to: `r${b}`, kind })

const SIZES = [3, 12, 1, 7, 12, 5, 9, 12] // incluye el máximo permitido por sala
// Árbol de exploración con ramas: r0 es el hub; r3 y r4 quedan en celdas vecinas sin ser hermanas directas.
const PARENT = [-1, 0, 1, 1, 0, 3, 0, 2]

function growth(sizes = SIZES, parent = PARENT) {
  const steps: PalaceLayout[] = []
  let layout = emptyLayout()
  sizes.forEach((n, i) => {
    layout = appendRoomToLayout(layout, room(i, n), parent[i] >= 0 ? [edge(parent[i], i)] : [])
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

  it('never moves a room that is already placed, whatever the shape of the graph', () => {
    const steps = growth()
    for (let k = 1; k < steps.length; k++) {
      const before = steps[k - 1]
      const after = steps[k]
      expect(after.rooms).toHaveLength(k + 1)
      for (let i = 0; i < k; i++) {
        const [a, b] = [before.rooms[i], after.rooms[i]]
        expect([b.x, b.z, b.w, b.d, b.height]).toEqual([a.x, a.z, a.w, a.d, a.height])
        expect(b.pedestals.map((p) => [p.x, p.z])).toEqual(a.pedestals.map((p) => [p.x, p.z]))
      }
    }
  })

  it('keeps the very same room object unless a door was opened toward the new room', () => {
    const steps = growth()
    for (let k = 1; k < steps.length; k++) {
      const host = PARENT[k]
      for (let i = 0; i < k; i++) {
        if (i === host) expect(steps[k].rooms[i].doors.length).toBe(steps[k - 1].rooms[i].doors.length + 1)
        else expect(steps[k].rooms[i]).toBe(steps[k - 1].rooms[i])
      }
    }
  })

  it('places each room on the fixed grid right next to the room that links it, not in a fixed snake', () => {
    const last = growth().pop()!
    last.rooms.forEach((r) => {
      expect(r.x % STREAM_CELL).toBeCloseTo(0, 6)
      expect(r.z % STREAM_CELL).toBeCloseTo(0, 6)
    })
    expect(new Set(last.rooms.map((r) => `${r.x},${r.z}`)).size).toBe(last.rooms.length)
    // Cada pasillo une dos salas en celdas contiguas; el hub reparte sus hijas por lados distintos.
    for (const [a, b] of last.stream!.grid.links) {
      expect(Math.abs(last.rooms[a].x - last.rooms[b].x) + Math.abs(last.rooms[a].z - last.rooms[b].z)).toBe(STREAM_CELL)
    }
    const hubChildren = last.stream!.grid.links.filter(([a]) => a === 0).map(([, b]) => `${last.rooms[b].x},${last.rooms[b].z}`)
    expect(new Set(hubChildren).size).toBe(hubChildren.length)
    expect(hubChildren.length).toBeGreaterThan(1)
  })

  it('position of a room does not depend on the size of the rooms that arrive later', () => {
    const a = growth().pop()!
    const b = growth([3, 12, 1, 12, 1, 12, 1, 12]).pop()!
    expect(b.rooms.map((r) => [r.x, r.z])).toEqual(a.rooms.map((r) => [r.x, r.z]))
  })

  it('never overlaps rooms and leaves a walkable corridor on every link, even with max-size rooms', () => {
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

  it('opens a door from the hosting room to the new one, with stable door ids and corridor indexes', () => {
    const steps = growth()
    const last = steps[steps.length - 1]
    // Una puerta por sala nueva, en orden de llegada: la sala k+1 cuelga del pasillo k.
    expect(last.doors.map((d) => d.id)).toEqual(last.rooms.slice(1).map((_, i) => `door-${i}-entrance`))
    last.doors.forEach((d, i) => expect(d.fromRoomId).toBe(`r${PARENT[i + 1]}`))
    // Los pasillos y puertas de un paso se conservan tal cual en el siguiente.
    steps.forEach((s, k) => {
      if (k < 2) return
      s.corridors.slice(0, k - 1).forEach((c, i) => expect(c).toBe(steps[k - 1].corridors[i]))
      s.doors.slice(0, k - 1).forEach((d, i) => expect(d).toBe(steps[k - 1].doors[i]))
    })
    // Cada sala nueva tiene al menos la puerta hacia su anfitriona.
    last.rooms.slice(1).forEach((r) => expect(r.doors.length).toBeGreaterThan(0))
  })

  it('without edges the room hangs from the previous one (a chain)', () => {
    let layout = emptyLayout()
    for (let i = 0; i < 4; i++) layout = appendRoomToLayout(layout, room(i, 3))
    expect(layout.doors.map((d) => d.fromRoomId)).toEqual(['r0', 'r1', 'r2'])
    expect(layout.stream?.edges.map((e) => e.kind)).toEqual(['next', 'next', 'next'])
  })

  it('the finished layout keeps every room where it was and adds the loop doors of the final graph', () => {
    const last = growth().pop()!
    // Atajo entre dos salas que quedaron vecinas sin puerta propia.
    const pairs: Array<[number, number]> = []
    for (let i = 0; i < last.rooms.length; i++)
      for (let j = i + 1; j < last.rooms.length; j++) {
        const [a, b] = [last.rooms[i], last.rooms[j]]
        const adjacent = Math.abs(a.x - b.x) + Math.abs(a.z - b.z) === STREAM_CELL
        const linked = last.stream!.grid.links.some(([x, y]) => (x === i && y === j) || (x === j && y === i))
        if (adjacent && !linked) pairs.push([i, j])
      }
    expect(pairs.length).toBeGreaterThan(0)
    const [i, j] = pairs[0]
    const edges = [...PARENT.flatMap((p, k) => (p >= 0 ? [edge(p, k)] : [])), edge(i, j)]
    const done = finalizeLayout(last, { rooms: last.rooms.map((_, k) => room(k, SIZES[k])), graph: { start: 'r0', edges } })
    expect(done.corridors).toHaveLength(last.corridors.length + 1)
    done.rooms.forEach((r, k) => expect([r.x, r.z]).toEqual([last.rooms[k].x, last.rooms[k].z]))
    expect(done.rooms[i].doors.length).toBe(last.rooms[i].doors.length + 1)
    expect(done.rooms[j].doors.length).toBe(last.rooms[j].doors.length + 1)
    // Los pasillos que ya estaban conservan su objeto.
    last.corridors.forEach((c, k) => expect(done.corridors[k]).toBe(c))
  })

  it('finalizing refreshes the content of each room (3D models, dioramas) without moving it, and is idempotent when nothing changes', () => {
    const last = growth().pop()!
    expect(finalizeLayout(last)).toBe(last)
    const enriched = last.rooms.map((_, k) => ({
      ...room(k, SIZES[k]),
      pieces: room(k, SIZES[k]).pieces.map((p) => ({ ...p, model: { type: 'catalog' as const, id: 'x' } })),
    }))
    const done = finalizeLayout(last, { rooms: enriched as Room[], graph: { start: 'r0', edges: PARENT.flatMap((p, k) => (p >= 0 ? [edge(p, k)] : [])) } })
    done.rooms.forEach((r, k) => {
      expect([r.x, r.z]).toEqual([last.rooms[k].x, last.rooms[k].z])
      expect(r.pedestals[0].concept).toBe(enriched[k].pieces[0])
    })
    expect(done.spawn).toBe(last.spawn)
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

  it('keeps the centerpiece and its collider like buildLayout does', () => {
    const last = growth().pop()!
    expect(last.rooms.every((r) => 'centerpiece' in r)).toBe(true)
    const withCenter = last.rooms.filter((r) => r.centerpiece)
    for (const r of withCenter) {
      expect(last.colliders.some((c) => c.x === r.x && c.z === r.z && c.h === r.centerpiece!.height)).toBe(true)
    }
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

