import { describe, expect, it } from 'vitest'
import { angleOfSide, nextStop, ringAngles } from './route'

const TAU = Math.PI * 2
/** Distancia angular mínima entre dos ángulos (0..π). */
const gap = (a: number, b: number) => {
  const d = Math.abs((((a - b) % TAU) + TAU) % TAU)
  return Math.min(d, TAU - d)
}

describe('ringAngles', () => {
  it('starts the ring right next to the entrance, then goes around in order', () => {
    const entry = angleOfSide('s')
    const angles = ringAngles(6, entry, [entry])
    const step = TAU / 6
    // El 1 queda a menos de un paso de la entrada; cada siguiente avanza un paso en el mismo sentido.
    expect(gap(angles[0], entry)).toBeLessThan(step)
    for (let k = 1; k < 6; k++) expect(gap(angles[k], angles[k - 1] + step)).toBeCloseTo(0, 6)
  })

  it('keeps totems away from the doors (entrance and exit facing each other)', () => {
    for (const count of [1, 2, 3, 4, 5, 6, 8, 12]) {
      const doors = [angleOfSide('w'), angleOfSide('e')]
      const angles = ringAngles(count, doors[0], doors)
      const minGap = Math.min(...angles.flatMap((a) => doors.map((d) => gap(a, d))))
      // Óptimo geométrico: con dos puertas enfrentadas el mejor espacio posible es π/(2n) en el peor caso.
      expect(minGap).toBeGreaterThan((Math.PI / (2 * count)) * 0.9)
    }
  })

  it('never puts a totem right in front of a door, even with four doors', () => {
    for (const count of [1, 2, 3, 4, 5, 6, 8, 12]) {
      const doors = (['n', 's', 'e', 'w'] as const).map(angleOfSide)
      const angles = ringAngles(count, angleOfSide('w'), doors)
      expect(Math.min(...angles.flatMap((a) => doors.map((d) => gap(a, d))))).toBeGreaterThan((Math.PI / (4 * count)) * 0.9)
    }
  })

  it('maps wall sides to the ring angles used by the layout (cos → x, sin → z)', () => {
    expect(Math.cos(angleOfSide('e'))).toBeCloseTo(1)
    expect(Math.cos(angleOfSide('w'))).toBeCloseTo(-1)
    expect(Math.sin(angleOfSide('n'))).toBeCloseTo(-1)
    expect(Math.sin(angleOfSide('s'))).toBeCloseTo(1)
  })
})

describe('nextStop', () => {
  const ids = ['a', 'b', 'c']

  it('is the first totem of the route that is not memorized yet', () => {
    expect(nextStop(ids, {})).toBe(0)
    expect(nextStop(ids, { a: true })).toBe(1)
    expect(nextStop(ids, { a: true, c: true })).toBe(1)
  })

  it('is null when the whole room is memorized', () => {
    expect(nextStop(ids, { a: true, b: true, c: true })).toBeNull()
    expect(nextStop([], {})).toBeNull()
  })
})

describe('study route in a real museum layout', () => {
  it('puts totem 1 next to where you enter each room (the spawn, or the door you come through)', async () => {
    const { EXAMPLE_TEXT } = await import('./example')
    const { buildLayout } = await import('./layout')
    const { parsePalace } = await import('./parse')
    const parsed = parsePalace(EXAMPLE_TEXT)
    if (!parsed.ok) throw new Error('example must parse')
    const layout = buildLayout(parsed.palace)
    const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z)
    layout.rooms.forEach((room, i) => {
      // Sala inicial: se entra donde aparece el jugador. Las demás: por la puerta más cercana que viene de otra sala.
      const entry = i === 0
        ? layout.spawn
        : layout.doors.filter((d) => d.fromRoomId !== room.id).sort((a, b) => dist(a, room) - dist(b, room))[0]
      const [first, ...rest] = room.pedestals.map((p) => dist(p, entry))
      expect(first).toBeLessThanOrEqual(Math.min(...rest) + 1e-6)
    })
  })

  it('continues the numbering from one room to the next', async () => {
    const { EXAMPLE_TEXT } = await import('./example')
    const { buildLayout } = await import('./layout')
    const { parsePalace } = await import('./parse')
    const parsed = parsePalace(EXAMPLE_TEXT)
    if (!parsed.ok) throw new Error('example must parse')
    const rooms = [...buildLayout(parsed.palace).rooms].sort((a, b) => a.index - b.index)
    let expected = 1
    for (const room of rooms) {
      expect(room.firstOrder).toBe(expected)
      expected += room.pedestals.length
    }
    expect(rooms.length).toBeGreaterThan(1)
  })
})

describe('routeStarts', () => {
  it('numbers the whole museum in one sequence: room 2 continues where room 1 ended', async () => {
    const { routeStarts } = await import('./route')
    expect(routeStarts([{ pieces: [1, 2, 3] }, { pieces: [1, 2, 3] }, { pieces: [1, 2] }])).toEqual([1, 4, 7])
    expect(routeStarts([])).toEqual([])
  })
})

describe('routeNext', () => {
  const rooms = [
    { id: 'r1', index: 0, title: 'Membrana', firstOrder: 1, pedestals: ['a', 'b', 'c'].map((id) => ({ concept: { id, title: id.toUpperCase() } })) },
    { id: 'r2', index: 1, title: 'Núcleo', firstOrder: 4, pedestals: ['d', 'e'].map((id) => ({ concept: { id, title: id.toUpperCase() } })) },
  ]

  it('points to the next totem of the current room with its museum-wide number', async () => {
    const { routeNext } = await import('./route')
    expect(routeNext(rooms, 'r1', {})).toEqual({ number: 1, title: 'A', fresh: true })
    expect(routeNext(rooms, 'r1', { a: true })).toEqual({ number: 2, title: 'B', fresh: false })
    expect(routeNext(rooms, 'r2', {})).toEqual({ number: 4, title: 'D', fresh: true })
  })

  it('sends you to the next room once the current one is complete', async () => {
    const { routeNext } = await import('./route')
    expect(routeNext(rooms, 'r1', { a: true, b: true, c: true })).toEqual({ number: 4, title: 'D', fresh: false, room: 'Núcleo' })
  })

  it('is null when the whole museum is memorized', async () => {
    const { routeNext } = await import('./route')
    expect(routeNext(rooms, 'r2', { a: 1, b: 1, c: 1, d: 1, e: 1 })).toBeNull()
  })
})

describe('routeHintText', () => {
  it('invites to start a fresh room with its first number', async () => {
    const { routeHintText } = await import('./route')
    expect(routeHintText({ number: 1, title: 'Bicapa lipídica', fresh: true })).toBe('Empieza por el 1 · Bicapa lipídica')
    expect(routeHintText({ number: 4, title: 'ADN', fresh: true })).toBe('Empieza por el 4 · ADN')
  })

  it('points to the next totem once the route has started', async () => {
    const { routeHintText } = await import('./route')
    expect(routeHintText({ number: 2, title: 'Proteínas de canal', fresh: false })).toBe('Siguiente: 2 · Proteínas de canal')
  })

  it('names the next room when the current one is complete', async () => {
    const { routeHintText } = await import('./route')
    expect(routeHintText({ number: 4, title: 'ADN', fresh: false, room: 'Núcleo' })).toBe('Sala completa → sigue en «Núcleo»: 4 · ADN')
  })
})
