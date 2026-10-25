import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import {
  DigestSourcesResponseSchema,
  findImageAssignmentIssues,
  LIMITS,
  ImprovePromptResponseSchema,
  MuseumSchema,
  parseMus3oDSL,
  repairAndSanitizeMuseum,
  sampleMuseum,
  sanitizeRawSources,
  verifySources,
  type DigestSourcesRequest,
  type DigestSourcesResponse,
  type GenerateMuseumRequest,
  type ImprovePromptRequest,
  type ImprovePromptResponse,
  type Museum,
} from "@mus3o/shared";
import {
  cleanNotes,
  DIGEST_SYSTEM_PROMPT,
  digestPrompt,
  DSL_SYSTEM_PROMPT,
  dslNotesPrompt,
  dslUserPrompt,
  flowNotesText,
  flowPrompt,
  IMPROVE_SYSTEM_PROMPT,
  improvePrompt as improvePromptText,
  notesPrompt,
  FALLBACK_MODEL_SYSTEM_PROMPT,
  FLOW_DSL_SYSTEM_PROMPT,
  flowMaxTokens,
  roomPlan,
  flowDslPrompt,
  FLOW_STATIC_RULES,
  SYSTEM_PROMPT,
  SYSTEM_PROMPT_LIGHT,
  userPrompt,
} from "./prompts";
import { attachImageSearches, retrieveSources } from "./enrich";
import { hydrateMuseumAssets, polyEnabled } from "./polyPizza";
import { fillMissingModels } from "./modelFallback";

const MODEL = () => process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
/** Modelo barato para resumir fuentes largas en un temario base. */
/** Modelo barato para dibujar el respaldo de las piezas sin asset. */
const FALLBACK_MODEL = () => process.env.ANTHROPIC_FALLBACK_MODEL || "claude-haiku-5-5";
/** "dsl" (por defecto) o "json" (formato anterior, más caro). */
const flowFormat = () => (process.env.FLOW_FORMAT === "json" ? "json" : "dsl");
/** Haiku razona por defecto (y se cobra como salida); Sonnet 5.5 no lo admite como "disabled". */
const noThinking = (model: string) => (/haiku/i.test(model) ? { thinking: { type: "disabled" as const } } : {});
const DIGEST_MODEL = () => process.env.ANTHROPIC_DIGEST_MODEL || "claude-haiku-5-5";
let client: Anthropic | undefined;

