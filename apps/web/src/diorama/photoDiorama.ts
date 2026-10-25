import { create } from 'zustand'
import { PhotoDioramaResponseSchema, type Diorama } from '@mus3o/shared'

/**
 * Cuadros vivos desde la foto real. Cuando la imagen del cuadro principal de una sala ya se resolvió, se le pide al
 * servidor (POST /api/diorama-from-image) que la recree. Si NO es una escena recreable (retrato, diagrama, mapa...)
 * o la IA no está disponible, el cuadro queda normal, sin portal: nunca se inventa un mundo con la teoría de la sala.
 *
 * Aquí vive solo la cola (pura, sin React): como mucho 2 peticiones a la vez, cada imagen se pide una sola vez
 * (también las simultáneas) y las salas más cercanas al jugador van primero.
 */

export type PhotoRequest = { imageUrl: string; title: string; roomTitle: string; concepts: string[]; roomId?: string }

/** Archivo de Wikimedia detrás de `/api/image/file?u=…`; `null` si la imagen no viene del proxy (subida por el usuario, etc.). */
export function wikimediaUrlOf(src: string | undefined): string | null {
  if (!src || !src.startsWith('/api/image/file?')) return null
  try {
    const u = new URLSearchParams(src.slice('/api/image/file?'.length)).get('u')
    return u && u.startsWith('https://') ? u : null
  } catch {
    return null
  }
}

/** Cuántos dioramas de foto hay listos: World usa esto para cargar el runtime de dioramas aunque ninguna sala traiga uno. */
export const usePhotoDioramaStore = create<{ ready: number }>(() => ({ ready: 0 }))

export const PHOTO_CONCURRENCY = 2
/** Tras un fallo transitorio (IA caída, red, 5xx) no se vuelve a pedir esa imagen hasta pasado este tiempo. */
const RETRY_AFTER_MS = 60_000

export type PhotoClientOptions = {
  fetchFn?: typeof fetch
  concurrency?: number
  /** Sala del jugador (para atender primero su cuadro). */
  currentRoomId?: () => string | null
  now?: () => number
}

export function createPhotoDioramaClient(options: PhotoClientOptions = {}) {
  const concurrency = options.concurrency ?? PHOTO_CONCURRENCY
  const now = options.now ?? Date.now
  const settled = new Map<string, Diorama | null>()
  const failedAt = new Map<string, number>()
  const inflight = new Map<string, Promise<Diorama | null>>()
  const queue: Array<{ req: PhotoRequest; run: () => void }> = []
  let active = 0
  const stats = { calls: 0 }

  const pump = () => {
    while (active < concurrency && queue.length > 0) {
      const here = options.currentRoomId?.() ?? null
      const i = here ? queue.findIndex((q) => q.req.roomId === here) : -1
      const [next] = queue.splice(i >= 0 ? i : 0, 1)
      active++
      next.run()
    }
  }

  async function call(req: PhotoRequest): Promise<{ diorama: Diorama | null; definitive: boolean }> {
    stats.calls++
    try {
      const res = await (options.fetchFn ?? fetch)('/api/diorama-from-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: req.imageUrl, title: req.title, roomTitle: req.roomTitle, concepts: req.concepts.slice(0, 12) }),
      })
      if (!res.ok) return { diorama: null, definitive: res.status === 400 || res.status === 413 }
      const parsed = PhotoDioramaResponseSchema.safeParse(await res.json())
      if (!parsed.success) return { diorama: null, definitive: false }
      return { diorama: parsed.data.recreatable && parsed.data.diorama ? parsed.data.diorama : null, definitive: true }
    } catch {
      return { diorama: null, definitive: false }
    }
  }

  /** Resuelve con el diorama o `null` (no recreable / sin IA / error). Una misma imagen se pide una sola vez. */
  function request(req: PhotoRequest): Promise<Diorama | null> {
    const key = req.imageUrl
    if (settled.has(key)) return Promise.resolve(settled.get(key)!)
    const failed = failedAt.get(key)
    if (failed !== undefined && now() - failed < RETRY_AFTER_MS) return Promise.resolve(null)
    const pending = inflight.get(key)
    if (pending) return pending
    const task = new Promise<Diorama | null>((resolve) => {
      queue.push({
        req,
        run: () => {
          void call(req).then(({ diorama, definitive }) => {
            if (definitive) {
              settled.set(key, diorama)
              failedAt.delete(key)
              if (diorama) usePhotoDioramaStore.setState((s) => ({ ready: s.ready + 1 }))
            } else failedAt.set(key, now())
            active--
            inflight.delete(key)
            resolve(diorama)
            pump()
          })
        },
      })
    })
    inflight.set(key, task)
    pump()
    return task
  }

  return {
    request,
    /** Lo ya resuelto sin esperar: `undefined` = aún no se sabe. */
    peek: (imageUrl: string) => settled.get(imageUrl),
    stats,
    reset() {
      settled.clear()
      failedAt.clear()
      inflight.clear()
      queue.length = 0
      active = 0
      stats.calls = 0
    },
  }
}
