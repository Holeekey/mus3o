import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanKeyterms } from './scribe'

// El SDK de ElevenLabs se simula: la conexión guarda sus manejadores para disparar eventos a mano.
const sdk = vi.hoisted(() => {
  const handlers = new Map<string, (d?: unknown) => void>()
  const conn = { on: (ev: string, cb: (d?: unknown) => void) => void handlers.set(ev, cb), close: vi.fn() }
  return { handlers, conn, connect: vi.fn((_opts: Record<string, unknown>) => conn) }
})
vi.mock('@elevenlabs/client', () => ({
  Scribe: { connect: sdk.connect },
  RealtimeEvents: {
    SESSION_STARTED: 'session_started',
    PARTIAL_TRANSCRIPT: 'partial_transcript',
    COMMITTED_TRANSCRIPT: 'committed_transcript',
    ERROR: 'error',
    CLOSE: 'close',
  },
  CommitStrategy: { VAD: 'vad' },
}))

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

describe('listen (dictado ElevenLabs con respaldo)', () => {
  let recognitions: { started: boolean }[]

  class FakeRecognition {
    started = false
    lang = ''
    interimResults = false
    maxAlternatives = 1
    continuous = false
    onresult = null
    onerror = null
    onend = null
    constructor() {
      recognitions.push(this)
    }
    start() {
      this.started = true
    }
    stop() {}
    abort() {}
  }

  /** Servidor con (o sin) dictado; el token puede fallar. */
  function stubSttServer({ enabled = true, tokenOk = true } = {}) {
    globalThis.fetch = vi.fn((url: string) => {
      const json = (body: unknown, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(body) })
      if (url === '/api/tts/status') return json({ enabled: false })
      if (url === '/api/stt/status') return json({ enabled })
      if (url === '/api/stt/token') return tokenOk ? json({ token: 'tok', modelId: 'scribe_v2_realtime' }) : json({}, false)
      return Promise.reject(new Error(`fetch inesperado: ${url}`))
    }) as unknown as typeof fetch
  }

  /** Espera a que el estado del servidor esté cargado (canListen ya es true por el navegador, no sirve de señal). */
  async function ready() {
    voice.warmVoice()
    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith('/api/stt/status'))
    await new Promise((r) => setTimeout(r, 0))
  }

  const opts = () => ({ keyterms: ['Mitocondria'], onInterim: vi.fn(), onFinal: vi.fn(), onError: vi.fn() })

  beforeEach(() => {
    vi.useRealTimers()
    recognitions = []
    sdk.handlers.clear()
    sdk.connect.mockClear()
    sdk.conn.close.mockClear()
    vi.stubGlobal('window', { SpeechRecognition: FakeRecognition })
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn() } })
  })

  it('dicta con ElevenLabs: el parcial va a onInterim y la frase confirmada a onFinal', async () => {
    stubSttServer()
    await ready()
    const o = opts()

    voice.listen(o)
    await vi.waitFor(() => expect(sdk.connect).toHaveBeenCalled())
    const args = sdk.connect.mock.calls[0]?.[0]
    expect(args).toMatchObject({ token: 'tok', modelId: 'scribe_v2_realtime', commitStrategy: 'vad', keyterms: ['Mitocondria'] })

    sdk.handlers.get('partial_transcript')?.({ text: 'mito' })
    expect(o.onInterim).toHaveBeenCalledWith('mito')
    sdk.handlers.get('committed_transcript')?.({ text: ' Mitocondria ' })
    expect(o.onFinal).toHaveBeenCalledWith(['Mitocondria'])
    expect(sdk.conn.close).toHaveBeenCalled()
    expect(recognitions).toHaveLength(0)
  })

  it('usa el dictado del navegador si el servidor no tiene ElevenLabs', async () => {
    stubSttServer({ enabled: false })
    await ready()

    voice.listen(opts())

    expect(recognitions[0]?.started).toBe(true)
    expect(sdk.connect).not.toHaveBeenCalled()
  })

  it('cae al dictado del navegador si no se puede obtener el token', async () => {
    stubSttServer({ tokenOk: false })
    await ready()

    voice.listen(opts())

    await vi.waitFor(() => expect(recognitions[0]?.started).toBe(true))
    expect(sdk.connect).not.toHaveBeenCalled()
  })

  it('avisa not-allowed y no usa el navegador cuando se niega el micrófono', async () => {
    stubSttServer()
    await ready()
    const o = opts()

    voice.listen(o)
    await vi.waitFor(() => expect(sdk.connect).toHaveBeenCalled())
    sdk.handlers.get('error')?.({ name: 'NotAllowedError' })

    expect(o.onError).toHaveBeenCalledWith('not-allowed')
    expect(recognitions).toHaveLength(0)
  })

  it('cae al navegador si ElevenLabs falla antes de dar una frase', async () => {
    stubSttServer()
    await ready()

    voice.listen(opts())
    await vi.waitFor(() => expect(sdk.connect).toHaveBeenCalled())
    sdk.handlers.get('error')?.(new Error('socket'))

    expect(sdk.conn.close).toHaveBeenCalled()
    expect(recognitions[0]?.started).toBe(true)
  })

  it('al detener cierra la conexión e ignora resultados tardíos', async () => {
    stubSttServer()
    await ready()
    const o = opts()

    const stop = voice.listen(o)
    await vi.waitFor(() => expect(sdk.connect).toHaveBeenCalled())
    stop()
    sdk.handlers.get('committed_transcript')?.({ text: 'tarde' })
    sdk.handlers.get('close')?.()

    expect(sdk.conn.close).toHaveBeenCalled()
    expect(o.onFinal).not.toHaveBeenCalled()
    expect(recognitions).toHaveLength(0)
  })
})

describe('cleanKeyterms', () => {
  it('deja términos únicos de hasta 20 caracteres y como mucho 50', () => {
    const many = Array.from({ length: 80 }, (_, i) => `concepto ${i}`)
    expect(cleanKeyterms([' Mitocondria ', 'Mitocondria', '', 'x'.repeat(21)])).toEqual(['Mitocondria'])
    expect(cleanKeyterms(many)).toHaveLength(50)
    expect(cleanKeyterms(undefined)).toEqual([])
  })
})
