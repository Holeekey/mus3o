import { firstSentence } from '../lib/info'

// Guía de Aris dentro de los cuadros: funciones puras que arman, con plantillas fijas, lo que dice
// Aris. Todo sale de los datos del museo (apuntes, títulos, periodo, Wikipedia ya recuperada):
// no se llama a ningún modelo y no se inventa nada.

/** Dónde aparece el jugador al entrar (coordenadas locales del diorama) y hacia dónde mira. */
export const DIORAMA_SPAWN = { x: 0, z: 10.6, yaw: Math.PI } as const

/** Cuántos conceptos se nombran en la introducción; el resto se resume como "y N más". */
export const INTRO_MAX_ITEMS = 4
/** Tope de caracteres del texto de los apuntes en la explicación de una pieza. */
export const PIECE_TEXT_MAX = 240

/**
 * Dirección de un punto respecto a quien mira. `yaw` es atan2(fwd.x, fwd.z), la misma convención
 * que playerPose: con yaw = π se mira hacia -Z y la derecha es +X.
 */
export function relativeDirection(yaw: number, from: { x: number; z: number }, to: { x: number; z: number }): string {
  const fx = Math.sin(yaw)
  const fz = Math.cos(yaw)
  const dx = to.x - from.x
  const dz = to.z - from.z
  const ahead = dx * fx + dz * fz
  const right = dx * -fz + dz * fx
  const deg = (Math.atan2(right, ahead) * 180) / Math.PI // + derecha, - izquierda
  const side = deg >= 0 ? 'derecha' : 'izquierda'
  const a = Math.abs(deg)
  if (a <= 25) return 'justo delante'
  if (a <= 65) return `delante, a tu ${side}`
  if (a <= 115) return `a tu ${side}`
  if (a <= 155) return `detrás, a tu ${side}`
  return 'a tu espalda'
}

export type IntroItem = { title: string; direction: string }

export type IntroInput = {
  dioramaTitle: string
  roomTitle?: string
  /** Periodo o fecha de la sala, si los apuntes lo traen. */
  period?: string
  items: IntroItem[]
}

const stop = (s: string) => {
  const t = s.trim()
  return /[.!?…]$/.test(t) ? t : `${t}.`
}

/** Introducción al entrar: qué escena es y qué conceptos hay a la vista (2–4 oraciones). */
export function buildIntro({ dioramaTitle, roomTitle, period, items }: IntroInput): string {
  const where = roomTitle?.trim() ? ` de la sala «${roomTitle.trim()}»` : ''
  const when = period?.trim() ? ` (${period.trim()})` : ''
  const first = `Estás dentro del cuadro «${dioramaTitle.trim()}»${where}${when}.`
  if (!items.length) {
    return `${first} Es una escena para recorrer: no tiene conceptos de tus apuntes enlazados, así que mira a tu alrededor con calma.`
  }
  const shown = items.slice(0, INTRO_MAX_ITEMS)
  const rest = items.length - shown.length
  const list = shown.map((i) => `${i.title.trim()} (${i.direction})`).join(', ')
  const here =
    items.length === 1
      ? `Aquí hay un concepto de tus apuntes: ${list}.`
      : `Aquí ves ${items.length} conceptos de tus apuntes: ${list}${rest > 0 ? ` y ${rest} más` : ''}.`
  return `${first} ${here} Acércate y mira cada uno para que te cuente de qué se trata.`
}

/** Recorta a un máximo de oraciones completas y de caracteres (sin cortar a media palabra). */
export function clipSentences(text: string, max = PIECE_TEXT_MAX, maxSentences = 2): string {
  let rest = text.replace(/\s+/g, ' ').trim()
  let out = ''
  for (let n = 0; n < maxSentences && rest; n++) {
    const room = max - out.length - (out ? 1 : 0)
    if (room < 30) break
    const s = firstSentence(rest, room)
    if (!s) break
    out = out ? `${out} ${s}` : s
    if (s.endsWith('…')) break // se recortó: no sigue
    rest = rest.slice(s.length).trim()
  }
  return out
}

export type PieceInput = {
  title: string
  text?: string
  /** Línea de los apuntes donde está la idea. */
  sourceLine?: number
  /** La idea tiene cita en los apuntes (aunque no se conozca la línea). */
  hasSource?: boolean
  /** La IA la agregó y no está en los apuntes. */
  unverified?: boolean
  /** Resumen de Wikipedia ya recuperado (nunca se pide aquí). */
  wiki?: { title: string; extract: string } | null
}

/** Lo que Aris dice al mirar un concepto: título, 1–2 oraciones de los apuntes y su fuente. */
export function buildPieceNarration(p: PieceInput): string {
  const parts = [stop(p.title)]
  const body = p.text ? clipSentences(p.text) : ''
  if (body) {
    parts.push(stop(body))
  } else if (p.wiki?.extract) {
    parts.push(`Wikipedia dice: ${stop(firstSentence(p.wiki.extract, PIECE_TEXT_MAX))}`)
  }
  if (p.sourceLine) parts.push(`Según tus apuntes, línea ${p.sourceLine}.`)
  else if (p.hasSource) parts.push('Esto sale de tus apuntes.')
  else if (p.unverified) parts.push('Ojo: esta idea no aparece en tus apuntes.')
  if (p.wiki) parts.push(`En Wikipedia: «${p.wiki.title}».`)
  return parts.join(' ')
}

/** Tiempo estimado (ms) que tarda en decirse (`voiced`) o leerse un texto; sirve para no pisar lo que Aris aún cuenta. */
export function speechMs(text: string, voiced = false): number {
  return Math.max(2500, text.length * (voiced ? 62 : 28))
}

/** Registro de piezas ya contadas en esta visita: no se repiten salvo que el usuario lo pida. */
export function createVisitTracker() {
  const seen = new Set<string>()
  return {
    /** true la primera vez que se pregunta por la pieza en la visita (y la marca como contada). */
    claim(id: string): boolean {
      if (seen.has(id)) return false
      seen.add(id)
      return true
    },
    has: (id: string) => seen.has(id),
    reset: () => seen.clear(),
    get size() {
      return seen.size
    },
  }
}
