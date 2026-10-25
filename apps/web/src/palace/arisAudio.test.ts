import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  cleanTextForSpeech,
  selectBestSpanishVoice,
  playArisVoice,
  defaultVoiceEngine,
  HybridArisVoiceEngine,
  type IArisVoiceEngine,
} from './arisAudio'

describe('cleanTextForSpeech', () => {
  it('removes Aris: prefix', () => {
    expect(cleanTextForSpeech('Aris: ¡Hola! Soy tu guía.')).toBe('¡Hola! Soy tu guía.')
  })

  it('removes markdown formatting, bullet points and urls', () => {
    const raw = 'Aris: Consulta esto: • *Opción 1* en https://mus3o.app'
    expect(cleanTextForSpeech(raw)).toBe('Consulta esto: Opción 1 en')
  })

  it('removes quotes cleanly', () => {
    expect(cleanTextForSpeech('Aris: Mira la "mitocondria"')).toBe('Mira la mitocondria')
  })

  it('handles empty strings gracefully', () => {
    expect(cleanTextForSpeech('')).toBe('')
  })
})

describe('selectBestSpanishVoice', () => {
  const mockVoice = (name: string, lang: string): SpeechSynthesisVoice => ({
    name,
    lang,
    default: false,
    localService: true,
    voiceURI: name,
  })

  it('prefers natural / high-quality Spanish voices when available', () => {
    const voices = [
      mockVoice('Alex', 'en-US'),
      mockVoice('Juan Standard', 'es-ES'),
      mockVoice('Microsoft Sabina Online (Natural)', 'es-MX'),
    ]
    const selected = selectBestSpanishVoice(voices)
    expect(selected?.name).toBe('Microsoft Sabina Online (Natural)')
  })

  it('falls back to general Spanish voice if no preferred name matches', () => {
    const voices = [
      mockVoice('Alex', 'en-US'),
      mockVoice('Standard Spanish', 'es-ES'),
    ]
    const selected = selectBestSpanishVoice(voices)
    expect(selected?.name).toBe('Standard Spanish')
  })

  it('returns first available voice if no Spanish voice exists', () => {
    const voices = [mockVoice('English Voice', 'en-US')]
    const selected = selectBestSpanishVoice(voices)
    expect(selected?.name).toBe('English Voice')
  })

  it('returns null when voices array is empty', () => {
    expect(selectBestSpanishVoice([])).toBeNull()
  })
})

describe('playArisVoice', () => {
  it('does NOT speak when muted is true', () => {
    const mockEngine: IArisVoiceEngine = {
      speak: vi.fn(),
      cancel: vi.fn(),
    }

    playArisVoice('Aris: Mensaje de prueba', { muted: true, engine: mockEngine })
    expect(mockEngine.speak).not.toHaveBeenCalled()
  })

  it('speaks when muted is false', () => {
    const mockEngine: IArisVoiceEngine = {
      speak: vi.fn(),
      cancel: vi.fn(),
    }

    playArisVoice('Aris: Mensaje de prueba', { muted: false, engine: mockEngine })
    expect(mockEngine.speak).toHaveBeenCalledWith('Aris: Mensaje de prueba')
  })

  it('delegates to defaultVoiceEngine when no engine option is passed', () => {
    const spy = vi.spyOn(defaultVoiceEngine, 'speak').mockImplementation(() => {})
    playArisVoice('Aris: Mensaje con motor default', { muted: false })
    expect(spy).toHaveBeenCalledWith('Aris: Mensaje con motor default')
    spy.mockRestore()
  })
})

describe('HybridArisVoiceEngine', () => {
  let originalFetch: typeof globalThis.fetch
  let originalAudio: typeof globalThis.Audio
  let originalCreateObjectURL: typeof URL.createObjectURL
  let originalRevokeObjectURL: typeof URL.revokeObjectURL

  let mockAudioInstance: {
    play: ReturnType<typeof vi.fn>
    pause: ReturnType<typeof vi.fn>
    onended: (() => void) | null
  }
  let mockFallback: IArisVoiceEngine

  class MockAudio {
    src: string
    play = vi.fn().mockResolvedValue(undefined)
    pause = vi.fn()
    onended: (() => void) | null = null
    constructor(src?: string) {
      this.src = src || ''
      mockAudioInstance = this
    }
  }

  beforeEach(() => {
    originalFetch = globalThis.fetch
    originalAudio = globalThis.Audio
    originalCreateObjectURL = URL.createObjectURL
    originalRevokeObjectURL = URL.revokeObjectURL

    globalThis.Audio = MockAudio as unknown as typeof Audio
    URL.createObjectURL = vi.fn(() => 'blob:mock-audio-url')
    URL.revokeObjectURL = vi.fn()

    mockFallback = {
      speak: vi.fn(),
      cancel: vi.fn(),
    }
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    globalThis.Audio = originalAudio
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    vi.restoreAllMocks()
  })

  it('uses ElevenLabs (/api/tts) successfully without invoking fallback', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['mock-mp3'], { type: 'audio/mpeg' })),
    })

    const engine = new HybridArisVoiceEngine(mockFallback)
    engine.speak('Hola, viajero del palacio')

    // Wait for microtasks
    await new Promise((r) => setTimeout(r, 20))

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/tts', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ text: 'Hola, viajero del palacio' }),
    }))
    expect(mockAudioInstance.play).toHaveBeenCalled()
    expect(mockFallback.speak).not.toHaveBeenCalled()
  })

  it('falls back to browser WebSpeech if /api/tts returns an HTTP error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
    })

    const engine = new HybridArisVoiceEngine(mockFallback)
    engine.speak('Texto de prueba')

    await new Promise((r) => setTimeout(r, 20))

    expect(mockFallback.speak).toHaveBeenCalledWith('Texto de prueba', undefined)
    expect(mockAudioInstance.play).not.toHaveBeenCalled()
  })

  it('falls back to browser WebSpeech if fetch encounters a network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    const engine = new HybridArisVoiceEngine(mockFallback)
    engine.speak('Texto de prueba')

    await new Promise((r) => setTimeout(r, 20))

    expect(mockFallback.speak).toHaveBeenCalledWith('Texto de prueba', undefined)
  })

  it('falls back to browser WebSpeech if ElevenLabs times out', async () => {
    // Hangs forever
    globalThis.fetch = vi.fn().mockImplementation(() => new Promise(() => {}))

    const engine = new HybridArisVoiceEngine(mockFallback, 50) // 50ms timeout for test
    engine.speak('Texto que demora')

    await new Promise((r) => setTimeout(r, 100))

    expect(mockFallback.speak).toHaveBeenCalledWith('Texto que demora', undefined)
  })

  it('cancels active request and stops audio immediately upon cancel() without triggering fallback', async () => {
    let abortSignalCaptured: AbortSignal | undefined
    globalThis.fetch = vi.fn().mockImplementation((_url, init) => {
      abortSignalCaptured = init?.signal
      return new Promise((resolve) => setTimeout(resolve, 100))
    })

    const engine = new HybridArisVoiceEngine(mockFallback)
    engine.speak('Texto a cancelar')

    expect(mockFallback.cancel).toHaveBeenCalled()

    engine.cancel()

    expect(mockFallback.cancel).toHaveBeenCalledTimes(2)
    expect(abortSignalCaptured?.aborted).toBe(true)

    await new Promise((r) => setTimeout(r, 120))

    // Fallback should NOT be called because it was explicitly cancelled by user
    expect(mockFallback.speak).not.toHaveBeenCalled()
  })
})
