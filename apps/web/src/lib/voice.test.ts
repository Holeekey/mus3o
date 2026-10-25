import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// lib/voice guarda estado en el módulo (cache de /api/tts/status, token): se recarga en cada test.
type VoiceModule = typeof import('./voice')

const originals = {
  fetch: globalThis.fetch,
  Audio: globalThis.Audio,
  createObjectURL: URL.createObjectURL,
  revokeObjectURL: URL.revokeObjectURL,
}

let audioPlay: ReturnType<typeof vi.fn>
let browserSpeak: ReturnType<typeof vi.fn>
let browserCancel: ReturnType<typeof vi.fn>

function stubBrowser() {
  browserSpeak = vi.fn()
  browserCancel = vi.fn()
  vi.stubGlobal('window', { speechSynthesis: { speak: browserSpeak, cancel: browserCancel, getVoices: () => [] } })
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} })
}

function stubAudio() {
  audioPlay = vi.fn().mockResolvedValue(undefined)
  globalThis.Audio = class {
    play = audioPlay
    pause = vi.fn()
    onended: (() => void) | null = null
    constructor(public src?: string) {}
  } as unknown as typeof Audio
  URL.createObjectURL = vi.fn(() => 'blob:mock')
  URL.revokeObjectURL = vi.fn()
}

/** fetch que responde el status y deja /api/tts a la lógica de cada test. */
function stubFetch(enabled: boolean, tts: (signal?: AbortSignal) => Promise<unknown>) {
  globalThis.fetch = vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/tts/status') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ enabled }) })
    }
    return tts(init?.signal ?? undefined)
  }) as unknown as typeof fetch
}

const okAudio = () =>
  Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(['mp3'], { type: 'audio/mpeg' })) })

let voice: VoiceModule

beforeEach(async () => {
  vi.useFakeTimers()
  vi.resetModules()
  stubBrowser()
  stubAudio()
  voice = await import('./voice')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  globalThis.fetch = originals.fetch
  globalThis.Audio = originals.Audio
  URL.createObjectURL = originals.createObjectURL
  URL.revokeObjectURL = originals.revokeObjectURL
})

describe('speak (ElevenLabs con fallback)', () => {
  it('reproduce el audio remoto sin usar el navegador', async () => {
    stubFetch(true, okAudio)

    voice.speak('Hola, viajero')
    await vi.advanceTimersByTimeAsync(0)

    expect(audioPlay).toHaveBeenCalled()
    expect(browserSpeak).not.toHaveBeenCalled()
  })

  it('no pide /api/tts si el servidor dice que ElevenLabs no está configurado', async () => {
    stubFetch(false, okAudio)

    voice.speak('Texto')
    await vi.advanceTimersByTimeAsync(0)

    expect(globalThis.fetch).not.toHaveBeenCalledWith('/api/tts', expect.anything())
    expect(browserSpeak).toHaveBeenCalledTimes(1)
  })

  it('cae al navegador si /api/tts responde error', async () => {
    stubFetch(true, () => Promise.resolve({ ok: false, status: 502 }))

    voice.speak('Texto')
    await vi.advanceTimersByTimeAsync(0)

    expect(browserSpeak).toHaveBeenCalledTimes(1)
    expect(audioPlay).not.toHaveBeenCalled()
  })

  it('cae al navegador a los 2500 ms si ElevenLabs no responde', async () => {
    // Respeta la señal: al abortar por timeout la petición rechaza como un fallo real.
    stubFetch(true, (signal) => new Promise((_, reject) => {
      signal?.addEventListener('abort', () => reject(new Error('aborted')))
    }))

    voice.speak('Texto lento')
    await vi.advanceTimersByTimeAsync(2499)
    expect(browserSpeak).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(browserSpeak).toHaveBeenCalledTimes(1)
  })

  it('no cae al navegador si la frase se cancela mientras espera a ElevenLabs', async () => {
    stubFetch(true, (signal) => new Promise((_, reject) => {
      signal?.addEventListener('abort', () => reject(new Error('aborted')))
    }))

    voice.speak('Texto a cancelar')
    await vi.advanceTimersByTimeAsync(0)
    voice.stopSpeaking()
    await vi.advanceTimersByTimeAsync(3000)

    expect(browserSpeak).not.toHaveBeenCalled()
  })

  it('pasa pitch y rate al navegador para conservar la voz de Aris', async () => {
    stubFetch(false, okAudio)

    voice.speak('Texto', { pitch: 1.25, rate: 1.05 })
    await vi.advanceTimersByTimeAsync(0)

    const utterance = browserSpeak.mock.calls[0]?.[0] as { pitch: number; rate: number }
    expect(utterance.pitch).toBe(1.25)
    expect(utterance.rate).toBe(1.05)
  })
})
