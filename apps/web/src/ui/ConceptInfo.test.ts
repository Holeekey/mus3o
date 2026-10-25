import { describe, expect, it } from 'vitest'
import type { ResolvedImage } from '@mus3o/shared'
import { extractLines } from './ConceptInfo'

describe('extractLines', () => {
  it('shows fewer lines of "Para saber más" when the card has an image', () => {
    expect(extractLines({ src: 'x' } as ResolvedImage)).toBe(4)
  })

  it('shows more lines when there is no image, and reserves the image case while it loads', () => {
    expect(extractLines(null)).toBe(8)
    expect(extractLines(undefined)).toBe(4)
  })
})
