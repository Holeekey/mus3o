import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Museum, MuseumStreamEvent, Room } from '@mus3o/shared'

vi.hoisted(() => {
  const data = new Map<string, string>()
  const localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
  Object.assign(globalThis, { window: { localStorage } })
})

const api = vi.hoisted(() => ({
  generateMuseumStream: vi.fn(),
  generateMuseum: vi.fn(),
  generateMuseumFromFilesStream: vi.fn(),
  generateMuseumFromFiles: vi.fn(),
}))
const prefetched = vi.hoisted(() => [] as string[])

vi.mock('../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api')>()),
  generateMuseumStream: api.generateMuseumStream,
  generateMuseum: api.generateMuseum,
  generateMuseumFromFilesStream: api.generateMuseumFromFilesStream,
  generateMuseumFromFiles: api.generateMuseumFromFiles,
}))
vi.mock('../lib/images', () => ({ prefetchRoomImages: (room: Room) => void prefetched.push(room.id), resetMainImages: () => {} }))

import { ApiError } from '../lib/api'
import { resetIntroForTests } from '../intro/store'
import { IDLE_BUILD, useStore } from '../store'
import { startLiveBuild, type LiveBuildRequest } from './liveBuild'

const room = (id: string): Room => ({
  id,
  name: `Sala ${id}`,
  description: '',
  pieces: [{ id: `${id}1`, title: `C${id}`, text: '', fact: '' }],
})
const museum = (): Museum => ({
  title: 'Final',
  rooms: [room('a'), room('b'), room('c')],
  graph: {
    start: 'a',
    edges: [
      { from: 'a', to: 'b', kind: 'next' },
      { from: 'b', to: 'c', kind: 'next' },
    ],
  },
})

async function* events(list: Array<MuseumStreamEvent | Error>): AsyncGenerator<MuseumStreamEvent> {
  for (const e of list) {
    if (e instanceof Error) throw e
    yield e
  }
}

const state = () => useStore.getState()
const text = (value: string): LiveBuildRequest => ({ kind: 'text', text: value })

beforeEach(() => {
  resetIntroForTests()
  prefetched.length = 0
  api.generateMuseumStream.mockReset()
  api.generateMuseum.mockReset()
  api.generateMuseumFromFilesStream.mockReset()
  api.generateMuseumFromFiles.mockReset()
  useStore.setState({ screen: 'landing', palace: null, layout: null, memorized: {}, exam: {}, roomKeys: {}, build: IDLE_BUILD })
  vi.stubGlobal('matchMedia', undefined)
})

