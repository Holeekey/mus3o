import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ListenOptions } from '../lib/voice'
import {
  ANSWER_WAIT_MAX_MS,
  GREETING,
  MAX_IDLE_TURNS,
  MUTED_WAIT_MS,
  createArisConversation,
  isUsableUtterance,
  type ArisConversationDeps,
} from './arisConversation'

function makeHarness(over: Partial<ArisConversationDeps> = {}) {
  const env = { canRun: true, speaking: false, muted: false }
  const turns: { opts: ListenOptions; stop: ReturnType<typeof vi.fn> }[] = []
  const deps: ArisConversationDeps = {
    canListen: () => true,
    listen: vi.fn((opts: ListenOptions) => {
      const stop = vi.fn()
      turns.push({ opts, stop })
      return stop
    }),
    isSpeakingNow: () => env.speaking,
    canRun: () => env.canRun,
    isMuted: () => env.muted,
    keyterms: () => ['Aorta'],
    lang: () => 'es-ES',
    ask: vi.fn(),
    say: vi.fn(),
    openTyped: vi.fn(),
    ...over,
  }
  const convo = createArisConversation(deps)
  const last = () => turns[turns.length - 1]
  /** Avanza el reloj en pasos del bucle. */
  const run = (ms: number) => vi.advanceTimersByTimeAsync(ms)
  /** Aris dice algo: empieza a sonar, suena un rato y termina. */
  const speechCycle = async () => {
    env.speaking = true
    await run(500)
    env.speaking = false
    await run(1000)
  }
  /** Enciende, deja pasar el saludo y espera a que se abra el primer turno. */
  const startAndGreet = async () => {
    convo.start()
    await run(300) // el saludo se dice en el primer paso
    await speechCycle()
  }
  return { convo, deps, env, turns, last, run, speechCycle, startAndGreet }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('isUsableUtterance', () => {
  it('descarta fragmentos sueltos y muletillas', () => {
    for (const t of ['', '  ', 'Sí.', 'no', 'eh', 'mmm', 'ok', 'Sí, vale.', 'hola']) expect(isUsableUtterance(t)).toBe(false)
  })
  it('acepta preguntas y también una sola palabra con contenido', () => {
    for (const t of ['¿Qué falta por memorizar?', 'dónde está la aorta', 'ayuda', 'sí, explícame esto']) expect(isUsableUtterance(t)).toBe(true)
  })
})

describe('createArisConversation', () => {
  it('no arranca si no hay forma de escuchar', () => {
    const h = makeHarness({ canListen: () => false })
    expect(h.convo.start()).toBe(false)
    expect(h.convo.store.getState().on).toBe(false)
  })

  it('saluda una vez y solo entonces abre el micrófono', async () => {
    const h = makeHarness()
    h.convo.start()
    await h.run(300)
    expect(h.deps.say).toHaveBeenCalledWith(GREETING)
    expect(h.turns).toHaveLength(0) // aún espera a que termine el saludo

    await h.speechCycle()
    expect(h.turns).toHaveLength(1)
    expect(h.last().opts).toMatchObject({ ambient: true, keyterms: ['Aorta'], lang: 'es-ES' })
    expect(h.convo.store.getState().listening).toBe(true)
  })

  it('responde a lo dicho y vuelve a escuchar cuando Aris termina de hablar', async () => {
    const h = makeHarness()
    await h.startAndGreet()
    h.last().opts.onFinal(['¿Qué falta por memorizar?'])
    expect(h.deps.ask).toHaveBeenCalledTimes(1)
    expect(vi.mocked(h.deps.ask).mock.calls[0]?.[0]).toContain('falta por memorizar') // ya normalizada
    expect(h.convo.store.getState().answering).toBe(true)

    await h.run(2000) // todavía no suena la respuesta: no se reabre el micrófono
    expect(h.turns).toHaveLength(1)

    await h.speechCycle()
    expect(h.turns).toHaveLength(2)
    expect(h.convo.store.getState().answering).toBe(false)
  })

  it('no abre el micrófono mientras suena una voz, ni siquiera la de otro', async () => {
    const h = makeHarness()
    await h.startAndGreet()
    h.last().opts.onFinal(['dónde está la aorta'])
    await h.speechCycle()
    h.last().opts.onError?.('no-speech')
    h.env.speaking = true // el narrador, por ejemplo
    await h.run(5000)
    expect(h.turns).toHaveLength(2)
    h.env.speaking = false
    await h.run(2000)
    expect(h.turns).toHaveLength(3)
  })

  it('silenciada, sigue pronto sin esperar una voz', async () => {
    const h = makeHarness()
    h.env.muted = true
    await h.startAndGreet()
    h.last().opts.onFinal(['explícame esto por favor'])
    await h.run(MUTED_WAIT_MS - 500)
    expect(h.turns).toHaveLength(1)
    await h.run(1500)
    expect(h.turns).toHaveLength(2)
  })

  it('si la respuesta nunca llega a sonar, retoma al pasar el máximo', async () => {
    const h = makeHarness()
    await h.startAndGreet()
    h.last().opts.onFinal(['dónde está la aorta'])
    await h.run(ANSWER_WAIT_MAX_MS - 1000)
    expect(h.turns).toHaveLength(1)
    await h.run(2500)
    expect(h.turns).toHaveLength(2)
  })

  it('se queda en silencio tras varios turnos seguidos sin nada útil', async () => {
    const h = makeHarness()
    await h.startAndGreet()
    for (let i = 0; i < MAX_IDLE_TURNS; i++) {
      expect(h.convo.store.getState().on).toBe(true)
      h.last().opts.onFinal(['Sí.']) // fragmento suelto: cuenta como silencio y no se envía
      await h.run(2000)
    }
    expect(h.deps.ask).not.toHaveBeenCalled()
    expect(h.convo.store.getState()).toMatchObject({ on: false, listening: false })
    expect(h.convo.store.getState().notice).toContain('Pulsa T')
  })

  it('un turno útil reinicia la cuenta de silencios', async () => {
    const h = makeHarness()
    await h.startAndGreet()
    h.last().opts.onError?.('no-speech')
    await h.run(2000)
    h.last().opts.onFinal(['dónde está la aorta'])
    await h.speechCycle()
    h.last().opts.onError?.('no-speech')
    await h.run(2000)
    expect(h.convo.store.getState().on).toBe(true)
  })

  it('en pausa cierra el micrófono y lo reabre al volver', async () => {
    const h = makeHarness()
    await h.startAndGreet()
    const first = h.last()
    h.env.canRun = false // Esc, tarjeta abierta, modal, cuadro...
    await h.run(600)
    expect(first.stop).toHaveBeenCalled()
    expect(h.convo.store.getState()).toMatchObject({ on: true, listening: false })
    await h.run(5000)
    expect(h.turns).toHaveLength(1)

    h.env.canRun = true
    await h.run(2000)
    expect(h.turns).toHaveLength(2)
  })

  it('sin permiso de micrófono se apaga, abre la consulta escrita y no se vuelve a pedir solo', async () => {
    const h = makeHarness()
    await h.startAndGreet()
    h.last().opts.onError?.('not-allowed')
    expect(h.convo.store.getState().on).toBe(false)
    expect(h.deps.openTyped).toHaveBeenCalledTimes(1)

    h.convo.autoStart()
    expect(h.convo.store.getState().on).toBe(false)
    h.convo.talk()
    expect(h.deps.openTyped).toHaveBeenCalledTimes(2)
  })

  it('ante otros errores se apaga y avisa, sin reintentar', async () => {
    const h = makeHarness()
    await h.startAndGreet()
    h.last().opts.onError?.('network')
    expect(h.convo.store.getState()).toMatchObject({ on: false, listening: false })
    expect(h.convo.store.getState().notice).toContain('Shift+T')
    await h.run(5000)
    expect(h.turns).toHaveLength(1)
  })

  it('T la apaga y la vuelve a encender sin repetir el saludo; el aviso desaparece solo', async () => {
    const h = makeHarness()
    await h.startAndGreet()
    h.convo.talk()
    expect(h.convo.store.getState().on).toBe(false)
    expect(h.last().stop).toHaveBeenCalled()
    expect(h.convo.store.getState().notice).toContain('apagado')
    await h.run(4000)
    expect(h.convo.store.getState().notice).toBeNull()

    h.convo.talk()
    await h.run(1000)
    expect(h.deps.say).toHaveBeenCalledTimes(1)
    expect(h.turns).toHaveLength(2)
  })

  it('arranca sola una sola vez', () => {
    const h = makeHarness()
    h.convo.autoStart()
    expect(h.convo.store.getState().on).toBe(true)
    h.convo.stop()
    h.convo.autoStart()
    expect(h.convo.store.getState().on).toBe(false)
  })

  it('ignora resultados de un turno que ya se cerró', async () => {
    const h = makeHarness()
    await h.startAndGreet()
    const old = h.last()
    h.convo.stop()
    old.opts.onFinal(['dónde está la aorta'])
    expect(h.deps.ask).not.toHaveBeenCalled()
  })
})
