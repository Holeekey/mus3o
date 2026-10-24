import { z } from 'zod'
import { PartSchema } from '@mus3o/shared'

// Contrato del diorama: el LLM solo ELIGE de nuestra biblioteca y COLOCA cosas.
// Todo está acotado y tiene respaldo (.catch) para que una salida descuidada se degrade bien
// en lugar de romper la escena.

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/)
const hexOr = (fallback: string) => hex.catch(fallback)
const num = (min: number, max: number, fallback: number) =>
  z.number().finite().catch(fallback).transform((v) => Math.min(max, Math.max(min, v)))

export const TERRAINS = ['plain', 'hills', 'mountains', 'coast', 'river', 'forest', 'city', 'interior', 'desert', 'abstract'] as const
export const TIMES = ['day', 'sunset', 'night', 'storm'] as const
export const KINDS = [
  'figure', 'rider', 'horse', 'flag', 'cannon', 'tree', 'rock', 'tent', 'house', 'church',
  'ship', 'column', 'arch', 'campfire', 'custom',
] as const
export const POSES = ['standing', 'pointing', 'charging', 'fallen', 'seated', 'raising-arm'] as const

export const DIORAMA_HALF = 14 // los props viven en [-14, 14] m
export const MAX_PROPS = 24

export const DioramaPropSchema = z.object({
  kind: z.enum(KINDS),
  pose: z.enum(POSES).optional().catch(undefined),
  color: hex.optional().catch(undefined),
  secondary: hex.optional().catch(undefined),
  pos: z
    .tuple([num(-DIORAMA_HALF, DIORAMA_HALF, 0), num(-DIORAMA_HALF, DIORAMA_HALF, 0)])
    .catch([0, 0]),
  rotY: num(-7, 7, 0).default(0),
  scale: num(0.5, 3, 1).default(1),
  count: z.number().finite().catch(1).transform((v) => Math.min(30, Math.max(1, Math.round(v)))).default(1),
  spread: num(0, 8, 0).default(0),
  label: z.string().max(40).optional().catch(undefined),
  pieceId: z.string().min(1).max(120).optional().catch(undefined),
  parts: z.array(PartSchema).max(10).optional().catch(undefined),
})

export const DioramaSchema = z.object({
  title: z.string().min(1).max(80).catch('Diorama'),
  terrain: z.enum(TERRAINS).catch('plain'),
  time: z.enum(TIMES).catch('day'),
  palette: z
    .object({
      ground: hexOr('#8a9a5b'),
      sky: hexOr('#9fc4e8'),
      accent: hexOr('#c9963a'),
    })
    .catch({ ground: '#8a9a5b', sky: '#9fc4e8', accent: '#c9963a' }),
  // Un prop inválido se descarta, no tumba el diorama entero; el exceso se recorta a MAX_PROPS.
  props: z
    .array(z.unknown())
    .catch([])
    .transform((arr) =>
      arr
        .map((p) => DioramaPropSchema.safeParse(p))
        .filter((r): r is { success: true; data: z.infer<typeof DioramaPropSchema> } => r.success)
        .map((r) => r.data)
        .filter((p) => p.kind !== 'custom' || (p.parts && p.parts.length > 0))
        .slice(0, MAX_PROPS),
    ),
})

export type Diorama = z.infer<typeof DioramaSchema>
export type DioramaProp = z.infer<typeof DioramaPropSchema>
export type DioramaKind = (typeof KINDS)[number]
export type DioramaPose = (typeof POSES)[number]
export type DioramaTerrain = (typeof TERRAINS)[number]
export type DioramaTime = (typeof TIMES)[number]

/** Valida (y repara) un diorama que viene de fuera. Nunca lanza. */
export function parseDiorama(input: unknown): Diorama {
  return DioramaSchema.parse(input ?? {})
}
