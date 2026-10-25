import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Museum } from '@mus3o/shared'

vi.hoisted(() => {
  const data = new Map<string, string>()
  const localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
  Object.assign(globalThis, { window: { localStorage } })
})

const voice = vi.hoisted(() => ({
  speak: vi.fn(),
  stopSpeaking: vi.fn(),
  canSpeak: vi.fn(() => true),
  isSpeakingNow: vi.fn(() => false),
  onVoiceActivity: vi.fn(() => () => {}),
}))
vi.mock('../lib/voice', () => voice)
vi.mock('./model', () => ({
  getDioramaModel: () => ({
    layout: {
      linked: [],
      labelled: [
        { propIndex: 0, label: 'soldados realistas', x: 6, z: 6, y: 0 },
        { propIndex: 1, label: 'Caballería', x: -6, z: 5, y: 0 },
        { propIndex: 2, label: 'soldados realistas', x: 9, z: 0, y: 0 },
        { propIndex: 3, label: 'río Tíber', x: 0, z: -12, y: 0 },
      ],
    },
  }),
}))

import { saveNarratorOn } from '../lib/narratorPref'
import { useStore } from '../store'
import { useDioramaStore } from './dioramaStore'
import { DWELL_MS, focusGuide, propGuideId, repeatGuide, startGuide, stopGuide, useGuideStore } from './guideStore'

const palace = {
  rooms: [
    {
      id: 'r1',
      name: 'Batalla',
      pieces: [{ id: 'p1', title: 'Caballería', text: 'Decidió la batalla con una carga.', fact: '', source: { quote: 'q', line: 7 } }],
    },
  ],
} as unknown as Museum

const diorama = {
  title: 'Carga en la ladera',
  backdrop: '/api/image/file?u=x',
  props: [
    { kind: 'figure', label: 'soldados realistas' },
    { kind: 'rider', label: 'Caballería' },
    { kind: 'figure', label: 'soldados realistas' },
    { kind: 'tree', label: 'río Tíber' },
  ],
}

beforeEach(() => {
  vi.useFakeTimers()
  saveNarratorOn(false)
  useStore.setState({ palace, arisMessage: null, arisMuted: false, openId: null, focusedId: null })
  useDioramaStore.setState({ phase: 'inside', activeId: 'portal:x', portals: { 'portal:x': { id: 'portal:x', roomId: 'r1', diorama } as never } })
})
afterEach(() => {
  stopGuide()
  vi.useRealTimers()
})

describe('guía de Aris en un mundo de foto', () => {
  it('la introducción dice que recrea la imagen real y lista los rótulos sin repetirlos, con dirección', () => {
    startGuide()
    const text = useGuideStore.getState().line!.text
    expect(text).toContain('recreación en 3D')
    expect(text).toContain('imagen real')
    // Dos «soldados realistas»: aparece una sola vez, el más cercano al punto de aparición (z 6, a la derecha).
    expect(text.match(/soldados realistas/g)).toHaveLength(1)
    expect(text).toMatch(/soldados realistas \((delante, )?a tu derecha\)/)
    expect(text).toMatch(/Caballería \(.*izquierda\)/)
    expect(useStore.getState().arisMessage).toBe(text)
  })

  it('al mirar un prop sin concepto dice su rótulo', () => {
    focusGuide(propGuideId(3))
    vi.advanceTimersByTime(DWELL_MS + 10)
    expect(useGuideStore.getState().line).toMatchObject({ kind: 'piece', id: 'prop:3', text: 'Río Tíber.' })
  })

  it('si el rótulo coincide con un concepto de la sala añade los apuntes y la fuente', () => {
    focusGuide(propGuideId(1))
    vi.advanceTimersByTime(DWELL_MS + 10)
    expect(useGuideStore.getState().line!.text).toBe('Caballería. Decidió la batalla con una carga. Según tus apuntes, línea 7.')
  })

  it('G repite lo del prop mirado, una vez contado', () => {
    useGuideStore.setState({ focusedProp: propGuideId(3) })
    repeatGuide()
    expect(useGuideStore.getState().line!.text).toBe('Río Tíber.')
  })
})
