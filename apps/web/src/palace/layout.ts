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

export function buildLayout(palace: Museum): PalaceLayout {
  // Celdas y puertas salen del grafo (o de la serpiente si el museo no trae grafo).
  const plan = planRoomGrid(palace)
  const indexOf = new Map(palace.rooms.map((room, i) => [room.id, i]))
  const cells = palace.rooms.map((room) => plan.cells[room.id])
  const links = plan.links.map(({ from, to }) => [indexOf.get(from)!, indexOf.get(to)!] as const)

  // Tamaño de cada sala según cuántos conceptos tiene (anillo de pedestales).
  const sizes = palace.rooms.map((room, i) => {
    const count = Math.max(room.pieces.length, 1)
    const radius = Math.max(3.2, (count * PEDESTAL_SPACING) / (2 * Math.PI))
    const half = radius + 3
    const aspect = i % 3 === 1 ? 1.35 : 1 // algunas salas son alargadas
    return { radius, w: half * 2 * aspect, d: half * 2, aspect }
  })
  const cell = Math.max(...sizes.map((s) => Math.max(s.w, s.d))) + CORRIDOR_LEN

  const doorsOf: Side[][] = palace.rooms.map(() => [])
  for (const [i, j] of links) {
    const s = sideToward(cells[i], cells[j])
    doorsOf[i].push(s)
    doorsOf[j].push(opposite[s])
  }

  const rooms: RoomLayout[] = palace.rooms.map((room, i) => {
    const { row, col } = cells[i]
    const x = col * cell
    const z = row * cell
    const { w, d, radius, aspect } = sizes[i]
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
      doors: doorsOf[i],
      walls: roomWalls(x, z, w, d, height, doorsOf[i]),
      pedestals,
      paintingSlots: paintingSlots(x, z, w, d, doorsOf[i]),
      imageSearch: room.imageSearch,
      theme: room.theme,
      palette: room.palette,
      diorama: room.diorama,
    }
  })

  const corridors: CorridorLayout[] = []
  const doors: DoorLayout[] = []
  let corridorIndex = 0
  for (const [i, j] of links) {
    const a = rooms[i]
    const b = rooms[j]
    const side = sideToward(cells[i], cells[j])
    const h = 3.6
    if (side === 'e' || side === 'w') {
      const x1 = side === 'e' ? a.x + a.w / 2 : b.x + b.w / 2
      const x2 = side === 'e' ? b.x - b.w / 2 : a.x - a.w / 2
      const len = x2 - x1
      const cx = (x1 + x2) / 2
      corridors.push({
        floor: { x: cx, z: a.z, w: len, d: DOOR_W, h: 0 },
        walls: [
          { x: cx, z: a.z - DOOR_W / 2 - WALL_T / 2, w: len, d: WALL_T, h },
          { x: cx, z: a.z + DOOR_W / 2 + WALL_T / 2, w: len, d: WALL_T, h },
        ],
      })
      const doorX = side === 'e' ? a.x + a.w / 2 : a.x - a.w / 2
      doors.push({
        id: `door-${corridorIndex}-entrance`,
        corridorIndex,
        fromRoomId: a.id,
        x: doorX,
        z: a.z,
        w: 0.6,
        d: DOOR_W,
        rotY: Math.PI / 2,
      })
    } else {
      const z1 = side === 's' ? a.z + a.d / 2 : b.z + b.d / 2
      const z2 = side === 's' ? b.z - b.d / 2 : a.z - a.d / 2
      const len = z2 - z1
      const cz = (z1 + z2) / 2
      corridors.push({
        floor: { x: a.x, z: cz, w: DOOR_W, d: len, h: 0 },
        walls: [
          { x: a.x - DOOR_W / 2 - WALL_T / 2, z: cz, w: WALL_T, d: len, h },
          { x: a.x + DOOR_W / 2 + WALL_T / 2, z: cz, w: WALL_T, d: len, h },
        ],
      })
      const doorZ = side === 's' ? a.z + a.d / 2 : a.z - a.d / 2
      doors.push({
        id: `door-${corridorIndex}-entrance`,
        corridorIndex,
        fromRoomId: a.id,
        x: a.x,
        z: doorZ,
        w: DOOR_W,
        d: 0.6,
        rotY: 0,
      })
    }
    corridorIndex++
  }

  const colliders: Box[] = [
    ...rooms.flatMap((r) => r.walls.filter((w) => !w.y)),
    ...corridors.flatMap((c) => c.walls),
    ...rooms.flatMap((r) => r.pedestals.map((p) => ({ x: p.x, z: p.z, w: PEDESTAL_SIZE, d: PEDESTAL_SIZE, h: 1 }))),
    ...rooms.map((r) => ({ x: r.x, z: r.z, w: 1.6, d: 1.6, h: 2 })),
  ]

  const xs = rooms.flatMap((r) => [r.x - r.w / 2, r.x + r.w / 2])
  const zs = rooms.flatMap((r) => [r.z - r.d / 2, r.z + r.d / 2])
  const first = rooms[indexOf.get(plan.start) ?? 0]
  // Aparece en una esquina sin puerta, mirando al monumento: lejos del anillo de pedestales.
  const sx = first.x - first.w / 2 + 1.5
  const sz = first.z - first.d / 2 + 1.5
  const spawn = { x: sx, z: sz, yaw: Math.atan2(-(first.x - sx), -(first.z - sz)) }

  return {
    rooms,
    corridors,
    colliders,
    doors,
    bounds: { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) },
    spawn,
  }
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

export type PaintingAssignment = { slot: PaintingSlot; /** Sin búsqueda, el cuadro principal de una sala con diorama es un lienzo de yeso con el título. */ search?: ImageSearch; key: string; roomId?: string; diorama?: Diorama }

const hasSearch = (s?: ImageSearch): s is ImageSearch => !!s && !!(s.wikiTitle?.trim() || s.commonsQuery?.trim())

/**
 * La búsqueda de la sala va al cuadro principal; cada pieza con búsqueda, al hueco libre
 * más cercano a su pedestal. Si faltan huecos, las piezas sobrantes se quedan sin cuadro.
 */
export function assignPaintings(room: RoomLayout): PaintingAssignment[] {
  const out: PaintingAssignment[] = []
  const free = [...room.paintingSlots]
  const main = free.find((s) => s.main)
  if (main && (hasSearch(room.imageSearch) || room.diorama)) {
    out.push({ slot: main, search: hasSearch(room.imageSearch) ? room.imageSearch : undefined, key: `room:${room.id}`, roomId: room.id, diorama: room.diorama })
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
