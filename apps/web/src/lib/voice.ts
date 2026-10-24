// Envoltorios finos sobre Web Speech (dictado y síntesis). Nada aquí lanza si el
// navegador no lo soporta: todo se detecta antes de usar.

type Alt = { transcript: string }
type Result = { isFinal: boolean; length: number; [i: number]: Alt }
type RecEvent = { resultIndex: number; results: { length: number; [i: number]: Result } }
type RecError = { error: string }
type Recognition = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  onresult: ((e: RecEvent) => void) | null
  onerror: ((e: RecError) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type RecognitionCtor = new () => Recognition

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function canListen(): boolean {
  return recognitionCtor() !== null
}

export type ListenOptions = {
  lang?: string
  onInterim?: (text: string) => void
  /** Todas las alternativas del resultado final, de más a menos probable. */
  onFinal: (alternatives: string[]) => void
  /** 'not-allowed' | 'service-not-allowed' | 'no-speech' | 'unsupported' | otros códigos del navegador. */
  onError?: (code: string) => void
}

/** Empieza a escuchar; devuelve la función que lo detiene. Un solo resultado final por llamada. */
export function listen({ lang = 'es-ES', onInterim, onFinal, onError }: ListenOptions): () => void {
  const Ctor = recognitionCtor()
  if (!Ctor) {
    onError?.('unsupported')
    return () => {}
  }
  let rec: Recognition
  let finished = false
  try {
    rec = new Ctor()
  } catch {
    onError?.('unsupported')
    return () => {}
  }
  rec.lang = lang
  rec.interimResults = true
  rec.maxAlternatives = 5
  rec.continuous = false
  rec.onresult = (e) => {
    if (finished) return
    const last = e.results[e.results.length - 1]
    if (!last) return
    if (last.isFinal) {
      finished = true
      const alts: string[] = []
      for (let i = 0; i < last.length; i++) {
        const t = last[i]?.transcript?.trim()
        if (t) alts.push(t)
      }
      if (alts.length) onFinal(alts)
      else onError?.('no-speech')
    } else {
      onInterim?.(last[0]?.transcript ?? '')
    }
  }
  rec.onerror = (e) => {
    if (finished) return
    finished = true
    onError?.(e.error)
  }
  rec.onend = () => {
    if (finished) return
    finished = true
    onError?.('no-speech')
  }
  try {
    rec.start()
  } catch {
    finished = true
    onError?.('unsupported')
  }
  return () => {
    finished = true
    rec.onresult = rec.onerror = rec.onend = null
    try {
      rec.abort()
    } catch {
      /* ya estaba detenido */
    }
  }
}

function synth(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
    ? window.speechSynthesis
    : null
}

const PREFERRED = ['es-ve', 'es-419', 'es-mx']

export function pickSpanishVoice<T extends { lang: string }>(voices: T[]): T | null {
  const norm = (v: { lang: string }) => v.lang.toLowerCase().replace('_', '-')
  for (const p of PREFERRED) {
    const v = voices.find((x) => norm(x) === p)
    if (v) return v
  }
  return voices.find((x) => norm(x).startsWith('es')) ?? null
}

export function canSpeak(): boolean {
  return synth() !== null
}

export function speak(text: string, { lang = 'es-ES' }: { lang?: string } = {}): void {
  const s = synth()
  if (!s || !text.trim()) return
  try {
    s.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    u.rate = 1
    const voice = pickSpanishVoice(s.getVoices())
    if (voice) {
      u.voice = voice
      u.lang = voice.lang
    }
    s.speak(u)
  } catch {
    /* sin voz: no pasa nada */
  }
}

export function stopSpeaking(): void {
  try {
    synth()?.cancel()
  } catch {
    /* nada */
  }
}
