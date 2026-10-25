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

const voice = vi.hoisted(() => ({ speak: vi.fn(), stopSpeaking: vi.fn(), canSpeak: vi.fn(() => true) }))
vi.mock('../lib/voice', () => voice)
vi.mock('./model', () => ({
  getDioramaModel: () => ({
    layout: {
      linked: [
        { pieceId: 'p1', label: '', x: 0, z: 0, y: 0, labelY: 1, propIndex: 0 },
        { pieceId: 'p2', label: '', x: 8, z: 10.6, y: 0, labelY: 1, propIndex: 1 },
      ],
    },
  }),
}))

import { saveNarratorOn } from '../lib/narratorPref'
import { useStore } from '../store'
import { useDioramaStore } from './dioramaStore'
import { DWELL_MS, focusGuide, repeatGuide, startGuide, stopGuide, useGuideStore } from './guideStore'

const palace = {
  rooms: [
    {
      id: 'r1',
      name: 'Sala Uno',
      period: '1821',
      pieces: [
        { id: 'p1', title: 'Uno', text: 'Primera idea.', fact: '', source: { quote: 'q', line: 3 } },
        { id: 'p2', title: 'Dos', text: '', fact: '' },
      ],
    },
  ],
} as unknown as Museum

beforeEach(() => {
  vi.useFakeTimers()
  voice.speak.mockClear()
  voice.stopSpeaking.mockClear()
  saveNarratorOn(false)
  useStore.setState({ palace, arisMessage: null, arisMuted: false, openId: null, focusedId: null })
  useDioramaStore.setState({
    phase: 'inside',
    activeId: 'portal:x',
    portals: { 'portal:x': { id: 'portal:x', roomId: 'r1', diorama: { title: 'Escena' } } as never },
  })
})
afterEach(() => {
  stopGuide()
  vi.useRealTimers()
})

describe('guía de Aris en el cuadro', () => {
  it('al entrar muestra la introducción en el globo de Aris y no habla si el narrador está apagado', () => {
    startGuide()
    const text = useStore.getState().arisMessage ?? ''
    expect(text).toContain('«Escena» de la sala «Sala Uno» (1821)')
    expect(text).toContain('Dos (a tu derecha), Uno (justo delante)')
    expect(useGuideStore.getState().line?.kind).toBe('intro')
    expect(voice.speak).not.toHaveBeenCalled()
  })

  it('con el narrador activo habla; con Aris silenciada, no', () => {
    saveNarratorOn(true)
    startGuide()
    expect(voice.speak).toHaveBeenCalledTimes(1)
    voice.speak.mockClear()
    useStore.setState({ arisMuted: true })
    startGuide()
    expect(voice.speak).not.toHaveBeenCalled()
  })

  it('cuenta una pieza una sola vez por visita, y G la repite', () => {
    focusGuide('p1')
    vi.advanceTimersByTime(DWELL_MS + 10)
    expect(useStore.getState().arisMessage).toBe('Uno. Primera idea. Según tus apuntes, línea 3.')
    useStore.setState({ arisMessage: null })
    focusGuide(null)
    focusGuide('p1')
    vi.advanceTimersByTime(DWELL_MS + 10)
    expect(useStore.getState().arisMessage).toBeNull()
    useStore.setState({ focusedId: 'p1' })
    repeatGuide()
    expect(useStore.getState().arisMessage).toContain('Uno.')
  })

  it('no cuenta si la mirada se fue antes del instante de espera ni con una ficha abierta', () => {
    focusGuide('p1')
    vi.advanceTimersByTime(DWELL_MS - 100)
    focusGuide(null)
    vi.advanceTimersByTime(2000)
    expect(useStore.getState().arisMessage).toBeNull()
    useStore.setState({ openId: 'p1' })
    focusGuide('p1')
    vi.advanceTimersByTime(DWELL_MS + 10)
    expect(useStore.getState().arisMessage).toBeNull()
  })

  it('espera a que termine la introducción antes de contar una pieza', () => {
    startGuide()
    const intro = useStore.getState().arisMessage
    focusGuide('p2')
    vi.advanceTimersByTime(DWELL_MS + 10)
    expect(useStore.getState().arisMessage).toBe(intro)
    vi.advanceTimersByTime(30_000)
    expect(useStore.getState().arisMessage).toBe('Dos.')
  })

  it('al salir calla, cierra el globo, cancela lo pendiente y olvida lo contado', () => {
    saveNarratorOn(true)
    startGuide()
    focusGuide('p1')
    stopGuide()
    expect(voice.stopSpeaking).toHaveBeenCalled()
    expect(useStore.getState().arisMessage).toBeNull()
    expect(useGuideStore.getState().line).toBeNull()
    vi.advanceTimersByTime(60_000)
    expect(useStore.getState().arisMessage).toBeNull()
    focusGuide('p1') // nueva visita: vuelve a contarse
    vi.advanceTimersByTime(DWELL_MS + 10)
    expect(useStore.getState().arisMessage).toContain('Uno.')
  })

  it('no pisa un mensaje ajeno al cerrar', () => {
    startGuide()
    useStore.setState({ arisMessage: 'Aris: otra cosa' })
    stopGuide()
    expect(useStore.getState().arisMessage).toBe('Aris: otra cosa')
  })
})
