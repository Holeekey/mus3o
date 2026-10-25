import { describe, expect, it } from 'vitest'
import { EXAMPLE_TEXT } from '../palace/example'
import { buildLayout, moveWithCollisions } from '../palace/layout'
import { detectFormat, parsePalace } from '../palace/parse'
import { doorFillers, lobbyColliders } from './walk'

const parsed = parsePalace(EXAMPLE_TEXT, detectFormat(EXAMPLE_TEXT))
if (!parsed.ok) throw new Error('example palace must parse')
const layout = buildLayout(parsed.palace)
const room = layout.rooms[0]

describe('doorFillers', () => {
  it('adds one full-height filler per door', () => {
    const fillers = doorFillers(room)
    expect(fillers).toHaveLength(room.doors.length)
    for (const f of fillers) expect(f.h).toBe(room.height)
  })
})

describe('lobbyColliders', () => {
  it('keeps the walker inside the room, even through a door gap', () => {
    const colliders = lobbyColliders(layout, room)
    // Walk from the center line straight towards every wall, door sides included.
    const starts = { n: [room.x - 1, room.z - 2], s: [room.x - 1, room.z + 2], e: [room.x + 2, room.z - 1], w: [room.x - 2, room.z - 1] }
    for (const [side, [x0, z0]] of Object.entries(starts)) {
      const dir = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[side]!
      let x = x0
      let z = z0
      for (let i = 0; i < 400; i++) ({ x, z } = moveWithCollisions(colliders, x, z, dir[0] * 0.05, dir[1] * 0.05))
      expect(Math.abs(x - room.x)).toBeLessThan(room.w / 2)
      expect(Math.abs(z - room.z)).toBeLessThan(room.d / 2)
    }
  })

  it('blocks the central logo pedestal but not the removed concept pedestals', () => {
    const colliders = lobbyColliders(layout, room)
    expect(room.pedestals.length).toBeGreaterThan(0)
    for (const p of room.pedestals) expect(colliders.some((c) => c.x === p.x && c.z === p.z)).toBe(false)
    expect(colliders.some((c) => c.x === room.x && c.z === room.z)).toBe(true)
    // Walking from a concept pedestal spot towards the wall is not blocked by it.
    const p = room.pedestals[0]
    const next = moveWithCollisions(colliders, p.x, p.z, 0.05, 0)
    expect(next.x).toBeCloseTo(p.x + 0.05)
  })
})
