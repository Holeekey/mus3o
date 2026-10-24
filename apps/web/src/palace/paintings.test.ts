import { describe, expect, it } from 'vitest'
import type { Museum } from '@mus3o/shared'
import { assignPaintings, buildLayout } from './layout'

const museum: Museum = {
  title: 'Test',
  rooms: [
    {
      id: 'a',
      name: 'Sala',
      description: '',
      imageSearch: { wikiTitle: 'Sala' },
      pieces: [
        { id: 'p1', title: 'Con búsqueda', text: '', fact: '', imageSearch: { wikiTitle: 'Uno' } },
        { id: 'p2', title: 'Con foto propia', text: '', fact: '', image: { imageId: 'img-1' }, imageSearch: { wikiTitle: 'Dos' } },
        { id: 'p3', title: 'Sin nada', text: '', fact: '' },
      ],
    },
  ],
}

describe('assignPaintings with user images', () => {
  it('hangs the user image of a piece before the Wikimedia searches', () => {
    const room = buildLayout(museum).rooms[0]
    const assigned = assignPaintings(room, { 'img-1': 'data:image/jpeg;base64,xx' })
    expect(assigned.map((a) => a.key)).toEqual(['room:a', 'user:p2', 'piece:p1'])
    expect(assigned[1]).toMatchObject({ userImage: { src: 'data:image/jpeg;base64,xx', title: 'Con foto propia' } })
    expect(assigned[1].search).toBeUndefined()
  })

  it('falls back to the piece search when the user image is no longer available', () => {
    const room = buildLayout(museum).rooms[0]
    expect(assignPaintings(room).map((a) => a.key)).toEqual(['room:a', 'piece:p1', 'piece:p2'])
  })
})
