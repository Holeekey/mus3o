import { beforeEach, describe, expect, it } from 'vitest'
import { demoMuseum } from '../mocks'
import { historiaMuseum } from '../mocks/historia'
import { buildLayout, roomAt } from '../palace/layout'
import { introPose } from './IntroCamera'
import { beginIntro, introState, resetIntroForTests, skipIntro, useIntro } from './store'
import { BUILD_END, BUILD_START, corridorKey, floorKey, introTimeline, objectKey, pedestalKey, revealProgress, TOTAL, wallsKey } from './timeline'

const museums = [
  ['demo', demoMuseum],
  ['historia', historiaMuseum],
] as const

describe.each(museums)('introTimeline (%s)', (_name, museum) => {
  const layout = buildLayout(museum)
  const tl = introTimeline(layout)

  it('is deterministic', () => {
    expect(introTimeline(buildLayout(museum))).toEqual(tl)
  })

  it('starts at the spawn room and covers every room once', () => {
    const start = roomAt(layout, layout.spawn.x, layout.spawn.z) ?? layout.rooms[0]
    expect(tl.order[0]).toBe(start.id)
    expect([...tl.order].sort()).toEqual(layout.rooms.map((r) => r.id).sort())
  })

  it('raises rooms in graph order: floors never start before the previous room', () => {
    const starts = tl.order.map((id) => tl.spans[floorKey(id)].start)
    expect(starts).toEqual([...starts].sort((a, b) => a - b))
    expect(new Set(starts).size).toBe(starts.length > 1 ? starts.length : 1)
  })

  it('finishes every element before the descent starts', () => {
    for (const s of Object.values(tl.spans)) {
      expect(s.start).toBeGreaterThanOrEqual(BUILD_START - 1e-9)
      expect(s.end).toBeLessThanOrEqual(BUILD_END + 1e-9)
      expect(s.end).toBeLessThanOrEqual(tl.descentStart + 1e-9)
      expect(s.end).toBeGreaterThan(s.start)
    }
    expect(tl.total).toBe(TOTAL)
  })

  it('builds in order inside a room: floor, walls, pedestal, object', () => {
    for (const room of layout.rooms) {
      const floor = tl.spans[floorKey(room.id)]
      const walls = tl.spans[wallsKey(room.id)]
      expect(walls.start).toBeGreaterThanOrEqual(floor.start)
      for (const p of room.pedestals) {
        const ped = tl.spans[pedestalKey(p.concept.id)]
        const obj = tl.spans[objectKey(p.concept.id)]
        expect(ped.start).toBeGreaterThanOrEqual(walls.start)
        expect(obj.start).toBeGreaterThan(ped.start)
        expect(obj.end).toBeGreaterThan(ped.end)
      }
    }
    layout.corridors.forEach((_, i) => expect(tl.spans[corridorKey(i)]).toBeDefined())
  })

  it('reveal is 0 before, 1 after, monotonic, and 1 for unknown keys', () => {
    for (const [key, s] of Object.entries(tl.spans)) {
      expect(revealProgress(tl, key, s.start - 0.01)).toBe(0)
      expect(revealProgress(tl, key, s.end)).toBe(1)
      let prev = 0
      for (let k = 0; k <= 10; k++) {
        const v = revealProgress(tl, key, s.start + ((s.end - s.start) * k) / 10)
        expect(v).toBeGreaterThanOrEqual(prev)
        expect(v).toBeLessThanOrEqual(1)
        prev = v
      }
    }
    expect(revealProgress(tl, 'nope', 0)).toBe(1)
    expect(revealProgress(null, 'floor:x', 0)).toBe(1)
  })

  it('camera descent ends exactly at the spawn eye position', () => {
    const end = introPose(layout, tl.total, tl.descentStart, tl.total)
    expect(end.pos[0]).toBeCloseTo(layout.spawn.x)
    expect(end.pos[1]).toBeCloseTo(1.7)
    expect(end.pos[2]).toBeCloseTo(layout.spawn.z)
    const start = introPose(layout, 0, tl.descentStart, tl.total)
    expect(start.pos[1]).toBeGreaterThan(15)
  })
})

describe('intro session logic', () => {
  const layoutA = buildLayout(historiaMuseum)
  beforeEach(() => resetIntroForTests())

  it('plays once per palace per session; ?intro=1 forces, ?intro=0 disables', async () => {
    expect(beginIntro(layoutA, { key: 'p1' })).toBe(true)
    // Re-entrada con otro layout del mismo palacio: no se repite.
    expect(beginIntro(buildLayout(historiaMuseum), { key: 'p1' })).toBe(false)
    expect(introState.active).toBe(false)
    expect(beginIntro(buildLayout(historiaMuseum), { key: 'p1', force: 'on' })).toBe(true)
    expect(beginIntro(buildLayout(historiaMuseum), { key: 'p2', force: 'off' })).toBe(false)
    await Promise.resolve()
    expect(useIntro.getState().phase).toBe('done')
  })

  it('reduced motion: no camera flight, everything built', () => {
    expect(beginIntro(layoutA, { key: 'r', reducedMotion: true })).toBe(false)
    expect(introState.active).toBe(false)
  })

  it('skip sets every element to done', () => {
    beginIntro(layoutA, { key: 's' })
    expect(introState.active).toBe(true)
    skipIntro()
    const tl = introState.timeline!
    expect(introState.t).toBe(tl.total)
    for (const key of Object.keys(tl.spans)) expect(revealProgress(tl, key, introState.t)).toBe(1)
  })
})
