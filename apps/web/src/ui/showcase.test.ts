import { describe, expect, it } from 'vitest'
import { openAmount } from './showcase'

describe('openAmount', () => {
  it('starts and ends closed', () => {
    expect(openAmount(0)).toBe(0)
    expect(openAmount(1)).toBe(0)
  })

  it('stays fully open in the middle of the scroll', () => {
    expect(openAmount(0.5)).toBe(1)
    expect(openAmount(0.4)).toBe(1)
  })

  it('opens and closes symmetrically', () => {
    expect(openAmount(0.2)).toBeCloseTo(openAmount(0.8))
    expect(openAmount(0.1)).toBeLessThan(openAmount(0.2))
  })

  it('clamps progress outside the section', () => {
    expect(openAmount(-0.5)).toBe(0)
    expect(openAmount(1.5)).toBe(0)
  })
})
