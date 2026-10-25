import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseMus3oDSL, type MuseumStreamEvent } from '@mus3o/shared'
import { ApiError, createLineSplitter, describeAiError, generateMuseumFromFilesStream, generateMuseumStream } from './api'

const museum = parseMus3oDSL(
  [
    'ROOM: r1 | Uno | void | #fff | #000 | torus |',
    'PIECE: A | box | cue',
    'ROOM: r2 | Dos | void | #fff | #000 | torus |',
    'PIECE: B | box | cue',
  ].join('\n'),
  { title: 'T' },
)
const events: MuseumStreamEvent[] = [
  { type: 'meta', title: 'T' },
  { type: 'room', room: museum.rooms[0] },
  { type: 'room', room: museum.rooms[1] },
  { type: 'done', museum },
]
const ndjson = (list: unknown[]) => list.map((e) => JSON.stringify(e)).join('\n') + '\n'

/** Respuesta cuyo cuerpo llega en trozos de `size` caracteres (cortan líneas por la mitad). */
function streamed(text: string, size = 37, status = 200) {
  const encoder = new TextEncoder()
  const chunks = text.match(new RegExp(`[\\s\\S]{1,${size}}`, 'g')) ?? []
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c))
      controller.close()
    },
  })
  return new Response(body, { status, headers: { 'Content-Type': 'application/x-ndjson' } })
}

async function collect(gen: AsyncIterable<MuseumStreamEvent>) {
  const out: MuseumStreamEvent[] = []
  for await (const e of gen) out.push(e)
  return out
}

afterEach(() => vi.unstubAllGlobals())

describe('createLineSplitter', () => {
  it('keeps a partial line until it is completed and drops blank lines', () => {
    const s = createLineSplitter()
    expect(s.push('{"a":1}\n{"b"')).toEqual(['{"a":1}'])
    expect(s.push(':2}\n\n')).toEqual(['{"b":2}'])
    expect(s.push('{"c":3}')).toEqual([])
    expect(s.flush()).toEqual(['{"c":3}'])
    expect(s.flush()).toEqual([])
  })
})

describe('generateMuseumStream', () => {
  it('yields each event as it is read, whatever the chunking, and stops at done', async () => {
    for (const size of [1, 5, 37, 100000]) {
      vi.stubGlobal('fetch', vi.fn(async () => streamed(ndjson(events), size)))
      const got = await collect(generateMuseumStream('Volcanes'))
      expect(got.map((e) => e.type)).toEqual(['meta', 'room', 'room', 'done'])
      expect(got[1]).toEqual(events[1])
    }
  })

  it('posts topics and notes to the stream endpoint', async () => {
    const fetchMock = vi.fn(async () => streamed(ndjson(events)))
    vi.stubGlobal('fetch', fetchMock)
    await collect(generateMuseumStream('Volcanes'))
    await collect(generateMuseumStream('línea uno\nlínea dos'))
    const calls = fetchMock.mock.calls as unknown as Array<[string, { body: string }]>
    expect(calls[0][0]).toBe('/api/generate-museum/stream')
    expect(JSON.parse(calls[0][1].body)).toEqual({ topic: 'Volcanes' })
    expect(JSON.parse(calls[1][1].body)).toEqual({ notes: 'línea uno\nlínea dos' })
  })

  it('keeps the provisional edges that come with a room', async () => {
    const withEdges = [events[0], { ...events[1] }, { type: 'room', room: museum.rooms[1], edges: [{ from: 'r1', to: 'r2', kind: 'related' }] }, events[3]]
    vi.stubGlobal('fetch', vi.fn(async () => streamed(ndjson(withEdges))))
    const got = await collect(generateMuseumStream('x'))
    expect(got[2]).toMatchObject({ type: 'room', edges: [{ from: 'r1', to: 'r2', kind: 'related' }] })
  })

  it('streams the full-flow request (mode, prompt, sources, images) to the same endpoint', async () => {
    const fetchMock = vi.fn(async () => streamed(ndjson(events)))
    vi.stubGlobal('fetch', fetchMock)
    await collect(generateMuseumFromFilesStream({ prompt: 'Roma', sources: [], images: [] }))
    const calls = fetchMock.mock.calls as unknown as Array<[string, { body: string }]>
    expect(calls[0][0]).toBe('/api/generate-museum/stream')
    expect(JSON.parse(calls[0][1].body)).toEqual({ mode: 'exploration', prompt: 'Roma', sources: [], images: [] })
  })

  it('delivers an error event and stops there', async () => {
    const list = [events[0], events[1], { type: 'error', message: 'No se pudo generar el mus3o', status: 502 }]
    vi.stubGlobal('fetch', vi.fn(async () => streamed(ndjson(list))))
    const got = await collect(generateMuseumStream('x'))
    expect(got.map((e) => e.type)).toEqual(['meta', 'room', 'error'])
  })

  it('fails with ApiError(502) after the rooms already delivered when the connection drops without done', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => streamed(ndjson(events.slice(0, 2)))))
    const got: MuseumStreamEvent[] = []
    await expect(
      (async () => {
        for await (const e of generateMuseumStream('x')) got.push(e)
      })(),
    ).rejects.toMatchObject({ status: 502 })
    expect(got.map((e) => e.type)).toEqual(['meta', 'room'])
  })

  it('reports HTTP errors with their status before any event', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'IA no configurada' }), { status: 503 })))
    await expect(collect(generateMuseumStream('x'))).rejects.toMatchObject({ status: 503, message: 'IA no configurada' })
  })

  it('validates every event like any external input', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => streamed(ndjson([{ type: 'room', room: { id: 5 } }]))))
    await expect(collect(generateMuseumStream('x'))).rejects.toBeInstanceOf(ApiError)
    vi.stubGlobal('fetch', vi.fn(async () => streamed('esto no es json\n')))
    await expect(collect(generateMuseumStream('x'))).rejects.toBeInstanceOf(ApiError)
  })

  it('passes the abort signal to fetch', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.signal).toBeDefined()
      return streamed(ndjson(events))
    })
    vi.stubGlobal('fetch', fetchMock)
    const ac = new AbortController()
    await collect(generateMuseumStream('x', ac.signal))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('describeAiError', () => {
  it('maps statuses to the same messages as before streaming', () => {
    expect(describeAiError(503)).toContain('Aris no está disponible')
    expect(describeAiError(429)).toContain('Demasiadas')
    expect(describeAiError(502)).toContain('Aris no pudo generar')
    expect(describeAiError()).toContain('Aris no pudo generar')
  })
})
