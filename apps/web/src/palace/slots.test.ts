import { describe, expect, it } from 'vitest'
import { assignPaintings, buildLayout, SLOT_DOOR_MARGIN, SLOT_GAP, SLOT_OFFSET, SLOT_Y, type PaintingSlot, type RoomLayout } from './layout'
import { parsePalace } from './parse'

const palaceOf = (n: number, pieces = 4) => {
  const text = Array.from({ length: n }, (_, i) => `# Sala ${i}\n${Array.from({ length: pieces }, (_, k) => `- c${k}`).join('\n')}`).join('\n')
  const r = parsePalace(text)
  if (!r.ok) throw new Error(r.error)
  // El parser ya pide imágenes por título; cada test define las suyas.
  for (const room of r.palace.rooms) {
    delete room.imageSearch
    for (const piece of room.pieces) delete piece.imageSearch
  }
  return r.palace
}

// Coordenada a lo largo del muro (relativa al centro de la sala) y mitad del largo del muro.
const along = (room: RoomLayout, s: PaintingSlot) =>
  s.side === 'n' || s.side === 's' ? { t: s.x - room.x, half: room.w / 2 } : { t: s.z - room.z, half: room.d / 2 }

describe('paintingSlots', () => {
  const layouts = [1, 2, 3, 5, 8].flatMap((n) => [2, 6, 12].map((p) => buildLayout(palaceOf(n, p))))

  it('every room has a single main slot first, at height 2.3', () => {
    for (const l of layouts)
      for (const r of l.rooms) {
        expect(r.paintingSlots.length).toBeGreaterThan(0)
        expect(r.paintingSlots[0].main).toBe(true)
        expect(r.paintingSlots.filter((s) => s.main)).toHaveLength(1)
        expect(r.paintingSlots[0].maxWidth).toBeLessThanOrEqual(3.4)
        for (const s of r.paintingSlots.slice(1)) expect(s.maxWidth).toBeLessThanOrEqual(1.4)
        for (const s of r.paintingSlots) expect(s.y).toBe(SLOT_Y)
      }
  })

  it('the main slot is centered on a doorless wall when one exists', () => {
    for (const l of layouts)
      for (const r of l.rooms) {
        const main = r.paintingSlots[0]
        if (r.doors.length < 4) {
          expect(r.doors).not.toContain(main.side)
          expect(along(r, main).t).toBeCloseTo(0)
        }
      }
  })

  it('slots sit just off the interior wall face, inside the room', () => {
    for (const l of layouts)
      for (const r of l.rooms)
        for (const s of r.paintingSlots) {
          const face = s.side === 'n' || s.side === 's' ? r.d / 2 - 0.2 - SLOT_OFFSET : r.w / 2 - 0.2 - SLOT_OFFSET
          const dist = s.side === 'n' || s.side === 's' ? Math.abs(s.z - r.z) : Math.abs(s.x - r.x)
          expect(dist).toBeCloseTo(face)
          const { t, half } = along(r, s)
          expect(Math.abs(t) + s.maxWidth / 2).toBeLessThanOrEqual(half - 0.2)
        }
  })

  it('keeps at least 0.6 m from every door opening', () => {
    for (const l of layouts)
      for (const r of l.rooms)
        for (const s of r.paintingSlots) {
          if (!r.doors.includes(s.side)) continue
          const { t } = along(r, s)
          expect(Math.abs(t) - s.maxWidth / 2).toBeGreaterThanOrEqual(1.4 + SLOT_DOOR_MARGIN - 1e-9)
        }
  })

  it('never overlaps and keeps a 0.4 m gap on the same wall', () => {
    for (const l of layouts)
      for (const r of l.rooms)
        for (const a of r.paintingSlots)
          for (const b of r.paintingSlots) {
            if (a === b || a.side !== b.side) continue
            const gap = Math.abs(along(r, a).t - along(r, b).t) - (a.maxWidth + b.maxWidth) / 2
            expect(gap).toBeGreaterThanOrEqual(SLOT_GAP - 1e-9)
          }
  })

  it('assigns the room search to the main slot and each piece to a distinct free slot', () => {
    const palace = palaceOf(1, 3)
    palace.rooms[0].imageSearch = { wikiTitle: 'Sala' }
    palace.rooms[0].pieces[0].imageSearch = { wikiTitle: 'A' }
    palace.rooms[0].pieces[2].imageSearch = { commonsQuery: 'c' }
    const room = buildLayout(palace).rooms[0]
    const assigned = assignPaintings(room)
    expect(assigned.map((a) => a.key)).toEqual(['room:' + room.id, 'piece:' + palace.rooms[0].pieces[0].id, 'piece:' + palace.rooms[0].pieces[2].id])
    expect(assigned[0].slot.main).toBe(true)
    expect(new Set(assigned.map((a) => a.slot)).size).toBe(3)
    expect(assigned.slice(1).every((a) => !a.slot.main)).toBe(true)
  })

  it('hangs nothing without imageSearch and never exceeds the slots', () => {
    expect(assignPaintings(buildLayout(palaceOf(1, 3)).rooms[0])).toEqual([])
    const palace = palaceOf(1, 12)
    palace.rooms[0].pieces.forEach((p) => (p.imageSearch = { wikiTitle: p.id }))
    const room = buildLayout(palace).rooms[0]
    expect(assignPaintings(room).length).toBeLessThanOrEqual(room.paintingSlots.length)
  })

  it('is deterministic', () => {
    expect(buildLayout(palaceOf(5)).rooms.map((r) => r.paintingSlots)).toEqual(
      buildLayout(palaceOf(5)).rooms.map((r) => r.paintingSlots),
    )
  })
})
