import { z } from "zod";
import { PartSchema, type Museum, type Piece } from "@mus3o/shared";
import { fallbackModelPrompt } from "./prompts";

/**
 * Respaldo creado: primero se busca el asset (Poly Pizza); solo las piezas que quedaron sin modelo
 * (sin coincidencia, error o timeout) se le piden a la IA, por lotes pequeños y en paralelo: así una salida
 * cortada o un fallo solo cuesta el lote afectado y no deja todas las piezas con su glifo plano.
 */
const MAX_PIECES = 24;
const BATCH_SIZE = 6;
/** Una pieza con 2 a 5 partes ronda los 210 tokens de salida: holgura para que el JSON no se corte. */
const TOKENS_PER_PIECE = 350;
const PartsSchema = z.array(PartSchema).min(1).max(8);

export type Complete = (prompt: string, maxTokens: number) => Promise<string>;

/**
 * Una pieza sin modelo creado necesita respaldo aunque tenga un asset de Poly Pizza asignado: el .glb se descarga después,
 * bajo demanda, y si falla (bloqueo, red) el cliente muestra este modelo en vez del glifo plano. Las que ya resolvió la
 * biblioteca propia (`skip`) no lo necesitan.
 */
const needsModel = (p: Piece, skip: ReadonlySet<string>) => !skip.has(p.id) && (!p.model || p.model.type === "glyph");

/** JSON de la IA; si la salida se cortó a medias, recupera las piezas completas anteriores al corte. */
function parseLenient(raw: string): Record<string, unknown> {
  const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch (err) {
    for (let i = text.lastIndexOf("]"); i > 0; i = text.lastIndexOf("]", i - 1)) {
      try {
        const salvaged = JSON.parse(`${text.slice(0, i + 1)}}`) as unknown;
        if (salvaged && typeof salvaged === "object") return salvaged as Record<string, unknown>;
      } catch {
        // sigue buscando un corte válido más atrás
      }
    }
    throw err;
  }
}

export function parseFallbackModels(raw: string, ids: string[]): Map<string, z.infer<typeof PartsSchema>> {
  const out = new Map<string, z.infer<typeof PartsSchema>>();
  const json = parseLenient(raw);
  for (const id of ids) {
    const parts = PartsSchema.safeParse(json[id]);
    if (parts.success) out.set(id, parts.data);
  }
  return out;
}

export async function fillMissingModels(museum: Museum, complete: Complete, skip: ReadonlySet<string> = new Set()): Promise<Museum> {
  const targets = museum.rooms.flatMap((r) => r.pieces).filter((p) => needsModel(p, skip)).slice(0, MAX_PIECES);
  if (targets.length === 0) return museum;
  const batches: Piece[][] = [];
  for (let i = 0; i < targets.length; i += BATCH_SIZE) batches.push(targets.slice(i, i + BATCH_SIZE));
  const models = new Map<string, z.infer<typeof PartsSchema>>();
  await Promise.all(
    batches.map(async (batch) => {
      try {
        const raw = await complete(
          fallbackModelPrompt(batch.map((p) => ({ id: p.id, title: p.title, object: p.searchKeyword ?? p.title }))),
          TOKENS_PER_PIECE * batch.length + 300,
        );
        for (const [id, parts] of parseFallbackModels(raw, batch.map((p) => p.id))) models.set(id, parts);
      } catch (err) {
        // El respaldo es opcional: ante cualquier fallo las piezas de ese lote conservan su glifo.
        console.error(`respaldo de modelos falló: ${(err as Error).name}`);
      }
    }),
  );
  if (models.size === 0) return museum;
  return {
    ...museum,
    rooms: museum.rooms.map((room) => ({
      ...room,
      pieces: room.pieces.map((p) => (models.has(p.id) ? { ...p, model: { type: "procedural" as const, parts: models.get(p.id)! } } : p)),
    })),
  };
}
