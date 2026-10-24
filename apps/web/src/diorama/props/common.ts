import type * as THREE from 'three'
import type { DioramaPose, DioramaTerrain, FlagPattern } from '@mus3o/shared'

export type PropCtx = {
  color?: string
  secondary?: string
  accent: string
  ground: string
  pose?: DioramaPose
  /** Solo banderas: 'saltire' = aspa. */
  pattern?: FlagPattern
  seed: number
  terrain: DioramaTerrain
}

export type Built = {
  geometry: THREE.BufferGeometry
  /** Radio de colisión en m (0 = atravesable). */
  radius: number
  /** Altura aproximada, para etiquetas. */
  height: number
  /** Movimiento sutil por instancia. */
  motion: 'none' | 'idle' | 'gallop' | 'breath'
  /** Luz puntual cálida (hogueras): sin brillo, solo ilumina. */
  light?: { offset: [number, number, number]; color: string; intensity: number; distance: number }
  /** Altura sobre el agua a la que flota (barcos). */
  floats?: boolean
}

export const SKIN = ['#e0b08a', '#c68a5e', '#a06a45', '#6e4630', '#d79d7a'] as const
export const HORSE = ['#7a4a2a', '#4e3220', '#a9774a', '#d8d0c0', '#2c231e', '#8f6034'] as const
export const WOOD = '#6b4a2b'
export const STEEL = '#8d9196'
export const IRON = '#3b3a3a'
export const GOLD = '#c9a24b'
