import { chooseCenterpiece, type Centerpiece } from './centerpiece'
import { buildDecor, decorBox, hash, pickIdentity, type FloorStyle, type RoomDecor, type RoomIdentity } from './roomIdentity'
import { emptyGrid, extraGridLinks, placeRoom, planRoomGrid, type Diorama, type Glyph, type GraphEdge, type ImageSearch, type IncrementalGrid, type Museum, type Piece, type MonumentType, type RoomPaletteDescriptor, type RoomTheme } from '@mus3o/shared'

// Todo en metros, plano XZ. Y es la altura.
export type Box = { x: number; z: number; w: number; d: number; h: number; y?: number }
export type Side = 'n' | 's' | 'e' | 'w'
export type Monument = 'icosahedron' | 'torusKnot' | 'octahedron' | 'dodecahedron' | 'cone' | 'torus'
export type Shape = Glyph

/** Hueco en un muro interior para colgar un cuadro. El plano mira a +Z local, girado `rotationY`. */
export type PaintingSlot = {
  x: number
  y: number
  z: number
  rotationY: number
  maxWidth: number
  maxHeight: number
  main: boolean
  side: Side
}

export { hash }
export type { FloorStyle, RoomDecor }

export type PedestalLayout = { concept: Piece; x: number; z: number; shape: Shape; facing: number }

export type RoomLayout = {
  id: string
  index: number
  title: string
  color: string
  x: number
  z: number
  w: number
  d: number
  height: number
  monument: Monument | MonumentType
  /** Pieza central del tema (o null: sala despejada). Sustituye al monumento en el render. */
  centerpiece: Centerpiece | null
  /** Dibujo del suelo (deriva del título de la sala; distinto al de la sala anterior). */
  floorStyle: FloorStyle
  /** Decoración arquitectónica en las esquinas, con sus colisionadores (kind null: sala sin decoración). */
  decor: RoomDecor
  doors: Side[]
  walls: Box[]
  pedestals: PedestalLayout[]
  paintingSlots: PaintingSlot[]
  /** Búsqueda del cuadro principal de la sala. */
  imageSearch?: ImageSearch
  theme?: RoomTheme
  palette?: RoomPaletteDescriptor
  /** Diorama al que se entra desde el cuadro principal (si lo hay). */
  diorama?: Diorama
}

export type CorridorLayout = { floor: Box; walls: Box[] }

export type DoorLayout = {
  id: string
  corridorIndex: number
  /** Sala de la que sale la puerta: se abre con su llave. */
  fromRoomId: string
  x: number
  z: number
  w: number
  d: number
  rotY: number
}

export type PalaceLayout = {
  rooms: RoomLayout[]
  corridors: CorridorLayout[]
  colliders: Box[]
  doors: DoorLayout[]
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  spawn: { x: number; z: number; yaw: number }
  /** Solo en un palacio que se levanta en vivo: lo que hace falta para añadir la sala siguiente sin mover las demás. */
  stream?: { inputs: RoomInput[]; grid: IncrementalGrid; edges: GraphEdge[] }
}

export const ROOM_COLORS = ['#2EE6D6', '#FF3DA5', '#FFB547', '#8B7CFF', '#7CFF6B', '#FF6B5B', '#4DB8FF', '#F2F26B', '#FF8AD8', '#38D9A9', '#E8B04A', '#A0A8FF']
const MONUMENTS: Monument[] = ['icosahedron', 'torusKnot', 'octahedron', 'dodecahedron', 'cone', 'torus']
const SHAPES: Shape[] = ['icosahedron', 'octahedron', 'dodecahedron', 'tetrahedron', 'torus', 'cone', 'box', 'sphere']

const WALL_T = 0.4
const DOOR_W = 2.8
const CORRIDOR_LEN = 6
const PEDESTAL_SPACING = 2.6
const PEDESTAL_SIZE = 0.9

