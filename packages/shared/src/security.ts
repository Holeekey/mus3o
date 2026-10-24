import { LIMITS, type Museum, type Piece, type Room, type Part } from "./schema";

/** Caracteres de control ASCII no imprimibles (excepto \t y \n). */
const CONTROL_CHARS_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/** Caracteres invisibles, zero-width y de dirección bidireccional usados para evadir filtros. */
const INVISIBLE_CHARS_REGEX = /[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u2060-\u206F]/g;

/** Delimitadores XML reservados que nunca deben existir dentro de datos no confiables. */
const RESERVED_DELIMITERS_REGEX = /<\/?(user_notes|notes|source|untrusted_study_data)\b[^>]*>/gi;

/** Patrones de tokens de control de modelos y wrappers (Llama, Anthropic, ChatGPT). */
const CONTROL_TOKENS_REGEX = /<\|[^|<>\n]{1,40}\|>|\[\/?INST\]|<<\/?SYS>>|<\/?s>/gi;

/**
 * Sanitiza texto no confiable provisto por el usuario:
 * 1. Normaliza unicode a NFKC para disolver caracteres homóglifos o variantes compuestas.
 * 2. Elimina caracteres de control y secuencias invisibles/zero-width.
 * 3. Elimina de manera recursiva cualquier intento de delimitador XML reservado o token de control.
 * 4. Acota la longitud máxima.
 */
export function sanitizeUntrustedText(raw: string, maxLen: number = LIMITS.maxNotesChars): string {
  if (typeof raw !== "string") return "";

  // 1. NFKC normalization
  let cleaned = raw.normalize("NFKC");

  // 2. Control & invisible characters
  cleaned = cleaned.replace(CONTROL_CHARS_REGEX, "").replace(INVISIBLE_CHARS_REGEX, "");

  // 3. Remove model control tokens
  cleaned = cleaned.replace(CONTROL_TOKENS_REGEX, "");

  // 4. Recursive delimiter stripping to avoid nested tag breakouts like <no<notes>tes>
  let prev: string;
  do {
    prev = cleaned;
    cleaned = cleaned.replace(RESERVED_DELIMITERS_REGEX, "");
  } while (cleaned !== prev);

  // 5. Truncate to max length and trim
  return cleaned.slice(0, maxLen).trim();
}

/** Limpia texto para visualización segura en UI/3D: remueve HTML residual y recorta longitud. */
export function sanitizeDisplayText(raw: string, maxLen: number): string {
  if (typeof raw !== "string") return "";
  const plain = raw
    .replace(/<[^>]*>/g, "")
    .replace(/[<>]/g, "") // etiquetas sin cerrar ("<script src=x") no deben sobrevivir
    .replace(CONTROL_CHARS_REGEX, "")
    .replace(INVISIBLE_CHARS_REGEX, "")
    .replace(/[\r\n\t]+/g, " ")
    .trim();
  return plain.slice(0, maxLen);
}

/** La búsqueda de imagen sale hacia servicios externos: solo texto plano y corto. */
function sanitizeImageSearch(search: NonNullable<Piece["imageSearch"]>): NonNullable<Piece["imageSearch"]> {
  return {
    ...search,
    wikiTitle: search.wikiTitle ? sanitizeDisplayText(search.wikiTitle, 120) : undefined,
    commonsQuery: search.commonsQuery ? sanitizeDisplayText(search.commonsQuery, 120) : undefined,
  };
}

/** Limpia los textos de un diorama generado por el modelo (título y rótulos de props). */
function sanitizeDiorama(diorama: NonNullable<Room["diorama"]>): NonNullable<Room["diorama"]> {
  return {
    ...diorama,
    title: sanitizeDisplayText(diorama.title, 80) || "Diorama",
    props: diorama.props.map((p) => ({
      ...p,
      label: p.label ? sanitizeDisplayText(p.label, 40) || undefined : undefined,
    })),
  };
}

/** Clampea un número a un rango [min, max], o devuelve default si no es finito. */
function clamp(val: unknown, min: number, max: number, fallback: number): number {
  const num = typeof val === "number" ? val : Number(val);
  if (!Number.isFinite(num) || Number.isNaN(num)) return fallback;
  return Math.min(Math.max(num, min), max);
}

const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;
function sanitizeHexColor(hex: unknown, fallback: string = "#888888"): string {
  if (typeof hex === "string" && HEX_REGEX.test(hex.trim())) {
    return hex.trim();
  }
  return fallback;
}

/** Parte procedural por defecto cuando un modelo viene vacío o corrupto. */
export const DEFAULT_SAFE_PART: Part = {
  shape: "box",
  args: [0.8, 0.8, 0.8],
  pos: [0, 0.4, 0],
  rot: [0, 0, 0],
  color: "#d9c39a",
};

/**
 * Valida y repara deterministamente una pieza:
 * - Asegura que textos no contengan scripts/HTML.
 * - Clampea coordenadas físicas 3D a los límites reales de la sala 16x16m ([-6, 6]).
 * - Valida y repara partes procedurales previniendo dimensiones infinitas o NaN.
 */
