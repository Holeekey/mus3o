import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-fA-F]{3,8}$/, "color hex inválido");
// Coordenadas y medidas acotadas: el modelo viene de la IA y no debe poder colgar el navegador.
const coord = z.number().finite().min(-5).max(5);
const vec3 = z.tuple([coord, coord, coord]);
const rot3 = z.tuple([
  z.number().finite().min(-7).max(7),
  z.number().finite().min(-7).max(7),
  z.number().finite().min(-7).max(7),
]);

/** Límites de contenido compartidos por el server, los parsers y el layout. */
export const LIMITS = {
  maxNotesChars: 20_000,
  maxRooms: 8,
  maxPiecesPerRoom: 12,
  maxTitle: 80,
  maxText: 400,
} as const;

export const PartSchema = z.object({
  shape: z.enum(["box", "cylinder", "sphere", "cone"]),
  // Medidas en metros (≤ 4) o número de segmentos (≤ 32); se vuelve a acotar al renderizar.
  args: z.array(z.number().finite().min(0).max(32)).max(8).default([]),
  pos: vec3.default([0, 0, 0]),
  rot: rot3.default([0, 0, 0]),
  color: hex,
});

/** Forma geométrica simple: la usan los apuntes parseados en el cliente, sin IA. */
export const GlyphShape = z.enum(["icosahedron", "octahedron", "dodecahedron", "tetrahedron", "torus", "cone", "box", "sphere"]);

export const ModelSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("catalog"), id: z.string().min(1) }),
  z.object({ type: z.literal("procedural"), parts: z.array(PartSchema).min(1).max(40) }),
  z.object({ type: z.literal("glyph"), shape: GlyphShape }),
]);

export const PieceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(LIMITS.maxTitle),
  text: z.string().max(LIMITS.maxText),
  fact: z.string().max(LIMITS.maxText).default(""),
  /** Opcional: el layout procedural del frontend decide la ubicación final. */
  position: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]).optional(),
  model: ModelSchema.optional(),
});

export const RoomSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(LIMITS.maxTitle),
  description: z.string().max(LIMITS.maxText).default(""),
  pieces: z.array(PieceSchema).max(LIMITS.maxPiecesPerRoom),
});

export const MuseumSchema = z.object({
  title: z.string().min(1).max(LIMITS.maxTitle),
  theme: z
    .object({
      palette: z.array(hex).min(2).max(8),
      ambience: z.string(),
    })
    .optional(),
  rooms: z.array(RoomSchema).min(1).max(LIMITS.maxRooms),
});

export type Part = z.infer<typeof PartSchema>;
export type Model = z.infer<typeof ModelSchema>;
export type Glyph = z.infer<typeof GlyphShape>;
export type Piece = z.infer<typeof PieceSchema>;
export type Room = z.infer<typeof RoomSchema>;
export type Museum = z.infer<typeof MuseumSchema>;
