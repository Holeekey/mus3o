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
  FLOW_STATIC_RULES,
  SYSTEM_PROMPT,
  SYSTEM_PROMPT_LIGHT,
  userPrompt,
} from "./prompts";
import { attachImageSearches, retrieveSources } from "./enrich";
import { hydrateMuseumAssets, polyEnabled } from "./polyPizza";

const MODEL = () => process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
/** Modelo barato para resumir fuentes largas en un temario base. */
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

export type GenerateInput = { topic: string } | { notes: string };

export class AiUnavailableError extends Error {}

function getClient(): Anthropic {
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
  options: { system: string | Anthropic.TextBlockParam[]; content: Anthropic.MessageParam["content"]; maxTokens: number; thinking?: boolean },
  parse: (raw: string) => T,
): Promise<T> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: options.content }];
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await getClient().messages.create({
      model: MODEL(),
      max_tokens: options.maxTokens,
      // Generar JSON no necesita razonamiento y ese razonamiento se cobra como salida.
      ...(options.thinking ? {} : { thinking: { type: "disabled" as const } }),
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
    { system: DSL_SYSTEM_PROMPT, content, maxTokens: isNotes ? 2500 : 1200 },
    (raw) => parseAdaptiveMuseum(raw, topic),
  );
  return hydrateMuseumAssets(enrichMuseum(museum, isNotes ? cleanNotes(input.notes) : undefined));
}

/** Cada imagen va precedida de su id para que la IA pueda referenciarla en `piece.image`. */
export function buildFlowContent(request: GenerateMuseumRequest): Anthropic.ContentBlockParam[] {
  const images = request.images.flatMap((image): Anthropic.ContentBlockParam[] => {
    const safeName = image.name.replace(/[<>\r\n]/g, "").slice(0, 80);
    return [
      { type: "text", text: `Imagen ${JSON.stringify(image.id)} (${safeName}):` },
      { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } },
    ];
  });
  return [...images, { type: "text", text: flowPrompt(request, { staticRules: false }) }];
}

export async function generateFlowMuseum(request: GenerateMuseumRequest): Promise<Museum> {
  if (!process.env.ANTHROPIC_API_KEY) throw new AiUnavailableError("IA no configurada");
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
  return hydrateMuseumAssets(enrichMuseum(museum, flowNotesText(request)));
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
