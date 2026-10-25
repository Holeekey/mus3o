import { useEffect, useState } from 'react'
import type { Diorama, ResolvedImage } from '@mus3o/shared'
import { useStore } from '../store'
import { createPhotoDioramaClient, wikimediaUrlOf } from './photoDiorama'

/** Cliente único de la sesión: cola de 2 peticiones, la sala del jugador primero. */
export const photoDioramas = createPhotoDioramaClient({ currentRoomId: () => useStore.getState().currentRoomId })

/** Salas a esta distancia (m) de la del jugador ya piden su diorama: así está listo cuando llega, sin pedirlo todo de golpe. */
const NEAR_ROOM_M = 64

/** ¿Esta sala está cerca de donde está el jugador (o de la sala inicial, antes de entrar a alguna)? */
function useRoomNear(roomId: string | undefined) {
  return useStore((s) => {
    if (!roomId || !s.layout) return false
    const rooms = s.layout.rooms
    const mine = rooms.find((r) => r.id === roomId)
    const here = (s.currentRoomId ? rooms.find((r) => r.id === s.currentRoomId) : undefined) ?? rooms[0]
    if (!mine || !here) return false
    return Math.hypot(mine.x - here.x, mine.z - here.z) <= NEAR_ROOM_M
  })
}

/**
 * Diorama recreado desde la foto del cuadro principal de una sala. `undefined` mientras se decide, `null` si el
 * cuadro debe quedar normal (no es una escena, es un diagrama, imagen subida por el usuario o sin IA).
 * Privacidad: al servidor solo viajan la URL pública de Wikimedia, el título de la imagen y el de la sala; los conceptos de los apuntes no salen del navegador.
 * Solo se pide cuando `enabled` (cuadro principal sin diorama de la biblioteca), con la imagen ya resuelta y la sala cerca.
 */
export function usePhotoDiorama(opts: { enabled: boolean; image?: ResolvedImage | null; roomId?: string; roomTitle?: string }): Diorama | null | undefined {
  const url = opts.enabled && opts.image && opts.image.kind !== 'diagram' ? wikimediaUrlOf(opts.image.src) : null
  const near = useRoomNear(opts.roomId)
  const [state, setState] = useState<{ url: string; diorama: Diorama | null } | null>(null)
  const title = opts.image?.title ?? ''
  const roomTitle = opts.roomTitle ?? ''
  useEffect(() => {
    if (!url || !near) return
    let alive = true
    void photoDioramas
      .request({ imageUrl: url, title, roomTitle, concepts: [], roomId: opts.roomId })
      .then((diorama) => alive && setState({ url, diorama }))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, near, roomTitle])
  if (!opts.enabled || !opts.image) return opts.enabled ? undefined : null
  if (!url) return null
  if (state?.url === url) return state.diorama
  const known = photoDioramas.peek(url)
  return known === undefined ? undefined : known
}
