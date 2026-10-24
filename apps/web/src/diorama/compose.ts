import { MAX_PROPS, parseDiorama, type Diorama, type Museum, type Room } from '@mus3o/shared'
import { fold } from './library'
import { hashStr, mulberry32, type Rng } from './random'
import { heightField, shoreZ } from './terrain'

/**
 * Compositor procedural de dioramas. Sin IA: a partir del tema de una sala (nombre, descripción y
 * piezas) elige un arquetipo y arma la escena con la biblioteca de props. Es determinista: la misma
 * sala y la misma semilla dan siempre el mismo diorama. Cada pieza de la sala recibe un prop enlazado
 * (rótulo + ficha) colocado en un abanico delante del punto de aparición.
 */

export type Archetype = 'battle' | 'assembly' | 'naval' | 'sacred' | 'nature' | 'city' | 'cell' | 'organ' | 'neural' | 'abstract'

export type Pigment = { wall?: string; floor?: string; trim?: string }

type RoomLike = Pick<Room, 'name' | 'description' | 'pieces'>
type PieceLike = { id: string; title: string; text: string }
type Raw = Record<string, unknown>

// ---------------------------------------------------------------------------------------------
// Clasificador de arquetipo
// ---------------------------------------------------------------------------------------------

/** Una palabra clave que termina en "!" solo casa como palabra completa; el resto, como inicio de palabra. */
const KEYWORDS: Record<Exclude<Archetype, 'abstract'>, string[]> = {
  battle: [
    'batalla', 'guerra', 'ejercito', 'combate', 'independencia', 'conquista', 'asedio', 'cruzada', 'invasion', 'soldado',
    'tropa', 'caballeria', 'bastilla', 'rebelion', 'insurreccion', 'ofensiva', 'campana militar', 'militar', 'libertador',
    'war!', 'battle', 'army', 'siege', 'conquest', 'independence', 'combat', 'soldier', 'troops', 'cavalry', 'uprising',
  ],
  assembly: [
    'congreso', 'asamblea', 'revolucion', 'parlamento', 'constitucion', 'rey!', 'reyes!', 'reina!', 'imperio', 'republica',
    'senado', 'tratado', 'gobierno', 'monarquia', 'declaracion', 'democracia', 'tribunal', 'estados generales', 'corte!',
    'congress', 'assembly', 'revolution', 'parliament', 'constitution', 'king!', 'queen!', 'empire', 'republic', 'senate',
    'treaty', 'government', 'monarchy', 'declaration', 'democracy',
  ],
  naval: [
    'mar!', 'naval', 'barco', 'puerto', 'flota', 'oceano', 'navegacion', 'marina', 'buque', 'pirata', 'galeon', 'naufragio',
    'armada', 'marinero', 'ship', 'sea!', 'ocean', 'port!', 'fleet', 'navy', 'maritime', 'sailor', 'harbor', 'harbour',
  ],
  sacred: [
    'iglesia', 'religion', 'papa!', 'papado', 'templo', 'dios!', 'dioses', 'catedral', 'sagrad', 'monasterio', 'biblia',
    'cristian', 'islam', 'budis', 'hinduis', 'mitologia', 'mezquita', 'sinagoga', 'vaticano', 'espiritual', 'santuario',
    'church', 'temple', 'god!', 'gods!', 'cathedral', 'religi', 'pope!', 'mosque', 'sacred', 'mythology', 'monastery',
  ],
  nature: [
    'rio!', 'rios!', 'montana', 'selva', 'clima', 'ecosistema', 'volcan', 'bosque', 'geografia', 'relieve', 'desierto',
    'glaciar', 'lago!', 'cordillera', 'andes', 'fauna', 'flora', 'bioma', 'biodiversidad', 'paisaje', 'cascada', 'ecologia',
    'river!', 'mountain', 'forest', 'jungle', 'climate', 'ecosystem', 'volcano', 'desert', 'glacier', 'geography', 'landscape',
  ],
  city: [
    'ciudad', 'urban', 'comercio', 'industri', 'mercado', 'metropoli', 'calle!', 'fabrica', 'pueblo!', 'plaza!', 'arrabal',
    'city', 'urban', 'trade!', 'commerce', 'industry', 'industrial', 'market!', 'factory', 'street', 'town!',
  ],
  cell: [
    'celula', 'celular', 'organelo', 'mitocondria', 'nucleo', 'citoplasma', 'membrana', 'adn!', 'arn!', 'ribosoma', 'bacteria',
    'virus!', 'cromosoma', 'genetica', 'mitosis', 'meiosis', 'reticulo', 'golgi', 'microscop',
    'cell!', 'cells!', 'dna!', 'rna!', 'organelle', 'nucleus', 'chromosome', 'genetic',
  ],
  organ: [
    'corazon', 'cardiac', 'cardio', 'pulmon', 'rinon', 'higado', 'cerebro', 'organo', 'sangre', 'circulatorio', 'respiratorio',
    'digestivo', 'anatomia', 'musculo', 'hueso', 'arteria', 'vena!', 'venas!', 'valvula', 'ventriculo', 'auricula',
    'heart', 'lung', 'kidney', 'liver', 'brain', 'blood', 'organ!', 'organs!', 'anatomy', 'muscle', 'artery',
  ],
  neural: ['neurona', 'sinapsis', 'axon', 'dendrita', 'impulso nervioso', 'neuro', 'nervioso', 'neural', 'synapse', 'nerve!'],
}