export const SLOT_Y = 2.3
export const SLOT_OFFSET = 0.06 // separación del muro
export const SLOT_DOOR_MARGIN = 0.6 // mínimo entre un cuadro y el borde de una puerta
export const SLOT_GAP = 0.4 // mínimo entre cuadros
const SLOT_CORNER = 0.5
const MAIN_W = 3.4
const MAIN_H = 2.0
const SMALL_W = 1.4
const SMALL_H = 1.2
const MAX_SLOTS = 16

type Span = { side: Side; lo: number; hi: number; doorless: boolean; wallLen: number }

// Cuadros sobre las caras interiores de los muros, fuera de las puertas. Determinista.
function paintingSlots(x: number, z: number, w: number, d: number, doors: Side[]): PaintingSlot[] {
  const half = (side: Side) => ((side === 'n' || side === 's' ? w : d) - WALL_T) / 2
  const spans: Span[] = []
  for (const side of ['n', 's', 'w', 'e'] as Side[]) {
    const h = half(side)
    const edge = h - SLOT_CORNER
    if (!doors.includes(side)) {
      spans.push({ side, lo: -edge, hi: edge, doorless: true, wallLen: h * 2 })
    } else {
      const inner = DOOR_W / 2 + SLOT_DOOR_MARGIN
      spans.push({ side, lo: -edge, hi: -inner, doorless: false, wallLen: h * 2 })
      spans.push({ side, lo: inner, hi: edge, doorless: false, wallLen: h * 2 })
    }
  }
  const usable = spans.filter((s) => s.hi - s.lo >= SMALL_W)
  if (usable.length === 0) return []

  const doorless = usable.filter((s) => s.doorless)
  const pool = doorless.length > 0 ? doorless : usable
  // Gana la pared más larga (o el tramo más ancho); el empate lo decide el orden n, s, w, e.
  const key = (s: Span) => (doorless.length > 0 ? s.wallLen : s.hi - s.lo)
  const mainSpan = pool.reduce((best, s) => (key(s) > key(best) + 1e-9 ? s : best))
  const mainW = Math.min(MAIN_W, mainSpan.hi - mainSpan.lo)
  const mainT = (mainSpan.lo + mainSpan.hi) / 2

  const place = (span: Span, t: number, width: number, height: number, main: boolean): PaintingSlot => {
    switch (span.side) {
      case 'n':
        return { x: x + t, y: SLOT_Y, z: z - d / 2 + WALL_T / 2 + SLOT_OFFSET, rotationY: 0, maxWidth: width, maxHeight: height, main, side: 'n' }
      case 's':
        return { x: x + t, y: SLOT_Y, z: z + d / 2 - WALL_T / 2 - SLOT_OFFSET, rotationY: Math.PI, maxWidth: width, maxHeight: height, main, side: 's' }
      case 'e':
        return { x: x + w / 2 - WALL_T / 2 - SLOT_OFFSET, y: SLOT_Y, z: z + t, rotationY: -Math.PI / 2, maxWidth: width, maxHeight: height, main, side: 'e' }
      default:
        return { x: x - w / 2 + WALL_T / 2 + SLOT_OFFSET, y: SLOT_Y, z: z + t, rotationY: Math.PI / 2, maxWidth: width, maxHeight: height, main, side: 'w' }
    }
  }

  const slots = [place(mainSpan, mainT, mainW, MAIN_H, true)]
  const mainLo = mainT - mainW / 2 - SLOT_GAP
  const mainHi = mainT + mainW / 2 + SLOT_GAP
  for (const span of usable) {
    // El tramo del cuadro principal se parte en dos, a ambos lados.
    const parts: [number, number][] =
      span === mainSpan ? [[span.lo, mainLo], [mainHi, span.hi]] : [[span.lo, span.hi]]
    for (const [lo, hi] of parts) {
      const len = hi - lo
      const n = Math.floor((len + SLOT_GAP) / (SMALL_W + SLOT_GAP))
      if (n < 1) continue
      const total = n * SMALL_W + (n - 1) * SLOT_GAP
      const start = lo + (len - total) / 2
      for (let k = 0; k < n; k++) {
        slots.push(place(span, start + SMALL_W / 2 + k * (SMALL_W + SLOT_GAP), SMALL_W, SMALL_H, false))
      }
    }
  }
  return slots.slice(0, MAX_SLOTS)
}

