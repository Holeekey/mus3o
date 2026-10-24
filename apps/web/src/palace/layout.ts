import { planRoomGrid, type Diorama, type Glyph, type ImageSearch, type Museum, type Piece, type MonumentType, type RoomPaletteDescriptor, type RoomTheme } from '@mus3o/shared'

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
}

export const ROOM_COLORS = ['#2EE6D6', '#FF3DA5', '#FFB547', '#8B7CFF', '#7CFF6B', '#FF6B5B', '#4DB8FF', '#F2F26B']
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

export function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
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

function makeRoomLayout(room: RoomInput, i: number, x: number, z: number, size: RoomSize, doors: Side[]): RoomLayout {
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
    doors,
    walls: roomWalls(x, z, w, d, height, doors),
    pedestals,
    paintingSlots: paintingSlots(x, z, w, d, doors),
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
    ...rooms.map((r) => ({ x: r.x, z: r.z, w: 1.6, d: 1.6, h: 2 })),
  ]
}

function boundsOf(rooms: RoomLayout[]): PalaceLayout['bounds'] {
  const xs = rooms.flatMap((r) => [r.x - r.w / 2, r.x + r.w / 2])
  const zs = rooms.flatMap((r) => [r.z - r.d / 2, r.z + r.d / 2])
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }
}

// Aparece en una esquina sin puerta, mirando al monumento: lejos del anillo de pedestales.
function spawnIn(first: RoomLayout): PalaceLayout['spawn'] {
  const sx = first.x - first.w / 2 + 1.5
  const sz = first.z - first.d / 2 + 1.5
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

  const rooms: RoomLayout[] = palace.rooms.map((room, i) =>
    makeRoomLayout(room, i, cells[i].col * cell, cells[i].row * cell, sizes[i], doorsOf[i]),
  )

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
    spawn: spawnIn(rooms[indexOf.get(plan.start) ?? 0]),
  }
}

// ── Construcción incremental (palacio que se levanta mientras la IA lo escribe) ─────────────────────
//
// Las salas se ubican en serpiente (E, luego S, luego O…), `STREAM_COLS` por fila, en el orden en que
// llegan, y cada una se une con la anterior. Una sala ya puesta no se mueve nunca: la celda es fija
// (`STREAM_CELL`, suficiente para cualquier sala permitida) y la posición solo depende del índice.
// El layout final es el incremental (no se recalcula con `buildLayout`), así que nada salta al terminar.

export const STREAM_COLS = 4
export const STREAM_CELL = 24
/** Límites de un palacio en construcción lleno (8 salas): sol y sombras se encuadran una vez y no se mueven al crecer. */
export const STREAM_MAX_BOUNDS = { minX: -11, maxX: (STREAM_COLS - 1) * STREAM_CELL + 11, minZ: -9, maxZ: STREAM_CELL + 9 }
/** La IA aún no mandó la primera sala: el punto de entrada ya es el de cualquier primera sala. */
const STREAM_SPAWN: PalaceLayout['spawn'] = { x: -4.5, z: -4.5, yaw: Math.atan2(-4.5, -4.5) }

/** Celda de la sala `i` en la serpiente. */
export function streamCell(i: number): { row: number; col: number } {
  const row = Math.floor(i / STREAM_COLS)
  return { row, col: row % 2 === 0 ? i % STREAM_COLS : STREAM_COLS - 1 - (i % STREAM_COLS) }
}

/** Palacio vacío: solo el solar. La cámara aérea lo enmarca alrededor del origen. */
export function emptyLayout(): PalaceLayout {
  return { rooms: [], corridors: [], colliders: [], doors: [], bounds: { minX: -12, maxX: 12, minZ: -12, maxZ: 12 }, spawn: STREAM_SPAWN }
}

// Hacia dónde queda la sala i+1 respecto de la i.
const streamSide = (i: number): Side => sideToward(streamCell(i), streamCell(i + 1))

