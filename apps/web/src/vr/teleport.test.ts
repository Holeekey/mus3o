import { describe, expect, it } from 'vitest'
import { buildLayout, roomAt, type PalaceLayout } from '../palace/layout'
import { parsePalace } from '../palace/parse'
import { activeColliders, corridorEnds, doorDestination, isWalkable, pointBlocked, validateTeleport } from './teleport'

const palaceOf = (n: number, pieces = 4) => {
  const text = Array.from({ length: n }, (_, i) => `# Sala ${i}\n${Array.from({ length: pieces }, (_, k) => `- c${k}`).join('\n')}`).join('\n')
  const r = parsePalace(text)
  if (!r.ok) throw new Error(r.error)
  return r.palace
}

const layoutOf = (n: number, pieces = 4): PalaceLayout => buildLayout(palaceOf(n, pieces))
const open = () => true
const closed = () => false

describe('validateTeleport', () => {
  const layout = layoutOf(3)
  const colliders = activeColliders(layout, open)
  const room = layout.rooms[0]
  const from = { x: layout.spawn.x, z: layout.spawn.z }

  it('accepts a free floor point in the same room', () => {
    // Un punto a 2 m del spawn en la dirección con más sitio libre.
    const candidates = [
      { x: from.x + 2, z: from.z },
      { x: from.x, z: from.z + 2 },
    ]
    const ok = candidates.map((to) => validateTeleport(layout, colliders, from, to)).filter((r) => r.ok)
    expect(ok.length).toBeGreaterThan(0)
  })

  it('rejects destinations that are too far or too near', () => {
    expect(validateTeleport(layout, colliders, from, { x: from.x + 40, z: from.z })).toEqual({ ok: false, reason: 'far' })
    expect(validateTeleport(layout, colliders, from, { x: from.x + 0.1, z: from.z })).toEqual({ ok: false, reason: 'near' })
  })

  it('rejects points with no floor (outside rooms and corridors)', () => {
    const to = { x: layout.bounds.minX - 3, z: from.z }
    expect(isWalkable(layout, to.x, to.z)).toBe(false)
    expect(validateTeleport(layout, colliders, from, to, { maxDist: 100 })).toEqual({ ok: false, reason: 'void' })
  })

  it('rejects a point inside a pedestal collider', () => {
    const ped = room.pedestals[0]
    expect(pointBlocked(colliders, ped.x, ped.z)).toBe(true)
    const r = validateTeleport(layout, colliders, { x: ped.x + 3, z: ped.z }, { x: ped.x, z: ped.z })
    expect(r.ok).toBe(false)
  })

  it('rejects a trip through a wall even if the destination is free floor', () => {
    // Desde un punto de la sala, a un lado del hueco, hacia el interior del pasillo: el muro de la sala queda en medio.
    const end = corridorEnds(layout)[0]
    const sideX = -end.dirZ
    const sideZ = end.dirX
    const start = { x: end.x - end.dirX * 0.8 + sideX * 3.5, z: end.z - end.dirZ * 0.8 + sideZ * 3.5 }
    const inside = { x: end.x + end.dirX * 1.5, z: end.z + end.dirZ * 1.5 }
    expect(isWalkable(layout, inside.x, inside.z)).toBe(true)
    expect(validateTeleport(layout, colliders, start, inside)).toEqual({ ok: false, reason: 'blocked' })
  })

  it('a closed door blocks the path through it; opening it lets it pass', () => {
    const door = layout.doors[0]
    const corridor = layout.corridors[door.corridorIndex].floor
    const horizontal = corridor.w > corridor.d
    // Un punto antes de la compuerta (en su sala) y otro justo después (en el pasillo), sobre el eje.
    const dir = horizontal ? Math.sign(corridor.x - door.x) : Math.sign(corridor.z - door.z)
    const before = horizontal ? { x: door.x - dir * 1.2, z: door.z } : { x: door.x, z: door.z - dir * 1.2 }
    const after = horizontal ? { x: door.x + dir * 1.2, z: door.z } : { x: door.x, z: door.z + dir * 1.2 }
    const shut = activeColliders(layout, closed)
    const opened = activeColliders(layout, open)
    expect(validateTeleport(layout, shut, before, after)).toEqual({ ok: false, reason: 'blocked' })
    expect(validateTeleport(layout, opened, before, after).ok).toBe(true)
  })
})

describe('corridor jumps', () => {
  for (const [rooms, pieces] of [[2, 3], [3, 6], [5, 10], [8, 4]] as const) {
    it(`every corridor end of a ${rooms}-room palace has a free landing spot in a room`, () => {
      const layout = layoutOf(rooms, pieces)
      const colliders = activeColliders(layout, open)
      const ends = corridorEnds(layout)
      expect(ends.length).toBe(layout.corridors.length * 2)
      for (const end of ends) {
        const dest = doorDestination(layout, colliders, end)
        expect(dest).not.toBeNull()
        expect(roomAt(layout, dest!.x, dest!.z)).not.toBeNull()
        expect(pointBlocked(colliders, dest!.x, dest!.z)).toBe(false)
      }
    })
  }

  it('the two ends of a corridor lead to the two different rooms it joins', () => {
    const layout = layoutOf(3)
    const colliders = activeColliders(layout, open)
    const [a, b] = corridorEnds(layout).slice(0, 2)
    const ra = roomAt(layout, doorDestination(layout, colliders, a)!.x, doorDestination(layout, colliders, a)!.z)
    const rb = roomAt(layout, doorDestination(layout, colliders, b)!.x, doorDestination(layout, colliders, b)!.z)
    expect(ra?.id).not.toBe(rb?.id)
  })
})
