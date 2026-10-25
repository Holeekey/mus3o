import { describe, expect, it } from 'vitest'
import { hasMoreBelow, wheelPixels, wheelScrollTarget } from './cardScroll'

const box = (scrollHeight: number, scrollTop: number, clientHeight: number) => ({ scrollHeight, scrollTop, clientHeight })

describe('hasMoreBelow', () => {
  it('is true while content remains below the visible area', () => {
    expect(hasMoreBelow(box(900, 0, 500))).toBe(true)
    expect(hasMoreBelow(box(900, 380, 500))).toBe(true)
  })

  it('is false at the end (a few pixels of rounding count as the end) or when everything fits', () => {
    expect(hasMoreBelow(box(900, 400, 500))).toBe(false)
    expect(hasMoreBelow(box(900, 397, 500))).toBe(false)
    expect(hasMoreBelow(box(400, 0, 500))).toBe(false)
  })
})

describe('wheelScrollTarget', () => {
  const inside = {}
  const card = { contains: (t: unknown) => t === inside }

  it('scrolls the card when the wheel happens outside it (pointer locked on the 3D scene)', () => {
    expect(wheelScrollTarget(card, {})).toBe(card)
  })

  it('leaves the native scroll alone when the mouse is already over the card', () => {
    expect(wheelScrollTarget(card, inside)).toBeNull()
  })

  it('does nothing without a card', () => {
    expect(wheelScrollTarget(null, {})).toBeNull()
  })
})

describe('wheelPixels', () => {
  it('keeps pixel deltas as they are (Chrome, Safari)', () => {
    expect(wheelPixels({ deltaY: 100, deltaMode: 0 }, 400)).toBe(100)
  })

  it('turns line deltas into pixels (Firefox sends about 3 lines per notch)', () => {
    expect(wheelPixels({ deltaY: 3, deltaMode: 1 }, 400)).toBe(48)
    expect(wheelPixels({ deltaY: -3, deltaMode: 1 }, 400)).toBe(-48)
  })

  it('turns page deltas into the visible height of the card', () => {
    expect(wheelPixels({ deltaY: 1, deltaMode: 2 }, 400)).toBe(400)
  })
})