/** Muro invisible sobre la puerta de la última sala, que aún no tiene a dónde llevar. */
function pendingDoorSeal(room: RoomLayout, side: Side): Box {
  const reach = 0.6
  const horizontal = side === 'n' || side === 's'
  const dx = side === 'e' ? room.w / 2 : side === 'w' ? -room.w / 2 : 0
  const dz = side === 's' ? room.d / 2 : side === 'n' ? -room.d / 2 : 0
  return { x: room.x + dx, z: room.z + dz, w: horizontal ? DOOR_W : reach, d: horizontal ? reach : DOOR_W, h: 3 }
}

/**
 * Agrega una sala al final del layout sin mover ninguna de las anteriores (conservan su objeto).
 * La última sala reserva ya su puerta hacia la siguiente —así sus muros y cuadros no cambian cuando
 * llega— y la puerta queda tapada con un collider hasta que llega la sala siguiente. Pura.
 * Llamar a `finalizeLayout` al terminar para cerrar la puerta reservada de la última sala.
 */
export function appendRoomToLayout(layout: PalaceLayout, room: RoomInput): PalaceLayout {
  const i = layout.rooms.length
  const cell = streamCell(i)
  const size = roomSize(room, i)
  const doors: Side[] = []
  if (i > 0) doors.push(opposite[streamSide(i - 1)])
  doors.push(streamSide(i)) // reservada: se tapa hasta que llegue la siguiente
  const next = makeRoomLayout(room, i, cell.col * STREAM_CELL, cell.row * STREAM_CELL, size, doors)

  const rooms = [...layout.rooms, next]
  const corridors = [...layout.corridors]
  const linkDoors = [...layout.doors]
  if (i > 0) {
    const { corridor, door } = makeLink(layout.rooms[i - 1], next, streamSide(i - 1), i - 1)
    corridors.push(corridor)
    linkDoors.push(door)
  }
  return {
    rooms,
    corridors,
    doors: linkDoors,
    colliders: [...collidersOf(rooms, corridors), pendingDoorSeal(next, streamSide(i))],
    bounds: boundsOf(rooms),
    spawn: layout.spawn,
  }
}

/**
 * Cierra la puerta reservada de la última sala (ya no llegará otra) y quita el muro invisible.
 * Es lo único que cambia al terminar: solo muros y cuadros de esa sala; ninguna sala se mueve.
 */
export function finalizeLayout(layout: PalaceLayout): PalaceLayout {
  const n = layout.rooms.length
  if (n === 0) return layout
  const last = layout.rooms[n - 1]
  const doors = last.doors.filter((side) => side !== streamSide(n - 1))
  if (doors.length === last.doors.length) return layout
  const sealed: RoomLayout = {
    ...last,
    doors,
    walls: roomWalls(last.x, last.z, last.w, last.d, last.height, doors),
    paintingSlots: paintingSlots(last.x, last.z, last.w, last.d, doors),
  }
  const rooms = [...layout.rooms.slice(0, n - 1), sealed]
  return { ...layout, rooms, colliders: collidersOf(rooms, layout.corridors), bounds: boundsOf(rooms) }
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

export type PaintingAssignment = { slot: PaintingSlot; search: ImageSearch; key: string; roomId?: string; diorama?: Diorama }

const hasSearch = (s?: ImageSearch): s is ImageSearch => !!s && !!(s.wikiTitle?.trim() || s.commonsQuery?.trim())

/**
 * La búsqueda de la sala va al cuadro principal; cada pieza con búsqueda, al hueco libre
 * más cercano a su pedestal. Si faltan huecos, las piezas sobrantes se quedan sin cuadro.
 */
export function assignPaintings(room: RoomLayout): PaintingAssignment[] {
  const out: PaintingAssignment[] = []
  const free = [...room.paintingSlots]
  const main = free.find((s) => s.main)
  if (main && hasSearch(room.imageSearch)) {
    out.push({ slot: main, search: room.imageSearch, key: `room:${room.id}`, roomId: room.id, diorama: room.diorama })
    free.splice(free.indexOf(main), 1)
  }
  for (const p of room.pedestals) {
    if (!hasSearch(p.concept.imageSearch) || free.length === 0) continue
    let best = 0
    let bestD = Infinity
    free.forEach((s, i) => {
      const d = Math.hypot(s.x - p.x, s.z - p.z)
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    out.push({ slot: free[best], search: p.concept.imageSearch, key: `piece:${p.concept.id}` })
    free.splice(best, 1)
  }
  return out
}
