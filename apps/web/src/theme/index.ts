import { hash } from '../palace/layout'
import { teatro } from './teatro'
import type { RoomPalette, Theme } from './types'

export type { RoomPalette, Theme } from './types'

export const THEMES: Record<string, Theme> = { teatro }
export const DEFAULT_THEME = teatro

export function getTheme(id?: string | null): Theme {
  return (id && THEMES[id]) || DEFAULT_THEME
}

/**
 * Paletas de las salas de un palacio: cada sala toma su color de hash(nombre), así el mismo tema
 * siempre se ve igual. Si dos salas caen en el mismo color, la segunda avanza al siguiente libre.
 */
export function roomPalettes(theme: Theme, roomNames: string[]): RoomPalette[] {
  const used = new Set<number>()
  return roomNames.map((name) => {
    let i = hash(name.trim().toLowerCase()) % theme.rooms.length
    for (let k = 0; k < theme.rooms.length && used.has(i); k++) i = (i + 1) % theme.rooms.length
    used.add(i)
    return theme.rooms[i]
  })
}

/** Aplica los tokens de UI del tema como variables CSS en :root. */
export function applyThemeTokens(theme: Theme) {
  const root = document.documentElement
  for (const [k, v] of Object.entries(theme.ui.tokens)) root.style.setProperty(`--${k}`, v)
  root.style.setProperty('--font-display', theme.ui.fonts.display)
  root.style.setProperty('--font-body', theme.ui.fonts.body)
  root.dataset.theme = theme.id
}
