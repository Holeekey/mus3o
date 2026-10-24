import { beforeEach, describe, expect, it } from 'vitest'
import type { Room } from '@mus3o/shared'
import { appendRoomToLayout, emptyLayout, type PalaceLayout } from '../palace/layout'
import { buildAerialPose, buildDescentPose, frameOf, stepFrame } from './IntroCamera'
import {
  abortIntro,
  beginBuildIntro,
  introBuildDone,
  introRoomArrived,
  introState,
  resetIntroForTests,
  skipIntro,
  useIntro,
} from './store'
import {
  corridorKey,
  DESCENT_DUR,
  floorKey,
  LIVE_ROOM_DUR,
  liveArrival,
  liveFinish,
  liveTimeline,
  objectKey,
  paintingsKey,
  pedestalKey,
  revealProgress,
  titleKey,
  wallsKey,
} from './timeline'

const room = (i: number, pieces = 3): Room => ({
  id: `r${i}`,
  name: `Sala ${i}`,
  description: '',
  monument: 'torus',
  pieces: Array.from({ length: pieces }, (_, k) => ({
    id: `r${i}-p${k + 1}`,
    title: `C${i}.${k}`,
    text: 't',
    fact: 'f',
    model: { type: 'glyph', shape: 'box' },
  })),
})

function layoutOf(n: number): PalaceLayout {
  let l = emptyLayout()
  for (let i = 0; i < n; i++) l = appendRoomToLayout(l, room(i))
  return l
}

describe('live timeline: reveal driven by arrivals', () => {
  it('starts raising a room exactly when it arrives, whatever the arrival time', () => {
    const layout = layoutOf(3)
    const tl = liveTimeline()
    const arrivals = [0.4, 2.9, 3.1]
    layout.rooms.forEach((r, i) => liveArrival(tl, r, i, arrivals[i]))
    layout.rooms.forEach((r, i) => {
      expect(tl.spans[floorKey(r.id)].start).toBe(arrivals[i])
      // Nada de la sala empieza antes de que llegue.
      const own = [wallsKey(r.id), paintingsKey(r.id), titleKey(r.id), ...r.pedestals.flatMap((p) => [pedestalKey(p.concept.id), objectKey(p.concept.id)])]
      for (const key of own) expect(tl.spans[key].start).toBeGreaterThanOrEqual(arrivals[i])
      // Y todo termina dentro de la duración de una sala.
      for (const key of own) expect(tl.spans[key].end).toBeLessThanOrEqual(arrivals[i] + LIVE_ROOM_DUR + 1e-9)
    })
    expect(tl.order).toEqual(['r0', 'r1', 'r2'])
  })

  it('flashes the room title right after it arrives', () => {
    const tl = liveTimeline()
    const [r] = layoutOf(1).rooms
    liveArrival(tl, r, 0, 5)
    const s = tl.spans[titleKey(r.id)]
    expect(s.start).toBeGreaterThan(5)
    expect(s.start).toBeLessThan(5.5)
    expect(s.end - s.start).toBeGreaterThan(0.8)
  })

  it('raises the corridor that joins a room with the previous one when it arrives', () => {
    const tl = liveTimeline()
    const layout = layoutOf(3)
    layout.rooms.forEach((r, i) => liveArrival(tl, r, i, i * 2))
    expect(tl.spans[corridorKey(0)]).toBeDefined()
    expect(tl.spans[corridorKey(1)].start).toBeGreaterThanOrEqual(4)
    expect(tl.spans[corridorKey(1)].start).toBeLessThan(4.5)
    expect(tl.spans[corridorKey(-1)]).toBeUndefined()
  })

  it('a room is invisible before it arrives and fully built after', () => {
    const tl = liveTimeline()
    const [r] = layoutOf(1).rooms
    liveArrival(tl, r, 0, 3)
    expect(revealProgress(tl, floorKey(r.id), 3)).toBe(0)
    expect(revealProgress(tl, floorKey(r.id), 3 + LIVE_ROOM_DUR + 0.01)).toBe(1)
    const mid = revealProgress(tl, floorKey(r.id), 3 + 0.3 * LIVE_ROOM_DUR * 0.5)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)
  })

  it('has no end until it is told the build is over, then descends after the last room finishes', () => {
    const tl = liveTimeline()
    expect(tl.total).toBe(Infinity)
    expect(tl.descentStart).toBe(Infinity)
    const layout = layoutOf(2)
    layout.rooms.forEach((r, i) => liveArrival(tl, r, i, i * 1.5))
    expect(tl.total).toBe(Infinity)
    const lastEnd = Math.max(...Object.values(tl.spans).map((s) => s.end))
    // `done` llega antes de que termine la última sala: el descenso espera.
    liveFinish(tl, 2)
    expect(tl.descentStart).toBeCloseTo(lastEnd)
    expect(tl.total).toBeCloseTo(lastEnd + DESCENT_DUR)
    // `done` llega mucho después: el descenso empieza en ese instante.
    const tl2 = liveTimeline()
    liveArrival(tl2, layout.rooms[0], 0, 0)
    liveFinish(tl2, 30)
    expect(tl2.descentStart).toBe(30)
  })
})

