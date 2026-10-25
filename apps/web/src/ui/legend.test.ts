import { describe, expect, it } from 'vitest'
import { IDLE_MS, INTRO_MS, legendShown } from './legend'

describe('legendShown', () => {
  it('shows the controls when entering, until the first move or a few seconds pass', () => {
    expect(legendShown(0, 0, null)).toBe(true)
    expect(legendShown(INTRO_MS - 1, 0, null)).toBe(true)
    expect(legendShown(INTRO_MS, 0, null)).toBe(false)
  })

  it('hides as soon as the player moves', () => {
    expect(legendShown(1_000, 0, 900)).toBe(false)
  })

  it('comes back when the player stands still for a while', () => {
    expect(legendShown(900 + IDLE_MS - 1, 0, 900)).toBe(false)
    expect(legendShown(900 + IDLE_MS, 0, 900)).toBe(true)
  })
})
