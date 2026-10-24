import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-fA-F]{3,8}$/, "color hex inválido");
const vec3 = z.tuple([z.number(), z.number(), z.number()]);

export const MAX_INPUT_CHARS = 50_000;
export const MAX_INPUT_IMAGES = 6;

export const MuseumModeSchema = z.enum(["exploration", "quiz", "biography", "education"]);

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

export const QuizSchema = z.object({
  question: z.string().min(1).max(200),
  options: z.array(z.string().min(1).max(100)).min(2).max(4),
  answerIndex: z.number().int().min(0).max(3),
});

export const PieceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  text: z.string(),
  fact: z.string(),
  /** [x, y, z] local a la sala. y = altura de la base de la pieza (alto del pedestal). */
  position: vec3,
  model: ModelSchema,
  /** Imagen subida por el usuario que la IA asignó a este cuadro. */
  image: z.object({ imageId: z.string().min(1) }).optional(),
  /** Obligatorio en modo quiz. */
  quiz: QuizSchema.optional(),
});

export const RoomSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  pieces: z.array(PieceSchema).min(1).max(12),
  /** Obligatorio en modo biography, por ejemplo "1879–1905". */
  period: z.string().min(1).max(40).optional(),
});

export const GraphEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  kind: z.enum(["next", "prerequisite", "related"]),
});

export const MuseumGraphSchema = z.object({
  /** Sala donde aparece el jugador. */
  start: z.string().min(1),
  edges: z.array(GraphEdgeSchema).max(16),
});

const MuseumObjectSchema = z.object({
  title: z.string().min(1),
  theme: z.object({
    palette: z.array(hex).min(2).max(8),
    ambience: z.string(),
  }),
  rooms: z.array(RoomSchema).min(1).max(8),
  mode: MuseumModeSchema.optional(),
  /** Si falta, el frontend recorre las salas en el orden de `rooms`. */
  graph: MuseumGraphSchema.optional(),
});

type MuseumShape = z.infer<typeof MuseumObjectSchema>;
type MuseumGraph = z.infer<typeof MuseumGraphSchema>;

const linearPathMessage = (mode: string) =>
  `modo ${mode}: las aristas next deben formar un único camino desde graph.start que recorra todas las salas`;

function neighbours(graph: MuseumGraph): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const { from, to } of graph.edges) {
    map.set(from, [...(map.get(from) ?? []), to]);
    map.set(to, [...(map.get(to) ?? []), from]);
  }
  return map;
}

function reachableFrom(graph: MuseumGraph): Set<string> {
  const links = neighbours(graph);
  const seen = new Set([graph.start]);
  const queue = [graph.start];
  while (queue.length > 0) {
    for (const next of links.get(queue.shift()!) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

/** Las aristas `next` forman un solo camino que empieza en `start` y pasa por todas las salas. */
function isNextPathCoveringAll(graph: MuseumGraph, roomIds: string[]): boolean {
  const nextEdges = graph.edges.filter((e) => e.kind === "next");
  if (nextEdges.length !== roomIds.length - 1) return false;
  const successor = new Map<string, string>();
  for (const { from, to } of nextEdges) {
    if (successor.has(from)) return false;
    successor.set(from, to);
  }
  const visited = new Set<string>();
  let current: string | undefined = graph.start;
  while (current !== undefined && !visited.has(current)) {
    visited.add(current);
    current = successor.get(current);
  }
  return current === undefined && visited.size === roomIds.length;
}

function checkGraph(museum: MuseumShape, ctx: z.RefinementCtx): boolean {
  const graph = museum.graph!;
  const roomIds = new Set(museum.rooms.map((r) => r.id));
  let valid = true;
  const fail = (message: string, path: (string | number)[]) => {
    valid = false;
    ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ["graph", ...path] });
  };

  if (!roomIds.has(graph.start)) fail(`graph.start no existe: "${graph.start}"`, ["start"]);
  graph.edges.forEach((edge, i) => {
    for (const end of [edge.from, edge.to]) {
      if (!roomIds.has(end)) fail(`arista hacia una sala inexistente: "${end}"`, ["edges", i]);
    }
    if (edge.from === edge.to) fail(`arista de una sala a sí misma: "${edge.from}"`, ["edges", i]);
  });
  if (!valid) return false;

  const reachable = reachableFrom(graph);
  for (const id of roomIds) {
    if (!reachable.has(id)) fail(`sala inalcanzable desde graph.start: "${id}"`, ["edges"]);
  }
  return valid;
}

function checkModeGraph(museum: MuseumShape, ctx: z.RefinementCtx) {
  const graph = museum.graph!;
  const roomIds = museum.rooms.map((r) => r.id);
  const fail = (message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ["graph", "edges"] });

  switch (museum.mode) {
    case "exploration":
      // Conexo (ya validado) y con n-1 aristas: es un árbol.
      if (graph.edges.length !== roomIds.length - 1) {
        fail("modo exploration: el grafo debe ser un árbol desde graph.start");
      }
      break;
    case "education":
    case "biography":
      if (!isNextPathCoveringAll(graph, roomIds)) fail(linearPathMessage(museum.mode));
      break;
  }
}

