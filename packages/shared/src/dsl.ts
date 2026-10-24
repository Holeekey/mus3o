import {
  type Museum,
  type Room,
  type Piece,
  type RoomTheme,
  type MonumentType,
  type Glyph,
  GlyphShape,
  MuseumSchema,
} from "./schema";

const VALID_THEMES: Record<string, RoomTheme> = {
  cyberpunk: "cyberpunk",
  ancient: "ancient",
  organic: "organic",
  void: "void",
  cathedral: "cathedral",
};

const VALID_MONUMENTS: Record<string, MonumentType> = {
  torus: "torus",
  dodecahedron: "dodecahedron",
  ring_system: "ring_system",
  crystal: "crystal",
};

const GLYPH_MAP: Record<string, Glyph> = {
  icosahedron: "icosahedron",
  octahedron: "octahedron",
  dodecahedron: "dodecahedron",
  tetrahedron: "tetrahedron",
  torus: "torus",
  cone: "cone",
  box: "box",
  sphere: "sphere",
  // Semantic glyph aliases mapped to geometrical glyphs
  cpu: "box",
  chip: "box",
  cube: "box",
  database: "octahedron",
  server: "box",
  shield: "dodecahedron",
  security: "dodecahedron",
  network: "icosahedron",
  globe: "sphere",
  cloud: "sphere",
  crystal: "tetrahedron",
  gem: "octahedron",
  ring: "torus",
  loop: "torus",
  pointer: "cone",
};

const HEX_REGEX = /^#[0-9a-fA-F]{3,8}$/;

function sanitizeHex(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  return HEX_REGEX.test(trimmed) ? trimmed : fallback;
}

function sanitizeSlug(raw: string, fallback: string): string {
  const clean = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return clean.length > 0 ? clean : fallback;
}

export interface ParseDslOptions {
  title?: string;
}

/** Sala tal como la lee el parser: `requires` (ids de prerrequisitos) solo sirve para armar el grafo. */
export type DslRoom = Room & { requires: string[] };

const DEFAULT_PALETTE = { primary: "#3b82f6", fogColor: "#0f172a" };

/**
 * Lee el DSL línea a línea. Es el único lugar donde se interpretan `ROOM:` y `PIECE:`, de modo que el
 * parser de una sola vez (`parseMus3oDSL`) y el incremental (`Mus3oDslStream`) no pueden divergir.
 */
class DslAccumulator {
  readonly rooms: DslRoom[] = [];
  current: DslRoom | null = null;
  private roomCount = 0;
  private pieceCountInRoom = 0;

  feedLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) return;

    if (trimmed.startsWith("ROOM:")) {
      const content = trimmed.slice(5).trim();
      const parts = content.split("|").map((p) => p.trim());

      this.roomCount++;
      const rawId = parts[0] || `room-${this.roomCount}`;
      const roomId = sanitizeSlug(rawId, `room-${this.roomCount}`);
      const title = parts[1] || `Sala ${this.roomCount}`;
      const rawTheme = (parts[2] || "").toLowerCase();
      const theme: RoomTheme = VALID_THEMES[rawTheme] ?? "cathedral";
      const primaryHex = sanitizeHex(parts[3], "#3b82f6");
      const fogHex = sanitizeHex(parts[4], "#0f172a");
      const rawMonument = (parts[5] || "").toLowerCase();
      const monument: MonumentType = VALID_MONUMENTS[rawMonument] ?? "torus";

      const requires = (parts[6] || "")
        .split(",")
        .map((r) => sanitizeSlug(r, ""))
        .filter((r) => r.length > 0);

      this.pieceCountInRoom = 0;
      this.current = {
        id: roomId,
        name: title.slice(0, 80),
        description: `Exhibición temática de ${title}`.slice(0, 400),
        theme,
        palette: {
          primary: primaryHex,
          fogColor: fogHex,
        },
        monument,
        pieces: [],
        requires,
      };
      this.rooms.push(this.current);
      return;
    }

    if (trimmed.startsWith("PIECE:")) {
      if (!this.current) {
        // Create an implicit room if PIECE comes before any ROOM
        this.roomCount++;
        this.current = {
          id: `room-${this.roomCount}`,
          name: `Sala ${this.roomCount}`,
          description: "Sala introductoria",
          theme: "cathedral",
          palette: { ...DEFAULT_PALETTE },
          monument: "torus",
          pieces: [],
          requires: [],
        };
        this.rooms.push(this.current);
        this.pieceCountInRoom = 0;
      }

      if (this.current.pieces.length >= 12) {
        // Enforce max pieces per room
        return;
      }

      this.pieceCountInRoom++;
      const content = trimmed.slice(6).trim();
      const parts = content.split("|").map((p) => p.trim());

      const concept = parts[0] || `Concepto ${this.pieceCountInRoom}`;
      const rawGlyph = (parts[1] || "box").toLowerCase();
      const glyphShape: Glyph = GLYPH_MAP[rawGlyph] ?? (GlyphShape.safeParse(rawGlyph).success ? (rawGlyph as Glyph) : "box");
      const mnemonicCue = parts[2] || `Visualiza ${concept} anclado en este pedestal.`;

      const pieceId = `${this.current.id}-p${this.pieceCountInRoom}`;

      const piece: Piece = {
        id: pieceId,
        title: concept.slice(0, 80),
        text: concept.slice(0, 400),
        fact: mnemonicCue.slice(0, 400),
        mnemonicCue: mnemonicCue.slice(0, 400),
        model: {
          type: "glyph",
          shape: glyphShape,
        },
      };

      this.current.pieces.push(piece);
    }
  }
}

/** Una sala sin piezas recibe una pieza central para que el palacio siga siendo válido. */
function ensurePieces(room: DslRoom): DslRoom {
  if (room.pieces.length === 0) {
    room.pieces.push({
      id: `${room.id}-p1`,
      title: room.name,
      text: room.description,
      fact: `Concepto central de ${room.name}`,
      mnemonicCue: `Visualiza un pedestal resplandeciente para ${room.name}.`,
      model: { type: "glyph", shape: "torus" },
    });
  }
  return room;
}

/**
 * Arma el museo (grafo conectado incluido) con las salas ya leídas. Compartido por el parser de una sola
 * vez y por el servidor de streaming, que lo usa al terminar con las salas que ya emitió.
 */
export function assembleDslMuseum(parsedRooms: DslRoom[], options: ParseDslOptions = {}): Museum {
  const rooms = parsedRooms;
  if (rooms.length === 0) {
    // Fallback if empty DSL
    rooms.push({
      id: "sala-1",
      name: "Sala Principal",
      description: "Introducción a los conceptos clave",
      theme: "cathedral",
      palette: { ...DEFAULT_PALETTE },
      monument: "crystal",
      pieces: [
        {
          id: "sala-1-p1",
          title: "Inicio",
          text: "Bienvenido al palacio de la memoria",
          fact: "Visualiza este templo como el inicio del recorrido",
          mnemonicCue: "Un arco triunfal que resplandece en el centro de la sala.",
          model: { type: "glyph", shape: "dodecahedron" },
        },
      ],
      requires: [],
    });
  }

  // Ensure pieces exist in all rooms
  for (const room of rooms) ensurePieces(room);

  // Build connected graph topology
  const start = rooms[0].id;
  const roomIds = new Set(rooms.map((r) => r.id));
  const edges: Array<{ from: string; to: string; kind: "next" | "prerequisite" | "related" }> = [];
  const edgeKeys = new Set<string>();

  const addEdge = (from: string, to: string, kind: "next" | "prerequisite" | "related") => {
    if (from === to || !roomIds.has(from) || !roomIds.has(to)) return;
    const key = `${from}->${to}:${kind}`;
    if (!edgeKeys.has(key) && edges.length < 16) {
      edgeKeys.add(key);
      edges.push({ from, to, kind });
    }
  };

  // Add prerequisites from requires
  for (const room of rooms) {
    for (const req of room.requires) {
      if (roomIds.has(req)) {
        addEdge(req, room.id, "prerequisite");
      }
    }
  }

  // Ensure all rooms are reachable sequentially from start to guarantee reachability
  for (let i = 0; i < rooms.length - 1; i++) {
    addEdge(rooms[i].id, rooms[i + 1].id, "next");
  }

  const museumPayload = {
    title: options.title || rooms[0].name || "Palacio de la Memoria",
    theme: {
      palette: [rooms[0].palette?.primary || "#3b82f6", rooms[0].palette?.fogColor || "#0f172a"],
      ambience: rooms[0].theme || "cathedral",
    },
    rooms: rooms.map((r) => {
      const { requires: _, ...cleanRoom } = r;
      return cleanRoom;
    }),
    mode: "education" as const,
    graph: {
      start,
      edges,
    },
  };

  return MuseumSchema.parse(museumPayload);
}

