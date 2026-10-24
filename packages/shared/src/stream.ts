import { z } from "zod";
import { GraphEdgeSchema, MAX_EDGES, MuseumSchema, RoomSchema, type GraphEdge, type Museum } from "./schema";

/**
 * Protocolo de `POST /api/generate-museum/stream` (NDJSON: un evento JSON por línea).
 * Orden: `meta`, N × `room`, y por último `done` o `error`. Tras `error` no llega nada más; las salas
 * ya emitidas forman un palacio válido.
 *
 * `room.edges` son las aristas provisionales entre esa sala y las anteriores (según el modo, igual que el grafo
 * final): con ellas el cliente ubica la sala junto a la que la enlaza sin esperar al grafo completo. El grafo
 * definitivo llega en `done.museum.graph`.
 */
export const MuseumStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("meta"), title: z.string().min(1).max(200) }),
  z.object({ type: z.literal("room"), room: RoomSchema, edges: z.array(GraphEdgeSchema).max(MAX_EDGES).optional() }),
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

/** Aristas del grafo del museo entre la sala `index` y las anteriores: lo que se sabe cuando esa sala llega. */
export function edgesAtArrival(museum: Pick<Museum, "rooms" | "graph">, index: number): GraphEdge[] {
  const room = museum.rooms[index];
  if (!room || !museum.graph) return [];
  const arrived = new Set(museum.rooms.slice(0, index + 1).map((r) => r.id));
  return museum.graph.edges.filter((e) => (e.from === room.id || e.to === room.id) && arrived.has(e.from) && arrived.has(e.to));
}