const PRIORITY: Archetype[] = ['neural', 'cell', 'organ', 'battle', 'naval', 'sacred', 'assembly', 'nature', 'city']
const THRESHOLD = 3

const wordMatch = (folded: string, kw: string) =>
  kw.endsWith('!') ? ` ${folded} `.includes(` ${kw.slice(0, -1)} `) : ` ${folded}`.includes(` ${kw}`)

const countHits = (folded: string, kws: string[]) => kws.filter((k) => wordMatch(folded, k)).length

const textOf = (s: unknown) => (typeof s === 'string' ? s : '')
const piecesOf = (room: RoomLike): PieceLike[] =>
  (Array.isArray(room?.pieces) ? room.pieces : [])
    .filter((p) => p && typeof p === 'object')
    .map((p, i) => ({ id: textOf(p.id) || `p${i}`, title: textOf(p.title), text: textOf(p.text) }))

/** Arquetipo de una sala por puntaje de palabras clave (sin tildes, es + en). Por omisión, `abstract`. */
export function classifyRoom(room: RoomLike, museumTitle = ''): Archetype {
  const name = fold(textOf(room?.name))
  const desc = fold(textOf(room?.description))
  const pieces = piecesOf(room)
  const titles = pieces.map((p) => fold(p.title))
  const texts = pieces.map((p) => fold(p.text))
  const museum = fold(textOf(museumTitle))
  let best: Archetype = 'abstract'
  let bestScore = THRESHOLD - 0.001
  for (const arch of PRIORITY) {
    const kws = KEYWORDS[arch as Exclude<Archetype, 'abstract'>]
    let score = countHits(name, kws) * 4 + countHits(desc, kws) * 1.5 + countHits(museum, kws) * 0.5
    for (const t of titles) score += countHits(t, kws) * 2
    for (const t of texts) score += Math.min(1, countHits(t, kws)) * 1
    if (score > bestScore) {
      best = arch
      bestScore = score
    }
  }
  return best
}

// ---------------------------------------------------------------------------------------------
// Personas vs. cosas
// ---------------------------------------------------------------------------------------------

const MARKERS = new Set([
  'rey', 'reina', 'general', 'san', 'santa', 'santo', 'papa', 'don', 'dona', 'dr', 'doctor', 'presidente', 'emperador', 'libertador',
  'capitan', 'coronel', 'mariscal', 'king', 'queen', 'saint', 'pope', 'sir', 'lord', 'president', 'emperor', 'captain', 'marshal',
  'principe', 'prince', 'duque', 'conde', 'fray', 'padre', 'almirante', 'admiral',
])
const ARTICLES = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'lo', 'the', 'a', 'an'])
const CONNECTORS = new Set(['de', 'del', 'la', 'van', 'von', 'da', 'di', 'y', 'of'])
const GENERIC = new Set([
  'toma', 'declaracion', 'tratado', 'guerra', 'batalla', 'estados', 'generales', 'historia', 'introduccion', 'concepto', 'conceptos',
  'definicion', 'tipos', 'funciones', 'origen', 'origenes', 'causas', 'consecuencias', 'resumen', 'conclusion', 'sistema', 'sistemas',
  'teoria', 'ley', 'leyes', 'principios', 'fundamentos', 'elementos', 'estructura', 'modelo', 'analisis', 'metodo', 'proceso',
  'etapas', 'fases', 'caracteristicas', 'ejemplos', 'big', 'bang', 'machine', 'learning', 'linear', 'algebra', 'operating',
  'revolution', 'revolucion', 'history', 'theory', 'law', 'laws', 'types', 'basics', 'overview', 'summary',
])
const SUFFIX = /(cion|sion|dad|ismo|ista|ia|tura|logia|grafia|ncia|miento|ico|ica|al|ar|or|ion)$/
const TEXT_PERSON = /\b(nacio|murio|falleci|born|died)\b|\b(fue|was) (un|una|el|la|a|an|the) (militar|politic|general|lider|escritor|cientific|pintor|rey|reina|president|libertador|filosof|matematic|abogado|emperador|soldado|caudillo|heroe|explorador|inventor|ingenier|king|queen|leader|writer|scientist|painter|philosopher|mathematician|hero|explorer|engineer)/

const ALL_KEYWORDS = Object.values(KEYWORDS).flat()

function personOf(title: string, text: string, arch: Archetype): boolean {
  if (arch === 'cell' || arch === 'organ' || arch === 'neural') return false
  const cleaned = title.replace(/\([^)]*\)/g, ' ').replace(/[,;:.–—-]+/g, ' ').trim()
  const tokens = cleaned.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return false
  const foldedTokens = tokens.map((t) => fold(t))
  if (MARKERS.has(foldedTokens[0]) && tokens.length >= 2) return true
  if (ARTICLES.has(foldedTokens[0]) && tokens[0][0] === tokens[0][0].toLowerCase()) return false
  if (ARTICLES.has(foldedTokens[0])) return false
  const folded = foldedTokens.join(' ')
  const keywordHit = ALL_KEYWORDS.some((k) => wordMatch(folded, k))
  const generic = foldedTokens.some((t) => GENERIC.has(t))
  if (keywordHit || generic) return false
  const significant = tokens.filter((t) => !CONNECTORS.has(fold(t)))
  const capitalized = significant.length > 0 && significant.every((t) => /^[A-ZÁÉÍÓÚÑ]/.test(t))
  const textSignal = TEXT_PERSON.test(fold(text))
  if (textSignal && capitalized && significant.length <= 4) return true
  const namesAllowed = arch === 'battle' || arch === 'assembly' || arch === 'naval' || arch === 'sacred'
  if (!namesAllowed || !capitalized) return false
  if (significant.length >= 2 && significant.length <= 4) return true
  if (significant.length === 1) {
    const w = fold(significant[0])
    if (w.length < 3 || w.length > 14) return false
    if (SUFFIX.test(w)) return false
    if (w.endsWith('a') && !textSignal) return false // "Brújula", "Carabela": casi siempre cosas
    if (w.endsWith('s') && w.length > 6) return false
    return true
  }
  return false
}

