/**
 * Pieza central de una sala: sustituye al viejo poliedro giratorio por algo que tenga que ver con el
 * tema (estatua, cañón conmemorativo, tribuna, órgano en yeso...) o por nada ("sala despejada").
 * Puro y determinista: la misma sala elige siempre lo mismo. Sin dependencias de three ni de React.
 */

export type CenterpieceKind =
  | 'statue' // persona: figura de yeso sobre plinto alto
  | 'battle' // batalla: cañón y obelisco sobre plinto
  | 'tribune' // asamblea, política, ley: tribuna con dos columnas
  | 'organ' // anatomía: órgano a gran escala
  | 'nucleus'
  | 'mitochondrion'
  | 'neuron'
  | 'ship' // naval: maqueta sobre plinto
  | 'temple' // sagrado: templete de yeso
  | 'rock' // naturaleza: roca
  | 'tree' // naturaleza: árbol

export type Archetype =
  | 'person'
  | 'battle'
  | 'assembly'
  | 'naval'
  | 'sacred'
  | 'nature'
  | 'cell'
  | 'organ'
  | 'neural'
  | 'abstract'

export type OrganName = 'heart' | 'lung' | 'kidney' | 'brain' | 'liver'

export type Centerpiece = {
  kind: CenterpieceKind
  archetype: Archetype
  /** Solo `organ`. */
  organ?: OrganName
  /** Solo `statue`. */
  pose?: 'standing' | 'pointing'
  /** Huella en planta (m): ancho (x) y fondo (z) del collider. */
  footprint: [number, number]
  /** Altura total aproximada (m). */
  height: number
  /** Gira despacio (solo ciencia: órgano y célula). */
  idle: boolean
}

export type CenterpieceInput = {
  title: string
  pieceTitles: string[]
  /** La sala ya tiene un diorama (portal en el cuadro principal): el centro se deja libre. */
  hasDiorama?: boolean
}

// --- Texto -------------------------------------------------------------------------------------

/** Minúsculas, sin tildes, solo letras y números. */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim()

/** Hash FNV-1a: estable entre ejecuciones. */
export function hashText(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Prefijo de palabra ("celula" casa "celulas"); con `=` delante, palabra exacta. */
function has(text: string, keywords: readonly string[]): boolean {
  const padded = ` ${text}`
  return keywords.some((k) => (k.startsWith('=') ? ` ${text} `.includes(` ${k.slice(1)} `) : padded.includes(` ${k}`)))
}

const ORGAN_WORDS: Array<[OrganName, string[]]> = [
  ['heart', ['corazon', 'cardi', 'heart', 'circulatori', 'circulatory']],
  ['lung', ['pulmon', 'respirator', 'lung', 'respiratory', 'bronquio']],
  ['kidney', ['rinon', 'renal', 'kidney', 'nefr']],
  ['brain', ['cerebro', 'cerebral', 'brain', 'encefal']],
  ['liver', ['higado', 'hepat', 'liver']],
]
const NEURAL = ['neurona', 'neuron', 'sinapsis', 'synaps', 'axon', 'dendrita', 'dendrite', 'neural', 'nervios', 'nerve', 'impulso nervioso']
const MITO = ['mitocondria', 'mitochondri', 'atp', 'respiracion celular', 'cellular respiration']
const CELL = ['celula', 'celular', 'cell', 'nucleo', 'nucleus', 'adn', '=dna', 'ribosoma', 'ribosome', 'organelo', 'organelle', 'membrana', 'membrane', 'genetic', 'genetica', 'citoplasma', 'cromosoma']
const NAVAL = ['naval', 'flota', 'barco', 'buque', 'navio', 'ship', 'fleet', 'navy', 'marina', 'armada', 'galeon', 'carabela', 'navegacion', 'naufrag']
const BATTLE = ['batalla', 'guerra', 'combate', 'ejercito', 'militar', 'asedio', 'legion', 'battle', '=war', 'army', 'siege', 'invasion', 'conquista']
const ASSEMBLY = ['congreso', 'senado', 'asamblea', 'parlamento', 'constituci', 'republica', 'tribunal', 'gobierno', 'derecho', 'juicio', 'politic', 'democracia', '=ley', '=leyes', 'foro', 'congress', 'senate', 'parliament', '=law', '=laws', '=court', 'assembly', 'government', 'constitution', 'politics', 'democracy', 'justicia', 'justice']
const SACRED = ['templo', 'iglesia', 'catedral', 'religi', 'sagrad', 'mezquita', 'sinagoga', 'monasterio', 'mitolog', 'temple', 'church', 'cathedral', 'sacred', 'religion', 'mythology', 'piramide', 'pyramid', 'espiritu', 'santuario', 'budis', 'cristian', 'islam']
const NATURE = ['bosque', 'selva', 'ecosistema', 'animal', 'planta', 'montana', 'volcan', 'forest', 'mountain', 'river', '=rio', 'tree', 'plant', 'ecosystem', 'fauna', 'flora', 'geolog', 'naturaleza', 'nature', 'jungle', 'clima', 'oceano']
const BIO = ['biografia', 'biography', 'vida de', 'life of', 'juventud', 'infancia', 'early years', 'libertador', 'su vida']

const GIVEN_NAMES = new Set(
  (
    'simon jose juan pedro francisco antonio miguel manuel manuela maria carlos luis jorge ricardo fernando rafael andres ' +
    'sebastian diego alberto alejandro cristobal isabel catalina teresa ana rosa marie albert isaac charles william ' +
    'george abraham napoleon julio augusto marco leonardo galileo nicolas miguel fidel ernesto salvador pablo vincent ' +
    'frida simone sor elizabeth john thomas james jean louis henry robert mahatma nelson martin'
  ).split(' '),
)
const ROLE_WORDS = ['don', 'dona', 'general', 'presidente', 'doctor', 'dr', 'san', 'santa', 'rey', 'reina', 'emperador', 'presidenta', 'president', 'king', 'queen']
const PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'van', 'von', 'da', 'di', 'y'])

