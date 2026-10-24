import type { Diorama, Museum, Room } from '@mus3o/shared'
import { CARABOBO } from '../mocks/caraboboDiorama'
import { CELULA, CORAZON, NEURONA } from './medicina'

/**
 * Biblioteca de dioramas hechos a mano. Un museo generado por IA no trae dioramas: al entrar
 * se recuperan de aquí los que encajan con el tema de una sala (por palabras clave, sin IA).
 */
export type LibraryEntry = { id: string; keywords: string[]; diorama: Diorama }

export const DIORAMA_LIBRARY: LibraryEntry[] = [
  { id: 'carabobo', keywords: ['carabobo'], diorama: CARABOBO },
  {
    id: 'heart',
    keywords: ['corazon', 'cardiaco', 'cardiaca', 'auricula', 'ventriculo', 'valvula mitral', 'tricuspide'],
    diorama: CORAZON,
  },
  {
    id: 'cell',
    keywords: ['celula', 'organelo', 'mitocondria', 'nucleo celular', 'membrana celular', 'citoplasma'],
    diorama: CELULA,
  },
  { id: 'neuron', keywords: ['neurona', 'sinapsis', 'axon', 'dendrita', 'impulso nervioso'], diorama: NEURONA },
]

/** Minúsculas, sin tildes, solo letras y números separados por espacios. */
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim()

/** La palabra clave aparece al inicio de alguna palabra ("corazon" casa con "corazones"). */
const hasKeyword = (text: string, keyword: string) => ` ${fold(text)}`.includes(` ${keyword}`)
const matches = (text: string, keywords: string[]) => keywords.some((k) => hasKeyword(text, k))

/** Puntaje de una sala frente a una entrada: nombre (10) o, si no, la mayoría de los títulos de sus piezas. */
function scoreRoom(room: Room, entry: LibraryEntry): number {
  if (matches(room.name, entry.keywords)) return 10
  const hits = room.pieces.filter((p) => matches(p.title, entry.keywords)).length
  return room.pieces.length > 0 && hits * 2 > room.pieces.length ? hits : 0
}

const stem = (w: string) => w.replace(/(es|s)$/, '')
const stems = (s: string) => fold(s).split(' ').filter(Boolean).map(stem)

/** El título de la pieza contiene el rótulo del prop (o al revés), ignorando tildes y plurales. */
function titleMatchesLabel(title: string, label: string): boolean {
  const t = stems(title)
  const l = stems(label)
  if (t.length === 0 || l.length === 0) return false
  return l.every((w) => t.includes(w)) || t.every((w) => l.includes(w))
}

/**
 * Copia el diorama con los `pieceId` de sus props reasignados a las piezas de la sala (por título
 * parecido al rótulo). Los enlaces sin pieza se quitan: el rótulo se queda, pero no apunta a nada.
 */
export function remapDiorama(diorama: Diorama, room: Room): Diorama {
  const copy = structuredClone(diorama)
  copy.props = copy.props.map((prop) => {
    if (!prop.pieceId) return prop
    const label = prop.label
    const piece = label ? room.pieces.find((p) => titleMatchesLabel(p.title, label)) : undefined
    const { pieceId: _old, ...rest } = prop
    return piece ? { ...rest, pieceId: piece.id } : rest
  })
  return copy
}

/**
 * A las salas sin diorama cuyo tema coincide con una entrada de la biblioteca les pone ese diorama.
 * Como máximo una sala por entrada (la que mejor coincide) y nunca pisa un diorama existente.
 * No muta el museo: si nada coincide, devuelve el mismo objeto.
 */
export function attachLibraryDioramas(museum: Museum, library: LibraryEntry[] = DIORAMA_LIBRARY): Museum {
  const taken = new Set(museum.rooms.map((r) => r.diorama?.title).filter(Boolean))
  const assigned = new Map<number, Diorama>()
  for (const entry of library) {
    if (taken.has(entry.diorama.title)) continue
    let best = -1
    let bestScore = 0
    museum.rooms.forEach((room, i) => {
      if (room.diorama || assigned.has(i)) return
      const score = scoreRoom(room, entry)
      if (score > bestScore) {
        best = i
        bestScore = score
      }
    })
    if (best >= 0) assigned.set(best, remapDiorama(entry.diorama, museum.rooms[best]))
  }
  if (assigned.size === 0) return museum
  return { ...museum, rooms: museum.rooms.map((room, i) => (assigned.has(i) ? { ...room, diorama: assigned.get(i) } : room)) }
}