export function repairAndSanitizePiece(piece: Piece): Piece {
  const cleanTitle = sanitizeDisplayText(piece.title, LIMITS.maxTitle) || "Pieza";
  const cleanText = sanitizeDisplayText(piece.text, LIMITS.maxText) || "Sin descripción disponible.";
  const cleanFact = piece.fact ? sanitizeDisplayText(piece.fact, LIMITS.maxText) : "";
  const cleanCue = piece.mnemonicCue ? sanitizeDisplayText(piece.mnemonicCue, LIMITS.maxText) : undefined;

  let pos: [number, number, number] | undefined = undefined;
  if (piece.position) {
    pos = [
      clamp(piece.position[0], -6, 6, 0),
      clamp(piece.position[1], 0.5, 2.5, 1.0),
      clamp(piece.position[2], -6, 6, 0),
    ];
  }

  let model = piece.model;
  if (model && model.type === "procedural") {
    const rawParts = Array.isArray(model.parts) ? model.parts : [];
    const validShapes = new Set(["box", "cylinder", "sphere", "cone"]);

    const cleanParts = rawParts.slice(0, 8).map((p): Part => {
      const shape = validShapes.has(p.shape) ? p.shape : "box";
      const args = Array.isArray(p.args)
        ? p.args.slice(0, 8).map((a) => clamp(a, 0.05, 32, 1))
        : [1, 1, 1];
      const partPos: [number, number, number] = Array.isArray(p.pos)
        ? [clamp(p.pos[0], -4, 4, 0), clamp(p.pos[1], -4, 4, 0), clamp(p.pos[2], -4, 4, 0)]
        : [0, 0, 0];
      const partRot: [number, number, number] = Array.isArray(p.rot)
        ? [clamp(p.rot[0], -6.28, 6.28, 0), clamp(p.rot[1], -6.28, 6.28, 0), clamp(p.rot[2], -6.28, 6.28, 0)]
        : [0, 0, 0];
      const color = sanitizeHexColor(p.color);
      return { shape, args, pos: partPos, rot: partRot, color };
    });

    model = {
      type: "procedural",
      parts: cleanParts.length > 0 ? cleanParts : [DEFAULT_SAFE_PART],
    };
  }

  // Campos secundarios que también llegan del modelo.
  const quiz = piece.quiz
    ? {
        ...piece.quiz,
        question: sanitizeDisplayText(piece.quiz.question, 200) || "?",
        options: piece.quiz.options.map((o) => sanitizeDisplayText(o, 100) || "-"),
      }
    : undefined;
  const source = piece.source
    ? { ...piece.source, quote: sanitizeDisplayText(piece.source.quote, LIMITS.maxQuote) || "-" }
    : undefined;
  const imageSearch = piece.imageSearch ? sanitizeImageSearch(piece.imageSearch) : undefined;

  return {
    ...piece,
    quiz,
    source,
    imageSearch,
    title: cleanTitle,
    text: cleanText,
    fact: cleanFact,
    mnemonicCue: cleanCue,
    position: pos,
    model,
  };
}

/**
 * Valida y repara deterministamente la estructura completa de un Museum:
 * - Desinfecta títulos y descripciones de salas y piezas.
 * - Asegura slugs y IDs únicos no vacíos.
 * - Garantiza que el número de salas y piezas respete los límites de render.
 */
export function repairAndSanitizeMuseum(museum: Museum): Museum {
  const cleanTitle = sanitizeDisplayText(museum.title, 120) || "Palacio de la Memoria";
  const usedPieceIds = new Set<string>();

  const rooms: Room[] = (museum.rooms || []).slice(0, LIMITS.maxRooms).map((room, rIdx) => {
    const roomId = (room.id || `sala-${rIdx + 1}`).toLowerCase().replace(/[^a-z0-9-_]/g, "") || `sala-${rIdx + 1}`;
    const cleanRoomName = sanitizeDisplayText(room.name, 80) || `Sala ${rIdx + 1}`;
    const cleanRoomDesc = sanitizeDisplayText(room.description, 300) || "";

    const pieces: Piece[] = (room.pieces || []).slice(0, LIMITS.maxPiecesPerRoom).map((piece, pIdx) => {
      let pieceId = (piece.id || `p-${rIdx + 1}-${pIdx + 1}`).toLowerCase().replace(/[^a-z0-9-_]/g, "");
      if (!pieceId || usedPieceIds.has(pieceId)) {
        pieceId = `p-${rIdx + 1}-${pIdx + 1}-${usedPieceIds.size}`;
      }
      usedPieceIds.add(pieceId);

      return repairAndSanitizePiece({ ...piece, id: pieceId });
    });

    return {
      ...room,
      id: roomId,
      name: cleanRoomName,
      description: cleanRoomDesc,
      period: room.period ? sanitizeDisplayText(room.period, 40) || undefined : undefined,
      imageSearch: room.imageSearch ? sanitizeImageSearch(room.imageSearch) : undefined,
      diorama: room.diorama ? sanitizeDiorama(room.diorama) : undefined,
      pieces,
    };
  });

  return {
    ...museum,
    title: cleanTitle,
    rooms,
  };
}