/** Quita años y paréntesis: "Simón Bolívar (1783-1830)" -> "Simón Bolívar". */
const stripTitle = (t: string) => t.replace(/\(.*?\)/g, ' ').replace(/\b\d{3,4}\b/g, ' ').replace(/\s+/g, ' ').trim()

/** Parece el nombre propio de una persona: 2-4 palabras con mayúscula y un nombre de pila conocido primero. */
function looksLikePerson(raw: string): boolean {
  const clean = stripTitle(raw)
  const words = clean.split(' ').filter(Boolean)
  if (words.length < 2 || words.length > 5) return false
  const capitalized = words.every((w) => /^\p{Lu}/u.test(w) || PARTICLES.has(fold(w)))
  if (!capitalized) return false
  const first = fold(words[0])
  return GIVEN_NAMES.has(first) || ROLE_WORDS.includes(first)
}

function isPersonRoom(title: string, pieceTitles: string[]): boolean {
  const f = fold(stripTitle(title))
  if (has(f, BIO)) return true
  if (looksLikePerson(title)) return true
  // La mayoría de las piezas son personas.
  if (pieceTitles.length >= 3) {
    const people = pieceTitles.filter((t) => looksLikePerson(t.split(',')[0])).length
    return people * 10 >= pieceTitles.length * 6
  }
  return false
}

// --- Clasificador ------------------------------------------------------------------------------

export type Classification = { archetype: Archetype; kind?: CenterpieceKind; organ?: OrganName }

/** Arquetipo de la sala por su título y, si hace falta, por sus piezas. */
export function classifyRoom(title: string, pieceTitles: string[] = []): Classification {
  const ft = fold(stripTitle(title))
  const fp = fold(pieceTitles.join(' '))
  // El título manda; las piezas solo deciden si el título no dice nada.
  for (const text of [ft, fp]) {
    if (!text) continue
    if (has(text, NEURAL)) return { archetype: 'neural', kind: 'neuron' }
    for (const [organ, words] of ORGAN_WORDS) if (has(text, words)) return { archetype: 'organ', kind: 'organ', organ }
    if (has(text, MITO)) return { archetype: 'cell', kind: 'mitochondrion' }
    if (has(text, CELL)) return { archetype: 'cell', kind: 'nucleus' }
    if (text === ft) {
      if (has(text, NAVAL)) return { archetype: 'naval', kind: 'ship' }
      if (has(text, BATTLE)) return { archetype: 'battle', kind: 'battle' }
      if (has(text, ASSEMBLY)) return { archetype: 'assembly', kind: 'tribune' }
      if (isPersonRoom(title, pieceTitles)) return { archetype: 'person', kind: 'statue' }
      if (has(text, SACRED)) return { archetype: 'sacred', kind: 'temple' }
      if (has(text, NATURE)) return { archetype: 'nature', kind: hashText(title) % 2 === 0 ? 'rock' : 'tree' }
    }
  }
  if (isPersonRoom(title, pieceTitles)) return { archetype: 'person', kind: 'statue' }
  return { archetype: 'abstract' }
}

// --- Elección ----------------------------------------------------------------------------------

const SCIENCE: ReadonlySet<Archetype> = new Set(['organ', 'cell', 'neural'])

const SPEC: Record<CenterpieceKind, { footprint: [number, number]; height: number }> = {
  statue: { footprint: [1.3, 1.3], height: 3.7 },
  battle: { footprint: [2.6, 1.6], height: 3.2 },
  tribune: { footprint: [3.0, 1.4], height: 3.0 },
  organ: { footprint: [2.2, 2.0], height: 3.1 },
  nucleus: { footprint: [2.4, 2.4], height: 3.0 },
  mitochondrion: { footprint: [2.6, 2.0], height: 2.7 },
  neuron: { footprint: [3.0, 3.0], height: 3.2 },
  ship: { footprint: [3.0, 1.4], height: 3.0 },
  temple: { footprint: [2.4, 2.4], height: 3.0 },
  rock: { footprint: [2.2, 2.2], height: 2.4 },
  tree: { footprint: [2.6, 2.6], height: 3.0 },
}

/**
 * Qué se pone en el centro de la sala (o `null` si se deja despejado). Salas con diorama, salas
 * casi vacías, temas abstractos y la mitad de los temas "blandos" (naturaleza, sagrado) quedan
 * sin pieza central; los temas de ciencia la llevan siempre porque el órgano es el tema.
 */
export function chooseCenterpiece(input: CenterpieceInput): Centerpiece | null {
  const { title, pieceTitles, hasDiorama } = input
  const c = classifyRoom(title, pieceTitles)
  if (!c.kind) return null
  const science = SCIENCE.has(c.archetype)
  if (!science) {
    if (hasDiorama) return null // el portal del diorama ya es el foco de la sala
    if (pieceTitles.length < 2) return null // sala pequeña: mejor despejada
    if ((c.archetype === 'nature' || c.archetype === 'sacred') && hashText(title) % 2 === 0) return null
  }
  const spec = SPEC[c.kind]
  return {
    kind: c.kind,
    archetype: c.archetype,
    ...(c.organ ? { organ: c.organ } : {}),
    ...(c.kind === 'statue' ? { pose: hashText(title) % 2 === 0 ? ('pointing' as const) : ('standing' as const) } : {}),
    footprint: spec.footprint,
    height: spec.height,
    idle: science,
  }
}