// ---------------------------------------------------------------------------------------------
// Colores
// ---------------------------------------------------------------------------------------------

const isHex = (s: unknown): s is string => typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s)
function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('')
}

const DEFAULTS: Record<Archetype, { terrain: Diorama['terrain']; time: Diorama['time']; ground: string; sky: string; accent: string }> = {
  battle: { terrain: 'hills', time: 'day', ground: '#a39b58', sky: '#86b4dc', accent: '#c8102e' },
  assembly: { terrain: 'interior', time: 'day', ground: '#b9ae9a', sky: '#cfd8e6', accent: '#b08a3a' },
  naval: { terrain: 'coast', time: 'sunset', ground: '#d8c795', sky: '#e9a874', accent: '#2a6f97' },
  sacred: { terrain: 'interior', time: 'sunset', ground: '#b9ad98', sky: '#e6c9a0', accent: '#d9b455' },
  nature: { terrain: 'forest', time: 'day', ground: '#6f8f4e', sky: '#8fc0e6', accent: '#d8b24a' },
  city: { terrain: 'city', time: 'day', ground: '#a8a49a', sky: '#a9c2de', accent: '#c0603a' },
  cell: { terrain: 'cellular', time: 'day', ground: '#9a6a86', sky: '#bfe4d8', accent: '#f0c968' },
  organ: { terrain: 'organic', time: 'day', ground: '#b4514b', sky: '#4a1a21', accent: '#ecd2a6' },
  neural: { terrain: 'cellular', time: 'day', ground: '#8a82c0', sky: '#c8c3ee', accent: '#e4d2ff' },
  abstract: { terrain: 'interior', time: 'day', ground: '#cfc8b8', sky: '#dfe6f0', accent: '#c9963a' },
}

const COSTUMES = ['#2b4c94', '#a8322d', '#c9a24b', '#3c6e47', '#6b3f7a', '#2f7f86']
const PAPER = '#efe8d8'
const STONE = '#d9d3c6'
const STONE_DARK = '#7a756b'

// ---------------------------------------------------------------------------------------------
// Colocación: abanico delante del punto de aparición (0, 10.6, mirando a -z)
// ---------------------------------------------------------------------------------------------

/** Separación mínima (m) entre dos props enlazados. */
export const MIN_LINK_SPACING = 3.4
/** Los props de la zona de entrada (z > ENTRY_Z) deben quedar libres. */
export const ENTRY_Z = 6
export const MAX_LINKED = 12

/** `row` 1 = arco trasero de la doble fila: sus props crecen un poco para que los rótulos no se pisen. */
type Slot = { x: number; z: number; rotY: number; row?: number }

const ARC_CZ = 4

/** Hasta 6 piezas en un arco; de 7 a 12, en dos arcos concéntricos. Ordenadas de izquierda a derecha. */
export function arcSlots(n: number): Slot[] {
  const pts: { a: number; r: number; row: number }[] = []
  const row = (count: number, r: number, maxSpan: number, rowIdx = 0, phase = 0) => {
    const step = count > 1 ? Math.min(0.62, maxSpan / (count - 1)) : 0
    for (let i = 0; i < count; i++) pts.push({ a: (i - (count - 1) / 2 + phase) * step, r, row: rowIdx })
  }
  if (n <= 6) row(n, 8.5, 2.6)
  else {
    row(Math.ceil(n / 2), 6.8, 2.7)
    // La fila de atrás va medio paso corrida: cada rótulo queda entre dos de adelante, no encima.
    row(Math.floor(n / 2), 10.8, 2.7, 1, n % 2 === 0 ? 0.5 : 0)
  }
  pts.sort((p, q) => p.a - q.a || p.r - q.r)
  return pts.map(({ a, r, row: rowIdx }) => ({ x: r * Math.sin(a), z: ARC_CZ - r * Math.cos(a), rotY: -a, row: rowIdx }))
}

/** Posiciones de la orilla (personas) y del agua (barcos) para el arquetipo naval. */
function navalSlots() {
  const field = heightField('coast', 0)
  const water: Slot[] = []
  for (let x = -12; x <= 12; x += 0.5) {
    if (shoreZ(x) < -11.2) continue
    const z = Math.max(-14, shoreZ(x) - 3.2)
    if (!field.isWater(x, z) || !field.isWater(x, z + 1.2)) continue
    if (water.every((s) => Math.hypot(s.x - x, s.z - z) >= 8.5)) water.push({ x, z, rotY: 0.5 })
  }
  const beach: Slot[] = []
  const xs = [0, 3.6, -3.6, 7.2, -7.2, 10.8, -10.8]
  for (const dz of [2.8, 8.4]) for (const x of xs) beach.push({ x, z: shoreZ(x) + dz, rotY: 0 })
  return { water, beach }
}

