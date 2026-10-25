import {
  type Museum,
  type Room,
  type Piece,
  type RoomTheme,
  type MonumentType,
  type Glyph,
  type MuseumMode,
  type GraphEdge,
  QuizSchema,
  GlyphShape,
  LIMITS,
  SearchKeywordSchema,
  MAX_EDGES,
  MuseumSchema,
  DioramaDirectivesSchema,
  DioramaDirectivePropSchema,
  MAX_DIRECTIVE_PROPS,
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

const LINE_TAG = /^[\s>*•\d.)\-\[\]xX]*\**(ROOM|PIECE|TITLE|PERIOD|QUIZ|IMAGE|DIO|D_PROP)\**\s*(?::|：|-(?=\s)|\|)\s*\**/i;

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

/** Sala tal como la lee el parser: `requires` y `related` (ids de otras salas) solo sirven para armar el grafo. */
export type DslRoom = Room & { requires: string[]; related?: string[] };

export type DslLineKind = "ROOM" | "PIECE" | "TITLE" | "PERIOD" | "QUIZ" | "IMAGE" | "DIO" | "D_PROP";

/** Clasifica una línea del DSL (tolerante a viñetas, negritas, mayúsculas, dos puntos asiáticos y pipes directos). */
export function classifyDslLine(trimmed: string): { kind?: DslLineKind; body: string } {
  // ：→: y ｜→| tienen el mismo largo, así que el índice de la etiqueta vale también sobre el texto original.
  // Solo se normaliza el cuerpo para las barras; los dos puntos de ancho completo del contenido se respetan.
  const normalized = trimmed.replace(/：/g, ":").replace(/｜/g, "|");
  const tag = LINE_TAG.exec(normalized);
  if (!tag) return { body: "" };
  return { kind: tag[1].toUpperCase() as DslLineKind, body: trimmed.slice(tag[0].length).replace(/｜/g, "|").trim() };
}

const DEFAULT_PALETTE = { primary: "#3b82f6", fogColor: "#0f172a" };

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
 * Lee el DSL línea a línea. Es el único lugar donde se interpretan las líneas (ROOM, PIECE, TITLE, PERIOD,
 * QUIZ, IMAGE), de modo que el parser de una sola vez (`parseMus3oDSL`) y el incremental (`Mus3oDslStream`)
 * no pueden divergir. El grafo, los rellenos y la validación final viven en `finish()`.
 */
class DslAccumulator {
  readonly rooms: DslRoom[] = [];
  current: DslRoom | null = null;
  docTitle: string | undefined;
  readonly dioramaRooms: string[] = [];
  private roomCount = 0;
  private pieceCountInRoom = 0;
  private skippingRoom = false;
  private lastPiece: Piece | null = null;
  private readonly usedImages = new Set<string>();

  constructor(private readonly options: ParseDslOptions = {}) {}