describe('live intro store', () => {
  beforeEach(() => resetIntroForTests())

  it('registers arrivals at the current intro clock', () => {
    expect(beginBuildIntro()).toBe(true)
    const layout = layoutOf(2)
    introState.t = 1.25
    introRoomArrived(layout.rooms[0], 0)
    introState.t = 4.5
    introRoomArrived(layout.rooms[1], 1)
    const spans = introState.timeline!.spans
    expect(spans[floorKey('r0')].start).toBe(1.25)
    expect(spans[floorKey('r1')].start).toBe(4.5)
    expect(useIntro.getState()).toMatchObject({ phase: 'playing', building: true, arrived: 2 })
  })

  it('introBuildDone schedules the descent and stops "building"', () => {
    beginBuildIntro()
    introRoomArrived(layoutOf(1).rooms[0], 0)
    introState.t = 0.5
    introBuildDone()
    expect(introState.buildDone).toBe(true)
    expect(Number.isFinite(introState.timeline!.total)).toBe(true)
    expect(useIntro.getState().building).toBe(false)
  })

  it('skip is ignored until a room exists, then asks the camera to jump to the latest state', () => {
    beginBuildIntro()
    skipIntro()
    expect(introState.skipRequested).toBe(false)
    introRoomArrived(layoutOf(1).rooms[0], 0)
    skipIntro()
    expect(introState.skipRequested).toBe(true)
    expect(introState.active).toBe(true) // lo atiende la cámara en su siguiente frame
  })

  it('skip after done jumps to the end of the descent like the fixed intro', () => {
    beginBuildIntro()
    introRoomArrived(layoutOf(1).rooms[0], 0)
    introBuildDone()
    skipIntro()
    expect(introState.t).toBe(introState.timeline!.total)
  })

  it('reduced motion: no flight, a fade per room, and playing until the build ends', () => {
    expect(beginBuildIntro({ reducedMotion: true })).toBe(false)
    expect(introState.active).toBe(false)
    expect(useIntro.getState()).toMatchObject({ phase: 'playing', reduced: true, building: true })
    introRoomArrived(layoutOf(1).rooms[0], 0)
    expect(useIntro.getState().arrived).toBe(1)
    skipIntro()
    expect(useIntro.getState().phase).toBe('done')
  })

  it('abort leaves fixed mode so the next palace gets its normal intro', () => {
    beginBuildIntro()
    introState.popin = true
    abortIntro()
    expect(introState.mode).toBe('fixed')
    expect(introState.popin).toBe(false)
    expect(introState.active).toBe(false)
  })
})

describe('live camera', () => {
  it('frames an empty site and follows the growing palace smoothly', () => {
    const empty = frameOf(emptyLayout().bounds)
    expect(Number.isFinite(buildAerialPose(empty, 0).pos[1])).toBe(true)
    let frame = empty
    const target = frameOf(layoutOf(6).bounds)
    const radii: number[] = [frame.R]
    for (let i = 0; i < 120; i++) {
      frame = stepFrame(frame, target, 1 / 60)
      radii.push(frame.R)
    }
    // Crece de forma monótona y sin pasarse del objetivo.
    for (let i = 1; i < radii.length; i++) expect(radii[i]).toBeGreaterThanOrEqual(radii[i - 1])
    expect(radii[radii.length - 1]).toBeLessThanOrEqual(target.R)
    expect(radii[radii.length - 1]).toBeGreaterThan(target.R * 0.8)
    // Un solo paso nunca salta de golpe.
    expect(radii[1] - radii[0]).toBeLessThan((target.R - empty.R) * 0.1)
  })

  it('descends from the last aerial pose to the spawn at eye height, ending looking ahead', () => {
    const layout = layoutOf(3)
    const from = buildAerialPose(frameOf(layout.bounds), 6)
    const start = buildDescentPose(from, layout.spawn, 0)
    expect(start.pos).toEqual(from.pos)
    const end = buildDescentPose(from, layout.spawn, 1)
    expect(end.pos[0]).toBeCloseTo(layout.spawn.x)
    expect(end.pos[2]).toBeCloseTo(layout.spawn.z)
    expect(end.pos[1]).toBeCloseTo(1.7)
  })
})