// ---------------------------------------------------------------------------------------------
// Props enlazados
// ---------------------------------------------------------------------------------------------

const clip = (s: string, n = 40) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…')
const round = (v: number) => Math.round(v * 100) / 100

type Info = { id: string; title: string; text: string; key: string; person: boolean; index: number }

function monolith(variant: number, accent: string): Raw {
  const parts: Raw[][] = [
    [
      { shape: 'box', args: [1.3, 0.3, 1.3], pos: [0, 0.15, 0], color: STONE_DARK },
      { shape: 'box', args: [0.8, 1.7, 0.8], pos: [0, 1.15, 0], color: STONE },
      { shape: 'cone', args: [0.58, 0.5, 4], pos: [0, 2.25, 0], rot: [0, Math.PI / 4, 0], color: accent },
    ],
    [
      { shape: 'cylinder', args: [0.5, 0.6, 0.9, 12], pos: [0, 0.45, 0], color: STONE },
      { shape: 'sphere', args: [0.55, 16, 12], pos: [0, 1.45, 0], color: accent },
    ],
    [
      { shape: 'box', args: [1.6, 0.2, 0.7], pos: [0, 0.1, 0], color: STONE_DARK },
      { shape: 'box', args: [1.3, 2.1, 0.35], pos: [0, 1.25, 0], color: STONE },
      { shape: 'box', args: [0.6, 0.6, 0.1], pos: [0, 1.6, 0.2], color: accent },
    ],
    [
      { shape: 'cylinder', args: [0.3, 0.4, 0.5, 8], pos: [0, 0.25, 0], color: STONE_DARK },
      { shape: 'cone', args: [0.62, 0.95, 4], pos: [0, 1.0, 0], rot: [Math.PI, 0, 0], color: STONE },
      { shape: 'cone', args: [0.62, 0.95, 4], pos: [0, 1.95, 0], color: accent },
    ],
    [
      { shape: 'cylinder', args: [0.17, 0.2, 1.9, 8], pos: [-0.65, 0.95, 0], color: STONE },
      { shape: 'cylinder', args: [0.17, 0.2, 1.9, 8], pos: [0.65, 0.95, 0], color: STONE },
      { shape: 'box', args: [1.8, 0.28, 0.45], pos: [0, 2.0, 0], color: accent },
    ],
  ]
  return { kind: 'custom', parts: parts[variant % parts.length] }
}

function altar(accent: string): Raw {
  return {
    kind: 'custom',
    parts: [
      { shape: 'box', args: [1.6, 0.25, 1.0], pos: [0, 0.12, 0], color: STONE_DARK },
      { shape: 'box', args: [1.2, 0.8, 0.7], pos: [0, 0.65, 0], color: STONE },
      { shape: 'cylinder', args: [0.05, 0.05, 0.9, 6], pos: [0, 1.5, 0], color: accent },
      { shape: 'sphere', args: [0.16, 10, 8], pos: [0, 2.05, 0], color: accent },
    ],
  }
}

const SCIENCE_BY_WORD: { re: RegExp; make: (i: number) => Raw }[] = [
  { re: /\b(mitocondri)/, make: () => ({ kind: 'mitochondrion', scale: 1.1 }) },
  { re: /\b(nucleo)/, make: () => ({ kind: 'nucleus', scale: 0.55 }) },
  { re: /\b(adn|dna|arn|rna|cromosoma|gen|genes|helice)\b/, make: () => ({ kind: 'dna-helix', scale: 0.9 }) },
  { re: /\b(ribosoma)/, make: () => ({ kind: 'ribosome', scale: 1.7 }) },
  { re: /\b(reticulo)/, make: () => ({ kind: 'rough-er', scale: 1.1 }) },
  { re: /\b(golgi)/, make: () => ({ kind: 'golgi', scale: 1 }) },
  { re: /\b(membrana)/, make: () => ({ kind: 'membrane-protein', scale: 1.4 }) },
  { re: /\b(vesicula|sinapsis|neurotransmisor)/, make: () => ({ kind: 'vesicle', count: 5, spread: 1.4, scale: 1, y: 1.4 }) },
  { re: /\b(atp|energia|glucosa)\b/, make: () => ({ kind: 'atp', count: 3, spread: 1.2, y: 1.8 }) },
  { re: /\b(neurona|dendrita|axon|soma|neuron)/, make: () => ({ kind: 'neuron', scale: 0.8 }) },
  { re: /\b(valvula)/, make: () => ({ kind: 'heart-chamber-valve', valveType: 'tricuspid', scale: 1, y: 1.6 }) },
  { re: /\b(corazon|cardiac|heart)/, make: () => ({ kind: 'organ', organ: 'heart', scale: 1 }) },
  { re: /\b(pulmon|pulmones|lung)/, make: () => ({ kind: 'organ', organ: 'lung', scale: 1 }) },
  { re: /\b(rinon|rinones|kidney)/, make: () => ({ kind: 'organ', organ: 'kidney', scale: 1 }) },
  { re: /\b(cerebro|brain)/, make: () => ({ kind: 'organ', organ: 'brain', scale: 1 }) },
  { re: /\b(higado|liver)/, make: () => ({ kind: 'organ', organ: 'liver', scale: 1 }) },
  { re: /\b(vena|venas|arteria|aorta|vaso|vasos|capilar)/, make: () => ({ kind: 'vessel-mouth', scale: 1, y: 0 }) },
  { re: /\b(sangre|globulo|eritrocito|plaqueta|blood)/, make: () => ({ kind: 'blood-cell', cell: 'red', count: 5, spread: 1.4, y: 1.4 }) },
  { re: /\b(musculo|miocardio|pared)/, make: () => ({ kind: 'muscle-wall', scale: 0.9 }) },
  { re: /\b(nodo|marcapasos)/, make: () => ({ kind: 'node-pacemaker', scale: 0.9, y: 0.6 }) },
  { re: /\b(microscop)/, make: () => ({ kind: 'microscope', scale: 1.4 }) },
  { re: /\b(matraz|frasco|flask)/, make: () => ({ kind: 'flask', scale: 1.6 }) },
]

