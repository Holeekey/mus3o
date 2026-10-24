import { z } from "zod";
import { MuseumSchema, RoomSchema } from "./schema";

/**
 * Protocolo de `POST /api/generate-museum/stream` (NDJSON: un evento JSON por línea).
 * Orden: `meta`, N × `room`, y por último `done` o `error`. Tras `error` no llega nada más; las salas
 * ya emitidas forman un palacio válido.
 */
export const MuseumStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("meta"), title: z.string().min(1).max(200) }),
  z.object({ type: z.literal("room"), room: RoomSchema }),
  z.object({ type: z.literal("done"), museum: MuseumSchema }),
  z.object({
    type: z.literal("error"),
    message: z.string().max(300),
    /** Equivalente HTTP (503 sin IA, 429 tope diario…) para que el cliente muestre el mismo aviso que sin streaming. */
    status: z.number().int().optional(),
  }),
]);

export type MuseumStreamEvent = z.infer<typeof MuseumStreamEventSchema>;
export const NDJSON_CONTENT_TYPE = "application/x-ndjson";
