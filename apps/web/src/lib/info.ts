import { useEffect, useState } from 'react'
import { WikiInfoSchema, type ImageSearch, type WikiInfo } from '@mus3o/shared'

const cache = new Map<string, Promise<WikiInfo | null>>()
// Resultados ya resueltos: se leen de forma sincrónica (la ficha no parpadea al reabrirse; el narrador los consulta).
const settled = new Map<string, WikiInfo | null>()

const keyOf = (s: ImageSearch) => `${s.lang ?? 'es'}|${s.wikiTitle?.trim() ?? ''}|${s.context?.trim() ?? ''}`

const hasTitle = (s?: ImageSearch): s is ImageSearch => !!s?.wikiTitle?.trim()

/** Pide el resumen de Wikipedia al servidor; las peticiones iguales comparten una sola. `null` si no hay artículo. */
export function fetchWikiInfo(search: ImageSearch): Promise<WikiInfo | null> {
  if (!hasTitle(search)) return Promise.resolve(null)
  const key = keyOf(search)
  let pending = cache.get(key)
  if (!pending) {
    const params = new URLSearchParams({ wiki: search.wikiTitle!.trim(), lang: search.lang ?? 'es' })
    if (search.context?.trim()) params.set('context', search.context.trim())
    pending = fetch(`/api/info?${params}`)
      .then(async (res) => {
        if (res.status === 404) return null
        if (!res.ok) throw new Error(String(res.status))
        const parsed = WikiInfoSchema.safeParse(await res.json())
        return parsed.success ? parsed.data : null
      })
      .then(
        (info) => {
          settled.set(key, info)
          return info
        },
        () => {
          // Error transitorio: no se recuerda, se volverá a pedir al reabrir la ficha.
          cache.delete(key)
          return null
        },
      )
    cache.set(key, pending)
  }
  return pending
}

/** `undefined` mientras carga, `null` si no hay artículo. */
export function useWikiInfo(search?: ImageSearch): WikiInfo | null | undefined {
  const key = search && hasTitle(search) ? keyOf(search) : ''
  const [state, setState] = useState<{ key: string; info: WikiInfo | null } | null>(null)
  useEffect(() => {
    if (!search || !key) return
    let alive = true
    fetchWikiInfo(search).then((info) => alive && setState({ key, info }))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  if (!key) return null
  if (state?.key === key) return state.info
  return settled.has(key) ? settled.get(key) : undefined
}

/** Lo que ya se resolvió para esta búsqueda, sin esperar. */
export const peekWikiInfo = (search?: ImageSearch) => (search && hasTitle(search) ? settled.get(keyOf(search)) : null)

/** Primera oración del resumen, para que el narrador la lea (corta, sin partir en abreviaturas como "J. A."). */
export function firstSentence(text: string, max = 220): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  const re = /[.!?](?=\s+[A-ZÁÉÍÓÚÑ¿¡"«(])/g
  for (let m = re.exec(clean); m; m = re.exec(clean)) {
    const before = clean.slice(0, m.index).split(' ').pop() ?? ''
    if (/^[A-ZÁÉÍÓÚÑ]$/.test(before) || /^(?:aprox|etc|fig|vol|dr|sr|sra|ca|c|s)$/i.test(before)) continue
    const sentence = clean.slice(0, m.index + 1)
    return sentence.length <= max ? sentence : sentence.slice(0, sentence.lastIndexOf(' ', max)) + '…'
  }
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  return cut.slice(0, cut.lastIndexOf(' ')) + '…'
}

/** URL corta para mostrar como texto seleccionable (sin protocolo). */
export function shortUrl(url: string): string {
  const bare = url.replace(/^https?:\/\//, '')
  try {
    return decodeURI(bare) // «José_Antonio_Páez» se lee mejor que «Jos%C3%A9…»
  } catch {
    return bare
  }
}