// Zona libre frente a cada puerta (el hueco más el paso hacia el interior).
export function doorOpenings(room: Pick<RoomLayout, 'x' | 'z' | 'w' | 'd' | 'doors'>): Box[] {
  const depth = 3
  const inset = 1.2
  return room.doors.map((side) => {
    const sign = side === 'n' || side === 'w' ? 1 : -1 // hacia el interior
    return side === 'n' || side === 's'
      ? { x: room.x, z: (side === 'n' ? room.z - room.d / 2 : room.z + room.d / 2) + sign * inset, w: DOOR_W + 0.8, d: depth, h: 3 }
      : { x: (side === 'w' ? room.x - room.w / 2 : room.x + room.w / 2) + sign * inset, z: room.z, w: depth, d: DOOR_W + 0.8, h: 3 }
  })
}

const SLOT_CLEAR = 0.7 // fondo (m) que se mantiene libre delante de un cuadro

/** Volumen que ocupa un cuadro y su marco, más el paso delante de él: nada de decoración dentro. */
export function slotZone(slot: PaintingSlot): Box {
  const sign = slot.side === 'n' || slot.side === 'w' ? 1 : -1 // hacia el interior
  const along = slot.maxWidth + 0.3
  return slot.side === 'n' || slot.side === 's'
    ? { x: slot.x, z: slot.z + sign * (SLOT_CLEAR / 2 - SLOT_OFFSET), w: along, d: SLOT_CLEAR, h: 3.4 }
    : { x: slot.x + sign * (SLOT_CLEAR / 2 - SLOT_OFFSET), z: slot.z, w: SLOT_CLEAR, d: along, h: 3.4 }
}

function sideToward(a: { row: number; col: number }, b: { row: number; col: number }): Side {
  if (b.col > a.col) return 'e'
  if (b.col < a.col) return 'w'
  return b.row > a.row ? 's' : 'n'
}

const opposite: Record<Side, Side> = { n: 's', s: 'n', e: 'w', w: 'e' }

// Divide cada pared en dos tramos cuando tiene puerta.
function roomWalls(x: number, z: number, w: number, d: number, h: number, doors: Side[]): Box[] {
  const walls: Box[] = []
  const add = (side: Side) => {
    const horizontal = side === 'n' || side === 's'
    const len = horizontal ? w : d
    const cx = side === 'e' ? x + w / 2 : side === 'w' ? x - w / 2 : x
    const cz = side === 's' ? z + d / 2 : side === 'n' ? z - d / 2 : z
    const seg = (offset: number, l: number) =>
      horizontal
        ? { x: cx + offset, z: cz, w: l, d: WALL_T, h }
        : { x: cx, z: cz + offset, w: WALL_T, d: l, h }
    if (!doors.includes(side)) {
      walls.push(seg(0, len + WALL_T))
      return
    }
    const part = (len + WALL_T - DOOR_W) / 2
    walls.push(seg(-(DOOR_W / 2 + part / 2), part), seg(DOOR_W / 2 + part / 2, part))
    // Dintel sobre la puerta.
    walls.push({ ...seg(0, DOOR_W), h: h - 3, y: 3 })
  }
  ;(['n', 's', 'e', 'w'] as Side[]).forEach(add)
  return walls
}

type RoomSize = { radius: number; w: number; d: number; aspect: number }

// Tamaño de una sala según cuántos conceptos tiene (anillo de pedestales).
function roomSize(room: { pieces: unknown[] }, i: number): RoomSize {
  const count = Math.max(room.pieces.length, 1)
  const radius = Math.max(3.2, (count * PEDESTAL_SPACING) / (2 * Math.PI))
  const half = radius + 3
  const aspect = i % 3 === 1 ? 1.35 : 1 // algunas salas son alargadas
  return { radius, w: half * 2 * aspect, d: half * 2, aspect }
}

