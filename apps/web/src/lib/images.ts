import { useEffect, useState } from 'react'
import { ResolvedImageSchema, type ImageSearch, type Museum, type ResolvedImage, type Room } from '@mus3o/shared'

const cache = new Map<string, Promise<ResolvedImage | null>>()
// Resultados ya resueltos: se leen de forma sincrónica para no mostrar "cargando" ni un instante.
const settled = new Map<string, ResolvedImage | null>()

const keyOf = (s: ImageSearch) => `${s.lang ?? 'es'}|${s.wikiTitle?.trim() ?? ''}|${s.commonsQuery?.trim() ?? ''}|${s.context?.trim() ?? ''}`

// Wikimedia limita la tasa cuando un museo pide muchas imágenes a la vez: se reintenta con espera.
const RETRY_DELAYS_MS = [2_000, 5_000]
class TransientError extends Error {}
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function requestImage(params: URLSearchParams): Promise<ResolvedImage | null> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`/api/image?${params}`)
      if (res.status < 500) {
        if (!res.ok) return null
        const parsed = ResolvedImageSchema.safeParse(await res.json())
        return parsed.success ? parsed.data : null
      }
    } catch {
      // Error de red: transitorio, igual que un 5xx.
    }
    if (attempt >= RETRY_DELAYS_MS.length) throw new TransientError()
    await wait(RETRY_DELAYS_MS[attempt])
  }
}

/** Pide la imagen al servidor; las peticiones iguales (también las simultáneas) comparten una sola. */
export function fetchResolvedImage(search: ImageSearch): Promise<ResolvedImage | null> {
  const key = keyOf(search)
  let pending = cache.get(key)
  if (!pending) {
    const params = new URLSearchParams()
    if (search.wikiTitle?.trim()) params.set('wiki', search.wikiTitle.trim())
    if (search.commonsQuery?.trim()) params.set('commons', search.commonsQuery.trim())
    if (search.context?.trim()) params.set('context', search.context.trim())
    params.set('lang', search.lang ?? 'es')
    pending = requestImage(params).then(
      (image) => {
        settled.set(key, image)
        return image
      },
      () => {
        // Agotados los reintentos, no se recuerda el fallo: se volverá a pedir más adelante.
        cache.delete(key)
        return null
      },
    )
    cache.set(key, pending)
  }
  return pending
}

// ---- Cuadro principal ÚNICO por palacio ----
// Los títulos de sala genéricos ("Antecedentes", "Despliegue militar") colapsan al mismo artículo y varias salas mostraban
// la misma imagen. Cada sala decide su cuadro principal EN ORDEN DE SALA (determinista, aunque las respuestas lleguen
// desordenadas): si su imagen ya es el cuadro principal de otra sala, usa la imagen de una de sus piezas (la primera que
// no esté tomada) y, si ninguna sirve, queda el lienzo de yeso. Nunca se repite.
const mainDecisions = new Map<string, Promise<ResolvedImage | null>>()
const mainSettled = new Map<string, ResolvedImage | null>()
const takenImages = new Set<string>()
let mainChain: Promise<unknown> = Promise.resolve()

/** Olvida las decisiones del palacio anterior (al entrar a otro o empezar a construir uno). */
export function resetMainImages() {
  mainDecisions.clear()
  mainSettled.clear()
  takenImages.clear()
  mainChain = Promise.resolve()
}

/** Identidad de una imagen: el archivo de Wikimedia (sin miniatura ni parámetros) y su título. Sirve para detectar repetidas. */
export function imageIdentities(image: ResolvedImage): string[] {
  let raw = image.src
  if (image.src.startsWith('/api/image/file?')) raw = new URLSearchParams(image.src.slice(image.src.indexOf('?') + 1)).get('u') ?? image.src
  let file = raw
  try {
    const parts = new URL(raw, 'http://local').pathname.split('/')
    file = decodeURIComponent((parts.includes('thumb') ? parts[parts.length - 2] : parts[parts.length - 1]) ?? raw)
  } catch {
    // src raro: se compara completo
  }
  return [`file:${file.toLowerCase()}`, `title:${image.title.trim().toLowerCase()}`]
}