/**
 * Parses low-token line-based DSL output into a strictly validated Mus3o museum payload.
 *
 * Format:
 * ROOM: <id> | <title> | <theme> | <primaryHex> | <fogHex> | <monumentType> | <requires_csv_or_empty>
 * PIECE: <concept> | <glyph> | <mnemonicCue>
 */
export function parseMus3oDSL(raw: string, options: ParseDslOptions = {}): Museum {
  const stripped = raw.replace(/^```[a-zA-Z]*\r?\n?/m, "").replace(/\r?\n?```$/m, "").trim();
  const acc = new DslAccumulator();
  for (const line of stripped.split(/\r?\n/)) acc.feedLine(line);
  return assembleDslMuseum(acc.rooms, options);
}

/**
 * Lector incremental del mismo DSL: se le pasan los trozos de texto tal como llegan y devuelve cada sala
 * en cuanto queda completa (al empezar la línea `ROOM:` siguiente, o en `end()`). Los trozos pueden
 * cortar una línea por la mitad. Las líneas se interpretan igual que en `parseMus3oDSL`.
 */
export class Mus3oDslStream {
  private readonly acc = new DslAccumulator();
  private buffer = "";
  private readonly emitted = new Set<DslRoom>();

  /** Todas las salas ya emitidas, en orden. */
  readonly rooms: DslRoom[] = [];

  /** Añade texto y devuelve las salas que este trozo terminó de completar. */
  push(chunk: string): DslRoom[] {
    this.buffer += chunk;
    const done: DslRoom[] = [];
    const lines = this.buffer.split(/\r?\n/);
    // La última porción no tiene salto de línea todavía: puede estar cortada.
    this.buffer = lines.pop() ?? "";
    for (const line of lines) this.feed(line, done);
    // Una línea `ROOM:` ya empezada cierra la sala anterior sin esperar a su salto de línea.
    if (this.buffer.trimStart().startsWith("ROOM:")) this.flushCurrent(done);
    return done;
  }

  /** Cierra el texto: procesa la línea pendiente y la última sala. */
  end(): DslRoom[] {
    const done: DslRoom[] = [];
    if (this.buffer) this.feed(this.buffer, done);
    this.buffer = "";
    this.flushCurrent(done);
    return done;
  }

  private feed(line: string, done: DslRoom[]) {
    const head = line.trim();
    if (head.startsWith("ROOM:")) this.flushCurrent(done);
    // Un PIECE que llegara tras una sala ya emitida no debe modificarla.
    else if (head.startsWith("PIECE:") && this.acc.current && this.emitted.has(this.acc.current)) return;
    this.acc.feedLine(line);
  }

  private flushCurrent(done: DslRoom[]) {
    const room = this.acc.current;
    if (!room || this.emitted.has(room)) return;
    this.emitted.add(room);
    ensurePieces(room);
    this.rooms.push(room);
    done.push(room);
  }
}
