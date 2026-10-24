import type { Museum, MuseumStreamEvent } from '@mus3o/shared'
import { ApiError, describeAiError, generateMuseum, generateMuseumStream, looksLikeTopic } from '../lib/api'
import { prefetchRoomImages } from '../lib/images'
import { useStore } from '../store'
import { newBuildSession } from './session'

/** Pausa entre salas al reproducir un museo que no llegó por streaming (servidor sin el endpoint). */
const REPLAY_GAP_MS = 450
const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => (clearTimeout(timer), resolve()), { once: true })
  })

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/**
 * "Generar con IA": entra al palacio de inmediato (solar vacío, cámara aérea) y lo va levantando sala a
 * sala según la IA las escribe. Un fallo antes de la primera sala vuelve a la landing con el error; uno a
 * mitad conserva las salas que ya hay.
 */
export async function startLiveBuild(input: string): Promise<void> {
  const text = input.trim()
  // Con apuntes se guardan para mostrar el contexto de cada fuente; un tema no tiene fuentes.
  const notes = !looksLikeTopic(text)
  const store = () => useStore.getState()
  store().beginBuildingPalace({ title: notes ? 'Tu palacio' : text, sourceText: notes ? text : null, reducedMotion: prefersReducedMotion() })
  // Abre la sesión nueva (y corta la de una generación anterior, cuyos eventos tardíos se descartan).
  const { signal } = newBuildSession()

  let built = 0
  let finished = false
  const onRoom = (event: Extract<MuseumStreamEvent, { type: 'room' }>) => {
    store().addBuiltRoom(event.room)
    built++
    // En paralelo a que la sala se levanta: el cuadro principal primero, luego los de las piezas.
    void prefetchRoomImages(event.room)
  }

  try {
    for await (const event of generateMuseumStream(text, signal)) {
      if (signal.aborted) return
      if (event.type === 'meta') store().setBuildTitle(event.title)
      else if (event.type === 'room') onRoom(event)
      else if (event.type === 'done') {
        store().finishBuildingPalace(event.museum)
        finished = true
      } else throw new ApiError(event.message, event.status ?? 502)
    }
    if (!finished) throw new ApiError('Se cortó la conexión con la IA', 502)
  } catch (e) {
    if (signal.aborted) return
    const status = (e as { status?: number }).status
    // Servidor sin el endpoint de streaming: se pide el museo entero y se levanta igual, sala a sala.
    if (built === 0 && (status === 404 || status === 405)) {
      await replayWhole(text, signal)
      return
    }
    store().failBuildingPalace(describeAiError(status))
  }
}

async function replayWhole(text: string, signal: AbortSignal) {
  try {
    const museum: Museum = await generateMuseum(text, signal)
    const store = () => useStore.getState()
    store().setBuildTitle(museum.title)
    for (const [i, room] of museum.rooms.entries()) {
      if (i > 0) await sleep(REPLAY_GAP_MS, signal)
      if (signal.aborted) return
      store().addBuiltRoom(room)
      void prefetchRoomImages(room)
    }
    store().finishBuildingPalace(museum)
  } catch (e) {
    if (signal.aborted) return
    useStore.getState().failBuildingPalace(describeAiError((e as { status?: number }).status))
  }
}

/** Corta la generación en curso (al salir del palacio o al empezar otra). */
export { cancelBuildSession as cancelLiveBuild } from './session'
