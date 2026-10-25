import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LIMITS, type Museum, type Piece, type Room } from '@mus3o/shared'
import { newBuildSession } from '../build/session'
import { introState, resetIntroForTests, useIntro } from '../intro/store'
import { floorKey } from '../intro/timeline'
import { palaceKey } from '../memory/model'
import { useMemory } from '../memory/store'
import { IDLE_BUILD, useStore } from '../store'

vi.hoisted(() => {
  const data = new Map<string, string>()
  const localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
  Object.assign(globalThis, { window: { localStorage } })
})

const piece = (id: string): Piece => ({ id, title: `Concepto ${id}`, text: '', fact: '' })
const room = (id: string, pieces = 2): Room => ({
  id,
  name: `Sala ${id}`,
  description: '',
  pieces: Array.from({ length: pieces }, (_, k) => piece(`${id}${k + 1}`)),
})
const ids = ['a', 'b', 'c']
const final = (): Museum => ({
  title: 'Final',
  rooms: ids.map((id) => room(id)),
  graph: {
    start: 'a',
    edges: [
      { from: 'a', to: 'b', kind: 'next' },
      { from: 'b', to: 'c', kind: 'next' },
      { from: 'a', to: 'c', kind: 'prerequisite' },
    ],
  },
})

const state = () => useStore.getState()

beforeEach(() => {
  resetIntroForTests()
  useStore.setState({ screen: 'landing', palace: null, layout: null, memorized: {}, exam: {}, roomKeys: {}, build: IDLE_BUILD })
})

