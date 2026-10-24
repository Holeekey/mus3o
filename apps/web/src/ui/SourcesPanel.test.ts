import { describe, expect, it } from 'vitest'
import { LIMITS } from '@mus3o/shared'
import { sourcesSummary, type Attachment } from './SourcesPanel'

const text = (id: string, size: number): Attachment => ({ id, kind: 'text', source: { name: `${id}.txt`, kind: 'txt', text: 'a'.repeat(size) } })
const image = (id: string): Attachment => ({
  id,
  kind: 'image',
  image: { image: { id, name: `${id}.jpg`, mediaType: 'image/jpeg', data: 'x' }, previewUrl: 'data:image/jpeg;base64,x' },
})

describe('sourcesSummary', () => {
  it('counts sources, characters and images', () => {
    expect(sourcesSummary([text('a', 1200), text('b', 40), image('img-1')])).toEqual({
      label: '3 fuentes · 1240 caracteres · 1 imagen',
      willDigest: false,
    })
  })

  it('warns that long text will be digested with AI', () => {
    expect(sourcesSummary([text('a', LIMITS.maxNotesChars + 1)]).willDigest).toBe(true)
  })

  it('handles a single image without text', () => {
    expect(sourcesSummary([image('img-1')])).toEqual({ label: '1 fuente · 1 imagen', willDigest: false })
  })
})
