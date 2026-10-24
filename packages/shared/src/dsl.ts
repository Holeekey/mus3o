import {
  type Museum,
  type Room,
  type Piece,
  type RoomTheme,
  type MonumentType,
  type Glyph,
  type MuseumMode,
  QuizSchema,
  GlyphShape,
  LIMITS,
  SearchKeywordSchema,
  MAX_EDGES,
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

const LINE_TAG = /^[-*•\d.)\s]*\**(ROOM|PIECE|TITLE|PERIOD|QUIZ|IMAGE)\**\s*:\s*\**/i;

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
  /** Flujo completo: define la forma del grafo y los campos obligatorios (period, quiz). Sin modo, el grafo es el de siempre. */
  mode?: MuseumMode;
  /** Ids de imagen del request: una línea IMAGE con otro id (o repetido) se ignora. */
  imageIds?: string[];
  /** Recibe los ids de sala que el modelo marcó como "diorama" (octavo campo de ROOM). */
  onDioramaRooms?: (roomIds: string[]) => void;
}

/**
 * Grafo lógico por modo a partir de lo que declara la IA: `requires` (prerrequisitos, solo hacia salas anteriores,
 * así que nunca hay ciclos) y `related` (conexiones transversales). Toda sala queda alcanzable desde la primera.
 *  - exploration / quiz: árbol desde la primera sala (cada sala cuelga de su primer prerrequisito) + cruces `related`.
 *  - education: DAG de prerrequisitos (ramas y convergencias); una sala sin prerrequisito válido cuelga de la anterior.
 *  - biography: cadena cronológica `next` (+ cruces `related`).
 */
function buildGraph(rooms: Array<Room & { requires?: string[]; related?: string[] }>, mode: MuseumMode | undefined) {
  const ids = new Set(rooms.map((r) => r.id));
  const index = new Map(rooms.map((r, i) => [r.id, i]));
  const edges: Array<{ from: string; to: string; kind: "next" | "prerequisite" | "related" }> = [];
  const keys = new Set<string>();
  const add = (from: string, to: string, kind: "next" | "prerequisite" | "related") => {
    const key = `${from}->${to}:${kind}`;
    if (from === to || !ids.has(from) || !ids.has(to) || keys.has(key) || edges.length >= MAX_EDGES) return;
    keys.add(key);
    edges.push({ from, to, kind });
  };
  const earlier = (room: Room & { requires?: string[] }, i: number) => (room.requires ?? []).filter((q) => (index.get(q) ?? Infinity) < i);

  if (mode === "biography") {
    rooms.slice(0, -1).forEach((r, i) => add(r.id, rooms[i + 1].id, "next"));
  } else if (mode === "exploration" || mode === "quiz") {
    rooms.slice(1).forEach((room, i) => add(earlier(room, i + 1)[0] ?? rooms[0].id, room.id, "related"));
  } else if (mode === "education") {
    rooms.slice(1).forEach((room, i) => {
      const reqs = earlier(room, i + 1);
      (reqs.length > 0 ? reqs : [rooms[i].id]).forEach((q) => add(q, room.id, "prerequisite"));
    });
  } else {
    // Comportamiento original (sin modo): prerrequisitos primero y luego la cadena.
    rooms.forEach((r) => r.requires?.forEach((q) => add(q, r.id, "prerequisite")));
    rooms.slice(0, -1).forEach((r, i) => add(r.id, rooms[i + 1].id, "next"));
  }
  // Conexiones transversales declaradas por la IA (no alteran la alcanzabilidad ni crean ciclos dirigidos).
  if (mode) rooms.forEach((r) => r.related?.forEach((q) => add(q, r.id, "related")));
  return { start: rooms[0].id, edges };
}

/**
 * Parses low-token line-based DSL output into a strictly validated Mus3o museum payload.
 *
 * Format:
 * ROOM: <id> | <title> | <theme> | <primaryHex> | <fogHex> | <monumentType> | <requires_csv_or_empty>
 * PIECE: <concept> | <glyph> | <mnemonicCue> | <searchKeyword> | <explanation>
 */
