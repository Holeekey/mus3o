import { describe, expect, it } from 'vitest'
import { AIM_MAX_DIST, aimedFounder, founderOf, type AimNode } from './founderAim'

const gabriel = { name: 'Gabriel Castellano', profile: 'https://www.linkedin.com/in/gdcastellano/' }
const valeria = { name: 'Valeria Riera', profile: 'https://www.linkedin.com/in/valeriarierat' }

const node = (userData: AimNode['userData'] = {}, parent: AimNode | null = null, visible = true): AimNode => ({
  userData,
  parent,
  visible,
})

// Un retrato: el grupo lleva la etiqueta y el marco/foto son hijos.
const portrait = (founder: typeof gabriel) => node({}, node({ founder }))
const wall = () => node()

describe('founderOf', () => {
  it('finds the tag on the object or any ancestor', () => {
    expect(founderOf(node({ founder: gabriel }))).toEqual(gabriel)
    expect(founderOf(node({}, node({}, node({ founder: gabriel }))))).toEqual(gabriel)
  })

  it('returns null for untagged objects', () => {
    expect(founderOf(node({}, node()))).toBeNull()
  })
})

describe('aimedFounder', () => {
  it('picks the portrait when it is the nearest hit within range', () => {
    expect(aimedFounder([{ distance: 3, object: portrait(gabriel) }])).toEqual(gabriel)
  })

  it('ignores portraits beyond the max distance', () => {
    expect(aimedFounder([{ distance: AIM_MAX_DIST + 0.5, object: portrait(gabriel) }])).toBeNull()
    expect(aimedFounder([{ distance: 5, object: portrait(gabriel) }], 4)).toBeNull()
  })

  it('is blocked by anything in front of the portrait', () => {
    expect(
      aimedFounder([
        { distance: 4, object: portrait(gabriel) },
        { distance: 2, object: wall() },
      ]),
    ).toBeNull()
  })

  it('only counts the nearest portrait, whatever the hit order', () => {
    expect(
      aimedFounder([
        { distance: 5, object: portrait(gabriel) },
        { distance: 3, object: portrait(valeria) },
      ]),
    ).toEqual(valeria)
  })

  it('skips invisible objects (they do not block)', () => {
    expect(
      aimedFounder([
        { distance: 1, object: node({}, null, false) },
        { distance: 3, object: portrait(gabriel) },
      ]),
    ).toEqual(gabriel)
  })

  it('returns null with no hits', () => {
    expect(aimedFounder([])).toBeNull()
  })
})
