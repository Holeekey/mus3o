import { describe, expect, it, vi } from 'vitest'
import type { Room } from '@mus3o/shared'
import { createPhotoDioramaClient, usePhotoDioramaStore, wikimediaUrlOf, type PhotoRequest } from './photoDiorama'
import { attachDioramasToArrivingRoom, attachDioramasToFinalMuseum } from '../palace/liveDioramas'
import { historiaMuseum } from '../mocks/historia'

const SRC = (name: string) => `/api/image/file?u=${encodeURIComponent(`https://upload.wikimedia.org/wikipedia/commons/a/ab/${name}.jpg`)}`
const req = (name: string, extra: Partial<PhotoRequest> = {}): PhotoRequest => ({ imageUrl: wikimediaUrlOf(SRC(name))!, title: name, roomTitle: 'Sala', concepts: [], ...extra })

const DIORAMA = {
  title: 'Escena',
  terrain: 'plain',
  time: 'day',
  palette: { ground: '#8a9a5b', sky: '#9fc4e8', accent: '#c9963a' },
  props: [{ kind: 'tree', pos: [0, 0], label: 'árboles' }],
}
const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

describe('wikimediaUrlOf', () => {
  it('extracts the Wikimedia file behind the image proxy', () => {
    expect(wikimediaUrlOf(SRC('Carabobo'))).toBe('https://upload.wikimedia.org/wikipedia/commons/a/ab/Carabobo.jpg')
  })
  it('ignores user uploads and anything that is not the proxy', () => {
    expect(wikimediaUrlOf('blob:http://localhost/abc')).toBeNull()
    expect(wikimediaUrlOf('data:image/png;base64,AAAA')).toBeNull()
    expect(wikimediaUrlOf('https://evil.example/a.jpg')).toBeNull()
    expect(wikimediaUrlOf('/api/image/file?u=http%3A%2F%2Fupload.wikimedia.org%2Fa.jpg')).toBeNull()
    expect(wikimediaUrlOf(undefined)).toBeNull()
  })
})

describe('photo diorama client', () => {
  it('a room whose image is not a scene gets no diorama (no portal)', async () => {
    const fetchFn = vi.fn(async () => ok({ recreatable: false, reason: 'Retrato' }))
    const client = createPhotoDioramaClient({ fetchFn: fetchFn as unknown as typeof fetch })
    expect(await client.request(req('Retrato'))).toBeNull()
    expect(client.peek(req('Retrato').imageUrl)).toBeNull() // decisión firme: no se vuelve a pedir
    await client.request(req('Retrato'))
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('returns the validated diorama when the image is a scene', async () => {
    const before = usePhotoDioramaStore.getState().ready
    const client = createPhotoDioramaClient({ fetchFn: (async () => ok({ recreatable: true, diorama: DIORAMA })) as unknown as typeof fetch })
    const d = await client.request(req('Batalla'))
    expect(d?.props[0].label).toBe('árboles')
    expect(usePhotoDioramaStore.getState().ready).toBe(before + 1)
    expect(await client.request(req('Batalla'))).toBe(d) // el mismo objeto: el modelo 3D se cachea por objeto
  })

  it('never runs more than 2 requests at once and shares identical ones', async () => {
    let running = 0
    let peak = 0
    const fetchFn = vi.fn(async () => {
      running++
      peak = Math.max(peak, running)
      await new Promise((r) => setTimeout(r, 15))
      running--
      return ok({ recreatable: true, diorama: DIORAMA })
    })
    const client = createPhotoDioramaClient({ fetchFn: fetchFn as unknown as typeof fetch })
    const names = ['a', 'b', 'c', 'd', 'e', 'f']
    await Promise.all([...names, 'a', 'b'].map((n) => client.request(req(n))))
    expect(peak).toBe(2)
    expect(fetchFn).toHaveBeenCalledTimes(names.length)
  })

  it("serves the player's room first", async () => {
    const order: string[] = []
    const fetchFn = vi.fn(async (_u: string, init: RequestInit) => {
      order.push(JSON.parse(String(init.body)).title)
      await new Promise((r) => setTimeout(r, 10))
      return ok({ recreatable: true, diorama: DIORAMA })
    })
    const client = createPhotoDioramaClient({ fetchFn: fetchFn as unknown as typeof fetch, currentRoomId: () => 'r4' })
    await Promise.all(['r1', 'r2', 'r3', 'r4'].map((n) => client.request(req(n, { roomId: n }))))
    expect(order.slice(0, 2)).toEqual(['r1', 'r2']) // arrancan al llegar
    expect(order[2]).toBe('r4') // al liberarse un cupo, primero la sala del jugador
  })

  it('degrades to a plain painting when the AI is unavailable, and backs off before retrying', async () => {
    let t = 0
    const fetchFn = vi.fn(async () => ok({ error: 'IA no configurada' }, 503))
    const client = createPhotoDioramaClient({ fetchFn: fetchFn as unknown as typeof fetch, now: () => t })
    expect(await client.request(req('X'))).toBeNull()
    expect(client.peek(req('X').imageUrl)).toBeUndefined() // no es definitivo
    await client.request(req('X'))
    expect(fetchFn).toHaveBeenCalledTimes(1) // pausa tras el fallo
    t = 61_000
    await client.request(req('X'))
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('treats network errors and garbage responses as no diorama', async () => {
    const boom = createPhotoDioramaClient({ fetchFn: (async () => { throw new Error('net') }) as unknown as typeof fetch })
    expect(await boom.request(req('N'))).toBeNull()
    const junk = createPhotoDioramaClient({ fetchFn: (async () => ok({ nope: true })) as unknown as typeof fetch })
    expect(await junk.request(req('J'))).toBeNull()
  })
})

describe('library dioramas vs generated ones', () => {
  const piece = (id: string, title: string) => ({ id, title, text: 'x', fact: '', model: { type: 'glyph', shape: 'box' } }) as unknown as Room['pieces'][number]
  const room = (id: string, name: string): Room =>
    ({ id, name, pieces: [piece(`${id}-p`, 'Concepto')], position: [0, 0, 0] }) as unknown as Room

  it('a hand-made library diorama still wins where the topic matches', () => {
    const r = attachDioramasToArrivingRoom([], room('c', 'Batalla de Carabobo (1821)'))
    expect(r.diorama?.title).toMatch(/carabobo/i)
  })

  it('rooms without a library match get NO concept-composed diorama anymore', () => {
    const r = attachDioramasToArrivingRoom([], room('t', 'Teoría de conjuntos'))
    expect(r.diorama).toBeUndefined()
    const museum = attachDioramasToFinalMuseum({ ...historiaMuseum, rooms: [room('a', 'Álgebra'), room('b', 'Geometría')] })
    expect(museum.rooms.every((x) => !x.diorama)).toBe(true)
  })
})
