import { describe, expect, it } from 'vitest'
import { sampleMuseum, type Museum } from '@mus3o/shared'
import { conceptIdSet } from './conceptIds'

const museumWith = (ids: string[][]): Museum => ({
  ...sampleMuseum,
  rooms: ids.map((pieceIds, r) => ({
    ...sampleMuseum.rooms[0],
    id: `room-${r}`,
    pieces: pieceIds.map((id) => ({ ...sampleMuseum.rooms[0].pieces[0], id })),
  })),
})

describe('conceptIdSet', () => {
  it('contains the id of every piece in every room', () => {
    const palace = museumWith([['a', 'b'], ['c']])
    expect([...conceptIdSet(palace)].sort()).toEqual(['a', 'b', 'c'])
  })

  it('is empty without a palace', () => {
    expect(conceptIdSet(null).size).toBe(0)
  })

  it('returns the same set for the same palace instead of rebuilding it', () => {
    const palace = museumWith([['a'], ['b']])
    expect(conceptIdSet(palace)).toBe(conceptIdSet(palace))
  })

  it('keeps separate sets for different palaces', () => {
    const one = museumWith([['a']])
    const two = museumWith([['x', 'y']])
    expect(conceptIdSet(one).has('x')).toBe(false)
    expect(conceptIdSet(two).has('x')).toBe(true)
    expect(conceptIdSet(one).has('a')).toBe(true)
  })
})