const SCIENCE_FALLBACK: Record<'cell' | 'organ' | 'neural', ((i: number) => Raw)[]> = {
  cell: [
    () => ({ kind: 'mitochondrion', scale: 1.1 }),
    () => ({ kind: 'golgi', scale: 1 }),
    () => ({ kind: 'rough-er', scale: 1.1 }),
    () => ({ kind: 'ribosome', scale: 1.7 }),
    () => ({ kind: 'vesicle', count: 5, spread: 1.4, y: 1.4 }),
    () => ({ kind: 'membrane-protein', scale: 1.4 }),
  ],
  organ: [
    (i) => ({ kind: 'organ', organ: (['heart', 'lung', 'kidney', 'brain', 'liver'] as const)[i % 5], scale: 1 }),
    () => ({ kind: 'muscle-wall', scale: 0.9 }),
    () => ({ kind: 'vessel-mouth', scale: 1 }),
    () => ({ kind: 'blood-cell', cell: 'red', count: 5, spread: 1.4, y: 1.4 }),
  ],
  neural: [
    () => ({ kind: 'neuron', scale: 0.8 }),
    () => ({ kind: 'vesicle', count: 5, spread: 1.4, y: 1.4 }),
    () => ({ kind: 'membrane-protein', scale: 1.2 }),
    () => ({ kind: 'atp', count: 3, spread: 1.2, y: 1.8 }),
  ],
}

function linkedKind(arch: Archetype, info: Info, i: number, accent: string, offset: number, flags: Flags): Raw {
  const c = COSTUMES[(i + offset) % COSTUMES.length]
  if (info.person) {
    if (arch === 'battle') {
      return i % 2 === 0
        ? { kind: 'rider', pose: 'charging', color: c, secondary: PAPER, scale: 1.1 }
        : { kind: 'figure', pose: 'pointing', color: c, secondary: PAPER, scale: 1.15 }
    }
    if (arch === 'assembly') return { kind: 'figure', pose: i % 2 === 0 ? 'raising-arm' : 'pointing', color: c, secondary: PAPER, scale: 1.15 }
    return { kind: 'figure', pose: 'standing', color: c, secondary: PAPER, scale: 1.15 }
  }
  if (arch === 'cell' || arch === 'organ' || arch === 'neural') {
    const folded = info.key
    for (const s of SCIENCE_BY_WORD) if (s.re.test(folded)) return s.make(i)
    const list = SCIENCE_FALLBACK[arch]
    return list[(i + offset) % list.length](i + offset)
  }
  const n = i + offset
  switch (arch) {
    case 'battle': {
      const k = n % 3
      if (k === 0) return { kind: 'cannon', scale: 1.1 }
      if (k === 1) return { kind: 'flag', ...(n % 2 ? flags.b : flags.a), scale: 1.1 }
      return { kind: 'tent', color: PAPER, scale: 0.8 }
    }
    case 'assembly': {
      const k = n % 3
      if (k === 0) return { kind: 'column', scale: 1 }
      if (k === 1) return { kind: 'arch', scale: 0.7 }
      return { kind: 'column', scale: 1.15 }
    }
    case 'naval':
      return { kind: 'ship', scale: 0.8 }
    case 'sacred': {
      const k = n % 4
      if (k === 0) return { kind: 'column', scale: 1 }
      if (k === 1) return altar(accent)
      if (k === 2) return { kind: 'arch', scale: 0.7 }
      return { kind: 'campfire', scale: 0.9 }
    }
    case 'nature': {
      const k = n % 4
      if (k === 0) return { kind: 'tree', scale: 1.1 }
      if (k === 1) return { kind: 'rock', scale: 1.5 }
      if (k === 2) return { kind: 'tree', scale: 0.9 }
      return { kind: 'rock', scale: 1.9 }
    }
    case 'city': {
      const k = n % 4
      if (k === 0) return { kind: 'house', scale: 0.55 }
      if (k === 1) return { kind: 'arch', scale: 0.7 }
      if (k === 2) return { kind: 'column', scale: 1.1 }
      return { kind: 'tree', scale: 0.9 }
    }
    default:
      return monolith(n, accent)
  }
}

// ---------------------------------------------------------------------------------------------
// Ambiente por arquetipo
// ---------------------------------------------------------------------------------------------

type Ctx = { waterUsed: number; rng: Rng; accent: string; ground: string; hasKey: (re: RegExp) => boolean; terrain: Diorama['terrain']; flags: Flags }

type Flags = { a: Raw; b: Raw }
/**
 * Banderas según el contexto histórico del museo y la sala: nunca se pone una bandera nacional
 * fuera de su historia. Sin contexto reconocible, estandartes neutros con el color de la sala.
 */