const stripFence = (raw: string) => raw.replace(/^```(?:json|dsl)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

function parseMuseum(raw: string): Museum {
  // Las citas largas se recortan antes de validar y la salida se desinfecta deterministamente.
  const parsed = MuseumSchema.parse(sanitizeRawSources(JSON.parse(stripFence(raw))));
  return repairAndSanitizeMuseum(parsed);
}

export function parseAdaptiveMuseum(raw: string, topic?: string): Museum {
  const stripped = stripFence(raw);
  if (stripped.includes("ROOM:") || stripped.startsWith("ROOM:")) {
    return repairAndSanitizeMuseum(parseMus3oDSL(stripped, { title: topic }));
  }
  return parseMuseum(raw);
}

/**
 * Verifica las citas de cada pieza contra los apuntes: la cita que no está se descarta y la pieza
 * queda `unverified`. Registra solo conteos, nunca contenido.
 */
export function attachSources(museum: Museum, notes: string): Museum {
  const { museum: verified, stats } = verifySources(museum, notes);
  console.log(`fuentes: ${stats.verified}/${stats.total} piezas verificadas, ${stats.unverified} sin fuente`);
  return { ...verified, sourceTextHash: createHash("sha256").update(notes).digest("hex") };
}

/** Además del schema, comprueba que la IA solo use imágenes que llegaron en el request. */
export function parseFlowMuseum(raw: string, imageIds: string[]): Museum {
  const museum = parseMuseum(raw);
  const issues = findImageAssignmentIssues(museum, imageIds);
  if (issues.length > 0) throw new Error(issues.join("; "));
  return museum;
}

/**
 * Capa de recuperación sobre la salida del modelo: pistas de búsqueda de imágenes y, con apuntes,
 * fuentes recuperadas de ellos. El modelo no genera nada de esto.
 */
export function enrichMuseum(museum: Museum, notes?: string): Museum {
  const images = attachImageSearches(museum, notes ?? museum.title);
  return notes === undefined ? images : retrieveSources(attachSources(images, notes), notes);
}

/** Buscar primero: trae assets y, solo para las piezas que quedaron sin modelo, la IA dibuja un respaldo. */
async function resolveModels(museum: Museum): Promise<Museum> {
  const hydrated = await hydrateMuseumAssets(museum);
  // Sin búsqueda activa no hay "faltantes" que rellenar (todas las piezas conservan su glifo).
  if (!polyEnabled() || !process.env.ANTHROPIC_API_KEY) return hydrated;
  return fillMissingModels(hydrated, async (prompt, maxTokens) => {
    const res = await getClient().messages.create({
      model: FALLBACK_MODEL(),
      thinking: { type: "disabled" },
      max_tokens: maxTokens,
      system: FALLBACK_MODEL_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    }, { timeout: 20_000, maxRetries: 0 });
    const u = res.usage;
    console.log(`tokens (respaldo): entrada ${u.input_tokens}, salida ${u.output_tokens}`);
    return res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  });
}

export type GenerateInput = { topic: string } | { notes: string };

export class AiUnavailableError extends Error {}

export function getClient(): Anthropic {
  // Las keys de organización sin workspace exigen el header anthropic-workspace-id.
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID;
  client ??= new Anthropic({
    timeout: 120_000,
    maxRetries: 1,
    ...(workspace ? { defaultHeaders: { "anthropic-workspace-id": workspace } } : {}),
  });
  return client;
}

/** Pide JSON a Claude y, si no valida, le devuelve el error una vez para que lo corrija. */
async function askForJson<T>(
  options: { system: string | Anthropic.TextBlockParam[]; content: Anthropic.MessageParam["content"]; maxTokens: number},
  parse: (raw: string) => T,
): Promise<T> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: options.content }];
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await getClient().messages.create({
      model: MODEL(),
      max_tokens: options.maxTokens,
      system: options.system,
      messages,
    });
    // Solo conteos de tokens (nunca contenido): sirve para vigilar el costo real por generación.
    const u = res.usage;
    console.log(`tokens: entrada ${u.input_tokens}, salida ${u.output_tokens}, caché leída ${u.cache_read_input_tokens ?? 0}, caché escrita ${u.cache_creation_input_tokens ?? 0}`);
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    try {
      return parse(text);
    } catch (err) {
      lastError = err;
      messages.push(
        { role: "assistant", content: text },
        { role: "user", content: `La respuesta no es válida (${String(err).slice(0, 500)}). Corrige el formato y responde de nuevo siguiendo las reglas estrictas.` },
      );
    }
  }
  throw new Error(`Claude devolvió un mus3o inválido: ${String(lastError).slice(0, 200)}`);
}

export async function generateMuseum(input: GenerateInput): Promise<Museum> {
  if (!process.env.ANTHROPIC_API_KEY) {
    // Con apuntes un mock no sirve: el cliente cae a su parser local.
    if ("notes" in input) throw new AiUnavailableError("IA no configurada");
    console.warn("ANTHROPIC_API_KEY no definida: devolviendo mus3o mock");
    return enrichMuseum({ ...sampleMuseum, title: input.topic });
  }
  const isNotes = "notes" in input;
  const content = isNotes ? dslNotesPrompt(input.notes) : dslUserPrompt(input.topic);
  const topic = isNotes ? undefined : input.topic;

  // El formato DSL reduce la longitud requerida a <2000 tokens garantizando baja latencia
  const museum = await askForJson(
    { system: DSL_SYSTEM_PROMPT, content, maxTokens: isNotes ? 3500 : 2000 },
    (raw) => parseAdaptiveMuseum(raw, topic),
  );
  return resolveModels(enrichMuseum(museum, isNotes ? cleanNotes(input.notes) : undefined));
}

/** Fuente de texto en streaming: trozos de la respuesta del modelo según llegan. */
export type TextStreamer = (params: {
  system: string | Anthropic.TextBlockParam[];
  content: Anthropic.MessageParam["content"];
  maxTokens: number;
  signal: AbortSignal;
}) => AsyncIterable<string>;

/** Streaming real contra la API de Anthropic. Si el consumidor deja de leer o se aborta, se corta la conexión. */
export const anthropicTextStreamer: TextStreamer = async function* ({ system, content, maxTokens, signal }) {
  const stream = getClient().messages.stream(
    { model: MODEL(), max_tokens: maxTokens, system, messages: [{ role: "user", content }] },
    { signal },
  );
  try {
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
    }
  } finally {
    stream.abort();
  }
};

let streamerOverride: TextStreamer | null = null;
/** Solo pruebas: sustituye al cliente de Anthropic por uno falso. */
export function setTextStreamerForTests(streamer: TextStreamer | null) {
  streamerOverride = streamer;
}
export const currentTextStreamer = (): TextStreamer => streamerOverride ?? anthropicTextStreamer;

/** Tokens máximos de la respuesta DSL de tema/apuntes (los mismos que la generación sin streaming). */
export const dslMaxTokens = (input: GenerateInput) => ("notes" in input ? 3500 : 2000);

/** Cada imagen va precedida de su id para que la IA pueda referenciarla en `piece.image`. */
export function buildFlowContent(request: GenerateMuseumRequest, format: "json" | "dsl" = "json"): Anthropic.ContentBlockParam[] {
  const images = request.images.flatMap((image): Anthropic.ContentBlockParam[] => {
    const safeName = image.name.replace(/[<>\r\n]/g, "").slice(0, 80);
    return [
      { type: "text", text: `Imagen ${JSON.stringify(image.id)} (${safeName}):` },
      { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } },
    ];
  });
  const text = format === "dsl" ? flowDslPrompt(request) : flowPrompt(request, { staticRules: false });
  return [...images, { type: "text", text }];
}

/** Salida DSL del flujo completo: valida el formato y las imágenes asignadas contra el request. */
export function parseFlowDsl(raw: string, request: GenerateMuseumRequest): Museum {
  const imageIds = request.images.map((i) => i.id);
  const museum = repairAndSanitizeMuseum(parseMus3oDSL(stripFence(raw), { mode: request.mode, imageIds }));
  const issues = findImageAssignmentIssues(museum, imageIds);
  if (issues.length > 0) throw new Error(issues.join("; "));
  return museum;
}

export async function generateFlowMuseum(request: GenerateMuseumRequest): Promise<Museum> {
  if (!process.env.ANTHROPIC_API_KEY) throw new AiUnavailableError("IA no configurada");
  if (flowFormat() === "dsl") return generateFlowMuseumDsl(request);
  const imageIds = request.images.map((i) => i.id);
  // Con Poly Pizza activo el modelo 3D lo trae el servidor: la IA solo elige un glifo de respaldo y emite
  // bastante menos salida. Las reglas fijas van en el system prompt con caché (se leen a ~10 % del precio).
  const light = polyEnabled();
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: light ? SYSTEM_PROMPT_LIGHT : SYSTEM_PROMPT },
    { type: "text", text: FLOW_STATIC_RULES, cache_control: { type: "ephemeral" } },
  ];
  const museum = await askForJson(
    { system, content: buildFlowContent(request), maxTokens: light ? 9000 : 16000 },
    (raw) => parseFlowMuseum(raw, imageIds),
  );
  return resolveModels(enrichMuseum(museum, flowNotesText(request)));
}

/**
 * Flujo completo por DSL: una salida de ~2-4 mil tokens en lugar de un JSON de hasta 16 mil. El servidor deriva
 * el grafo según el modo, las imágenes de cada cuadro, las citas y los modelos 3D; los dioramas ya no los genera la IA (biblioteca a mano o foto real, ver photoDiorama.ts).
 */
async function generateFlowMuseumDsl(request: GenerateMuseumRequest): Promise<Museum> {
  const { system, content, maxTokens } = flowDslCall(request);
  const museum = await askForJson({ system, content, maxTokens }, (raw) => parseFlowDsl(raw, request));
  return completeMuseum(enrichMuseum(museum, flowNotesText(request)));
}

/** Lo que se le pide al modelo en el flujo completo por DSL (compartido por la generación con y sin streaming). */
export function flowDslCall(request: GenerateMuseumRequest) {
  const system: Anthropic.TextBlockParam[] = [{ type: "text", text: FLOW_DSL_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }];
  return { system, content: buildFlowContent(request, "dsl"), maxTokens: flowMaxTokens(roomPlan(request), request.mode) };
}

/** El flujo completo usa DSL salvo que FLOW_FORMAT=json (formato anterior, que no se puede leer por partes). */
export const flowStreamable = () => flowFormat() === "dsl";

/**
 * Cierre de la generación DSL ya enriquecida: modelos 3D (búsqueda + respaldo). Lo usan tanto la generación completa
 * como el final del streaming. El museo no lleva dioramas: los cuadros usan la biblioteca hecha a mano o recrean su foto.
 */
export async function completeMuseum(enriched: Museum): Promise<Museum> {
  return resolveModels(enriched);
}

/** Comprueba que la IA solo use imágenes del request (la misma regla que `parseFlowDsl`, sobre un museo ya armado). */
export function checkFlowImages(museum: Museum, request: GenerateMuseumRequest): void {
  const issues = findImageAssignmentIssues(museum, request.images.map((i) => i.id));
  if (issues.length > 0) throw new Error(issues.join("; "));
}

export async function improvePrompt(request: ImprovePromptRequest): Promise<ImprovePromptResponse> {
  if (!process.env.ANTHROPIC_API_KEY) throw new AiUnavailableError("IA no configurada");
  return askForJson(
    { system: IMPROVE_SYSTEM_PROMPT, content: improvePromptText(request), maxTokens: 1500 },
    (raw) => ImprovePromptResponseSchema.parse(JSON.parse(stripFence(raw))),
  );
}

/** Recorta el temario a LIMITS.maxDigestChars cortando en el último salto de línea anterior al límite. */
export function clampDigest(raw: string): string {
  const text = raw.trim();
  if (text.length <= LIMITS.maxDigestChars) return text;
  const head = text.slice(0, LIMITS.maxDigestChars);
  const cut = head.lastIndexOf("\n");
  return (cut > 0 ? head.slice(0, cut) : head).trim();
}

export async function digestSources(sources: DigestSourcesRequest["sources"]): Promise<DigestSourcesResponse> {
  if (!process.env.ANTHROPIC_API_KEY) throw new AiUnavailableError("IA no configurada");
  const res = await getClient().messages.create({
    model: DIGEST_MODEL(),
    // Haiku 5.5 razona por defecto y ese razonamiento se cobra: para resumir no hace falta.
    thinking: { type: "disabled" },
    max_tokens: 6000,
    system: DIGEST_SYSTEM_PROMPT,
    messages: [{ role: "user", content: digestPrompt(sources) }],
  });
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  // Salida vacía o inválida: lanza y el route responde 502.
  return DigestSourcesResponseSchema.parse({ digest: clampDigest(stripFence(text)) });
}
