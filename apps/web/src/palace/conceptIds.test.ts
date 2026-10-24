import { describe, expect, it } from 'vitest'
import { sampleMuseum, type Museum } from '@mus3o/shared'
import { conceptIdList, conceptIdSet } from './conceptIds'

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

describe('conceptIdList', () => {
  it('lists every piece id in room then piece order', () => {
    expect(conceptIdList(museumWith([['a', 'b'], ['c']]))).toEqual(['a', 'b', 'c'])
  })

  it('is empty without a palace', () => {
    expect(conceptIdList(null)).toEqual([])
  })

  it('returns the same list for the same palace instead of rebuilding it', () => {
    const palace = museumWith([['a'], ['b']])
    expect(conceptIdList(palace)).toBe(conceptIdList(palace))
  })

  it('has the same length as the number of pieces, as the HUD counts them', () => {
    const palace = museumWith([['a', 'b', 'c'], [], ['d']])
    expect(conceptIdList(palace)).toHaveLength(4)
    expect(conceptIdSet(palace).size).toBe(4)
  })
})