  feedLine(line: string): void {
    // Una valla de código pegada al final de la línea no es parte del contenido.
    const trimmed = line.trim().replace(/\s*```$/, "").trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) return;

    // Tolera viñetas, numeración, negritas, mayúsculas/minúsculas y barras de ancho completo: "- **Piece**: ..."
    const { kind, body } = classifyDslLine(trimmed);

    if (kind === "TITLE") {
      this.docTitle = body.trim().slice(0, LIMITS.maxTitle) || this.docTitle;
      return;
    }
    if (kind === "PERIOD") {
      if (this.current && body.trim()) this.current.period = body.trim().slice(0, 40);
      return;
    }
    if (kind === "QUIZ") {
      // QUIZ: <pregunta> | <opción> | <opción> [| <opción> | <opción>] | <índice 0-based de la correcta>
      const q = body.split("|").map((x) => x.trim()).filter((x) => x.length > 0);
      const answer = Number(q[q.length - 1]);
      const quiz = QuizSchema.safeParse({ question: q[0], options: q.slice(1, -1).slice(0, 4), answerIndex: answer });
      if (this.lastPiece && quiz.success && quiz.data.answerIndex < quiz.data.options.length) this.lastPiece.quiz = quiz.data;
      return;
    }
    if (kind === "IMAGE") {
      const id = body.trim().replace(/^["']|["']$/g, "");
      // Solo ids que llegaron en el request y como mucho una pieza por imagen.
      if (this.lastPiece && this.options.imageIds?.includes(id) && !this.usedImages.has(id)) {
        this.usedImages.add(id);
        this.lastPiece.image = { imageId: id };
      }
      return;
    }

    if (kind === "DIO" || kind === "D_PROP") {
      this.feedDirective(kind, body);
      return;
    }

    if (kind === "ROOM") {
      this.lastPiece = null;
      if (this.rooms.length >= LIMITS.maxRooms) {
        this.current = null;
        this.skippingRoom = true;
        return;
      }
      this.skippingRoom = false;
      const content = body.trim();
      const parts = content.split("|").map((p) => p.trim());

      this.roomCount++;
      const rawId = parts[0] || `room-${this.roomCount}`;
      // Ids repetidos (la IA a veces repite): se desambiguan para que el grafo y los pedestales no choquen.
      const baseId = sanitizeSlug(rawId, `room-${this.roomCount}`);
      let roomId = baseId;
      for (let n = 2; this.rooms.some((r) => r.id === roomId); n++) roomId = `${baseId}-${n}`;
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

      if ((parts[7] || "").toLowerCase() === "diorama") this.dioramaRooms.push(roomId);

      const related = (parts[8] || "")
        .split(",")
        .map((r) => sanitizeSlug(r, ""))
        .filter((r) => r.length > 0 && r !== roomId);

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
        related,
      };
      this.rooms.push(this.current);
      return;
    }

    if (kind === "PIECE") {
      // Piezas de una sala omitida por el tope: se ignoran, no se cuelgan de otra sala.
      if (this.skippingRoom) return;
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

      if (this.current.pieces.length >= LIMITS.maxPiecesPerRoom) {
        // Enforce max pieces per room
        return;
      }

      this.pieceCountInRoom++;
      const content = body.trim();
      const parts = content.split("|").map((p) => p.trim());

      const concept = parts[0] || `Concepto ${this.pieceCountInRoom}`;
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

      const pieceId = `${this.current.id}-p${this.pieceCountInRoom}`;

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

      this.current.pieces.push(piece);
      this.lastPiece = piece;
    }
  }

  /**
   * Micro-DSL del diorama, bajo su sala:
   *   DIO: <arquetipo> | <hora> [| <terreno>]
   *   D_PROP: <zona> | <kind> | <pose> | <cantidad> | <pieza> | <rótulo> [| <color> [| <secundario> [| <patrón>]]]
   * Las coordenadas las pone el cliente. Una línea inválida se descarta sin afectar a la sala. Solo las
   * 2 primeras salas con directivas cuentan (igual que el tope de salas con "diorama").
   */
  private feedDirective(kind: "DIO" | "D_PROP", body: string): void {
    const room = this.current;
    if (!room || this.skippingRoom) return;
    const current = room.dioramaDirectives ?? { props: [] };
    // El cupo (2 salas) lo gastan solo las salas con props válidos: una DIO vacía o inválida no quita su turno a otra.
    if (current.props.length === 0 && this.rooms.filter((r) => r.dioramaDirectives?.props.length).length >= 2) return;
    const f = body.split("|").map((x) => x.trim());
    const value = (v: string | undefined) => (v && v !== "-" ? v.toLowerCase() : undefined);
    if (kind === "DIO") {
      // Un segundo DIO completa o corrige, pero un campo vacío ("-") no borra lo ya pedido.
      room.dioramaDirectives = DioramaDirectivesSchema.parse({
        ...current,
        archetype: value(f[0]) ?? current.archetype,
        time: value(f[1]) ?? current.time,
        terrain: value(f[2]) ?? current.terrain,
      });
      return;
    }
    if (current.props.length >= MAX_DIRECTIVE_PROPS) return;
    const piece = /^(?:[\w-]*p|pieza\s*)?(\d+)$/i.exec(f[4] ?? "");
    const count = Number(f[3]);
    const prop = DioramaDirectivePropSchema.safeParse({
      zone: value(f[0]),
      kind: value(f[1]),
      pose: value(f[2]),
      count: Number.isFinite(count) && f[3] !== "" ? count : 1,
      piece: piece ? Number(piece[1]) : undefined,
      label: f[5] ? f[5].slice(0, 40) : undefined,
      color: value(f[6]),
      secondary: value(f[7]),
      pattern: value(f[8]),
    });
    if (!prop.success) return;
    room.dioramaDirectives = DioramaDirectivesSchema.parse({ ...current, props: [...current.props, prop.data] });
  }

  /** Rellenos, grafo y validación final. */
  finish(): Museum {
    const rooms = this.rooms;
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
            text: "Bienvenido al museo de la memoria",
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
    this.options.onDioramaRooms?.(this.dioramaRooms.slice(0, 2));
    const graph = buildGraph(rooms, this.options.mode);

    const museumPayload = {
      title: this.options.title || this.docTitle || rooms[0].name || "Museo de la Memoria",
      theme: {
        palette: [rooms[0].palette?.primary || "#3b82f6", rooms[0].palette?.fogColor || "#0f172a"],
        ambience: rooms[0].theme || "cathedral",
      },
      rooms: rooms.map((r) => {
        const { requires: _, related: __, ...cleanRoom } = r;
        return cleanRoom;
      }),
      mode: this.options.mode ?? ("education" as const),
      graph,
    };

    return MuseumSchema.parse(museumPayload);
  }
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
  const acc = new DslAccumulator(options);
  for (const line of stripped.split(/\r?\n/)) acc.feedLine(line);
  return acc.finish();
}

/**
 * Lector incremental del mismo DSL: se le pasan los trozos de texto tal como llegan y devuelve cada sala
 * en cuanto queda completa (al empezar la línea `ROOM:` siguiente, o en `end()`). Los trozos pueden
 * cortar una línea por la mitad. Las líneas se interpretan igual que en `parseMus3oDSL` (mismo acumulador).
 *
 * `finish()` produce el museo final con el grafo de `buildGraph` según el modo: es igual al de `parseMus3oDSL`
 * para el mismo texto. Las salas emitidas antes de terminar aún no conocen las aristas definitivas.
 */
export class Mus3oDslStream {
  private readonly acc: DslAccumulator;
  private buffer = "";
  private readonly emitted = new Set<DslRoom>();

  /** Todas las salas ya emitidas, en orden. */
  readonly rooms: DslRoom[] = [];

  constructor(private readonly options: ParseDslOptions = {}) {
    this.acc = new DslAccumulator(options);
  }

  /** Título declarado con `TITLE:` hasta ahora. */
  get docTitle(): string | undefined {
    return this.acc.docTitle;
  }

  /** Ids de sala marcados como "diorama" hasta ahora (máx. 2, como en `onDioramaRooms`). */
  get dioramaRooms(): string[] {
    return this.acc.dioramaRooms.slice(0, 2);
  }

  /** Añade texto y devuelve las salas que este trozo terminó de completar. */
  push(chunk: string): DslRoom[] {
    this.buffer += chunk;
    const done: DslRoom[] = [];
    const lines = this.buffer.split(/\r?\n/);
    // La última porción no tiene salto de línea todavía: puede estar cortada.
    this.buffer = lines.pop() ?? "";
    for (const line of lines) this.feed(line, done);
    // Una línea `ROOM:` ya empezada cierra la sala anterior sin esperar a su salto de línea.
    if (classifyDslLine(this.buffer.trim()).kind === "ROOM") this.flushCurrent(done);
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

  /**
   * Aristas provisionales entre la sala emitida `roomId` y las anteriores, con la misma regla por modo que el grafo
   * final: el cliente ubica la sala junto a la que la enlaza sin esperar a `finish()`.
   */
  edgesOf(roomId: string): GraphEdge[] {
    if (this.rooms.length === 0) return [];
    return buildGraph(this.rooms, this.options.mode).edges.filter((e) => e.from === roomId || e.to === roomId);
  }

  /** Museo final (tras `end()`): mismo resultado que `parseMus3oDSL` sobre el texto completo. */
  finish(): Museum {
    return this.acc.finish();
  }

  private feed(line: string, done: DslRoom[]) {
    if (classifyDslLine(line.trim()).kind === "ROOM") this.flushCurrent(done);
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
