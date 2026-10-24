import { z } from "zod";
import { PartSchema, type Museum, type Piece } from "@mus3o/shared";
import { fallbackModelPrompt } from "./prompts";

/**
 * Respaldo creado: primero se busca el asset (Poly Pizza); solo las piezas que quedaron sin modelo
 * (sin coincidencia, error o timeout) se le piden a la IA, en UNA llamada barata y por lotes.
 */
const MAX_PIECES = 12;
const PartsSchema = z.array(PartSchema).min(1).max(8);

export type Complete = (prompt: string, maxTokens: number) => Promise<string>;

const needsModel = (p: Piece) => !p.dynamicAsset && (!p.model || p.model.type === "glyph");

export function parseFallbackModels(raw: string, ids: string[]): Map<string, z.infer<typeof PartsSchema>> {
  const out = new Map<string, z.infer<typeof PartsSchema>>();
  const json = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim()) as Record<string, unknown>;
  for (const id of ids) {
    const parts = PartsSchema.safeParse(json[id]);
    if (parts.success) out.set(id, parts.data);
  }
  return out;
}

export async function fillMissingModels(museum: Museum, complete: Complete): Promise<Museum> {
  const targets = museum.rooms.flatMap((r) => r.pieces).filter(needsModel).slice(0, MAX_PIECES);
  if (targets.length === 0) return museum;
  try {
    const raw = await complete(
      fallbackModelPrompt(targets.map((p) => ({ id: p.id, title: p.title, object: p.searchKeyword ?? p.title }))),
      200 * targets.length + 200,
    );
    const models = parseFallbackModels(raw, targets.map((p) => p.id));
    if (models.size === 0) return museum;
    return {
      ...museum,
      rooms: museum.rooms.map((room) => ({
        ...room,
        pieces: room.pieces.map((p) => (models.has(p.id) ? { ...p, model: { type: "procedural" as const, parts: models.get(p.id)! } } : p)),
      })),
    };
  } catch (err) {
    // El respaldo es opcional: ante cualquier fallo la pieza conserva su glifo.
    console.error(`respaldo de modelos falló: ${(err as Error).name}`);
    return museum;
  }
}
