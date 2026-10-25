import {
  edgesAtArrival,
  LIMITS,
  Mus3oDslStream,
  repairAndSanitizeMuseum,
  sanitizeDisplayText,
  type DslRoom,
  type GenerateMuseumRequest,
  type Museum,
  type MuseumStreamEvent,
} from "@mus3o/shared";
import {
  AiUnavailableError,
  checkFlowImages,
  completeMuseum,
  dslMaxTokens,
  enrichMuseum,
  flowDslCall,
  parseAdaptiveMuseum,
  type GenerateInput,
  type TextStreamer,
} from "./claude";
import { cleanNotes, DSL_SYSTEM_PROMPT, dslNotesPrompt, dslUserPrompt, flowNotesText } from "./prompts";

const FALLBACK_TITLE = "Palacio de la Memoria";

/** Lo que acepta el streaming: lo mismo que la generación sin streaming (tema, apuntes o flujo completo). */
export type StreamInput = GenerateInput | GenerateMuseumRequest;
export const isFlowInput = (input: StreamInput): input is GenerateMuseumRequest => "prompt" in input;

/** Museo mínimo con las salas leídas hasta ahora: sirve para pasar por la misma desinfección que el museo completo. */
function prefixMuseum(title: string, rooms: DslRoom[], mode: Museum["mode"]): Museum {
  const first = rooms[0];
  return {
    title,
    theme: { palette: [first.palette?.primary ?? "#3b82f6", first.palette?.fogColor ?? "#0f172a"], ambience: first.theme ?? "cathedral" },
    rooms: rooms.map(({ requires: _requires, related: _related, ...room }) => room),
    mode: mode ?? "education",
  } as Museum;
}

export type StreamDeps = { streamText: TextStreamer; signal: AbortSignal };

/**
 * Genera el museo en streaming por el mismo camino que la generación sin streaming (mismos prompts, modo, ids de
 * imagen, enriquecimiento y cierre con modelos 3D y dioramas). Cada vez que el modelo termina una sala, la
 * desinfecta, la enriquece (pistas de imágenes y fuentes de los apuntes) y la emite con sus aristas provisionales;
 * al final emite el museo completo, igual al que devolvería la generación sin streaming.
 * No lanza: un fallo del modelo se emite como evento `error` (las salas ya emitidas siguen siendo válidas).
 */
export async function* streamNewMuseum(input: StreamInput, deps: StreamDeps): AsyncGenerator<MuseumStreamEvent> {
  const { signal } = deps;
  const flow = isFlowInput(input) ? input : undefined;
  const notesInput = !flow && "notes" in input ? input.notes : undefined;
  const topic = !flow && notesInput === undefined ? (input as { topic: string }).topic : undefined;
  const notes = flow ? flowNotesText(flow) : notesInput !== undefined ? cleanNotes(notesInput) : undefined;
  const mode = flow?.mode;
  const parser = new Mus3oDslStream({ title: topic, mode, imageIds: flow?.images.map((i) => i.id) });
  const rawRooms: DslRoom[] = [];
  let metaSent = false;
  let full = "";

  /** Título del palacio con lo que se sabe hasta ahora: el tema, el `TITLE:` del DSL o el nombre de la primera sala. */
  const rawTitle = () => topic ?? parser.docTitle ?? rawRooms[0]?.name ?? "";

  async function* accept(room: DslRoom): AsyncGenerator<MuseumStreamEvent> {
    if (rawRooms.length >= LIMITS.maxRooms) return;
    rawRooms.push(room);
    const sanitized = repairAndSanitizeMuseum(prefixMuseum(rawTitle(), rawRooms, mode));
    if (!metaSent) {
      metaSent = true;
      yield { type: "meta", title: sanitized.title };
    }
    const enriched = enrichMuseum({ ...sanitized, rooms: [sanitized.rooms[sanitized.rooms.length - 1]] }, notes);
    yield { type: "room", room: enriched.rooms[0], edges: parser.edgesOf(room.id) };
  }

  /** Emite las salas de un museo que no llegó por partes (respuesta en JSON, o DSL sin ninguna línea ROOM). */
  async function* announce(museum: Museum): AsyncGenerator<MuseumStreamEvent> {
    if (!metaSent) {
      metaSent = true;
      yield { type: "meta", title: museum.title };
    }
    for (const [i, room] of museum.rooms.entries()) yield { type: "room", room, edges: edgesAtArrival(museum, i) };
  }

  try {
    if (topic !== undefined) {
      metaSent = true;
      yield { type: "meta", title: sanitizeDisplayText(topic, 120) || FALLBACK_TITLE };
    }
    const call = flow
      ? flowDslCall(flow)
      : {
          system: DSL_SYSTEM_PROMPT,
          content: notesInput !== undefined ? dslNotesPrompt(notesInput) : dslUserPrompt(topic!),
          maxTokens: dslMaxTokens(input as GenerateInput),
        };
    for await (const chunk of deps.streamText({ ...call, signal })) {
      if (signal.aborted) return;
      full += chunk;
      for (const room of parser.push(chunk)) yield* accept(room);
      // Con el tope de salas alcanzado no se gastan más tokens.
      if (rawRooms.length >= LIMITS.maxRooms) break;
    }
    if (signal.aborted) return;
    for (const room of parser.end()) yield* accept(room);

    let museum: Museum;
    if (rawRooms.length === 0 && !flow) {
      // Sin líneas ROOM: el modelo pudo contestar en JSON. Se interpreta igual que sin streaming.
      museum = await completeMuseum(enrichMuseum(parseAdaptiveMuseum(full, topic), notes));
      yield* announce(museum);
    } else {
      // Mismo cierre que la generación sin streaming: desinfección, imágenes del request, enriquecimiento del
      // museo completo (grafo definitivo incluido), modelos 3D y dioramas.
      const parsed = repairAndSanitizeMuseum(parser.finish());
      if (flow) checkFlowImages(parsed, flow);
      museum = await completeMuseum(enrichMuseum(parsed, notes), flow ? parser.dioramaRooms : []);
      if (rawRooms.length === 0) yield* announce(museum);
    }
    if (signal.aborted) return;
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
    yield { type: "room", room, edges: edgesAtArrival(museum, i) };
  }
  yield { type: "done", museum };
}

/**
 * Para lo que no se puede leer por partes (flujo completo con FLOW_FORMAT=json): se genera entero como siempre y
 * se reproduce sala a sala. Un fallo se emite como evento `error`, igual que en `streamNewMuseum`.
 */
export async function* generateThenReplay(
  generate: () => Promise<Museum>,
  options: { signal: AbortSignal; delayMs: number },
): AsyncGenerator<MuseumStreamEvent> {
  let museum: Museum;
  try {
    museum = await generate();
  } catch (err) {
    if (options.signal.aborted) return;
    console.error(`generate-museum/stream falló: ${(err as Error).name}`);
    if (err instanceof AiUnavailableError) yield { type: "error", message: "IA no configurada", status: 503 };
    else yield { type: "error", message: "No se pudo generar el mus3o", status: 502 };
    return;
  }
  yield* replayMuseum(museum, options);
}