describe('startLiveBuild', () => {
  it('builds room by room, prefetches each room as it arrives and finishes with the full museum', async () => {
    const m = museum()
    const seen: number[] = []
    api.generateMuseumStream.mockImplementation(async function* () {
      yield { type: 'meta', title: 'Volcanes' } as const
      for (const r of m.rooms) {
        yield { type: 'room', room: r } as const
        seen.push(state().palace?.rooms.length ?? -1)
      }
      yield { type: 'done', museum: m } as const
    })
    await startLiveBuild(text('Volcanes'))
    // Cada sala estaba publicada en cuanto el generador siguió adelante.
    expect(seen).toEqual([1, 2, 3])
    expect(prefetched).toEqual(['a', 'b', 'c'])
    expect(state().build.status).toBe('done')
    expect(state().palace?.title).toBe('Final')
    expect(state().screen).toBe('palace')
  })

  it('enters the palace screen before the first event arrives', async () => {
    let screenWhenStreamOpened = ''
    api.generateMuseumStream.mockImplementation(async function* () {
      screenWhenStreamOpened = state().screen
      yield { type: 'done', museum: museum() } as const
    })
    await startLiveBuild(text('Volcanes'))
    expect(screenWhenStreamOpened).toBe('palace')
  })

  it('keeps what the user typed as source text for the citations', async () => {
    api.generateMuseumStream.mockImplementation(() => events([{ type: 'done', museum: museum() }]))
    await startLiveBuild(text('apuntes\ncon varias líneas'))
    expect(state().sourceText).toBe('apuntes\ncon varias líneas')
    await startLiveBuild(text('Volcanes'))
    expect(state().sourceText).toBe('Volcanes')
  })

  it('places each room from the edges that come with it and ends with the final graph', async () => {
    const m = museum()
    api.generateMuseumStream.mockImplementation(async function* () {
      yield { type: 'room', room: m.rooms[0] } as const
      yield { type: 'room', room: m.rooms[1], edges: [{ from: 'a', to: 'b', kind: 'related' }] } as const
      yield { type: 'room', room: m.rooms[2], edges: [{ from: 'a', to: 'c', kind: 'related' }] } as const
      yield { type: 'done', museum: { ...m, graph: { start: 'a', edges: [{ from: 'a', to: 'b', kind: 'related' }, { from: 'a', to: 'c', kind: 'related' }] } } } as const
    })
    await startLiveBuild(text('Volcanes'))
    // b y c cuelgan del hub: las dos puertas salen de a.
    expect(state().layout?.doors.map((d) => d.fromRoomId)).toEqual(['a', 'a'])
    expect(state().palace?.graph?.edges.map((e) => e.from)).toEqual(['a', 'a'])
  })

  it('files: streams the full-flow request with its attachments and keeps the user images', async () => {
    api.generateMuseumFromFilesStream.mockImplementation(() => events([{ type: 'room', room: room('a') }, { type: 'done', museum: museum() }]))
    await startLiveBuild({ kind: 'files', prompt: 'Roma', sources: [], images: [], text: 'Roma', userImages: { 'img-1': 'blob:x' } })
    expect(api.generateMuseumFromFilesStream).toHaveBeenCalledTimes(1)
    expect(api.generateMuseumStream).not.toHaveBeenCalled()
    expect(state().userImages).toEqual({ 'img-1': 'blob:x' })
    expect(state().build.status).toBe('done')
  })

  it('files: falls back to the non-streaming full-flow request when the stream fails before any room', async () => {
    api.generateMuseumFromFilesStream.mockImplementation(() => events([new ApiError('boom', 502)]))
    api.generateMuseumFromFiles.mockResolvedValue(museum())
    vi.useFakeTimers()
    const done = startLiveBuild({ kind: 'files', prompt: 'Roma', sources: [], images: [], text: 'Roma', userImages: {} })
    await vi.runAllTimersAsync()
    await done
    vi.useRealTimers()
    expect(api.generateMuseumFromFiles).toHaveBeenCalledTimes(1)
    expect(state().build.status).toBe('done')
  })

  it('does not retry without streaming when the AI is not configured or the user is rate limited', async () => {
    api.generateMuseumStream.mockImplementation(() => events([new ApiError('IA no configurada', 503)]))
    await startLiveBuild(text('Volcanes'))
    expect(api.generateMuseum).not.toHaveBeenCalled()
    expect(state().screen).toBe('landing')
  })

  it('mid-stream failure keeps the rooms and tells the user quietly', async () => {
    api.generateMuseumStream.mockImplementation(() =>
      events([{ type: 'meta', title: 'T' }, { type: 'room', room: room('a') }, { type: 'room', room: room('b') }, { type: 'error', message: 'x', status: 502 }]),
    )
    await startLiveBuild(text('Volcanes'))
    expect(state().screen).toBe('palace')
    expect(state().palace?.rooms).toHaveLength(2)
    expect(state().build.status).toBe('cut')
    expect(state().build.notice).toBe('La IA se cortó; tu museo tiene 2 salas')
  })

  it('a dropped connection after some rooms is also a cut', async () => {
    api.generateMuseumStream.mockImplementation(() => events([{ type: 'room', room: room('a') }, new ApiError('Se cortó la conexión con la IA', 502)]))
    await startLiveBuild(text('Volcanes'))
    expect(state().build.status).toBe('cut')
    expect(state().build.notice).toBe('La IA se cortó; tu museo tiene 1 sala')
  })

  it('failure before any room returns to the landing with the usual message', async () => {
    api.generateMuseumStream.mockImplementation(() => events([new ApiError('IA no configurada', 503)]))
    await startLiveBuild(text('Volcanes'))
    expect(state().screen).toBe('landing')
    expect(state().build.error).toContain('no está configurada')
    api.generateMuseumStream.mockImplementation(() => events([{ type: 'error', message: 'x', status: 429 }]))
    await startLiveBuild(text('Volcanes'))
    expect(state().build.error).toContain('Demasiadas')
  })

  it('falls back to the non-streaming endpoint (and still builds room by room) when the server has no stream route', async () => {
    api.generateMuseumStream.mockImplementation(() => events([new ApiError('No encontrado', 404)]))
    api.generateMuseum.mockResolvedValue(museum())
    vi.useFakeTimers()
    const done = startLiveBuild(text('Volcanes'))
    await vi.runAllTimersAsync()
    await done
    vi.useRealTimers()
    expect(api.generateMuseum).toHaveBeenCalledTimes(1)
    expect(state().build.status).toBe('done')
    expect(state().palace?.rooms.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('stops quietly when the user leaves the palace mid-build', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    api.generateMuseumStream.mockImplementation(async function* () {
      yield { type: 'room', room: room('a') } as const
      await gate
      yield { type: 'room', room: room('b') } as const
      yield { type: 'done', museum: museum() } as const
    })
    const running = startLiveBuild(text('Volcanes'))
    await vi.waitFor(() => expect(state().palace?.rooms).toHaveLength(1))
    state().exitToLanding()
    release()
    await running
    expect(state().screen).toBe('landing')
    expect(state().build.status === 'idle' || state().build.status === 'cut').toBe(true)
    expect(state().palace?.rooms.length).toBeLessThanOrEqual(1)
  })
})
