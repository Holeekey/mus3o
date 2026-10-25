import {
  DigestSourcesResponseSchema,
  LIMITS,
  MuseumSchema,
  MuseumStreamEventSchema,
  type InputImage,
  type Museum,
  type MuseumStreamEvent,
  type Source,
} from "@mus3o/shared";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Una línea corta se trata como tema; cualquier otra cosa, como apuntes. */
export const looksLikeTopic = (text: string) => !text.includes("\n") && text.trim().length <= 200;

async function postJson(url: string, body: unknown, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? `Error ${res.status}`, res.status);
  return data;
}

function toMuseum(data: unknown): Museum {
  // La respuesta se valida igual que cualquier entrada externa.
  const parsed = MuseumSchema.safeParse(data);
  if (!parsed.success) throw new ApiError("Aris devolvió un museo inválido", 502);
  return parsed.data;
}

export async function generateMuseum(text: string, signal?: AbortSignal): Promise<Museum> {
  const body = looksLikeTopic(text) ? { topic: text.trim() } : { notes: text.trim() };
  return toMuseum(await postJson("/api/generate-museum", body, signal));
}

/** Mensaje para el usuario según el estado HTTP de un fallo de la IA (el mismo con y sin streaming). */
export function describeAiError(status?: number): string {
  return status === 503
    ? "Aris no está disponible ahora. Puedes construir el museo sin Aris."
    : status === 429
      ? "Demasiadas solicitudes. Intenta en un minuto."
      : "Aris no pudo generar el museo. Intenta de nuevo o constrúyelo sin Aris.";
}

/** Parte un flujo de texto en líneas completas; lo que queda sin salto de línea espera al siguiente trozo. */
export function createLineSplitter() {
  let rest = "";
  return {
    push(chunk: string): string[] {
      rest += chunk;
      const lines = rest.split("\n");
      rest = lines.pop() ?? "";
      return lines.filter((l) => l.trim() !== "");
    },
    flush(): string[] {
      const last = rest.trim();
      rest = "";
      return last ? [last] : [];
    },
  };
}

function parseStreamLine(line: string): MuseumStreamEvent {
  let json: unknown;
  try {
    json = JSON.parse(line);
  } catch {
    throw new ApiError("Respuesta de Aris inválida", 502);
  }
  // Cada evento se valida igual que cualquier entrada externa.
  const parsed = MuseumStreamEventSchema.safeParse(json);
  if (!parsed.success) throw new ApiError("Aris devolvió un museo inválido", 502);
  return parsed.data;
}

/**
 * Genera el museo en streaming (`POST /api/generate-museum/stream`, NDJSON) y entrega cada evento según llega.
 * Falla antes del primer evento con `ApiError` (estado HTTP); si la conexión se corta sin `done` ni `error`
 * lanza `ApiError` 502. El evento `error` se entrega como evento y el flujo termina.
 */
async function* streamMuseum(body: unknown, signal?: AbortSignal): AsyncGenerator<MuseumStreamEvent> {
  const res = await fetch("/api/generate-museum/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError((data as { error?: string }).error ?? `Error ${res.status}`, res.status || 502);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const splitter = createLineSplitter();
  let ended = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      const lines = done ? splitter.flush() : splitter.push(decoder.decode(value, { stream: true }));
      for (const line of lines) {
        const event = parseStreamLine(line);
        yield event;
        if (event.type === "done" || event.type === "error") {
          ended = true;
          return;
        }
      }
      if (done) break;
    }
  } finally {
    // Si el consumidor deja de leer (o aborta), se cierra la conexión.
    void reader.cancel().catch(() => undefined);
  }
  if (!ended) throw new ApiError("Se cortó la conexión con Aris", 502);
}

/** Tema o apuntes en streaming: el mismo pedido que `generateMuseum`. */
export function generateMuseumStream(text: string, signal?: AbortSignal): AsyncGenerator<MuseumStreamEvent> {
  return streamMuseum(looksLikeTopic(text) ? { topic: text.trim() } : { notes: text.trim() }, signal);
}

/** Pedido por defecto cuando el usuario solo adjunta archivos. */
export const DEFAULT_FILES_PROMPT = "Crea el museo a partir de los archivos adjuntos.";
/** Un texto escrito más largo que esto ya no es un pedido sino apuntes: viaja como fuente. */
const MAX_PROMPT_CHARS = 2_000;
/** Máximo de fuentes que acepta la generación (`GenerateMuseumRequestSchema`). */
const MAX_GENERATION_SOURCES = 5;

