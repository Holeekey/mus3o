import Anthropic from "@anthropic-ai/sdk";
import { MuseumSchema, sampleMuseum, type Museum } from "@mus3o/shared";
import { SYSTEM_PROMPT, userPrompt } from "./prompts";

const MODEL = () => process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
let client: Anthropic | undefined;

function parseMuseum(raw: string): Museum {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  return MuseumSchema.parse(JSON.parse(cleaned));
}

export async function generateMuseum(topic: string): Promise<Museum> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("ANTHROPIC_API_KEY no definida: devolviendo mus3o mock");
    return { ...sampleMuseum, title: topic };
  }
  client ??= new Anthropic();

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userPrompt(topic) }];
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await client.messages.create({
      model: MODEL(),
      max_tokens: 8000,
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
