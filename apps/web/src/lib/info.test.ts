import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchWikiInfo, firstSentence, shortUrl } from './info'

describe('firstSentence', () => {
  it('returns the first sentence', () => {
    expect(firstSentence('La mitocondria es un orgánulo. Produce ATP.')).toBe('La mitocondria es un orgánulo.')
  })
  it('does not split after an initial', () => {
    expect(firstSentence('J. A. Páez fue un militar. Nació en 1790.')).toBe('J. A. Páez fue un militar.')
  })
  it('caps a very long sentence', () => {
    expect(firstSentence('palabra '.repeat(80) + '.', 100).endsWith('…')).toBe(true)
  })
})

describe('shortUrl', () => {
  it('drops the protocol', () => expect(shortUrl('https://es.wikipedia.org/wiki/Roma')).toBe('es.wikipedia.org/wiki/Roma'))
})

describe('fetchWikiInfo', () => {
  afterEach(() => vi.unstubAllGlobals())

  const info = { title: 'Roma', extract: 'Roma es una ciudad.', url: 'https://es.wikipedia.org/wiki/Roma', license: 'CC BY-SA 4.0', source: 'Wikipedia' }

  it('validates the response and shares one request', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(info), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const a = fetchWikiInfo({ wikiTitle: 'Roma-a', lang: 'es' })
    const b = fetchWikiInfo({ wikiTitle: 'Roma-a', lang: 'es' })
    expect(await a).toMatchObject({ title: 'Roma' })
    expect(await b).toMatchObject({ title: 'Roma' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns null for 404, and ignores malformed bodies', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })))
    expect(await fetchWikiInfo({ wikiTitle: 'Nada-b' })).toBeNull()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ title: 'x' }), { status: 200 })))
    expect(await fetchWikiInfo({ wikiTitle: 'Raro-c' })).toBeNull()
  })

  it('does not remember transient errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 502 })))
    expect(await fetchWikiInfo({ wikiTitle: 'Err-d' })).toBeNull()
    const ok = vi.fn(async () => new Response(JSON.stringify(info), { status: 200 }))
    vi.stubGlobal('fetch', ok)
    expect(await fetchWikiInfo({ wikiTitle: 'Err-d' })).toMatchObject({ title: 'Roma' })
  })

  it('never asks without a title', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await fetchWikiInfo({ commonsQuery: 'x' })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
