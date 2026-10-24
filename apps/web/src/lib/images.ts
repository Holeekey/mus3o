import { useEffect, useState } from 'react'
import { ResolvedImageSchema, type ImageSearch, type ResolvedImage } from '@mus3o/shared'

const cache = new Map<string, Promise<ResolvedImage | null>>()

const keyOf = (s: ImageSearch) => `${s.lang ?? 'es'}|${s.wikiTitle?.trim() ?? ''}|${s.commonsQuery?.trim() ?? ''}`

/** Pide la imagen al servidor; las peticiones iguales (también las simultáneas) comparten una sola. */
export function fetchResolvedImage(search: ImageSearch): Promise<ResolvedImage | null> {
  const key = keyOf(search)
  let pending = cache.get(key)
  if (!pending) {
    const params = new URLSearchParams()
    if (search.wikiTitle?.trim()) params.set('wiki', search.wikiTitle.trim())
    if (search.commonsQuery?.trim()) params.set('commons', search.commonsQuery.trim())
    params.set('lang', search.lang ?? 'es')
    pending = fetch(`/api/image?${params}`)
      .then(async (res) => {
        // Un error del servidor o de Wikimedia es transitorio: no se recuerda, se reintentará.
        if (res.status >= 500) cache.delete(key)
        if (!res.ok) return null
        const parsed = ResolvedImageSchema.safeParse(await res.json())
        return parsed.success ? parsed.data : null
      })
      .catch(() => {
        cache.delete(key)
        return null
      })
    cache.set(key, pending)
  }
  return pending
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
  return state?.key === key ? state.image : undefined
}

/** Texto de la licencia para la placa, en español cuando es la más común. */
export function creditLine(image: ResolvedImage): string {
  const license = /^public domain$/i.test(image.license) ? 'Dominio público' : image.license
  return [image.title, image.artist, license].filter(Boolean).join(' · ')
}