type RoomInput = Pick<Museum['rooms'][number], 'id' | 'name' | 'pieces' | 'palette' | 'monument' | 'imageSearch' | 'theme' | 'diorama'>

/** Punto de entrada de la sala inicial: una esquina sin puerta (la decoración lo deja libre). */
const entryCorner = (r: Pick<RoomLayout, 'x' | 'z' | 'w' | 'd'>) => ({ x: r.x - r.w / 2 + 1.5, z: r.z - r.d / 2 + 1.5 })

/**
 * `prev` es la identidad de la sala anterior (para no repetir estilo) y `spawn` el punto de entrada si el jugador
 * aparece en esta sala. Todo lo demás sale de la propia sala: no cambia cuando llegan salas nuevas.
 */
function makeRoomLayout(room: RoomInput, i: number, x: number, z: number, size: RoomSize, doors: Side[], prev: RoomIdentity | null, spawn: { x: number; z: number } | null): RoomLayout {
  const { w, d, radius, aspect } = size
  const height = 4.5 + (hash(room.name) % 3) * 1.2
  const count = room.pieces.length
  const offset = Math.PI / Math.max(count, 1) + Math.PI / 4
  const pedestals = room.pieces.map((concept, k) => {
    const a = (k / Math.max(count, 1)) * Math.PI * 2 + offset
    const px = x + Math.cos(a) * radius * aspect
    const pz = z + Math.sin(a) * radius
    return {
      concept,
      x: px,
      z: pz,
      shape: concept.model?.type === 'glyph' ? concept.model.shape : SHAPES[hash(concept.title) % SHAPES.length],
      facing: Math.atan2(px - x, pz - z), // mira hacia afuera, al visitante
    }
  })
  const centerpiece = chooseCenterpiece({ title: room.name, pieceTitles: room.pieces.map((p) => p.title) })
  const slots = paintingSlots(x, z, w, d, doors)
  const identity = pickIdentity(room.name, prev)
  const avoid: Box[] = [
    ...doorOpenings({ x, z, w, d, doors }),
    ...slots.map(slotZone),
    ...pedestals.map((p) => ({ x: p.x, z: p.z, w: PEDESTAL_SIZE, d: PEDESTAL_SIZE, h: 1 })),
    // Con o sin pieza central, el centro queda libre.
    { x, z, w: Math.max(centerpiece?.footprint[0] ?? 0, 1.6), d: Math.max(centerpiece?.footprint[1] ?? 0, 1.6), h: 2 },
  ]
  if (spawn) avoid.push({ x: spawn.x, z: spawn.z, w: 1.2, d: 1.2, h: 1 })
  return {
    id: room.id,
    index: i,
    title: room.name,
    color: room.palette?.primary || ROOM_COLORS[i % ROOM_COLORS.length],
    x,
    z,
    w,
    d,
    height,
    monument: room.monument || MONUMENTS[i % MONUMENTS.length],
    // Sin hasDiorama: ahora todas las salas llevan cuadro vivo, así que ya no distingue nada.
    centerpiece,
    floorStyle: identity.floorStyle,
    decor: buildDecor({ x, z, w, d, height, kind: identity.decorKind, avoid }),
    doors,
    walls: roomWalls(x, z, w, d, height, doors),
    pedestals,
    paintingSlots: slots,
    imageSearch: room.imageSearch,
    theme: room.theme,
    palette: room.palette,
    diorama: room.diorama,
  }
}