describe('building store actions', () => {
  it('enters the palace screen at once with an empty site and the aerial intro running', () => {
    state().beginBuildingPalace({ title: 'Volcanes' })
    expect(state().screen).toBe('palace')
    expect(state().palace?.title).toBe('Volcanes')
    expect(state().palace?.rooms).toHaveLength(0)
    expect(state().layout?.rooms).toHaveLength(0)
    expect(state().build.status).toBe('building')
    expect(introState.mode).toBe('build')
    expect(introState.active).toBe(true)
    expect(useIntro.getState()).toMatchObject({ phase: 'playing', building: true, arrived: 0 })
  })

  it('grows the palace and layout room by room without moving the rooms already there', () => {
    state().beginBuildingPalace({ title: 'T' })
    const snapshots: Array<{ x: number; z: number; ref: unknown }[]> = []
    for (const id of ids) {
      state().addBuiltRoom(room(id))
      snapshots.push(state().layout!.rooms.map((r) => ({ x: r.x, z: r.z, ref: r })))
    }
    expect(state().palace?.rooms.map((r) => r.id)).toEqual(ids)
    expect(state().layout?.rooms.map((r) => r.id)).toEqual(ids)
    snapshots.forEach((snap, k) => {
      if (k === 0) return
      // Las salas de antes conservan posición (y, salvo la última, hasta el objeto).
      snapshots[k - 1].forEach((prev, i) => {
        expect([snap[i].x, snap[i].z]).toEqual([prev.x, prev.z])
      })
    })
    // El grafo parcial es válido: encadenado por orden de llegada.
    expect(state().palace?.graph).toEqual({
      start: 'a',
      edges: [
        { from: 'a', to: 'b', kind: 'next' },
        { from: 'b', to: 'c', kind: 'next' },
      ],
    })
    expect(state().build.rooms).toBe(3)
  })

  it('starts each room reveal when the room arrives (intro clock), before it is published', () => {
    state().beginBuildingPalace({ title: 'T' })
    introState.t = 1.5
    state().addBuiltRoom(room('a'))
    introState.t = 3.25
    state().addBuiltRoom(room('b'))
    expect(introState.timeline!.spans[floorKey('a')].start).toBe(1.5)
    expect(introState.timeline!.spans[floorKey('b')].start).toBe(3.25)
    expect(useIntro.getState().arrived).toBe(2)
  })

  it('ignores duplicate rooms and rooms past the limit', () => {
    state().beginBuildingPalace({ title: 'T' })
    state().addBuiltRoom(room('a'))
    state().addBuiltRoom(room('a'))
    for (let i = 0; i < LIMITS.maxRooms + 4; i++) state().addBuiltRoom(room(`x${i}`))
    expect(state().palace?.rooms.length).toBe(LIMITS.maxRooms)
  })

  it('arriving rooms only get hand-made library dioramas: never a world composed from their concepts', () => {
    state().beginBuildingPalace({ title: 'T' })
    for (const r of ids.map((id) => room(id))) {
      state().addBuiltRoom(r)
      const arrived = state().palace!.rooms[state().palace!.rooms.length - 1]
      // Las salas de prueba no encajan con la biblioteca: su cuadro pide recrear su foto real al resolverse (usePhotoDiorama).
      expect(arrived.diorama).toBeUndefined()
      expect(state().layout!.rooms[state().layout!.rooms.length - 1].diorama).toBeUndefined()
    }
  })

  it('at the end the rooms keep their live dioramas and receive the final content (3D models) without moving', () => {
    state().beginBuildingPalace({ title: 'T' })
    for (const r of ids.map((id) => room(id))) state().addBuiltRoom(r)
    const live = state().palace!.rooms.map((r) => r.diorama)
    const withModels: Museum = {
      ...final(),
      rooms: ids.map((id) => ({ ...room(id), pieces: room(id).pieces.map((p) => ({ ...p, model: { type: 'catalog' as const, id: 'torch' } })) })),
    }
    const before = state().layout!.rooms.map((r) => [r.x, r.z])
    state().finishBuildingPalace(withModels)
    expect(state().palace!.rooms.map((r) => r.diorama)).toEqual(live)
    const after = state().layout!
    expect(after.rooms.map((r) => [r.x, r.z])).toEqual(before)
    expect(after.rooms.every((r) => r.pedestals.every((p) => p.concept.model?.type === 'catalog'))).toBe(true)
  })

  it('does not record progress while the key of the palace is still undefined', () => {
    state().beginBuildingPalace({ title: 'T' })
    state().addBuiltRoom(room('a'))
    state().toggleMemorized('a1')
    state().recordExam('a1', 'ok')
    expect(state().memorized).toEqual({})
    expect(state().exam).toEqual({})
  })

  it('finishing yields the same progress and key state as entering the final museum directly', () => {
    const museum = final()
    // Un palacio con la misma clave y un concepto ya aprendido en una sesión anterior.
    useMemory.getState().learn(palaceKey(museum), 'a1')

    state().enterPalace(museum)
    const direct = { palace: state().palace, memorized: state().memorized, roomKeys: state().roomKeys, exam: state().exam, lastKeyRoomId: state().lastKeyRoomId }

    state().exitToLanding()
    state().beginBuildingPalace({ title: 'Final' })
    for (const r of museum.rooms) state().addBuiltRoom(r)
    state().finishBuildingPalace(museum)

    expect(state().build.status).toBe('done')
    expect(state().palace).toEqual(direct.palace)
    expect(palaceKey(state().palace!)).toBe(palaceKey(museum))
    expect(state().memorized).toEqual(direct.memorized)
    expect(state().memorized).toEqual({ a1: true })
    expect(state().roomKeys).toEqual(direct.roomKeys)
    expect(state().exam).toEqual(direct.exam)
    expect(state().lastKeyRoomId).toBe(direct.lastKeyRoomId)
    expect(state().screen).toBe('palace')
  })

  it('keeps every room where it was at the end (final layout is the incremental one)', () => {
    state().beginBuildingPalace({ title: 'T' })
    const museum = final()
    for (const r of museum.rooms) state().addBuiltRoom(r)
    const before = state().layout!.rooms.map((r) => [r.id, r.x, r.z, r.w, r.d])
    const spawn = state().layout!.spawn
    state().finishBuildingPalace(museum)
    const after = state().layout!
    expect(after.rooms.map((r) => [r.id, r.x, r.z, r.w, r.d])).toEqual(before)
    expect(after.spawn).toBe(spawn)
    // La última sala ya no tiene la puerta reservada ni el muro invisible.
    expect(after.rooms[2].doors).toHaveLength(1)
    expect(after.colliders.filter((c) => c.h === 3)).toHaveLength(0)
    expect(introState.buildDone).toBe(true)
  })

  it('adds a room the stream skipped when the final museum arrives', () => {
    state().beginBuildingPalace({ title: 'T' })
    state().addBuiltRoom(room('a'))
    state().finishBuildingPalace(final())
    expect(state().layout?.rooms.map((r) => r.id)).toEqual(ids)
    expect(state().palace?.rooms.map((r) => r.id)).toEqual(ids)
  })

  it('keeps the rooms already built when the stream is cut, with a quiet notice', () => {
    state().beginBuildingPalace({ title: 'T' })
    state().addBuiltRoom(room('a'))
    state().addBuiltRoom(room('b'))
    state().failBuildingPalace('x')
    expect(state().screen).toBe('palace')
    expect(state().build.status).toBe('cut')
    expect(state().build.notice).toBe('Aris se interrumpió; tu museo quedó con 2 salas')
    expect(state().palace?.rooms).toHaveLength(2)
    expect(state().layout?.colliders.filter((c) => c.h === 3)).toHaveLength(0)
    expect(introState.buildDone).toBe(true)
  })

  it('goes back to the landing, with the old palace and the error, when nothing was built', () => {
    state().enterPalace(final())
    // enterPalace completa los dioramas: el palacio de antes es el que quedó guardado.
    const before = state().palace
    state().exitToLanding()
    state().beginBuildingPalace({ title: 'T' })
    state().failBuildingPalace('Aris no pudo generar el museo.')
    expect(state().screen).toBe('landing')
    expect(state().palace).toEqual(before)
    expect(state().build.error).toBe('Aris no pudo generar el museo.')
    expect(state().build.status).toBe('idle')
    expect(introState.mode).toBe('fixed')
    state().clearBuildError()
    expect(state().build.error).toBeNull()
  })

  it('leaving the palace mid-build cuts the model connection and restores the previous palace', () => {
    state().enterPalace(final())
    // enterPalace completa los dioramas: el palacio de antes es el que quedó guardado.
    const before = state().palace
    state().exitToLanding()
    state().beginBuildingPalace({ title: 'T' })
    const live = newBuildSession()
    state().exitToLanding()
    expect(live.signal.aborted).toBe(true)
    expect(state().screen).toBe('landing')
    expect(state().palace).toEqual(before)
    expect(state().build.status).toBe('idle')
  })

  it('late events after leaving are ignored', () => {
    state().beginBuildingPalace({ title: 'T' })
    state().exitToLanding()
    state().addBuiltRoom(room('a'))
    state().finishBuildingPalace(final())
    expect(state().screen).toBe('landing')
    expect(state().build.status).toBe('idle')
  })

  it('a normal palace entered afterwards gets the regular fixed intro mode', () => {
    state().beginBuildingPalace({ title: 'T' })
    state().addBuiltRoom(room('a'))
    state().finishBuildingPalace(final())
    state().exitToLanding()
    expect(introState.mode).toBe('fixed')
    state().enterPalace(final())
    expect(state().build.status).toBe('idle')
  })
})
