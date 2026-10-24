import {
  type Museum,
  type Room,
  type Piece,
  type RoomTheme,
  type MonumentType,
  type Glyph,
  GlyphShape,
  SearchKeywordSchema,
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

/**
 * Normaliza la palabra clave de búsqueda que propone la IA: minúsculas, sin tildes ni signos, máx. 3 palabras.
 * Devuelve undefined si no queda un sustantivo usable (así la pieza conserva su glifo).
 */
export function normalizeSearchKeyword(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const words = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 1)
    .slice(0, 3);
  const keyword = words.join(" ");
  const parsed = SearchKeywordSchema.safeParse(keyword);
  return parsed.success ? parsed.data : undefined;
}

export interface ParseDslOptions {
  title?: string;
}

/**
 * Parses low-token line-based DSL output into a strictly validated Mus3o museum payload.
 *
 * Format:
 * ROOM: <id> | <title> | <theme> | <primaryHex> | <fogHex> | <monumentType> | <requires_csv_or_empty>
 * PIECE: <concept> | <glyph> | <mnemonicCue> | <searchKeyword opcional>
 */
export function parseMus3oDSL(raw: string, options: ParseDslOptions = {}): Museum {
  const stripped = raw.replace(/^```[a-zA-Z]*\r?\n?/m, "").replace(/\r?\n?```$/m, "").trim();
  const lines = stripped.split(/\r?\n/);
  const rooms: Room[] = [];
  let currentRoom: (Room & { requires: string[] }) | null = null;
  let roomCount = 0;
  let pieceCountInRoom = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) continue;

    if (trimmed.startsWith("ROOM:")) {
      const content = trimmed.slice(5).trim();
      const parts = content.split("|").map((p) => p.trim());

      roomCount++;
      const rawId = parts[0] || `room-${roomCount}`;
      const roomId = sanitizeSlug(rawId, `room-${roomCount}`);
      const title = parts[1] || `Sala ${roomCount}`;
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

      pieceCountInRoom = 0;
      currentRoom = {
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
      rooms.push(currentRoom);
      continue;
    }

    if (trimmed.startsWith("PIECE:")) {
      if (!currentRoom) {
        // Create an implicit room if PIECE comes before any ROOM
        roomCount++;
        currentRoom = {
          id: `room-${roomCount}`,
          name: `Sala ${roomCount}`,
          description: "Sala introductoria",
          theme: "cathedral",
          palette: { primary: "#3b82f6", fogColor: "#0f172a" },
          monument: "torus",
          pieces: [],
          requires: [],
        };
        rooms.push(currentRoom);
        pieceCountInRoom = 0;
      }

      if (currentRoom.pieces.length >= 12) {
        // Enforce max pieces per room
        continue;
      }

      pieceCountInRoom++;
      const content = trimmed.slice(6).trim();
      const parts = content.split("|").map((p) => p.trim());

      const concept = parts[0] || `Concepto ${pieceCountInRoom}`;
      const rawGlyph = (parts[1] || "box").toLowerCase();
      const glyphShape: Glyph = GLYPH_MAP[rawGlyph] ?? (GlyphShape.safeParse(rawGlyph).success ? (rawGlyph as Glyph) : "box");
      // Un "|" dentro del anclaje no debe correr los campos: la palabra clave es siempre el último campo.
      const hasKeyword = parts.length > 3;
      const cueParts = hasKeyword ? parts.slice(2, -1) : parts.slice(2);
      const mnemonicCue = cueParts.filter(Boolean).join(" ") || `Visualiza ${concept} anclado en este pedestal.`;

      const keyword = normalizeSearchKeyword(hasKeyword ? parts[parts.length - 1] : undefined);

      const pieceId = `${currentRoom.id}-p${pieceCountInRoom}`;

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
        ...(keyword ? { searchKeyword: keyword } : {}),
      };

      currentRoom.pieces.push(piece);
    }
  }

  if (rooms.length === 0) {
    // Fallback if empty DSL
    rooms.push({
      id: "sala-1",
      name: "Sala Principal",
      description: "Introducción a los conceptos clave",
      theme: "cathedral",
      palette: { primary: "#3b82f6", fogColor: "#0f172a" },
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
    });
  }

  // Ensure pieces exist in all rooms
  for (const room of rooms) {
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
  }

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
  for (const room of rooms as Array<Room & { requires?: string[] }>) {
    if (room.requires) {
      for (const req of room.requires) {
        if (roomIds.has(req)) {
          addEdge(req, room.id, "prerequisite");
        }
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
      const { requires: _, ...cleanRoom } = r as Room & { requires?: string[] };
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