// Pasillo y puerta de salida entre la sala `a` y la contigua `b` (que queda hacia `side`).
function makeLink(a: RoomLayout, b: RoomLayout, side: Side, corridorIndex: number): { corridor: CorridorLayout; door: DoorLayout } {
  const h = 3.6
  if (side === 'e' || side === 'w') {
    const x1 = side === 'e' ? a.x + a.w / 2 : b.x + b.w / 2
    const x2 = side === 'e' ? b.x - b.w / 2 : a.x - a.w / 2
    const len = x2 - x1
    const cx = (x1 + x2) / 2
    const doorX = side === 'e' ? a.x + a.w / 2 : a.x - a.w / 2
    return {
      corridor: {
        floor: { x: cx, z: a.z, w: len, d: DOOR_W, h: 0 },
        walls: [
          { x: cx, z: a.z - DOOR_W / 2 - WALL_T / 2, w: len, d: WALL_T, h },
          { x: cx, z: a.z + DOOR_W / 2 + WALL_T / 2, w: len, d: WALL_T, h },
        ],
      },
      door: {
        id: `door-${corridorIndex}-entrance`,
        corridorIndex,
        fromRoomId: a.id,
        x: doorX,
        z: a.z,
        w: 0.6,
        d: DOOR_W,
        rotY: Math.PI / 2,
      },
    }
  }
  const z1 = side === 's' ? a.z + a.d / 2 : b.z + b.d / 2
  const z2 = side === 's' ? b.z - b.d / 2 : a.z - a.d / 2
  const len = z2 - z1
  const cz = (z1 + z2) / 2
  const doorZ = side === 's' ? a.z + a.d / 2 : a.z - a.d / 2
  return {
    corridor: {
      floor: { x: a.x, z: cz, w: DOOR_W, d: len, h: 0 },
      walls: [
        { x: a.x - DOOR_W / 2 - WALL_T / 2, z: cz, w: WALL_T, d: len, h },
        { x: a.x + DOOR_W / 2 + WALL_T / 2, z: cz, w: WALL_T, d: len, h },
      ],
    },
    door: {
      id: `door-${corridorIndex}-entrance`,
      corridorIndex,
      fromRoomId: a.id,
      x: a.x,
      z: doorZ,
      w: DOOR_W,
      d: 0.6,
      rotY: 0,
    },
  }
}

function collidersOf(rooms: RoomLayout[], corridors: CorridorLayout[]): Box[] {
  return [
    ...rooms.flatMap((r) => r.walls.filter((w) => !w.y)),
    ...corridors.flatMap((c) => c.walls),
    ...rooms.flatMap((r) => r.pedestals.map((p) => ({ x: p.x, z: p.z, w: PEDESTAL_SIZE, d: PEDESTAL_SIZE, h: 1 }))),
    // Solo hay collider donde hay pieza central: un centro despejado se puede cruzar.
    ...rooms.flatMap((r) => (r.centerpiece ? [{ x: r.x, z: r.z, w: r.centerpiece.footprint[0], d: r.centerpiece.footprint[1], h: r.centerpiece.height }] : [])),
    // Columnas, arcos y nichos: sólidos (también para el teletransporte de VR, que valida contra estos colliders).
    ...rooms.flatMap((r) => (r.decor.kind ? r.decor.items.map((it) => decorBox(r.decor.kind!, it, r.height)) : [])),
  ]
}

function boundsOf(rooms: RoomLayout[]): PalaceLayout['bounds'] {
  const xs = rooms.flatMap((r) => [r.x - r.w / 2, r.x + r.w / 2])
  const zs = rooms.flatMap((r) => [r.z - r.d / 2, r.z + r.d / 2])
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }
}

// Aparece en una esquina sin puerta, mirando al monumento: lejos del anillo de pedestales.
function spawnIn(first: RoomLayout): PalaceLayout['spawn'] {
  const { x: sx, z: sz } = entryCorner(first)
  return { x: sx, z: sz, yaw: Math.atan2(-(first.x - sx), -(first.z - sz)) }
}