export function parseMus3oDSL(raw: string, options: ParseDslOptions = {}): Museum {
  const stripped = raw.replace(/^```[a-zA-Z]*\r?\n?/m, "").replace(/\r?\n?```$/m, "").trim();
  const lines = stripped.split(/\r?\n/);
  const rooms: Room[] = [];
  let currentRoom: (Room & { requires: string[]; related?: string[] }) | null = null;
  let roomCount = 0;
  let pieceCountInRoom = 0;
  let skippingRoom = false;
  let docTitle: string | undefined;
  const dioramaRooms: string[] = [];
  let lastPiece: Piece | null = null;
  const usedImages = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) continue;

    // Tolera viñetas, numeración, negritas, mayúsculas/minúsculas y barras de ancho completo: "- **Piece**: ..."
    const tag = LINE_TAG.exec(trimmed);
    const kind = tag?.[1].toUpperCase();
    const body = tag ? trimmed.slice(tag[0].length).replace(/｜/g, "|") : "";

    if (kind === "TITLE") {
      docTitle = body.trim().slice(0, LIMITS.maxTitle) || docTitle;
      continue;
    }
    if (kind === "PERIOD") {
      if (currentRoom && body.trim()) currentRoom.period = body.trim().slice(0, 40);
      continue;
    }
    if (kind === "QUIZ") {
      // QUIZ: <pregunta> | <opción> | <opción> [| <opción> | <opción>] | <índice 0-based de la correcta>
      const q = body.split("|").map((x) => x.trim()).filter((x) => x.length > 0);
      const answer = Number(q[q.length - 1]);
      const quiz = QuizSchema.safeParse({ question: q[0], options: q.slice(1, -1).slice(0, 4), answerIndex: answer });
      if (lastPiece && quiz.success && quiz.data.answerIndex < quiz.data.options.length) lastPiece.quiz = quiz.data;
      continue;
    }
    if (kind === "IMAGE") {
      const id = body.trim().replace(/^["']|["']$/g, "");
      // Solo ids que llegaron en el request y como mucho una pieza por imagen.
      if (lastPiece && options.imageIds?.includes(id) && !usedImages.has(id)) {
        usedImages.add(id);
        lastPiece.image = { imageId: id };
      }
      continue;
    }

    if (kind === "ROOM") {
      lastPiece = null;
      if (rooms.length >= LIMITS.maxRooms) {
        currentRoom = null;
        skippingRoom = true;
        continue;
      }
      skippingRoom = false;
      const content = body.trim();
      const parts = content.split("|").map((p) => p.trim());

      roomCount++;
      const rawId = parts[0] || `room-${roomCount}`;
      // Ids repetidos (la IA a veces repite): se desambiguan para que el grafo y los pedestales no choquen.
      const baseId = sanitizeSlug(rawId, `room-${roomCount}`);
      let roomId = baseId;
      for (let n = 2; rooms.some((r) => r.id === roomId); n++) roomId = `${baseId}-${n}`;
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

      if ((parts[7] || "").toLowerCase() === "diorama") dioramaRooms.push(roomId);

      const related = (parts[8] || "")
        .split(",")
        .map((r) => sanitizeSlug(r, ""))
        .filter((r) => r.length > 0 && r !== roomId);

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
        related,
      };
      rooms.push(currentRoom);
      continue;
    }

    if (kind === "PIECE") {
      // Piezas de una sala omitida por el tope: se ignoran, no se cuelgan de otra sala.
      if (skippingRoom) continue;
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

      if (currentRoom.pieces.length >= LIMITS.maxPiecesPerRoom) {
        // Enforce max pieces per room
        continue;
      }

      pieceCountInRoom++;
      const content = body.trim();
      const parts = content.split("|").map((p) => p.trim());

      const concept = parts[0] || `Concepto ${pieceCountInRoom}`;
      const rawGlyph = (parts[1] || "box").toLowerCase();
      const glyphShape: Glyph = GLYPH_MAP[rawGlyph] ?? (GlyphShape.safeParse(rawGlyph).success ? (rawGlyph as Glyph) : "box");
      // Campos: concepto | glifo | anclaje | palabra clave | explicación. Un "|" dentro del anclaje no corre los
      // campos porque la palabra clave y la explicación se toman desde el final. Con 4 campos (formato anterior)
      // el último es la palabra clave.
      const n = parts.length;
      const explanation = n >= 5 ? parts[n - 1] : "";
      const rawKeyword = n >= 5 ? parts[n - 2] : n === 4 ? parts[3] : undefined;
      const cueParts = n >= 5 ? parts.slice(2, -2) : n === 4 ? parts.slice(2, -1) : parts.slice(2);
      const mnemonicCue = cueParts.filter(Boolean).join(" ") || `Visualiza ${concept} anclado en este pedestal.`;

      const keyword = normalizeSearchKeyword(rawKeyword);

      const pieceId = `${currentRoom.id}-p${pieceCountInRoom}`;

      const piece: Piece = {
        id: pieceId,
        title: concept.slice(0, 80),
        text: (explanation || concept).slice(0, LIMITS.maxText),
        fact: mnemonicCue.slice(0, 400),
        mnemonicCue: mnemonicCue.slice(0, 400),
        model: {
          type: "glyph",
          shape: glyphShape,
        },
        ...(keyword ? { searchKeyword: keyword } : {}),
      };

      currentRoom.pieces.push(piece);
      lastPiece = piece;
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
  options.onDioramaRooms?.(dioramaRooms.slice(0, 2));
  const graph = buildGraph(rooms as Array<Room & { requires?: string[]; related?: string[] }>, options.mode);

  const museumPayload = {
    title: options.title || docTitle || rooms[0].name || "Palacio de la Memoria",
    theme: {
      palette: [rooms[0].palette?.primary || "#3b82f6", rooms[0].palette?.fogColor || "#0f172a"],
      ambience: rooms[0].theme || "cathedral",
    },
    rooms: rooms.map((r) => {
      const { requires: _, related: __, ...cleanRoom } = r as Room & { requires?: string[]; related?: string[] };
      return cleanRoom;
    }),
    mode: options.mode ?? ("education" as const),
    graph,
  };

  return MuseumSchema.parse(museumPayload);
}
