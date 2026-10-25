// Dictado en tiempo real con ElevenLabs Scribe. Se carga bajo demanda desde lib/voice.ts (import dinámico) para que
// el SDK no pese en el bundle inicial. El navegador abre un websocket directo con ElevenLabs usando un token de un
// solo uso que mintea nuestro servidor: la clave nunca llega aquí.

/** Silencio que cierra la frase: los conceptos son cortos y el examen se siente más ágil con poco margen. */
const VAD_SILENCE_SECS = 0.8
/** Tiempo para tener sesión abierta (token + websocket + micrófono) antes de pasar al respaldo. */
const CONNECT_TIMEOUT_MS = 5000
/** Sin una frase confirmada en este tiempo se da por "no se oyó nada" (como el 'no-speech' del navegador). */
const MAX_LISTEN_MS = 10_000
/** Límites del parámetro keyterms de Scribe. */
const MAX_KEYTERMS = 50
const MAX_KEYTERM_CHARS = 20

/** Deja términos únicos de 1-20 caracteres (los más largos Scribe los rechaza) y como mucho 50. */
export function cleanKeyterms(terms: string[] = []): string[] {
  const seen = new Set<string>()
  for (const t of terms) {
    const term = t.trim()
    if (term && term.length <= MAX_KEYTERM_CHARS) seen.add(term)
    if (seen.size >= MAX_KEYTERMS) break
  }
  return [...seen]
}

export type ScribeListenOptions = {
  keyterms?: string[]
  onInterim?: (text: string) => void
  onFinal: (alternatives: string[]) => void
  /** Pasó el tiempo máximo sin una frase confirmada. */
  onNoSpeech: () => void
  /** No se pudo dictar con ElevenLabs. 'not-allowed' = sin permiso de micrófono (el respaldo tampoco serviría). */
  onFail: (code: 'not-allowed' | 'network') => void
}

const isPermissionError = (e: unknown): boolean => {
  const err = e as { name?: unknown; message?: unknown } | null
  return err?.name === 'NotAllowedError' || err?.name === 'SecurityError' || /permission|not.?allowed/i.test(String(err?.message ?? ''))
}

/** Empieza a escuchar; devuelve la función que lo detiene (idempotente, libera el micrófono). */
export function listenScribe(o: ScribeListenOptions): () => void {
  let done = false
  let conn: { close: () => void } | null = null
  let connectTimer: ReturnType<typeof setTimeout> | undefined
  let listenTimer: ReturnType<typeof setTimeout> | undefined

  const stop = () => {
    done = true
    clearTimeout(connectTimer)
    clearTimeout(listenTimer)
    try {
      conn?.close()
    } catch {
      /* ya estaba cerrada */
    }
    conn = null
  }
  const fail = (code: 'not-allowed' | 'network') => {
    if (done) return
    stop()
    o.onFail(code)
  }

  void (async () => {
    try {
      const res = await fetch('/api/stt/token', { method: 'POST' })
      if (done) return
      if (!res.ok) return fail('network')
      const { token, modelId } = (await res.json()) as { token?: string; modelId?: string }
      if (done) return
      if (!token || !modelId) return fail('network')
      const { Scribe, RealtimeEvents, CommitStrategy } = await import('@elevenlabs/client')
      if (done) return

      const keyterms = cleanKeyterms(o.keyterms)
      const connection = Scribe.connect({
        token,
        modelId,
        languageCode: 'es',
        commitStrategy: CommitStrategy.VAD,
        vadSilenceThresholdSecs: VAD_SILENCE_SECS,
        ...(keyterms.length ? { keyterms } : {}),
        microphone: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      conn = connection
      connectTimer = setTimeout(() => fail('network'), CONNECT_TIMEOUT_MS)

      connection.on(RealtimeEvents.SESSION_STARTED, () => {
        clearTimeout(connectTimer)
        listenTimer = setTimeout(() => {
          if (done) return
          stop()
          o.onNoSpeech()
        }, MAX_LISTEN_MS)
      })
      connection.on(RealtimeEvents.PARTIAL_TRANSCRIPT, (d) => {
        if (!done && d.text) o.onInterim?.(d.text)
      })
      connection.on(RealtimeEvents.COMMITTED_TRANSCRIPT, (d) => {
        const text = d.text?.trim()
        if (done || !text) return
        stop()
        o.onFinal([text])
      })
      connection.on(RealtimeEvents.ERROR, (e) => fail(isPermissionError(e) ? 'not-allowed' : 'network'))
      // Si el servidor cierra antes de dar una frase, es un fallo (al detener nosotros, `done` ya es true).
      connection.on(RealtimeEvents.CLOSE, () => fail('network'))
    } catch (e) {
      fail(isPermissionError(e) ? 'not-allowed' : 'network')
    }
  })()

  return stop
}
