import { PartSchema, type Museum, type Piece } from "@mus3o/shared";
import { z } from "zod";

/**
 * Respaldo determinista (sin IA ni red): si no hubo asset ni la IA dibujó la pieza, se arma un modelo procedural
 * con recetas fijas. Primero por la palabra clave del objeto ("sword", "key"...); si no hay receta, por la forma
 * del glifo. El color sale del id de la pieza, así que el mismo museo siempre se ve igual.
 */
type Part = z.infer<typeof PartSchema>;
type Recipe = (c: Colors) => Part[];
type Colors = { main: string; accent: string; dark: string; light: string };

const PALETTE = ["#c8553d", "#588b8b", "#d9a441", "#6b7fd7", "#8a9a5b", "#b07aa1", "#e07a5f", "#4f9d69"];

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function colorsFor(id: string): Colors {
  const h = hash(id);
  return { main: PALETTE[h % PALETTE.length], accent: PALETTE[(h >>> 4) % PALETTE.length], dark: "#4a4540", light: "#e8e2d6" };
}

// Ayudantes: miden en metros y se apoyan en `y` (base de la parte), no en su centro.
const box = (w: number, h: number, d: number, x: number, y: number, z: number, color: string, rot: [number, number, number] = [0, 0, 0]): Part => ({ shape: "box", args: [w, h, d], pos: [x, y + h / 2, z], rot, color });
const cyl = (rt: number, rb: number, h: number, x: number, y: number, z: number, color: string, seg = 12, rot: [number, number, number] = [0, 0, 0]): Part => ({ shape: "cylinder", args: [rt, rb, h, seg], pos: [x, y + h / 2, z], rot, color });
const ball = (r: number, x: number, y: number, z: number, color: string): Part => ({ shape: "sphere", args: [r, 12, 8], pos: [x, y + r, z], rot: [0, 0, 0], color });
const cone = (r: number, h: number, x: number, y: number, z: number, color: string, seg = 12): Part => ({ shape: "cone", args: [r, h, seg], pos: [x, y + h / 2, z], rot: [0, 0, 0], color });

