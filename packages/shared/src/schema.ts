import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-fA-F]{3,8}$/, "color hex inválido");
const vec3 = z.tuple([z.number(), z.number(), z.number()]);

export const PartSchema = z.object({
  shape: z.enum(["box", "cylinder", "sphere", "cone"]),
  args: z.array(z.number()).max(8).default([]),
  pos: vec3.default([0, 0, 0]),
  rot: vec3.default([0, 0, 0]),
  color: hex,
});

export const ModelSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("catalog"), id: z.string().min(1) }),
  z.object({ type: z.literal("procedural"), parts: z.array(PartSchema).min(1).max(40) }),
]);

export const PieceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  text: z.string(),
  fact: z.string(),
  /** [x, y, z] local a la sala. y = altura de la base de la pieza (alto del pedestal). */
  position: vec3,
  model: ModelSchema,
});

export const RoomSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  pieces: z.array(PieceSchema).min(1).max(12),
});

export const MuseumSchema = z.object({
  title: z.string().min(1),
  theme: z.object({
    palette: z.array(hex).min(2).max(8),
    ambience: z.string(),
  }),
  rooms: z.array(RoomSchema).min(1).max(8),
});

export type Part = z.infer<typeof PartSchema>;
export type Model = z.infer<typeof ModelSchema>;
export type Piece = z.infer<typeof PieceSchema>;
export type Room = z.infer<typeof RoomSchema>;
export type Museum = z.infer<typeof MuseumSchema>;
