import Anthropic from "@anthropic-ai/sdk";
import { MuseumSchema, sampleMuseum, type Museum } from "@mus3o/shared";
import { notesPrompt, SYSTEM_PROMPT, userPrompt } from "./prompts";

const MODEL = () => process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
let client: Anthropic | undefined;

function parseMuseum(raw: string): Museum {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  return MuseumSchema.parse(JSON.parse(cleaned));
}

export type GenerateInput = { topic: string } | { notes: string };

export class AiUnavailableError extends Error {}

export async function generateMuseum(input: GenerateInput): Promise<Museum> {
  if (!process.env.ANTHROPIC_API_KEY) {
    // Con apuntes un mock no sirve: el cliente cae a su parser local.
    if ("notes" in input) throw new AiUnavailableError("IA no configurada");
    console.warn("ANTHROPIC_API_KEY no definida: devolviendo mus3o mock");
    return { ...sampleMuseum, title: input.topic };
  }
  client ??= new Anthropic({ timeout: 120_000, maxRetries: 1 });

  const content = "notes" in input ? notesPrompt(input.notes) : userPrompt(input.topic);
  const messages: Anthropic.MessageParam[] = [{ role: "user", content }];
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await client.messages.create({
      model: MODEL(),
      // Los apuntes pueden traer hasta 8 salas × 12 piezas con modelos: necesita más salida.
      max_tokens: "notes" in input ? 16000 : 8000,
      system: SYSTEM_PROMPT,
      messages,
    });
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    try {
      return parseMuseum(text);
    } catch (err) {
      lastError = err;
      messages.push(
        { role: "assistant", content: text },
        { role: "user", content: `El JSON no es válido (${String(err).slice(0, 500)}). Responde de nuevo solo con el JSON corregido.` },
      );
    }
  }
  throw new Error(`Claude devolvió un mus3o inválido: ${String(lastError).slice(0, 200)}`);
}
