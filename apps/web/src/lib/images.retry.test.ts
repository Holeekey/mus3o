import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchResolvedImage } from './images'

const resolved = {
  src: '/api/image/file?u=x',
  width: 960,
  height: 640,
  title: 'Codón',
  artist: '',
  license: 'Ver fuente',
  sourceUrl: 'https://es.wikipedia.org',
  kind: 'photo',
}

describe('fetchResolvedImage', () => {
  let responses: Response[]
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    fetchMock = vi.fn(async () => responses.shift() ?? new Response('{}', { status: 502 }))
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('retries transient server errors until the image resolves', async () => {
    responses = [new Response('{}', { status: 502 }), new Response(JSON.stringify(resolved))]
    const pending = fetchResolvedImage({ wikiTitle: 'Codón' })
    await vi.runAllTimersAsync()
    expect(await pending).toMatchObject({ title: 'Codón' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('gives up after three attempts and forgets the failure so it can be asked again', async () => {
    responses = []
    const pending = fetchResolvedImage({ wikiTitle: 'Transcripción' })
    await vi.runAllTimersAsync()
    expect(await pending).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(3)
    responses = [new Response(JSON.stringify(resolved))]
    expect(await fetchResolvedImage({ wikiTitle: 'Transcripción' })).toMatchObject({ title: 'Codón' })
  })

  it('does not retry when there is simply no image', async () => {
    responses = [new Response('{}', { status: 404 })]
    const pending = fetchResolvedImage({ wikiTitle: 'ATP' })
    await vi.runAllTimersAsync()
    expect(await pending).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
