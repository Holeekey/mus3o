import { z } from 'zod'
import { PartSchema } from '@mus3o/shared'

// Contrato del diorama: el LLM solo ELIGE de nuestra biblioteca y COLOCA cosas.
// Todo está acotado y tiene respaldo (.catch) para que una salida descuidada se degrade bien
// en lugar de romper la escena.

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/)
const hexOr = (fallback: string) => hex.catch(fallback)
const num = (min: number, max: number, fallback: number) =>
  z.number().finite().catch(fallback).transform((v) => Math.min(max, Math.max(min, v)))

export const TERRAINS = [
  'plain', 'hills', 'mountains', 'coast', 'river', 'forest', 'city', 'interior', 'desert', 'abstract',
  'organic', 'cellular', 'vessel', // science-kit: interiores (cavidad corporal, célula, vaso sanguíneo)
] as const
export const TIMES = ['day', 'sunset', 'night', 'storm'] as const
export const KINDS = [
  'figure', 'rider', 'horse', 'flag', 'cannon', 'tree', 'rock', 'tent', 'house', 'church',
  'ship', 'column', 'arch', 'campfire', 'custom',
  // science-kit: medicina y anatomía
  'heart-chamber-valve', 'blood-cell', 'vessel-mouth', 'node-pacemaker', 'muscle-wall', 'neuron', 'organ',
  // science-kit: biología celular
  'nucleus', 'mitochondrion', 'ribosome', 'rough-er', 'golgi', 'dna-helix', 'atp', 'membrane-protein', 'vesicle',
  // science-kit: laboratorio
  'microscope', 'flask', 'test-tube-rack',
] as const
export const POSES = ['standing', 'pointing', 'charging', 'fallen', 'seated', 'raising-arm'] as const

// science-kit: valores admitidos por los parámetros opcionales de los props científicos.
export const VALVE_TYPES = ['tricuspid', 'mitral', 'pulmonary', 'aortic'] as const
export const ORGANS = ['heart', 'lung', 'kidney', 'brain', 'liver'] as const
export const BLOOD_CELLS = ['red', 'white', 'platelet'] as const

export const DIORAMA_HALF = 14 // los props viven en [-14, 14] m
export const MAX_PROPS = 24

// science-kit: recorrido de las células en `flow`: 2–6 puntos [x, y, z] en m (y = altura sobre el suelo).
const flowPoint = z.tuple([num(-40, 40, 0), num(0, 30, 0), num(-40, 40, 0)])
export const FlowSchema = z.object({
  path: z.array(flowPoint).min(2).max(6),
  /** m/s a lo largo del recorrido. */
  speed: num(0.2, 8, 2.2),
  /** Fracción (0–1) del recorrido donde hay una válvula: las células esperan ahí mientras está cerrada. */
  gate: num(0.02, 0.98, 0.5).optional().catch(undefined),
})

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
  // science-kit: parámetros opcionales por tipo (se ignoran en los demás).
  /** Altura sobre el suelo (m): vasos en la pared, moléculas flotando... */
  y: num(0, 24, 0).default(0),
  /** heart-chamber-valve: tricúspide/pulmonar/aórtica = 3 valvas, mitral = 2. */
  valveType: z.enum(VALVE_TYPES).optional().catch(undefined),
  /** organ: qué órgano estilizado. */
  organ: z.enum(ORGANS).optional().catch(undefined),
  /** blood-cell: glóbulo rojo, blanco o plaqueta. */
  cell: z.enum(BLOOD_CELLS).optional().catch(undefined),
  /** blood-cell: circulación en bucle por un recorrido (ver FlowSchema). */
  flow: FlowSchema.optional().catch(undefined),
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
export type ValveType = (typeof VALVE_TYPES)[number]
export type OrganType = (typeof ORGANS)[number]
export type BloodCellType = (typeof BLOOD_CELLS)[number]
export type Flow = z.infer<typeof FlowSchema>

/** Valida (y repara) un diorama que viene de fuera. Nunca lanza. */
export function parseDiorama(input: unknown): Diorama {
  return DioramaSchema.parse(input ?? {})
}