export function buildLayout(palace: Museum): PalaceLayout {
  // Celdas y puertas salen del grafo (o de la serpiente si el museo no trae grafo).
  const plan = planRoomGrid(palace)
  const indexOf = new Map(palace.rooms.map((room, i) => [room.id, i]))
  const cells = palace.rooms.map((room) => plan.cells[room.id])
  const links = plan.links.map(({ from, to }) => [indexOf.get(from)!, indexOf.get(to)!] as const)

  const sizes = palace.rooms.map(roomSize)
  const cell = Math.max(...sizes.map((s) => Math.max(s.w, s.d))) + CORRIDOR_LEN

  const doorsOf: Side[][] = palace.rooms.map(() => [])
  for (const [i, j] of links) {
    const s = sideToward(cells[i], cells[j])
    doorsOf[i].push(s)
    doorsOf[j].push(opposite[s])
  }

  const startIndex = indexOf.get(plan.start) ?? 0
  const rooms: RoomLayout[] = []
  palace.rooms.forEach((room, i) => {
    const x = cells[i].col * cell
    const z = cells[i].row * cell
    const prev = i > 0 ? { floorStyle: rooms[i - 1].floorStyle, decorKind: rooms[i - 1].decor.kind } : null
    const spawn = i === startIndex ? entryCorner({ x, z, w: sizes[i].w, d: sizes[i].d }) : null
    rooms.push(makeRoomLayout(room, i, x, z, sizes[i], doorsOf[i], prev, spawn))
  })

  const corridors: CorridorLayout[] = []
  const doors: DoorLayout[] = []
  links.forEach(([i, j], corridorIndex) => {
    const { corridor, door } = makeLink(rooms[i], rooms[j], sideToward(cells[i], cells[j]), corridorIndex)
    corridors.push(corridor)
    doors.push(door)
  })

  return {
    rooms,
    corridors,
    colliders: collidersOf(rooms, corridors),
    doors,
    bounds: boundsOf(rooms),
    spawn: spawnIn(rooms[startIndex]),
  }
}

// ── Construcción incremental (palacio que se levanta mientras la IA lo escribe) ─────────────────────
//
// Cada sala se ubica al llegar, junto a la que la enlaza en el grafo (`placeRoom`, la misma regla que usa
// `buildLayout` pero sin mirar las salas que aún no existen), en una grilla de celda fija (`STREAM_CELL`,
// suficiente para cualquier sala permitida). Una sala ya puesta no se mueve nunca: su posición solo depende
// de las salas anteriores. Lo único que cambia en una sala ya mostrada es que se le abre una puerta cuando
// llega una sala que cuelga de ella. Al terminar, `finalizeLayout` añade las puertas extra del grafo final
// (bucles y atajos entre salas vecinas) y refresca el contenido (modelos 3D, dioramas) sin mover nada.

export const STREAM_CELL = 24
/** Solar de la obra: la retícula tenue que se dibuja mientras la cámara aérea espera la primera sala. */
export const STREAM_MAX_BOUNDS = { minX: -36, maxX: 84, minZ: -36, maxZ: 84 }
/** La IA aún no mandó la primera sala: el punto de entrada ya es el de cualquier primera sala (en el origen). */
const STREAM_SPAWN: PalaceLayout['spawn'] = { x: -4.5, z: -4.5, yaw: Math.atan2(-4.5, -4.5) }

/** Palacio vacío: solo el solar. La cámara aérea lo enmarca alrededor del origen. */
export function emptyLayout(): PalaceLayout {
  return { rooms: [], corridors: [], colliders: [], doors: [], bounds: { minX: -12, maxX: 12, minZ: -12, maxZ: 12 }, spawn: STREAM_SPAWN }
}

