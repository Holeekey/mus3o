/**
 * Dibuja con un modelo fuerte (Sonnet) una lista de objetos para sembrar la biblioteca propia. Se paga una sola vez por
 * objeto: después se reutiliza gratis en todos los museos.
 *   npm run library:draw -w @mus3o/server -- --keywords "anvil,glove,key" --out /tmp/dibujos.json [--model claude-sonnet-5-5]
 *   npm run library:draw -w @mus3o/server -- --file palabras.txt --out /tmp/dibujos.json
 * Luego se revisa a ojo y se importa lo bueno con `library import /tmp/dibujos.json`.
 */
import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { getClient } from "../src/claude";
import { FALLBACK_MODEL_SYSTEM_PROMPT, fallbackModelPrompt } from "../src/prompts";
import { parseFallbackModels } from "../src/modelFallback";
import { normalizeKeyword } from "../src/library";

const args = process.argv.slice(2);
const flag = (n: string) => args[args.indexOf(`--${n}`) + 1];
const has = (n: string) => args.includes(`--${n}`);
const model = (has("model") && flag("model")) || "claude-sonnet-5-5";
const BATCH = 12;
// Tarifas de lista (USD por millón de tokens, entrada/salida) para el aviso de costo.
const PRICE: Record<string, [number, number]> = { "claude-sonnet-5-5": [2, 10], "claude-haiku-5-5": [0.1, 0.5] };

async function main() {
  const raw = has("file") ? (await readFile(flag("file"), "utf8")).split(/[\n,]/) : has("keywords") ? flag("keywords").split(",") : [];
  const keywords = [...new Set(raw.map(normalizeKeyword).filter(Boolean))];
  if (keywords.length === 0 || !has("out")) throw new Error('Uso: --keywords "a,b" | --file lista.txt  --out dibujos.json [--model id]');
  const out: Record<string, unknown> = {};
  let cost = 0;
  for (let i = 0; i < keywords.length; i += BATCH) {
    const batch = keywords.slice(i, i + BATCH);
    const pieces = batch.map((k, j) => ({ id: `k${j}`, title: k, object: k }));
    const res = await getClient().messages.create(
      {
        model,
        max_tokens: 8000,
        // Sonnet 5.5 no admite thinking "disabled": "between_tools" lo deja sin razonamiento previo.
        ...(/haiku/i.test(model) ? { thinking: { type: "disabled" } } : { thinking: { type: "between_tools" } }),
        system: FALLBACK_MODEL_SYSTEM_PROMPT,
        messages: [{ role: "user", content: fallbackModelPrompt(pieces) }],
      } as never,
      { timeout: 180_000, maxRetries: 1 },
    ) as { usage: { input_tokens: number; output_tokens: number }; content: { type: string; text?: string }[] };
    const [pi, po] = PRICE[model] ?? [2, 10];
    cost += (res.usage.input_tokens * pi + res.usage.output_tokens * po) / 1e6;
    try {
      const models = parseFallbackModels(res.content.map((b) => (b.type === "text" ? b.text : "")).join(""), pieces.map((p) => p.id));
      for (const [id, parts] of models) out[batch[Number(id.slice(1))]] = parts;
    } catch {
      console.error(`lote ${i / BATCH + 1}: JSON inválido, se omite`);
    }
    console.log(`lote ${i / BATCH + 1}/${Math.ceil(keywords.length / BATCH)}: ${Object.keys(out).length} dibujos, ~$${cost.toFixed(3)}`);
  }
  await writeFile(flag("out"), JSON.stringify(out, null, 1));
  console.log(`\n${Object.keys(out).length}/${keywords.length} dibujados con ${model}, costo estimado $${cost.toFixed(3)} → ${flag("out")}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
