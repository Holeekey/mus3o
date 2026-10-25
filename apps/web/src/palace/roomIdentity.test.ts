import { describe, expect, it } from 'vitest'
import type { GraphEdge, Museum } from '@mus3o/shared'
import { appendRoomToLayout, buildLayout, doorOpenings, emptyLayout, finalizeLayout, slotZone, type Box, type PalaceLayout } from './layout'
import { decorBox, pickIdentity } from './roomIdentity'

const room = (id: string, n: number, name = id) => ({
  id,
  name,
  description: '',
  pieces: Array.from({ length: n }, (_, i) => ({ id: `${id}-p${i}`, title: `${id} ${i}`, text: 't', fact: '' })),
})

const NAMES = ['Roma', 'Atenas', 'Egipto', 'Mesopotamia', 'Bizancio', 'Cartago', 'Persia', 'Fenicia', 'Esparta', 'Troya', 'Iberia', 'Galia']

function museum(count = 12): Museum {
  const rooms = NAMES.slice(0, count).map((n, i) => room(`r${i}`, 2 + (i % 6), n))
  return {
    title: 'Grande',
    mode: 'education',
    rooms,
    graph: {
      start: 'r0',
      edges: [
        ...rooms.slice(1).map((r, i) => ({ from: rooms[Math.floor(i / 2)].id, to: r.id, kind: 'prerequisite' as const })),
        { from: 'r5', to: 'r11', kind: 'related' as const },
        { from: 'r4', to: 'r9', kind: 'related' as const },
      ].filter((e) => rooms.some((r) => r.id === e.from) && rooms.some((r) => r.id === e.to)),
    },
  }
}

const hit = (a: Box, b: Box) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.z - b.z) < (a.d + b.d) / 2

describe('identidad de sala', () => {
  it('es determinista y salas consecutivas difieren', () => {
    const a = buildLayout(museum())
    const b = buildLayout(museum())
    expect(a.rooms.map((r) => [r.floorStyle, r.decor])).toEqual(b.rooms.map((r) => [r.floorStyle, r.decor]))
    for (let i = 1; i < a.rooms.length; i++) {
      expect(a.rooms[i].floorStyle).not.toBe(a.rooms[i - 1].floorStyle)
      expect(a.rooms[i].decor.kind).not.toBe(a.rooms[i - 1].decor.kind)
    }
  })

  it('mismo título, misma elección; sin la sala anterior no hay restricción', () => {
    expect(pickIdentity('Roma', null)).toEqual(pickIdentity('Roma', null))
    const p = pickIdentity('Roma', null)
    const q = pickIdentity('Roma', p)
    expect(q.floorStyle).not.toBe(p.floorStyle)
    expect(q.decorKind).not.toBe(p.decorKind)
  })

  it('reparte los tres estilos de suelo, las tres decoraciones y algunas salas sin decorar', () => {
    const titles = Array.from({ length: 200 }, (_, i) => `Sala ${i}`)
    const ids = titles.map((t) => pickIdentity(t, null))
    expect(new Set(ids.map((i) => i.floorStyle)).size).toBe(3)
    expect(new Set(ids.map((i) => i.decorKind))).toEqual(new Set(['columns', 'arches', 'niches', null]))
    const none = ids.filter((i) => i.decorKind === null).length / ids.length
    expect(none).toBeGreaterThan(0.1)
    expect(none).toBeLessThan(0.4)
  })

  it('la decoración nunca invade puertas, cuadros, pedestales ni la pieza central', () => {
    const layout = buildLayout(museum())
    let placed = 0
    for (const r of layout.rooms) {
      if (!r.decor.kind) {
        expect(r.decor.items).toHaveLength(0)
        continue
      }
      for (const it of r.decor.items) {
        placed++
        const box = decorBox(r.decor.kind, it, r.height)
        for (const o of doorOpenings(r)) expect(hit(box, o)).toBe(false)
        for (const s of r.paintingSlots) expect(hit(box, slotZone(s))).toBe(false)
        for (const p of r.pedestals) expect(hit(box, { x: p.x, z: p.z, w: 0.9, d: 0.9, h: 1 })).toBe(false)
        if (r.centerpiece) expect(hit(box, { x: r.x, z: r.z, w: r.centerpiece.footprint[0], d: r.centerpiece.footprint[1], h: 1 })).toBe(false)
        // dentro de la sala
        expect(Math.abs(it.x - r.x)).toBeLessThan(r.w / 2)
        expect(Math.abs(it.z - r.z)).toBeLessThan(r.d / 2)
      }
    }
    expect(placed).toBeGreaterThan(10)
  })

  it('la decoración deja libre el punto de entrada', () => {
    const layout = buildLayout(museum())
    const start = layout.rooms[0]
    const sp = { x: layout.spawn.x, z: layout.spawn.z, w: 1, d: 1, h: 1 }
    if (start.decor.kind) for (const it of start.decor.items) expect(hit(decorBox(start.decor.kind, it, start.height), sp)).toBe(false)
  })

  it('cada elemento de decoración es un collider del palacio', () => {
    const layout = buildLayout(museum())
    for (const r of layout.rooms)
      for (const it of r.decor.items) {
        const b = decorBox(r.decor.kind!, it, r.height)
        expect(layout.colliders.some((c) => c.x === b.x && c.z === b.z && c.w === b.w && c.d === b.d)).toBe(true)
      }
    // y se frena al jugador contra ellos: no se atraviesa una columna
    expect(layout.colliders.length).toBeGreaterThan(layout.rooms.reduce((n, r) => n + r.walls.length, 0))
  })
})

describe('identidad en un palacio que se levanta', () => {
  const edge = (a: number, b: number): GraphEdge => ({ from: `r${a}`, to: `r${b}`, kind: 'related' })
  const grow = () => {
    let layout: PalaceLayout = emptyLayout()
    const steps: PalaceLayout[] = []
    NAMES.slice(0, 8).forEach((n, i) => {
      layout = appendRoomToLayout(layout, room(`r${i}`, 2 + (i % 5), n), i > 0 ? [edge(Math.floor((i - 1) / 2), i)] : [])
      steps.push(layout)
    })
    return steps
  }

  it('añadir salas no cambia el suelo de las anteriores y solo quita decoración bajo una puerta nueva', () => {
    const steps = grow()
    for (let s = 1; s < steps.length; s++)
      for (let i = 0; i < s; i++) {
        const before = steps[s - 1].rooms[i]
        const after = steps[s].rooms[i]
        expect(after.floorStyle).toBe(before.floorStyle)
        expect(after.decor.kind).toBe(before.decor.kind)
        // los elementos que quedan son los mismos de antes (sin mover ninguno) y los quitados caen sobre una puerta
        for (const it of after.decor.items) expect(before.decor.items).toContainEqual(it)
        const added = after.doors.length > before.doors.length
        if (!added) expect(after.decor.items).toEqual(before.decor.items)
        for (const it of before.decor.items) {
          if (after.decor.items.some((x) => x.x === it.x && x.z === it.z)) continue
          const box = decorBox(before.decor.kind!, it, before.height)
          expect(doorOpenings(after).some((d) => hit(box, { ...d, w: d.w + 0.4, d: d.d + 0.4 }))).toBe(true)
        }
      }
  })

  it('finalizar el palacio no mueve la decoración', () => {
    const steps = grow()
    const last = steps[steps.length - 1]
    const done = finalizeLayout(last)
    last.rooms.forEach((r, i) => expect(done.rooms[i].decor.kind).toBe(r.decor.kind))
  })
})
