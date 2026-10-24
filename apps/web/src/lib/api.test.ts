import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LIMITS, sampleMuseum, type InputImage, type Source } from '@mus3o/shared'
import { DEFAULT_FILES_PROMPT, generateMuseumFromFiles, needsDigest } from './api'

const source = (name: string, size: number): Source => ({ name, kind: 'txt', text: 'a'.repeat(size) })
const image: InputImage = { id: 'img-1', name: 'foto.jpg', mediaType: 'image/jpeg', data: 'aGVsbG8=' }

describe('needsDigest', () => {
  it('sends the files as they are while they fit in the generation limits', () => {
    expect(needsDigest('Biología', [source('a.txt', 5_000), source('b.txt', 5_000)])).toBe(false)
  })

  it('asks for the master prompt when the total text goes over the limit', () => {
    expect(needsDigest('x'.repeat(100), [source('a.txt', LIMITS.maxNotesChars)])).toBe(true)
  })

  it('asks for the master prompt when there are more files than the generation accepts', () => {
    expect(needsDigest('', Array.from({ length: 6 }, (_, i) => source(`${i}.txt`, 10)))).toBe(true)
  })
})

describe('generateMuseumFromFiles', () => {
  let requests: { url: string; body: Record<string, unknown> }[]

  beforeEach(() => {
    requests = []
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body))
      requests.push({ url, body })
      if (url === '/api/digest-sources') return new Response(JSON.stringify({ digest: '# Tema\n- Concepto: idea' }))
      return new Response(JSON.stringify(sampleMuseum))
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('sends small files and images straight to the generation, without the master prompt', async () => {
    const stages: string[] = []
    await generateMuseumFromFiles({ prompt: '  Biología  ', sources: [source('a.txt', 100)], images: [image] }, (s) => stages.push(s))
    expect(requests.map((r) => r.url)).toEqual(['/api/generate-museum'])
    expect(requests[0].body).toEqual({ mode: 'exploration', prompt: 'Biología', sources: [source('a.txt', 100)], images: [image] })
    expect(stages).toEqual(['generating'])
  })

  it('digests large files first and generates from the digest', async () => {
    const stages: string[] = []
    const big = [source('libro.docx', 15_000), source('tabla.xlsx', 15_000)]
    await generateMuseumFromFiles({ prompt: '', sources: big, images: [] }, (s) => stages.push(s))
    expect(requests.map((r) => r.url)).toEqual(['/api/digest-sources', '/api/generate-museum'])
    expect(requests[0].body).toEqual({ sources: big })
    expect(requests[1].body).toEqual({
      mode: 'exploration',
      prompt: DEFAULT_FILES_PROMPT,
      sources: [{ name: 'Temario base de 2 archivos', kind: 'md', text: '# Tema\n- Concepto: idea' }],
      images: [],
    })
    expect(stages).toEqual(['digesting', 'generating'])
  })

  it('treats long notes typed next to the files as one more source', async () => {
    const notes = '# Tema\n' + '- Concepto\n'.repeat(300)
    await generateMuseumFromFiles({ prompt: notes, sources: [source('a.txt', 100)], images: [] })
    expect(requests[0].body).toMatchObject({
      prompt: DEFAULT_FILES_PROMPT,
      sources: [{ name: 'Tus apuntes', kind: 'md', text: notes.trim() }, source('a.txt', 100)],
    })
  })

  it('reports the server status when the master prompt fails', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ error: 'IA no configurada' }), { status: 503 }))
    await expect(
      generateMuseumFromFiles({ prompt: '', sources: [source('a.txt', LIMITS.maxNotesChars + 1)], images: [] }),
    ).rejects.toMatchObject({ status: 503 })
  })
})
