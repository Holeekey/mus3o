import { describe, expect, it } from 'vitest'
import { fadeAmount } from './scrollFade'

// `center` is the block's vertical centre as a fraction of the viewport: 1 = bottom edge, 0 = top edge.
describe('fadeAmount', () => {
  it('is hidden below the viewport and above it', () => {
    expect(fadeAmount(1)).toBe(0)
    expect(fadeAmount(1.4)).toBe(0)
    expect(fadeAmount(-0.15)).toBe(0)
    expect(fadeAmount(-0.6)).toBe(0)
  })

  it('is fully shown around the upper-middle of the screen', () => {
    expect(fadeAmount(0.5)).toBe(1)
    expect(fadeAmount(0.2)).toBe(1)
    expect(fadeAmount(0.65)).toBe(1)
  })

  it('grows while entering from the bottom', () => {
    expect(fadeAmount(0.9)).toBeGreaterThan(0)
    expect(fadeAmount(0.9)).toBeLessThan(fadeAmount(0.75))
    expect(fadeAmount(0.75)).toBeLessThan(1)
  })

  it('shrinks while leaving through the top', () => {
    expect(fadeAmount(0.1)).toBeLessThan(1)
    expect(fadeAmount(-0.05)).toBeLessThan(fadeAmount(0.1))
    expect(fadeAmount(-0.05)).toBeGreaterThan(0)
  })
})
