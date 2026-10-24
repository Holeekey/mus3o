import type { Diorama } from '@mus3o/shared'
import { darken, lighten, mixHex } from './geo'

export type Atmosphere = {
  skyTop: string
  skyHorizon: string
  fog: string
  fogNear: number
  fogFar: number
  sunColor: string
  sunIntensity: number
  sunDir: [number, number, number] // hacia el sol
  hemiSky: string
  hemiGround: string
  hemiIntensity: number
  clouds: boolean
  cloudColor: string
  stars: boolean
  /** Nivel de agua: color */
  water: string
}

// Sol duro y luz plana, sin brillo ni bloom: el cielo es una escalera de tonos, no un degradado suave.
export function atmosphereOf(d: Pick<Diorama, 'time' | 'palette'>): Atmosphere {
  const { sky, ground } = d.palette
  const water = mixHex('#2a6f97', sky, 0.35)
  switch (d.time) {
    case 'sunset': {
      const horizon = mixHex('#f2a65a', sky, 0.15)
      return {
        skyTop: mixHex(darken(sky, 0.45), '#3b2f6b', 0.55),
        skyHorizon: horizon,
        fog: mixHex(horizon, '#c97b63', 0.35),
        fogNear: 45,
        fogFar: 115,
        sunColor: '#ffb070',
        sunIntensity: 2.5,
        sunDir: [-0.78, 0.3, -0.55],
        hemiSky: '#f0b48e',
        hemiGround: mixHex(ground, '#4a2c3a', 0.6),
        hemiIntensity: 1.05,
        clouds: true,
        cloudColor: '#f6c4a0',
        stars: false,
        water: mixHex(water, '#e08a5a', 0.3),
      }
    }
    case 'night':
      return {
        skyTop: '#070b22',
        skyHorizon: '#1d2b5a',
        fog: '#17234b',
        fogNear: 22,
        fogFar: 100,
        sunColor: '#a9bcff',
        sunIntensity: 0.9,
        sunDir: [0.4, 0.75, 0.45],
        hemiSky: '#4b5fa8',
        hemiGround: '#141826',
        hemiIntensity: 0.75,
        clouds: false,
        cloudColor: '#3a4577',
        stars: true,
        water: '#14224a',
      }
    case 'storm':
      return {
        skyTop: '#3d444d',
        skyHorizon: '#8b939b',
        fog: '#7c848c',
        fogNear: 16,
        fogFar: 88,
        sunColor: '#d3dce4',
        sunIntensity: 1.1,
        sunDir: [0.3, 0.8, 0.3],
        hemiSky: '#a0a9b2',
        hemiGround: darken(ground, 0.5),
        hemiIntensity: 1.0,
        clouds: true,
        cloudColor: '#59616a',
        stars: false,
        water: '#4b5d6b',
      }
    case 'day':
    default: {
      const horizon = lighten(sky, 0.6)
      return {
        skyTop: darken(sky, 0.06),
        skyHorizon: horizon,
        fog: lighten(sky, 0.5),
        fogNear: 55,
        fogFar: 118,
        sunColor: '#fff1d6',
        sunIntensity: 2.8,
        sunDir: [0.55, 0.78, 0.32],
        hemiSky: lighten(sky, 0.35),
        hemiGround: mixHex(ground, '#4a3a2a', 0.5),
        hemiIntensity: 1.55,
        clouds: true,
        cloudColor: '#fbf7ee',
        stars: false,
        water,
      }
    }
  }
}