const sameSides = (a: Side[], b: Side[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join()

/** Arma el layout de un palacio en construcción reutilizando los objetos que no cambiaron. */
function assembleStream(prev: PalaceLayout, inputs: RoomInput[], grid: IncrementalGrid, edges: GraphEdge[], links: Array<[number, number]>): PalaceLayout {
  const doorsOf: Side[][] = inputs.map(() => [])
  const sides = links.map(([a, b]) => sideToward(grid.cells[a], grid.cells[b]))
  links.forEach(([a, b], k) => {
    doorsOf[a].push(sides[k])
    doorsOf[b].push(opposite[sides[k]])
  })
  const rooms: RoomLayout[] = []
  inputs.forEach((input, i) => {
    const old = prev.rooms[i]
    // Misma sala, mismo contenido y mismas puertas: se conserva el objeto.
    if (old && prev.stream?.inputs[i] === input && sameSides(old.doors, doorsOf[i])) {
      rooms.push(old)
      return
    }
    const before = i > 0 ? { floorStyle: rooms[i - 1].floorStyle, decorKind: rooms[i - 1].decor.kind } : null
    // La primera sala es donde aparece el jugador (STREAM_SPAWN).
    rooms.push(
      makeRoomLayout(input, i, grid.cells[i].col * STREAM_CELL, grid.cells[i].row * STREAM_CELL, roomSize(input, i), doorsOf[i], before, i === 0 ? STREAM_SPAWN : null),
    )
  })
  const corridors: CorridorLayout[] = []
  const doors: DoorLayout[] = []
  links.forEach(([a, b], k) => {
    // El pasillo solo depende de la posición y el tamaño de sus dos salas (no de sus puertas ni de su contenido).
    const same = (x?: RoomLayout, y?: RoomLayout) => !!x && !!y && x.x === y.x && x.z === y.z && x.w === y.w && x.d === y.d
    const unchanged = prev.corridors[k] && prev.doors[k] && same(prev.rooms[a], rooms[a]) && same(prev.rooms[b], rooms[b])
    if (unchanged) {
      corridors.push(prev.corridors[k])
      doors.push(prev.doors[k])
      return
    }
    const link = makeLink(rooms[a], rooms[b], sides[k], k)
    corridors.push(link.corridor)
    doors.push(link.door)
  })
  return {
    rooms,
    corridors,
    doors,
    colliders: collidersOf(rooms, corridors),
    bounds: boundsOf(rooms),
    spawn: prev.spawn,
    stream: { inputs, grid, edges },
  }
}

/**
 * Agrega una sala al final del layout sin mover ninguna de las anteriores. `edges` son las aristas de la sala con
 * las anteriores (según el modo): la sala se ubica junto a la que mejor la enlaza; sin aristas, junto a la última.
 * Una sala anterior solo cambia de objeto si se le abre una puerta hacia la nueva. Pura.
 * Llamar a `finalizeLayout` al terminar.
 */
export function appendRoomToLayout(layout: PalaceLayout, room: RoomInput, edges: GraphEdge[] = []): PalaceLayout {
  const state = layout.stream ?? { inputs: [], grid: emptyGrid(), edges: [] }
  const i = state.inputs.length
  const known = i === 0 || edges.length > 0 ? edges : [{ from: state.grid.ids[i - 1], to: room.id, kind: 'next' as const }]
  const grid = placeRoom(state.grid, room.id, known)
  const have = new Set(state.edges.map((e) => `${e.from}>${e.to}:${e.kind}`))
  const allEdges = [...state.edges, ...known.filter((e) => !have.has(`${e.from}>${e.to}:${e.kind}`))]
  return assembleStream(layout, [...state.inputs, room], grid, allEdges, grid.links)
}

/** Aristas conocidas del palacio que se está levantando (para el grafo provisional del museo). */
export const streamEdges = (layout: PalaceLayout): GraphEdge[] => layout.stream?.edges ?? []

/**
 * Cierra el layout al terminar: con el museo final, añade las puertas extra de su grafo (bucles y atajos entre salas
 * que quedaron vecinas) y refresca el contenido de cada sala (modelos 3D, dioramas, búsquedas) sin moverla.
 * Sin museo, usa las aristas conocidas. Devuelve el mismo objeto si no hay nada que cambiar.
 */
export function finalizeLayout(layout: PalaceLayout, museum?: Pick<Museum, 'rooms' | 'graph'>): PalaceLayout {
  const state = layout.stream
  if (!state || state.inputs.length === 0) return layout
  const byId = new Map((museum?.rooms ?? []).map((r) => [r.id, r]))
  const inputs = state.inputs.map((input) => byId.get(input.id) ?? input)
  const edges = museum?.graph?.edges ?? state.edges
  const links = [...state.grid.links, ...extraGridLinks(state.grid, edges)]
  if (links.length === layout.corridors.length && inputs.every((input, i) => input === state.inputs[i])) return layout
  return assembleStream(layout, inputs, state.grid, edges, links)
}

export function roomAt(layout: PalaceLayout, x: number, z: number): RoomLayout | null {
  return (
    layout.rooms.find((r) => Math.abs(x - r.x) <= r.w / 2 && Math.abs(z - r.z) <= r.d / 2) ?? null
  )
}

const PLAYER_R = 0.35

function hits(x: number, z: number, b: Box) {
  return Math.abs(x - b.x) < b.w / 2 + PLAYER_R && Math.abs(z - b.z) < b.d / 2 + PLAYER_R
}

// Mueve por ejes separados para poder deslizarse contra las paredes.
export function moveWithCollisions(colliders: Box[], x: number, z: number, dx: number, dz: number) {
  let nx = x + dx
  if (colliders.some((b) => hits(nx, z, b))) nx = x
  let nz = z + dz
  if (colliders.some((b) => hits(nx, nz, b))) nz = z
  return { x: nx, z: nz }
}

/** Imagen subida por el usuario y asignada por la IA a una pieza (vive solo en memoria). */
export type UserImage = { src: string; title: string }

export type PaintingAssignment = {
  slot: PaintingSlot
  key: string
  /** Búsqueda en Wikimedia; falta cuando el cuadro muestra una imagen del usuario. */
  search?: ImageSearch
  userImage?: UserImage
  roomId?: string
  diorama?: Diorama
}

const hasSearch = (s?: ImageSearch): s is ImageSearch => !!s && !!(s.wikiTitle?.trim() || s.commonsQuery?.trim())

/**
 * La búsqueda de la sala va al cuadro principal. Después, las piezas con una imagen del usuario
 * (si sigue en memoria) y luego las piezas con búsqueda, cada una al hueco libre más cercano a su
 * pedestal. Si faltan huecos, las piezas sobrantes se quedan sin cuadro.
 */
export function assignPaintings(room: RoomLayout, userImages: Record<string, string> = {}): PaintingAssignment[] {
  const out: PaintingAssignment[] = []
  const free = [...room.paintingSlots]
  const main = free.find((s) => s.main)
  if (main && (hasSearch(room.imageSearch) || room.diorama)) {
    out.push({ slot: main, search: hasSearch(room.imageSearch) ? room.imageSearch : undefined, key: `room:${room.id}`, roomId: room.id, diorama: room.diorama })
    free.splice(free.indexOf(main), 1)
  }
  const nearestFree = (p: PedestalLayout) => {
    let best = 0
    let bestD = Infinity
    free.forEach((s, i) => {
      const d = Math.hypot(s.x - p.x, s.z - p.z)
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    return free.splice(best, 1)[0]
  }
  const userSrc = (p: PedestalLayout) => (p.concept.image ? userImages[p.concept.image.imageId] : undefined)
  for (const p of room.pedestals) {
    const src = userSrc(p)
    if (!src || free.length === 0) continue
    out.push({ slot: nearestFree(p), userImage: { src, title: p.concept.title }, key: `user:${p.concept.id}` })
  }
  for (const p of room.pedestals) {
    if (userSrc(p) || !hasSearch(p.concept.imageSearch) || free.length === 0) continue
    out.push({ slot: nearestFree(p), search: p.concept.imageSearch, key: `piece:${p.concept.id}` })
  }
  return out
}
