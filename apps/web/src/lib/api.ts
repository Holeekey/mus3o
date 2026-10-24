import {
  DigestSourcesResponseSchema,
  LIMITS,
  MuseumSchema,
  type InputImage,
  type Museum,
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
  if (!parsed.success) throw new ApiError("La IA devolvió un palacio inválido", 502);
  return parsed.data;
}

export async function generateMuseum(text: string, signal?: AbortSignal): Promise<Museum> {
  const body = looksLikeTopic(text) ? { topic: text.trim() } : { notes: text.trim() };
  return toMuseum(await postJson("/api/generate-museum", body, signal));
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

export async function generateMuseumFromFiles(
  input: { prompt: string; sources: Source[]; images: InputImage[] },
  onStage?: (stage: FilesStage) => void,
  signal?: AbortSignal,
): Promise<Museum> {
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
  const body = { mode: "exploration", prompt, sources, images: input.images };
  return toMuseum(await postJson("/api/generate-museum", body, signal));
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