const isTaken = (image: ResolvedImage) => imageIdentities(image).some((id) => takenImages.has(id))
const take = (image: ResolvedImage) => imageIdentities(image).forEach((id) => takenImages.add(id))

/**
 * Decide (una sola vez por sala) la imagen de su cuadro principal: la de su búsqueda, o la de la primera pieza con
 * imagen propia si la principal ya la usa otra sala. Si su búsqueda no tiene imagen, la sala queda sin cuadro (yeso).
 */
export function decideMainImage(roomId: string, search: ImageSearch, alternatives: ImageSearch[] = []): Promise<ResolvedImage | null> {
  const known = mainDecisions.get(roomId)
  if (known) return known
  void fetchResolvedImage(search) // se adelanta la consulta; la decisión espera su turno
  const decision = mainChain.then(async () => {
    const own = await fetchResolvedImage(search)
    if (!own) {
      // Sin imagen definitiva = yeso; un fallo transitorio no se recuerda, para poder decidir de nuevo más adelante.
      if (!settled.has(keyOf(search))) mainDecisions.delete(roomId)
      else mainSettled.set(roomId, null)
      return null
    }
    let chosen: ResolvedImage | null = null
    for (const candidate of [own, ...alternatives]) {
      const image = candidate === own ? own : await fetchResolvedImage(candidate as ImageSearch)
      if (image && !isTaken(image)) {
        chosen = image
        break
      }
    }
    if (chosen) take(chosen)
    mainSettled.set(roomId, chosen)
    return chosen
  })
  mainChain = decision.catch(() => undefined)
  mainDecisions.set(roomId, decision)
  return decision
}

/** Imagen del cuadro principal de una sala: la decidida si ya se sabe; si no, la de su búsqueda sin esperar. */
export const peekMainImage = (roomId: string, search: ImageSearch) =>
  mainSettled.has(roomId) ? mainSettled.get(roomId) : settled.get(keyOf(search))

