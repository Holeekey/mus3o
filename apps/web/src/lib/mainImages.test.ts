import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImageSearch, ResolvedImage } from '@mus3o/shared'
import { decideMainImage, imageIdentities, peekMainImage, resetMainImages } from './images'

// Imagen simulada por título de Wikipedia: `file` es el archivo de Wikimedia; dos títulos pueden devolver el mismo.
type Fake = { file: string; title: string; delay?: number }
let table: Record<string, Fake | null> = {}
const calls: string[] = []

const proxied = (file: string, thumb = true) =>
  '/api/image/file?u=' +
  encodeURIComponent(
    thumb
      ? `https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/${file}/960px-${file}?utm_source=commons.wikimedia.org&utm_campaign=imageinfo`
      : `https://upload.wikimedia.org/wikipedia/commons/a/ab/${file}`,
  )
const image = (f: Fake): ResolvedImage => ({ src: proxied(f.file), width: 960, height: 600, title: f.title, artist: '', license: 'CC0', sourceUrl: '', kind: 'photo' })
const search = (wikiTitle: string): ImageSearch => ({ wikiTitle, lang: 'es', context: 'Palacio' })

beforeEach(() => {
  resetMainImages()
  calls.length = 0
  vi.stubGlobal('fetch', async (input: string) => {
    const wiki = new URLSearchParams(String(input).split('?')[1]).get('wiki') ?? ''
    calls.push(wiki)
    const hit = table[wiki]
    if (hit?.delay) await new Promise((r) => setTimeout(r, hit.delay))
    return hit ? new Response(JSON.stringify(image(hit)), { status: 200 }) : new Response('{}', { status: 404 })
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('imageIdentities', () => {
  it('sees the same file behind different thumbnail sizes, tracking params and hosts', () => {
    const a = imageIdentities(image({ file: 'Bastille.jpg', title: 'Toma de la Bastilla' }))
    const b = imageIdentities({ ...image({ file: 'Bastille.jpg', title: 'Otro título' }), src: proxied('Bastille.jpg', false) })
    expect(a[0]).toBe(b[0])
    expect(a[1]).not.toBe(b[1])
  })
})

describe('main painting is unique within a palace', () => {
  it('the second room with the same image falls back to its first piece image, in room order', async () => {
    table = {
      'Antecedentes A': { file: 'Relaciones.jpg', title: 'Relaciones Estados Unidos-Venezuela' },
      'Despliegue A': { file: 'Relaciones.jpg', title: 'Relaciones Estados Unidos-Venezuela' }, // mismo artículo
      'Armada A': { file: 'Armada.jpg', title: 'Operación naval' },
      'Lanchas A': { file: 'Lanchas.jpg', title: 'Ataques a lanchas' },
    }
    const a = decideMainImage('r1', search('Antecedentes A'))
    const b = decideMainImage('r2', search('Despliegue A'), [search('Armada A'), search('Lanchas A')])
    expect((await a)?.title).toBe('Relaciones Estados Unidos-Venezuela')
    expect((await b)?.title).toBe('Operación naval')
    expect(peekMainImage('r2', search('Despliegue A'))?.title).toBe('Operación naval')
  })

  it('is deterministic even when the later room answers first', async () => {
    table = {
      'Primera B': { file: 'Mismo.jpg', title: 'Mismo', delay: 60 },
      'Segunda B': { file: 'Mismo.jpg', title: 'Mismo', delay: 0 },
      'Pieza B': { file: 'Pieza.jpg', title: 'Pieza' },
    }
    // Se registran en orden de sala; la primera responde más tarde que la segunda.
    const first = decideMainImage('s1', search('Primera B'))
    const second2 = decideMainImage('s2', search('Segunda B'), [search('Pieza B')])
    expect((await first)?.title).toBe('Mismo')
    expect((await second2)?.title).toBe('Pieza')
  })

  it('skips piece images already used by another main painting, and ends in no image (plaster) when nothing is free', async () => {
    table = {
      'Sala1 C': { file: 'Uno.jpg', title: 'Uno' },
      'Sala2 C': { file: 'Dos.jpg', title: 'Dos' },
      'Sala3 C': { file: 'Uno.jpg', title: 'Uno' },
      'Pieza1 C': { file: 'Dos.jpg', title: 'Dos' }, // ya es el principal de la sala 2
      'Pieza2 C': { file: 'Uno.jpg', title: 'Otro nombre' }, // mismo archivo que la sala 1
      'Pieza3 C': null,
    }
    await decideMainImage('c1', search('Sala1 C'))
    await decideMainImage('c2', search('Sala2 C'))
    const third = await decideMainImage('c3', search('Sala3 C'), [search('Pieza1 C'), search('Pieza2 C'), search('Pieza3 C')])
    expect(third).toBeNull()
    expect(peekMainImage('c3', search('Sala3 C'))).toBeNull()
  })

  it('a room whose own search has no image stays without one (no borrowing from pieces)', async () => {
    table = { 'Sin imagen D': null, 'Pieza D': { file: 'PiezaD.jpg', title: 'Pieza D' } }
    expect(await decideMainImage('d1', search('Sin imagen D'), [search('Pieza D')])).toBeNull()
  })

  it('decides each room once and forgets everything on reset', async () => {
    table = { 'Sala E': { file: 'E.jpg', title: 'E' } }
    const first = await decideMainImage('e1', search('Sala E'))
    expect(await decideMainImage('e1', search('Sala E'))).toBe(first)
    resetMainImages()
    // otro palacio: el mismo archivo vuelve a estar libre
    expect((await decideMainImage('e2', search('Sala E')))?.title).toBe('E')
  })
})
