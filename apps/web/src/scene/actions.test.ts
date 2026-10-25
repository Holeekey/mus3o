import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Piece } from '@mus3o/shared'
import { dioramaRequest, useDioramaStore } from '../diorama/dioramaStore'
import type { PalaceLayout } from '../palace/layout'
import { useStore } from '../store'
import { closeCard, interact, leaveDiorama, openAris, toggleMemorize } from './actions'
import { pointerLock } from './pointerLock'

vi.hoisted(() => {
  const data = new Map<string, string>()
  const localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
  Object.assign(globalThis, { window: { localStorage } })
})

const plain: Piece = { id: 'p1', title: 'Bomba', text: '', fact: '' }
const key: Piece = { id: 'k1', title: 'Llave', text: '', fact: '', model: { type: 'catalog', id: 'dungeon_key' } } as Piece
const door = { id: 'd1', fromRoomId: 'a', toRoomId: 'b', x: 0, z: 0, w: 1, d: 1 }
const layout = {
  rooms: [{ id: 'a', pedestals: [{ concept: plain }, { concept: key }] }],
  doors: [door],
} as unknown as PalaceLayout

beforeEach(() => {
  useStore.setState({
    mode: 'explore',
    reviewIds: null,
    locked: true,
    openId: null,
    focusedId: null,
    focusedDoorId: null,
    hasKey: false,
    roomKeys: {},
    unlockedDoors: {},
    freeExplore: false,
    memorized: {},
    exam: {},
    arisPromptOpen: false,
  })
  useDioramaStore.setState({ phase: 'room', activeId: null, hintId: null, nearReturn: false })
  dioramaRequest.enter = null
  dioramaRequest.leave = false
  pointerLock.unlock = vi.fn()
  pointerLock.lock = vi.fn()
})

describe('interact (E o botón 👁️)', () => {
  it('opens the focused concept card and closes it on the second press', () => {
    useStore.setState({ focusedId: 'p1' })
    interact(layout)
    expect(useStore.getState().openId).toBe('p1')
    interact(layout)
    expect(useStore.getState().openId).toBeNull()
  })

  it('picks up the iron key when the focused piece is a key', () => {
    useStore.setState({ focusedId: 'k1' })
    interact(layout)
    expect(useStore.getState().hasKey).toBe(true)
    expect(useStore.getState().openId).toBe('k1')
  })

  it('opens a locked door when the player holds a key, without opening a card', () => {
    useStore.setState({ focusedDoorId: 'd1', focusedId: 'p1', hasKey: true })
    interact(layout)
    expect(useStore.getState().unlockedDoors).toEqual({ d1: true })
    expect(useStore.getState().openId).toBeNull()
  })

  it('a closed door the player cannot open does not steal E from the focused pedestal', () => {
    useStore.setState({ focusedDoorId: 'd1', focusedId: 'p1', hasKey: false })
    interact(layout)
    expect(useStore.getState().unlockedDoors).toEqual({})
    expect(useStore.getState().openId).toBe('p1')
  })

  it('enters the painting the player is looking at', () => {
    useDioramaStore.setState({ hintId: 'p1' })
    useStore.setState({ focusedId: 'p1' })
    interact(layout)
    expect(dioramaRequest.enter).toBe('p1')
    expect(useStore.getState().openId).toBeNull()
  })

  it('releases the pointer to type an exam answer when there is no dictation', () => {
    useStore.setState({ mode: 'exam', focusedId: 'p1' })
    interact(layout)
    expect(useStore.getState().openId).toBe('p1')
    expect(pointerLock.unlock).toHaveBeenCalled()
  })
})

describe('toggleMemorize (M o botón ✓)', () => {
  it('marks the open or focused concept in explore mode', () => {
    useStore.setState({ focusedId: 'p1' })
    toggleMemorize()
    expect(useStore.getState().memorized.p1).toBeTruthy()
  })

  it('does nothing in exam mode', () => {
    useStore.setState({ mode: 'exam', focusedId: 'p1' })
    toggleMemorize()
    expect(useStore.getState().memorized.p1).toBeFalsy()
  })
})

describe('openAris (T o botón 🤖)', () => {
  it('opens the prompt in the palace', () => {
    openAris()
    expect(useStore.getState().arisPromptOpen).toBe(true)
  })

  it('is not available inside a painting or with an exam card open', () => {
    useDioramaStore.setState({ phase: 'inside' })
    openAris()
    expect(useStore.getState().arisPromptOpen).toBe(false)
    useDioramaStore.setState({ phase: 'room' })
    useStore.setState({ mode: 'exam', openId: 'p1' })
    openAris()
    expect(useStore.getState().arisPromptOpen).toBe(false)
  })
})

describe('leaveDiorama (Q o botón Volver)', () => {
  it('asks the runtime to leave only from inside the painting', () => {
    leaveDiorama()
    expect(dioramaRequest.leave).toBe(false)
    useDioramaStore.setState({ phase: 'inside' })
    leaveDiorama()
    expect(dioramaRequest.leave).toBe(true)
  })
})

describe('closeCard (E o ✕ con la ficha abierta)', () => {
  it('returns to the palace when the pointer was released to read, instead of showing the pause menu', () => {
    useStore.setState({ openId: 'p1', locked: false })
    closeCard()
    expect(useStore.getState().openId).toBeNull()
    expect(pointerLock.lock).toHaveBeenCalled()
  })

  it('does not touch the pointer when it is already locked', () => {
    useStore.setState({ openId: 'p1', locked: true })
    closeCard()
    expect(useStore.getState().openId).toBeNull()
    expect(pointerLock.lock).not.toHaveBeenCalled()
  })

  it('E closes the card the same way', () => {
    useStore.setState({ openId: 'p1', locked: false })
    interact(layout)
    expect(useStore.getState().openId).toBeNull()
    expect(pointerLock.lock).toHaveBeenCalled()
  })
})