function checkMuseum(museum: MuseumShape, ctx: z.RefinementCtx) {
  const issue = (message: string, path: (string | number)[]) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });

  const roomIds = new Set<string>();
  const pieceIds = new Set<string>();
  const imageIds = new Set<string>();

  museum.rooms.forEach((room, r) => {
    if (roomIds.has(room.id)) issue(`id de sala duplicado: "${room.id}"`, ["rooms", r, "id"]);
    roomIds.add(room.id);
    if (museum.mode === "biography" && !room.period) {
      issue(`modo biography: la sala "${room.id}" necesita period`, ["rooms", r, "period"]);
    }

    room.pieces.forEach((piece, p) => {
      const path = ["rooms", r, "pieces", p];
      if (pieceIds.has(piece.id)) issue(`id de pieza duplicado: "${piece.id}"`, [...path, "id"]);
      pieceIds.add(piece.id);

      if (piece.image) {
        if (imageIds.has(piece.image.imageId)) {
          issue(`la imagen "${piece.image.imageId}" se usa en más de una pieza`, [...path, "image"]);
        }
        imageIds.add(piece.image.imageId);
      }

      if (piece.quiz && piece.quiz.answerIndex >= piece.quiz.options.length) {
        issue(`la respuesta del quiz de "${piece.id}" no está entre las opciones`, [...path, "quiz"]);
      }
      if (museum.mode === "quiz" && !piece.quiz) {
        issue(`modo quiz: la pieza "${piece.id}" necesita quiz`, [...path, "quiz"]);
      }
    });
  });

  if (museum.graph && checkGraph(museum, ctx)) checkModeGraph(museum, ctx);
}

export const MuseumSchema = MuseumObjectSchema.superRefine(checkMuseum);

/** Imágenes asignadas que no llegaron en el request. Necesita el request, por eso no está en el schema. */
export function findImageAssignmentIssues(museum: Museum, requestImageIds: string[]): string[] {
  const sent = new Set(requestImageIds);
  return museum.rooms.flatMap((room) =>
    room.pieces
      .filter((piece) => piece.image && !sent.has(piece.image.imageId))
      .map(
        (piece) =>
          `la pieza "${piece.id}" usa una imagen que no está en el request: "${piece.image!.imageId}"`,
      ),
  );
}

export const SourceSchema = z.object({
  name: z.string().min(1).max(120),
  kind: z.enum(["docx", "xlsx", "csv", "txt"]),
  /** Texto ya extraído en el navegador: los archivos nunca llegan al servidor. */
  text: z.string().max(MAX_INPUT_CHARS),
});

export const InputImageSchema = z.object({
  /** Lo genera el frontend: img-1, img-2... */
  id: z.string().regex(/^img-\d{1,2}$/, "id de imagen inválido"),
  name: z.string().min(1).max(120),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  /** Base64, redimensionada en el navegador a <= 1024 px. */
  data: z.string().min(1),
});

const RequestObjectSchema = z.object({
  mode: MuseumModeSchema.default("exploration"),
  prompt: z.string().trim().min(1).max(2_000),
  sources: z.array(SourceSchema).max(5).default([]),
  images: z.array(InputImageSchema).max(MAX_INPUT_IMAGES).default([]),
});

/** Acepta el formato anterior `{ topic }` como `{ prompt: topic }`. */
const fromLegacyTopic = (value: unknown) => {
  if (value && typeof value === "object" && "topic" in value && !("prompt" in value)) {
    const { topic, ...rest } = value as { topic: unknown };
    return { ...rest, prompt: topic };
  }
  return value;
};

function checkTextLimit(request: { prompt: string; sources: { text: string }[] }, ctx: z.RefinementCtx) {
  const total = request.sources.reduce((sum, s) => sum + s.text.length, request.prompt.length);
  if (total > MAX_INPUT_CHARS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `el texto total supera ${MAX_INPUT_CHARS} caracteres`,
      path: ["sources"],
    });
  }
}

export const GenerateMuseumRequestSchema = z.preprocess(
  fromLegacyTopic,
  RequestObjectSchema.superRefine((request, ctx) => {
    checkTextLimit(request, ctx);
    const ids = request.images.map((i) => i.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "ids de imagen duplicados", path: ["images"] });
    }
  }),
);

export const ImprovePromptRequestSchema = z.preprocess(
  fromLegacyTopic,
  RequestObjectSchema.omit({ images: true }).superRefine(checkTextLimit),
);

export const ImprovePromptResponseSchema = z.object({
  suggestions: z.array(z.string().min(1).max(200)).max(5),
  improvedPrompt: z.string().min(1).max(2_000),
});

export type MuseumMode = z.infer<typeof MuseumModeSchema>;
export type Part = z.infer<typeof PartSchema>;
export type Model = z.infer<typeof ModelSchema>;
export type Quiz = z.infer<typeof QuizSchema>;
export type Piece = z.infer<typeof PieceSchema>;
export type Room = z.infer<typeof RoomSchema>;
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;
export type Graph = z.infer<typeof MuseumGraphSchema>;
export type Museum = z.infer<typeof MuseumSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type InputImage = z.infer<typeof InputImageSchema>;
export type GenerateMuseumRequest = z.infer<typeof GenerateMuseumRequestSchema>;
export type ImprovePromptRequest = z.infer<typeof ImprovePromptRequestSchema>;
export type ImprovePromptResponse = z.infer<typeof ImprovePromptResponseSchema>;
