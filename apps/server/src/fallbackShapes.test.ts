import { describe, expect, it } from "vitest";
import { MuseumSchema, PartSchema, sampleMuseum, type DynamicAsset, type Museum } from "@mus3o/shared";
import { applyDeterministicModels, deterministicParts } from "./fallbackShapes";

const base = sampleMuseum.rooms[0].pieces[0];
const glyph = (shape: "box" | "sphere" | "cone" | "torus" | "icosahedron" | "octahedron" | "dodecahedron" | "tetrahedron") => ({ type: "glyph" as const, shape });
const museum = (pieces: Museum["rooms"][number]["pieces"]): Museum => ({ ...sampleMuseum, rooms: [{ ...sampleMuseum.rooms[0], pieces }] });

describe("deterministicParts", () => {
  it("es determinista: misma pieza, mismas partes", () => {
    const p = { ...base, id: "x1", title: "Espada", searchKeyword: "sword", model: glyph("box") };
    expect(deterministicParts(p)).toEqual(deterministicParts(p));
  });

  it("elige la receta por palabra clave y, sin coincidencia, por la forma del glifo", () => {
    const sword = deterministicParts({ ...base, id: "a", title: "Espada", searchKeyword: "sword", model: glyph("box") });
    const plainBox = deterministicParts({ ...base, id: "a", title: "Cosa", searchKeyword: "-", model: glyph("box") });
    const plainCone = deterministicParts({ ...base, id: "a", title: "Cosa", searchKeyword: "-", model: glyph("cone") });
    expect(sword).not.toEqual(plainBox);
    expect(plainBox).not.toEqual(plainCone);
  });

  it("toda receta (cada glifo y cada palabra clave) produce partes válidas que descansan sobre y = 0", () => {
    const shapes = ["box", "sphere", "cone", "torus", "icosahedron", "octahedron", "dodecahedron", "tetrahedron"] as const;
    const keywords = ["sword", "shield", "key", "book", "crown", "tower", "lamp", "bottle", "tree", "ship", "cannon", "clock", "bell", "person", "horse", "cell", "chip"];
    const pieces = [
      ...shapes.map((s) => ({ ...base, id: `g-${s}`, title: "x", searchKeyword: "-", model: glyph(s) })),
      ...keywords.map((k) => ({ ...base, id: `k-${k}`, title: "x", searchKeyword: k, model: glyph("box") })),
    ];
    for (const p of pieces) {
      const parts = deterministicParts(p);
      expect(parts.length).toBeGreaterThanOrEqual(2);
      for (const part of parts) {
        expect(PartSchema.safeParse(part).success).toBe(true);
        const [, h] = part.shape === "box" ? part.args.slice(0, 3).concat() : part.shape === "cylinder" ? [0, part.args[2]] : part.shape === "sphere" ? [0, part.args[0] * 2] : [0, part.args[1]];
        expect(part.pos[1] - h / 2).toBeGreaterThanOrEqual(-0.12);
      }
    }
  });
});

describe("applyDeterministicModels", () => {
  it("da modelo a toda pieza sin modelo creado (también las de asset por descargar), salta las resueltas y deja el museo válido", () => {
    const asset: DynamicAsset = { assetId: "a", url: "/api/assets/a.glb", title: "", author: "", license: "CC0", sourceUrl: "" };
    const made = { type: "procedural" as const, parts: [{ shape: "box" as const, args: [1, 1, 1], pos: [0, 0.5, 0] as [number, number, number], rot: [0, 0, 0] as [number, number, number], color: "#aabbcc" }] };
    const out = applyDeterministicModels(
      museum([
        { ...base, id: "hit", model: glyph("box"), dynamicAsset: asset },
        { ...base, id: "made", model: made },
        { ...base, id: "miss", model: glyph("sphere") },
        { ...base, id: "own", model: glyph("box") },
      ]),
      new Set(["own"]),
    );
    const [hit, kept, miss, own] = out.rooms[0].pieces;
    expect(hit.model?.type).toBe("procedural");
    expect(own.model?.type).toBe("glyph");
    expect(kept.model).toBe(made);
    expect(miss.model?.type).toBe("procedural");
    expect(MuseumSchema.safeParse(out).success).toBe(true);
  });

  it("devuelve el mismo museo si no falta ningún modelo", () => {
    const m = museum([{ ...base, id: "ok", model: { type: "procedural", parts: [{ shape: "box", args: [1, 1, 1], pos: [0, 0.5, 0], rot: [0, 0, 0], color: "#aabbcc" }] } }]);
    expect(applyDeterministicModels(m)).toBe(m);
  });
});