export function flagsFor(text: string, accent: string): Flags {
  const t = fold(text)
  if (/\b(francia|frances|francesa|bastilla|paris|napoleon|robespierre|girondin|jacobin|versalles|luis xvi|maria antonieta|revolucion francesa)/.test(t))
    return { a: { pattern: 'vertical', color: '#1f3fa0', secondary: '#c8102e' }, b: { pattern: 'vertical', color: PAPER, secondary: PAPER } }
  if (/\b(venezuela|venezolan|gran colombia|bolivar|carabobo|boyaca|angostura|bolivarian|nueva granada)/.test(t))
    return { a: { color: '#f2c200', secondary: '#1f3fa0' }, b: { pattern: 'saltire', color: PAPER, secondary: '#b3262d' } }
  return { a: { pattern: 'vertical', color: accent, secondary: accent }, b: { pattern: 'vertical', color: '#3b3b3b', secondary: '#3b3b3b' } }
}

/** Coloca un prop de ambiente cuidando que no invada la zona de entrada. */
const amb = (kind: string, x: number, z: number, extra: Raw = {}): Raw => {
  const spread = typeof extra.spread === 'number' ? extra.spread : 0
  return { kind, pos: [round(x), round(Math.min(z, ENTRY_Z - 1.2 - spread))], ...extra }
}

