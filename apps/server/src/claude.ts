import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import {
  findImageAssignmentIssues,
  ImprovePromptResponseSchema,
  MuseumSchema,
  parseMus3oDSL,
  repairAndSanitizeMuseum,
  sampleMuseum,
  sanitizeRawSources,
  verifySources,
  type GenerateMuseumRequest,
  type ImprovePromptRequest,
  type ImprovePromptResponse,
  type Museum,
} from "@mus3o/shared";
import {
  cleanNotes,
  DSL_SYSTEM_PROMPT,
  dslNotesPrompt,
  dslUserPrompt,
  flowNotesText,
  flowPrompt,
  IMPROVE_SYSTEM_PROMPT,
  improvePrompt as improvePromptText,
  notesPrompt,
  SYSTEM_PROMPT,
  userPrompt,
} from "./prompts";

const MODEL = () => process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
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

export type GenerateInput = { topic: string } | { notes: string };

export class AiUnavailableError extends Error {}

function getClient(): Anthropic {
  client ??= new Anthropic({ timeout: 120_000, maxRetries: 1 });
  return client;
}

/** Pide JSON a Claude y, si no valida, le devuelve el error una vez para que lo corrija. */
async function askForJson<T>(
  options: { system: string; content: Anthropic.MessageParam["content"]; maxTokens: number },
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
    return { ...sampleMuseum, title: input.topic };
  }
  const isNotes = "notes" in input;
  const content = isNotes ? dslNotesPrompt(input.notes) : dslUserPrompt(input.topic);
  const topic = isNotes ? undefined : input.topic;

  // El formato DSL reduce la longitud requerida a <2000 tokens garantizando baja latencia
  const museum = await askForJson(
    { system: DSL_SYSTEM_PROMPT, content, maxTokens: isNotes ? 2500 : 1200 },
    (raw) => parseAdaptiveMuseum(raw, topic),
  );
  return isNotes ? attachSources(museum, cleanNotes(input.notes)) : museum;
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
  return [...images, { type: "text", text: flowPrompt(request) }];
}

export async function generateFlowMuseum(request: GenerateMuseumRequest): Promise<Museum> {
  if (!process.env.ANTHROPIC_API_KEY) throw new AiUnavailableError("IA no configurada");
  const imageIds = request.images.map((i) => i.id);
  const museum = await askForJson(
    { system: SYSTEM_PROMPT, content: buildFlowContent(request), maxTokens: 16000 },
    (raw) => parseFlowMuseum(raw, imageIds),
  );
  return attachSources(museum, flowNotesText(request));
}

export async function improvePrompt(request: ImprovePromptRequest): Promise<ImprovePromptResponse> {
  if (!process.env.ANTHROPIC_API_KEY) throw new AiUnavailableError("IA no configurada");
  return askForJson(
    { system: IMPROVE_SYSTEM_PROMPT, content: improvePromptText(request), maxTokens: 1500 },
    (raw) => ImprovePromptResponseSchema.parse(JSON.parse(stripFence(raw))),
  );
}