const RECIPES: { match: RegExp; build: Recipe }[] = [
  { match: /\b(ram|dimm|memory (module|stick|card)|memoria)\b/, build: (c) => [box(2, 0.7, 0.12, 0, 0.1, 0, "#3f9d6b"), box(0.38, 0.34, 0.16, -0.65, 0.2, 0, c.main), box(0.38, 0.34, 0.16, -0.15, 0.2, 0, c.main), box(0.38, 0.34, 0.16, 0.35, 0.2, 0, c.main), box(1.9, 0.12, 0.14, 0, 0, 0, c.accent), box(0.1, 0.3, 0.1, 0.95, 0.8, 0, c.light)] },
  { match: /\b(sword|dagger|blade|knife|saber|sabre|spear|lance)\b/, build: (c) => [box(0.16, 1.4, 0.05, 0, 0.5, 0, c.light), box(0.7, 0.1, 0.12, 0, 0.4, 0, c.accent), cyl(0.06, 0.06, 0.4, 0, 0, 0, c.dark), ball(0.09, 0, -0.05, 0, c.accent)] },
  { match: /\b(shield|armor|armour|helmet|crest|badge)\b/, build: (c) => [cyl(0.8, 0.8, 0.14, 0, 0.5, 0, c.main, 16, [Math.PI / 2, 0, 0]), cyl(0.35, 0.35, 0.18, 0, 0.5, 0, c.accent, 16, [Math.PI / 2, 0, 0]), cone(0.4, 0.5, 0, 0, 0, c.dark, 6)] },
  { match: /\b(key|lock|padlock|gate|door)\b/, build: (c) => [cyl(0.32, 0.32, 0.12, 0, 1.3, 0, c.accent, 14, [Math.PI / 2, 0, 0]), cyl(0.07, 0.07, 1.3, 0, 0, 0, c.main), box(0.35, 0.1, 0.1, 0.18, 0.3, 0, c.main), box(0.25, 0.1, 0.1, 0.12, 0.5, 0, c.main)] },
  { match: /\b(book|scroll|paper|letter|document|manuscript|tablet|map|newspaper|page)\b/, build: (c) => [box(1.2, 0.18, 0.85, 0, 0, 0, c.main), box(1.1, 0.1, 0.78, 0, 0.18, 0, c.light), box(1.2, 0.18, 0.85, 0, 0.28, 0, c.main), box(0.08, 0.5, 0.85, -0.62, 0, 0, c.dark)] },
  { match: /\b(crown|tiara|throne|king|queen|emperor|laurel|trophy|medal|cup|chalice|goblet|grail)\b/, build: (c) => [cyl(0.5, 0.35, 0.5, 0, 0.7, 0, c.accent, 12), cyl(0.12, 0.12, 0.5, 0, 0.3, 0, c.accent), cyl(0.5, 0.5, 0.1, 0, 0, 0, c.accent), ball(0.12, 0, 1.2, 0, c.main)] },
  { match: /\b(tower|castle|fort|fortress|wall|temple|church|cathedral|palace|house|building|pyramid|monument|obelisk|column|pillar|arch|bridge)\b/, build: (c) => [box(1.2, 0.2, 1.2, 0, 0, 0, c.dark), box(0.8, 1.3, 0.8, 0, 0.2, 0, c.light), box(1.0, 0.15, 1.0, 0, 1.5, 0, c.main), cone(0.65, 0.5, 0, 1.65, 0, c.accent, 4)] },
  { match: /\b(lamp|torch|candle|lantern|fire|flame|light|bulb|sun|star|lightning)\b/, build: (c) => [cyl(0.35, 0.45, 0.15, 0, 0, 0, c.dark), cyl(0.07, 0.07, 1.0, 0, 0.15, 0, c.dark), cone(0.3, 0.6, 0, 1.15, 0, c.accent, 8), ball(0.2, 0, 1.2, 0, c.main)] },
  { match: /\b(bottle|flask|vial|potion|beaker|jar|vase|urn|pot|amphora|test tube|microscope)\b/, build: (c) => [ball(0.55, 0, 0, 0, c.main), cyl(0.18, 0.28, 0.5, 0, 1.0, 0, c.accent, 12), cyl(0.2, 0.2, 0.12, 0, 1.5, 0, c.dark)] },
  { match: /\b(tree|plant|leaf|flower|seed|forest|bush|palm|root)\b/, build: (c) => [cyl(0.12, 0.2, 0.9, 0, 0, 0, "#7a5230"), ball(0.6, 0, 0.7, 0, c.main), ball(0.45, 0.35, 1.1, 0.1, c.accent), ball(0.4, -0.3, 1.2, -0.1, c.main)] },
  { match: /\b(ship|boat|sail|anchor|canoe|galleon|navy)\b/, build: (c) => [box(1.6, 0.3, 0.6, 0, 0, 0, c.dark), box(1.1, 0.2, 0.5, 0, 0.3, 0, c.main), cyl(0.05, 0.05, 1.4, 0, 0.3, 0, c.dark), box(0.8, 0.9, 0.04, 0.05, 0.7, 0, c.light)] },
  { match: /\b(cannon|gun|rifle|pistol|musket|bomb|missile|rocket)\b/, build: (c) => [cyl(0.2, 0.28, 1.3, 0, 0.45, 0, c.dark, 12, [0, 0, Math.PI / 2 - 0.3]), cyl(0.35, 0.35, 0.12, -0.35, 0.25, 0.3, c.main, 14, [Math.PI / 2, 0, 0]), cyl(0.35, 0.35, 0.12, -0.35, 0.25, -0.3, c.main, 14, [Math.PI / 2, 0, 0])] },
  { match: /\b(clock|watch|hourglass|time|calendar|compass|gear|wheel|cog|engine|machine)\b/, build: (c) => [cyl(0.8, 0.8, 0.2, 0, 0.6, 0, c.light, 20, [Math.PI / 2, 0, 0]), cyl(0.9, 0.9, 0.12, 0, 0.6, -0.02, c.accent, 20, [Math.PI / 2, 0, 0]), box(0.07, 0.5, 0.06, 0, 0.6, 0.12, c.dark), box(0.35, 0.07, 0.06, 0.15, 0.6, 0.12, c.dark), cyl(0.3, 0.45, 0.2, 0, 0, 0, c.dark)] },
  { match: /\b(bell|horn|trumpet|drum|instrument|music|guitar|violin|piano)\b/, build: (c) => [cone(0.7, 1.1, 0, 0.35, 0, c.accent, 14), ball(0.14, 0, 0.3, 0, c.dark), cyl(0.05, 0.05, 0.3, 0, 1.4, 0, c.dark)] },
  { match: /\b(person|man|woman|soldier|human|figure|statue|knight|warrior|leader|hero)\b/, build: (c) => [cyl(0.3, 0.38, 0.9, 0, 0, 0, c.main), box(0.7, 0.55, 0.4, 0, 0.9, 0, c.main), ball(0.26, 0, 1.45, 0, c.light), box(0.18, 0.6, 0.18, -0.46, 0.85, 0, c.accent), box(0.18, 0.6, 0.18, 0.46, 0.85, 0, c.accent)] },
  { match: /\b(animal|horse|dog|cat|bird|owl|fish|beast|cow|lion|wolf)\b/, build: (c) => [box(1.1, 0.5, 0.5, 0, 0.6, 0, c.main), ball(0.3, 0.7, 1.0, 0, c.main), box(0.12, 0.6, 0.12, -0.4, 0, 0.15, c.dark), box(0.12, 0.6, 0.12, -0.4, 0, -0.15, c.dark), box(0.12, 0.6, 0.12, 0.4, 0, 0.15, c.dark), box(0.12, 0.6, 0.12, 0.4, 0, -0.15, c.dark)] },
  { match: /\b(cell|atom|molecule|nucleus|dna|virus|bacteria|egg|planet|earth|globe|world|ball|orb|brain|heart|organ)\b/, build: (c) => [cyl(0.5, 0.6, 0.3, 0, 0, 0, c.dark), ball(0.75, 0, 0.3, 0, c.main), ball(0.3, 0.2, 0.75, 0.4, c.accent), ball(0.18, -0.35, 0.6, -0.45, c.light)] },
  { match: /\b(chip|cpu|processor|circuit|computer|server|database|disk|memory|ram|screen|monitor|phone|network|router)\b/, build: (c) => [box(1.3, 0.2, 1.3, 0, 0, 0, c.dark), box(0.9, 0.25, 0.9, 0, 0.2, 0, c.main), box(0.45, 0.1, 0.45, 0, 0.45, 0, c.accent), box(0.08, 0.2, 0.08, 0.55, 0, 0.7, c.light), box(0.08, 0.2, 0.08, -0.55, 0, 0.7, c.light), box(0.08, 0.2, 0.08, 0.55, 0, -0.7, c.light), box(0.08, 0.2, 0.08, -0.55, 0, -0.7, c.light)] },
];

