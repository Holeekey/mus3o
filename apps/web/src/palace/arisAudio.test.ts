import { describe, expect, it, vi } from 'vitest'
import { speak as speakVoice } from '../lib/voice'
import {
  cleanTextForSpeech,
  selectBestSpanishVoice,
  playArisVoice,
  shortenForSpeech,
  defaultVoiceEngine,
  type IArisVoiceEngine,
} from './arisAudio'

vi.mock('../lib/voice', () => ({ speak: vi.fn(), stopSpeaking: vi.fn() }))

describe('defaultVoiceEngine', () => {
  it('limpia el texto y aplica el pitch/rate de Aris antes de delegar en lib/voice', () => {
    defaultVoiceEngine.speak('Aris: **Hola** viajero https://mus3o.app')
    expect(speakVoice).toHaveBeenCalledWith('Hola viajero', { lang: undefined, pitch: 1.25, rate: 1.05 })
  })

  it('no habla si el texto queda vacío tras limpiarlo', () => {
    vi.mocked(speakVoice).mockClear()
    defaultVoiceEngine.speak('Aris: ')
    expect(speakVoice).not.toHaveBeenCalled()
  })
})

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

describe('shortenForSpeech', () => {
  it('deja intacto el texto corto', () => {
    expect(shortenForSpeech('Estás en la sala del corazón.')).toBe('Estás en la sala del corazón.')
  })
  it('conserva las primeras frases que caben y descarta el resto', () => {
    const text = 'Primera frase corta. Segunda frase un poco más larga que la anterior. ' + 'Tercera frase muy larga '.repeat(10) + 'y fin.'
    const out = shortenForSpeech(text, 100)
    expect(out).toBe('Primera frase corta. Segunda frase un poco más larga que la anterior.')
    expect(out.length).toBeLessThanOrEqual(100)
  })
  it('corta en una palabra si la primera frase ya no cabe', () => {
    const out = shortenForSpeech('palabra '.repeat(60), 50)
    expect(out.length).toBeLessThanOrEqual(51)
    expect(out.endsWith('.')).toBe(true)
    expect(out).not.toMatch(/palab\.$/)
  })
  it('el motor por defecto habla solo lo esencial', () => {
    vi.mocked(speakVoice).mockClear()
    defaultVoiceEngine.speak('Aris: ' + 'Una frase de relleno bastante larga para superar el límite. '.repeat(8))
    const spoken = vi.mocked(speakVoice).mock.calls[0]?.[0] as string
    expect(spoken.length).toBeLessThanOrEqual(180)
  })
})
