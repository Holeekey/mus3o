import { useEffect, useState } from 'react'
import { ResolvedImageSchema, type ImageSearch, type Museum, type ResolvedImage } from '@mus3o/shared'

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

/**
 * Resuelve y precarga las imágenes de todas las salas y piezas al entrar al palacio,
 * para que la ficha de un objeto las muestre al instante.
 */
export async function prefetchPalaceImages(palace: Museum): Promise<void> {
  const searches = palace.rooms.flatMap((room) => [room.imageSearch, ...room.pieces.map((p) => p.imageSearch)])
  await Promise.all(
    searches.filter(hasSearch).map(async (search) => {
      const image = await fetchResolvedImage(search)
      if (image) await preload(image.src)
    }),
  )
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