/** `undefined` mientras se decide, `null` si la sala queda sin imagen. Registra la sala si nadie lo hizo (el orden es el de llegada). */
export function useRoomMainImage(roomId: string | undefined, search: ImageSearch | undefined, alternatives: ImageSearch[]): ResolvedImage | null | undefined {
  const key = roomId && search ? `${roomId}|${keyOf(search)}` : ''
  const [state, setState] = useState<{ key: string; image: ResolvedImage | null } | null>(null)
  useEffect(() => {
    if (!roomId || !search) return
    let alive = true
    decideMainImage(roomId, search, alternatives).then((image) => alive && setState({ key, image }))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  if (!roomId || !search) return null
  if (state?.key === key) return state.image
  return mainSettled.has(roomId) ? mainSettled.get(roomId) : undefined
}

const preloaded = new Set<string>()

/** Descarga y decodifica la imagen en segundo plano para que el navegador la tenga lista al mostrarla. */
function preload(src: string): Promise<void> {
  if (preloaded.has(src)) return Promise.resolve()
  preloaded.add(src)
  const img = new Image()
  img.src = src
  return img.decode().catch(() => {
    // Si falla la descarga, se reintentará al mostrarla.
    preloaded.delete(src)
  })
}

const hasSearch = (s?: ImageSearch): s is ImageSearch => !!(s?.wikiTitle?.trim() || s?.commonsQuery?.trim())

const PREFETCH_CONCURRENCY = 4

/** Registra el cuadro principal de la sala (ver `decideMainImage`) y precarga la imagen que quede. */
function registerMain(room: Room) {
  if (!hasSearch(room.imageSearch)) return
  void decideMainImage(room.id, room.imageSearch, room.pieces.map((p) => p.imageSearch).filter(hasSearch)).then((image) => image && preload(image.src))
}

/**
 * Resuelve y precarga las imágenes de todas las salas y piezas al entrar al palacio,
 * para que la ficha de un objeto las muestre al instante. Como mucho 4 a la vez y los cuadros
 * principales de las salas primero, para no saturar al servidor ni a Wikimedia.
 */
export async function prefetchPalaceImages(palace: Museum): Promise<void> {
  // Las decisiones de cuadro principal se registran en orden de sala antes de cualquier otra cosa.
  for (const room of palace.rooms) registerMain(room)
  const ordered = [
    ...palace.rooms.map((room) => room.imageSearch),
    ...palace.rooms.flatMap((room) => room.pieces.map((p) => p.imageSearch)),
  ].filter(hasSearch)
  const seen = new Set<string>()
  const queue = ordered.filter((s) => {
    const key = keyOf(s)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  let next = 0
  const worker = async () => {
    while (next < queue.length) {
      const image = await fetchResolvedImage(queue[next++])
      if (image) await preload(image.src)
    }
  }
  await Promise.all(Array.from({ length: Math.min(PREFETCH_CONCURRENCY, queue.length) }, worker))
}

// Cupo compartido entre todas las salas que llegan en vivo: así 8 salas seguidas no piden 8 × 4 imágenes a la vez.
let roomSlotsInUse = 0
const roomSlotWaiters: Array<() => void> = []

async function withRoomSlot<T>(task: () => Promise<T>): Promise<T> {
  if (roomSlotsInUse >= PREFETCH_CONCURRENCY) await new Promise<void>((resolve) => roomSlotWaiters.push(resolve))
  roomSlotsInUse++
  try {
    return await task()
  } finally {
    roomSlotsInUse--
    roomSlotWaiters.shift()?.()
  }
}

/**
 * Resuelve y precarga las imágenes de una sala recién llegada, el cuadro principal primero. Como mucho 4
 * peticiones a la vez entre todas las salas, en orden de llegada. Las imágenes que otra petición ya trajo no se repiten.
 */
export function prefetchRoomImages(room: Room): Promise<void> {
  registerMain(room)
  const seen = new Set<string>()
  const searches = [room.imageSearch, ...room.pieces.map((p) => p.imageSearch)].filter(hasSearch).filter((s) => {
    const key = keyOf(s)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return Promise.all(
    searches.map((search) =>
      withRoomSlot(async () => {
        const image = await fetchResolvedImage(search)
        if (image) await preload(image.src)
      }),
    ),
  ).then(() => undefined)
}

/** `undefined` mientras carga, `null` si no hay imagen. */
export function useResolvedImage(search?: ImageSearch): ResolvedImage | null | undefined {
  const key = search ? keyOf(search) : ''
  const [state, setState] = useState<{ key: string; image: ResolvedImage | null } | null>(null)
  useEffect(() => {
    if (!search) return
    let alive = true
    fetchResolvedImage(search).then((image) => alive && setState({ key, image }))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  if (!search) return null
  if (state?.key === key) return state.image
  return settled.has(key) ? settled.get(key) : undefined
}

/** Lo que ya se resolvió para esta búsqueda, sin esperar: `undefined` si todavía no se sabe. */
export const peekResolvedImage = (search: ImageSearch) => settled.get(keyOf(search))

/** Texto de la licencia para la placa, en español cuando es la más común. */
export function creditLine(image: ResolvedImage): string {
  const license = /^public domain$/i.test(image.license) ? 'Dominio público' : image.license
  return [image.title, image.artist, license].filter(Boolean).join(' · ')
}

/** Una imagen subida por el usuario, con la misma forma que una de Wikimedia (placa y ficha). */
export function userImageAsResolved(src: string, title: string): ResolvedImage {
  return { src, width: 1024, height: 768, title, artist: '', license: 'Imagen subida por ti', sourceUrl: '', kind: 'photo' }
}