/**
 * Prompt maestro híbrido: si el texto de los archivos ya entra en los límites de la generación,
 * se manda tal cual (0 tokens extra); si no, primero se resume con un modelo barato.
 */
export function needsDigest(prompt: string, sources: Source[]): boolean {
  const total = sources.reduce((sum, s) => sum + s.text.length, prompt.trim().length);
  return sources.length > MAX_GENERATION_SOURCES || total > LIMITS.maxNotesChars;
}

export type FilesStage = "digesting" | "generating";

type FilesInput = { prompt: string; sources: Source[]; images: InputImage[] };

/** Cuerpo del pedido del flujo completo; si los archivos no entran en los límites, antes se resumen. */
async function filesRequestBody(input: FilesInput, onStage?: (stage: FilesStage) => void, signal?: AbortSignal) {
  const typed = input.prompt.trim();
  const asNotes = typed.length > MAX_PROMPT_CHARS;
  const prompt = asNotes || !typed ? DEFAULT_FILES_PROMPT : typed;
  let sources: Source[] = asNotes ? [{ name: "Tus apuntes", kind: "md", text: typed }, ...input.sources] : input.sources;
  if (needsDigest(prompt, sources)) {
    onStage?.("digesting");
    const parsed = DigestSourcesResponseSchema.safeParse(await postJson("/api/digest-sources", { sources }, signal));
    if (!parsed.success) throw new ApiError("No se pudo resumir los archivos", 502);
    const files = sources.length === 1 ? "1 archivo" : `${sources.length} archivos`;
    sources = [{ name: `Temario base de ${files}`, kind: "md", text: parsed.data.digest }];
  }
  onStage?.("generating");
  return { mode: "exploration", prompt, sources, images: input.images };
}

export async function generateMuseumFromFiles(input: FilesInput, onStage?: (stage: FilesStage) => void, signal?: AbortSignal): Promise<Museum> {
  const body = await filesRequestBody(input, onStage, signal);
  return toMuseum(await postJson("/api/generate-museum", body, signal));
}

/** Lo mismo que `generateMuseumFromFiles`, pero en streaming (sala a sala). El resumen previo de archivos largos no se parte. */
export async function* generateMuseumFromFilesStream(
  input: FilesInput,
  onStage?: (stage: FilesStage) => void,
  signal?: AbortSignal,
): AsyncGenerator<MuseumStreamEvent> {
  yield* streamMuseum(await filesRequestBody(input, onStage, signal), signal);
}

const ARIS_HELP_MAX_PER_SESSION = 10
const ARIS_HELP_COOLDOWN_MS = 4_000
const arisHelpCache = new Map<string, string>()
let arisHelpCalls = 0
let arisHelpLast = 0
let arisHelpBusy = false

/** Solo para tests. */
export function resetArisHelpLimits() {
  arisHelpCache.clear()
  arisHelpCalls = 0
  arisHelpLast = 0
  arisHelpBusy = false
}

/**
 * Ayuda de Haiku para lo que las reglas de Aris no entienden. Devuelve null si no hay respuesta usable
 * o si se limita el esfuerzo: repetida (caché), una a la vez, con espera entre consultas y tope por sesión.
 */
export async function askArisHelp(
  query: string,
  context: { palaceTitle?: string; roomName?: string; topics: string[] },
  signal?: AbortSignal,
): Promise<string | null> {
  const key = `${context.roomName ?? ''}|${query.toLowerCase().replace(/\s+/g, ' ').trim()}`
  const cached = arisHelpCache.get(key)
  if (cached) return cached
  const now = Date.now()
  if (arisHelpBusy || arisHelpCalls >= ARIS_HELP_MAX_PER_SESSION || now - arisHelpLast < ARIS_HELP_COOLDOWN_MS) return null
  arisHelpBusy = true
  arisHelpCalls++
  arisHelpLast = now
  try {
    const data = (await postJson('/api/aris-help', { query: query.slice(0, 200), ...context }, signal)) as { answer?: unknown }
    const answer = typeof data.answer === 'string' && data.answer.trim() ? data.answer.trim().slice(0, 300) : null
    if (answer) arisHelpCache.set(key, answer)
    return answer
  } catch {
    return null
  } finally {
    arisHelpBusy = false
  }
}