function ambientFor(arch: Archetype, ctx: Ctx): Raw[] {
  const { rng, accent } = ctx
  const j = (a: number) => (rng() - 0.5) * a
  switch (arch) {
    case 'battle':
      return [
        amb('rider', -9 + j(1), -12, { pose: 'charging', color: '#2b4c94', secondary: PAPER, rotY: 1.05, scale: 1, count: 5, spread: 2.6 }),
        amb('figure', 9 + j(1), -12.4, { pose: 'standing', color: '#a8322d', secondary: PAPER, rotY: -1.1, count: 12, spread: 3 }),
        amb('flag', -11.5, -9, { ...ctx.flags.a, rotY: 0.2, scale: 1.2 }),
        amb('flag', 12, -9, { ...ctx.flags.b, rotY: 2.8, scale: 1.2 }),
        amb('figure', 0, -12.5, { pose: 'fallen', color: '#a8322d', secondary: PAPER, count: 5, spread: 2.2 }),
        amb('cannon', 13, -5, { rotY: -1.9, scale: 1.1 }),
        amb('cannon', -13, -4.5, { rotY: 1.9, scale: 1.1 }),
        amb('tent', -12.5, -13, { color: PAPER, scale: 1.1 }),
        amb('tree', 13, -12, { count: 4, spread: 1.8 }),
        amb('rock', -13, -7, { count: 2, spread: 1.2, scale: 1.4 }),
        amb('campfire', 12.5, -1, { scale: 0.9 }),
      ]
    case 'assembly':
      return [
        amb('figure', 0, -12, { pose: 'standing', color: '#4a4f7a', secondary: PAPER, rotY: 0, count: 14, spread: 3.4 }),
        amb('arch', 0, -13.4, { scale: 1.5 }),
        amb('column', -13, -9, { scale: 1.2 }),
        amb('column', 13, -9, { scale: 1.2 }),
        amb('column', -13, -4.5, { scale: 1.2 }),
        amb('column', 13, -4.5, { scale: 1.2 }),
        amb('flag', -6, -13, { color: '#2a4fa0', secondary: '#efe8d8', scale: 1.3 }),
        amb('flag', 6, -13, { color: '#c0392b', secondary: '#efe8d8', scale: 1.3 }),
        amb('house', -12, -13, { scale: 1.0 }),
        amb('house', 12, -13, { scale: 1.0 }),
      ]
    case 'naval': {
      const { water } = navalSlots()
      const far = water.slice(ctx.waterUsed).filter((w) => w.z <= -12)
      return [
        ...far.map((w) => amb('ship', w.x, w.z - 0.3, { rotY: w.rotY + 0.4, scale: 0.7 })),
        amb('tree', -13, -3, { count: 3, spread: 1.4 }),
        amb('tree', 13, -3, { count: 3, spread: 1.4 }),
        amb('rock', 12.5, -6.5, { count: 3, spread: 1.4, scale: 1.2 }),
        amb('flag', -12.5, 1, { color: '#d8c795', secondary: '#2a6f97', scale: 1.1 }),
        amb('tent', 12.5, 2.5, { color: PAPER, scale: 0.9 }),
        amb('campfire', 11.5, 0.5, { scale: 0.9 }),
      ]
    }
    case 'sacred':
      return [
        amb('church', 0, -13, { scale: 1.1 }),
        amb('column', -13, -9, { scale: 1.3 }),
        amb('column', 13, -9, { scale: 1.3 }),
        amb('column', -13, -4.5, { scale: 1.3 }),
        amb('column', 13, -4.5, { scale: 1.3 }),
        amb('arch', -8, -13, { scale: 1.1 }),
        amb('arch', 8, -13, { scale: 1.1 }),
        amb('campfire', -12, 0, { scale: 0.9 }),
        amb('campfire', 12, 0, { scale: 0.9 }),
        amb('figure', 0, -2, { pose: 'seated', color: '#5b4636', secondary: PAPER, count: 4, spread: 1.6 }),
      ]
    case 'nature':
      return [
        amb('tree', -11.5, -10, { count: 7, spread: 2.6 }),
        amb('tree', 11.5, -10, { count: 7, spread: 2.6 }),
        amb('rock', 0, -13, { count: 4, spread: 4, scale: 1.8 }),
        amb('tree', 13, -3.5, { count: 3, spread: 1.2 }),
        amb('tree', -13, -3.5, { count: 3, spread: 1.2 }),
        amb('rock', 12.5, 3.5, { count: 2, spread: 1, scale: 1.2 }),
        amb('tent', -12.5, 3, { color: '#c8b88a', scale: 1 }),
        amb('campfire', -11, 1.5, { scale: 0.9 }),
      ]
    case 'city':
      return [
        amb('house', -11.5, -12, { scale: 1.1, rotY: 0.3 }),
        amb('house', -4, -13, { scale: 1.0 }),
        amb('house', 4, -13, { scale: 1.1, rotY: -0.2 }),
        amb('house', 11.5, -12, { scale: 1.0, rotY: -0.3 }),
        amb('church', 0, -14, { scale: 0.8 }),
        amb('house', -13, -5, { scale: 0.9, rotY: 1.4 }),
        amb('house', 13, -5, { scale: 0.9, rotY: -1.4 }),
        amb('tree', 12.5, 2.5, { count: 2, spread: 1 }),
        amb('tree', -12.5, 2.5, { count: 2, spread: 1 }),
        amb('figure', 0, -2, { pose: 'standing', color: '#7a5c3c', secondary: PAPER, count: 6, spread: 2.2 }),
      ]
    case 'cell':
      return [
        ...(ctx.hasKey(/\bnucleo/) ? [] : [amb('nucleus', 0, -13.6, { scale: 1.0 })]),
        amb('golgi', 11.5, -11, { rotY: -0.5 }),
        amb('mitochondrion', -12, -9, { rotY: 0.85, scale: 0.9 }),
        amb('mitochondrion', 12.5, -4, { rotY: -0.6, scale: 0.8 }),
        amb('ribosome', -12, -3, { count: 5, spread: 2.5, scale: 1.0, y: 0.8 }),
        amb('atp', 0, -1, { count: 3, spread: 3, scale: 0.9, y: 3.4 }),
        amb('vesicle', 12, 2, { count: 4, spread: 1.6, scale: 0.9, y: 1.6 }),
      ]
    case 'organ':
      return [
        amb('muscle-wall', -13.4, -9, { rotY: Math.PI / 2, scale: 1.3 }),
        amb('muscle-wall', 13.4, -9, { rotY: -Math.PI / 2, scale: 1.4, color: '#8f2f35' }),
        amb('vessel-mouth', -13.6, -2, { y: 1.6, rotY: Math.PI / 2, scale: 1.3 }),
        amb('node-pacemaker', 13.4, -1.5, { y: 0.8, rotY: -Math.PI / 2, scale: 1.2 }),
        amb('blood-cell', 0, 2, { cell: 'red', count: 6, spread: 4, y: 1.8 }),
        amb('blood-cell', -2, 1, { cell: 'white', count: 1, y: 2.6 }),
        amb('blood-cell', 3, 3, { cell: 'platelet', count: 4, spread: 3, y: 1.4 }),
      ]
    case 'neural':
      return [
        amb('neuron', -12.5, -10, { rotY: -1.45, scale: 1.1 }),
        amb('atp', 0, 1, { count: 6, spread: 8, scale: 0.9, y: 3.2 }),
        amb('mitochondrion', 12, -9, { rotY: 0.3, scale: 0.8 }),
        amb('ribosome', -12, 1, { count: 6, spread: 4, scale: 0.9, y: 0.6 }),
        amb('vesicle', 12.5, -2, { count: 5, spread: 2, scale: 0.9, y: 1.6 }),
        amb('membrane-protein', 0, -13, { rotY: -0.7, scale: 1.0 }),
      ]
    default: {
      // Templo de las ideas: tarima central con una esfera luminosa, arquería al fondo y columnatas.
      const dais: Raw = {
        kind: 'custom',
        pos: [0, 2],
        scale: 0.9,
        parts: [
          { shape: 'cylinder', args: [3.4, 3.6, 0.3, 28], pos: [0, 0.15, 0], color: STONE_DARK },
          { shape: 'cylinder', args: [2.5, 2.7, 0.3, 28], pos: [0, 0.45, 0], color: STONE },
          { shape: 'cylinder', args: [0.5, 0.65, 0.9, 12], pos: [0, 1.05, 0], color: STONE_DARK },
          { shape: 'sphere', args: [0.6, 18, 14], pos: [0, 2.0, 0], color: accent },
          { shape: 'cylinder', args: [1.05, 1.05, 0.05, 20], pos: [0, 0.62, 0], color: accent },
        ],
      }
      return [
        dais,
        amb('arch', -9, -13.2, { scale: 1.3 }),
        amb('arch', 0, -13.5, { scale: 1.6 }),
        amb('arch', 9, -13.2, { scale: 1.3 }),
        amb('column', -4.6, -13.2, { scale: 1.3 }),
        amb('column', 4.6, -13.2, { scale: 1.3 }),
        amb('column', -13, -9, { scale: 1.25 }),
        amb('column', 13, -9, { scale: 1.25 }),
        amb('column', -13, -4.5, { scale: 1.25 }),
        amb('column', 13, -4.5, { scale: 1.25 }),
        amb('column', -13, -13, { scale: 1.25 }),
        amb('column', 13, -13, { scale: 1.25 }),
      ]
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Composición
// ---------------------------------------------------------------------------------------------

const FALLBACK = (title: string): Diorama => parseDiorama({ title: title || 'Diorama', terrain: 'abstract', time: 'day', props: [] })

/**
 * Diorama de una sala, armado con la biblioteca de props. Determinista y siempre válido
 * (pasa por `parseDiorama`); nunca lanza.
 */
export function composeDiorama(room: RoomLike, museumTitle: string, seed: number | string, pigment?: Pigment): Diorama {
  const roomName = textOf(room?.name)
  try {
    const arch = classifyRoom(room, museumTitle)
    const pieces = piecesOf(room)
    const base = hashStr(`${seed}|${museumTitle}|${roomName}`)
    const rng = mulberry32(base)
    const def = DEFAULTS[arch]
    const science = arch === 'cell' || arch === 'organ' || arch === 'neural'

    // Paleta: los arquetipos naturales conservan su cielo; los arquitectónicos toman el pigmento del fresco.
    const trim = isHex(pigment?.trim) ? pigment!.trim! : def.accent
    const wall = isHex(pigment?.wall) ? pigment!.wall! : null
    let ground = def.ground
    let sky = def.sky
    if (wall && (arch === 'abstract' || arch === 'assembly' || arch === 'sacred' || arch === 'city')) {
      ground = mix(def.ground, wall, 0.3)
      sky = mix(def.sky, wall, 0.22)
    }
    const accent = science ? def.accent : arch === 'abstract' ? mix(trim, '#e6c35a', 0.55) : trim

    let terrain = def.terrain
    const hay = fold(`${roomName} ${textOf(room?.description)} ${pieces.map((p) => p.title).join(' ')}`)
    if (arch === 'nature') {
      if (/\b(montana|volcan|cordillera|andes|glaciar)/.test(hay)) terrain = 'mountains'
      else if (/\b(desierto|desert)/.test(hay)) terrain = 'desert'
      else if (/\b(clima|climate|geografia|relieve|paisaje|landscape)/.test(hay) && !/\b(selva|bosque|jungle|forest)/.test(hay)) terrain = 'hills'
    }
    const time: Diorama['time'] = arch === 'battle' && base % 3 === 0 ? 'sunset' : def.time

    const infos: Info[] = pieces.slice(0, MAX_LINKED).map((p, index) => ({
      id: p.id,
      title: p.title,
      text: p.text,
      key: fold(p.title),
      person: personOf(p.title, p.text, arch),
      index,
    }))

    const costumeOffset = base % COSTUMES.length
    const flags = flagsFor(`${museumTitle} ${hay}`, accent)
    const linked: Raw[] = []
    const place = (info: Info, i: number, slot: Slot, forceKind?: Raw) => {
      const k = forceKind ?? linkedKind(arch, info, i, accent, costumeOffset, flags)
      const grow = slot.row === 1 && typeof k.scale === 'number' ? { scale: round(Math.min(3, k.scale * 1.45)) } : slot.row === 1 ? { scale: 1.45 } : {}
      linked.push({
        rotY: round(slot.rotY),
        ...k,
        ...grow,
        pos: [round(slot.x), round(slot.z)],
        label: clip(info.title.trim() || `Pieza ${i + 1}`),
        pieceId: info.id,
      })
    }

    let w = 0
    if (arch === 'naval') {
      const { water, beach } = navalSlots()
      let b = 0
      infos.forEach((info, i) => {
        if (!info.person && w < water.length) place(info, i, water[w++])
        else if (b < beach.length) {
          const slot = beach[b++]
          place(info, i, slot, info.person ? undefined : linkedKind('nature', info, i, accent, costumeOffset, flags))
        }
      })
    } else {
      const slots = arcSlots(infos.length)
      infos.forEach((info, i) => place(info, i, slots[i]))
    }

    // El ambiente se recorta para respetar el tope de props del esquema.
    const ctx: Ctx = { waterUsed: w, rng, accent, ground, terrain, flags, hasKey: (re) => infos.some((i) => re.test(i.key)) }
    const ambient = ambientFor(arch, ctx).slice(0, Math.max(0, MAX_PROPS - linked.length))

    return parseDiorama({
      title: clip(roomName || 'Diorama', 80),
      terrain,
      time,
      palette: { ground, sky, accent },
      props: [...linked, ...ambient],
    })
  } catch {
    return FALLBACK(roomName)
  }
}

/**
 * Da a toda sala sin diorama uno compuesto. Los dioramas existentes (hechos a mano o de la biblioteca)
 * ganan siempre. `pigmentOf` devuelve el pigmento del fresco de la sala, si se conoce.
 * `?dioramas=library` (depuración) lo desactiva.
 */
export function attachComposedDioramas(museum: Museum, pigmentOf?: (roomIndex: number) => Pigment | undefined, seed: number | string = 0): Museum {
  if (typeof window !== 'undefined' && new URLSearchParams(window.location?.search ?? '').get('dioramas') === 'library') return museum
  if (!museum.rooms.some((r) => !r.diorama)) return museum
  return {
    ...museum,
    rooms: museum.rooms.map((room, i) => (room.diorama ? room : { ...room, diorama: composeDiorama(room, museum.title, seed, pigmentOf?.(i)) })),
  }
}
