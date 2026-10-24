import {
  assembleDslMuseum,
  LIMITS,
  Mus3oDslStream,
  repairAndSanitizeMuseum,
  sanitizeDisplayText,
  type DslRoom,
  type Museum,
  type MuseumStreamEvent,
  type Room,
} from "@mus3o/shared";
import {
  AiUnavailableError,
  dslMaxTokens,
  enrichMuseum,
  parseAdaptiveMuseum,
  type GenerateInput,
  type TextStreamer,
} from "./claude";
import { cleanNotes, DSL_SYSTEM_PROMPT, dslNotesPrompt, dslUserPrompt } from "./prompts";

const FALLBACK_TITLE = "Palacio de la Memoria";

/** Museo mínimo con las salas leídas hasta ahora: sirve para pasar por la misma desinfección que el museo completo. */
function prefixMuseum(title: string, rooms: DslRoom[]): Museum {
  const first = rooms[0];
  return {
    title,
    theme: { palette: [first.palette?.primary ?? "#3b82f6", first.palette?.fogColor ?? "#0f172a"], ambience: first.theme ?? "cathedral" },
    rooms: rooms.map(({ requires: _requires, ...room }) => room),
    mode: "education",
  } as Museum;
}

/** Los ids de sala deben ser únicos: una repetida recibe sufijo (y sus piezas, el mismo id nuevo). */
function uniqueRoomId(room: DslRoom, used: Set<string>) {
  if (used.has(room.id)) {
    const base = room.id;
    let n = 2;
    while (used.has(`${base}-${n}`)) n++;
    const id = `${base}-${n}`;
    room.pieces = room.pieces.map((p) => ({ ...p, id: p.id.startsWith(`${base}-`) ? id + p.id.slice(base.length) : p.id }));
    room.id = id;
  }
  used.add(room.id);
}

export type StreamDeps = { streamText: TextStreamer; signal: AbortSignal };

/**
 * Genera el museo en streaming. Cada vez que el modelo termina una sala, la desinfecta, la enriquece
 * (pistas de imágenes y fuentes de los apuntes) y la emite; al final emite el museo completo.
 * No lanza: un fallo del modelo se emite como evento `error` (las salas ya emitidas siguen siendo válidas).
 */
export async function* streamNewMuseum(input: GenerateInput, deps: StreamDeps): AsyncGenerator<MuseumStreamEvent> {
  const { signal } = deps;
  const isNotes = "notes" in input;
  const notes = isNotes ? cleanNotes(input.notes) : undefined;
  const topic = isNotes ? undefined : input.topic;
  const parser = new Mus3oDslStream();
  const rawRooms: DslRoom[] = [];
  const processed: Room[] = [];
  const usedIds = new Set<string>();
  let sourceTextHash: string | undefined;
  let rawTitle = "";
  let title = "";
  let full = "";

  async function* accept(room: DslRoom): AsyncGenerator<MuseumStreamEvent> {
    if (rawRooms.length >= LIMITS.maxRooms) return;
    uniqueRoomId(room, usedIds);
    rawRooms.push(room);
    if (processed.length === 0 && isNotes) rawTitle = room.name;
    const sanitized = repairAndSanitizeMuseum(prefixMuseum(rawTitle, rawRooms));
    title = sanitized.title;
    if (processed.length === 0 && isNotes) yield { type: "meta", title };
    const enriched = enrichMuseum({ ...sanitized, rooms: [sanitized.rooms[sanitized.rooms.length - 1]] }, notes);
    sourceTextHash = enriched.sourceTextHash ?? sourceTextHash;
    processed.push(enriched.rooms[0]);
    yield { type: "room", room: enriched.rooms[0] };
  }

  try {
    if (!isNotes) {
      rawTitle = topic ?? "";
      title = sanitizeDisplayText(rawTitle, 120) || FALLBACK_TITLE;
      yield { type: "meta", title };
    }
    const content = isNotes ? dslNotesPrompt(input.notes) : dslUserPrompt(input.topic);
    for await (const chunk of deps.streamText({ system: DSL_SYSTEM_PROMPT, content, maxTokens: dslMaxTokens(input), signal })) {
      if (signal.aborted) return;
      full += chunk;
      for (const room of parser.push(chunk)) yield* accept(room);
      // Con el tope de salas alcanzado no se gastan más tokens.
      if (rawRooms.length >= LIMITS.maxRooms) break;
    }
    if (signal.aborted) return;
    for (const room of parser.end()) yield* accept(room);

    if (processed.length === 0) {
      // Sin líneas ROOM: el modelo pudo contestar en JSON. Se interpreta igual que sin streaming.
      const museum = enrichMuseum(parseAdaptiveMuseum(full, topic), notes);
      if (isNotes) yield { type: "meta", title: museum.title };
      for (const room of museum.rooms) yield { type: "room", room };
      yield { type: "done", museum };
      return;
    }

    const sanitized = repairAndSanitizeMuseum(assembleDslMuseum(rawRooms, { title: rawTitle || undefined }));
    const museum: Museum = { ...sanitized, rooms: processed, ...(sourceTextHash ? { sourceTextHash } : {}) };
    yield { type: "done", museum };
  } catch (err) {
    if (signal.aborted) return;
    // Solo el tipo de error: nunca los apuntes ni la respuesta del modelo.
    console.error(`generate-museum/stream falló: ${(err as Error).name}`);
    if (err instanceof AiUnavailableError) yield { type: "error", message: "IA no configurada", status: 503 };
    else yield { type: "error", message: "No se pudo generar el mus3o", status: 502 };
  }
}

const abortableSleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (ms <= 0 || signal.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done, { once: true });
  });

/** Emite un museo ya generado (caché o mock) sala a sala, con una pausa corta para que se vea la construcción. */
export async function* replayMuseum(museum: Museum, options: { signal: AbortSignal; delayMs: number }): AsyncGenerator<MuseumStreamEvent> {
  yield { type: "meta", title: museum.title };
  for (const [i, room] of museum.rooms.entries()) {
    if (i > 0) await abortableSleep(options.delayMs, options.signal);
    if (options.signal.aborted) return;
    yield { type: "room", room };
  }
  yield { type: "done", museum };
}