/** Una receta por forma de glifo para lo que no coincide con ninguna palabra clave. */
const GLYPH_RECIPES: Record<string, Recipe> = {
  box: (c) => [box(1.3, 0.2, 1.3, 0, 0, 0, c.dark), box(1.0, 1.0, 1.0, 0, 0.2, 0, c.main), box(1.1, 0.12, 1.1, 0, 1.2, 0, c.accent)],
  sphere: (c) => [cyl(0.5, 0.6, 0.3, 0, 0, 0, c.dark), ball(0.75, 0, 0.3, 0, c.main), ball(0.25, 0, 1.2, 0, c.accent)],
  cone: (c) => [cyl(0.8, 0.8, 0.2, 0, 0, 0, c.dark), cone(0.7, 1.4, 0, 0.2, 0, c.main, 6), ball(0.12, 0, 1.65, 0, c.accent)],
  torus: (c) => [cyl(0.6, 0.7, 0.3, 0, 0, 0, c.dark), cyl(0.7, 0.7, 0.18, 0, 0.3, 0, c.main, 20), cyl(0.38, 0.38, 0.2, 0, 0.29, 0, c.dark, 20), ball(0.22, 0, 0.55, 0, c.accent)],
  icosahedron: (c) => [cyl(0.5, 0.6, 0.3, 0, 0, 0, c.dark), ball(0.7, 0, 0.35, 0, c.main), cone(0.25, 0.4, 0, 1.4, 0, c.accent, 5)],
  octahedron: (c) => [cyl(0.5, 0.6, 0.25, 0, 0, 0, c.dark), cone(0.65, 0.8, 0, 0.25, 0, c.main, 4), cone(0.65, 0.8, 0, 1.05, 0, c.accent, 4)],
  dodecahedron: (c) => [cyl(0.55, 0.65, 0.25, 0, 0, 0, c.dark), cyl(0.5, 0.65, 0.5, 0, 0.25, 0, c.main, 5), cyl(0.65, 0.5, 0.5, 0, 0.75, 0, c.accent, 5)],
  tetrahedron: (c) => [cyl(0.6, 0.7, 0.25, 0, 0, 0, c.dark), cone(0.75, 1.3, 0, 0.25, 0, c.main, 3), ball(0.12, 0, 1.6, 0, c.accent)],
};

/** Modelo procedural fijo para una pieza (misma entrada, misma salida). */
export function deterministicParts(piece: Pick<Piece, "id" | "title" | "searchKeyword" | "model">): Part[] {
  const colors = colorsFor(piece.id);
  const text = `${piece.searchKeyword ?? ""} ${piece.title}`.toLowerCase();
  const recipe = RECIPES.find((r) => r.match.test(text))?.build ?? GLYPH_RECIPES[piece.model?.type === "glyph" ? piece.model.shape : "box"] ?? GLYPH_RECIPES.box;
  return z.array(PartSchema).max(8).parse(recipe(colors));
}

const needsModel = (p: Piece, skip: ReadonlySet<string>) => !skip.has(p.id) && (!p.model || p.model.type === "glyph");

/** Da un modelo procedural fijo a toda pieza sin modelo creado (aunque tenga un asset por descargar, que es el respaldo si falla). Nunca llama a la red. */
export function applyDeterministicModels(museum: Museum, skip: ReadonlySet<string> = new Set()): Museum {
  if (!museum.rooms.some((r) => r.pieces.some((p) => needsModel(p, skip)))) return museum;
  return {
    ...museum,
    rooms: museum.rooms.map((room) => ({
      ...room,
      pieces: room.pieces.map((p) => (needsModel(p, skip) ? { ...p, model: { type: "procedural" as const, parts: deterministicParts(p) } } : p)),
    })),
  };
}
