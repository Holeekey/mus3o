import { describe, expect, it } from "vitest";
import { sampleMuseum, type DynamicAsset, type Museum } from "@mus3o/shared";
import { fillMissingModels, parseFallbackModels } from "./modelFallback";

const parts = [{ shape: "box", args: [1, 1, 1], pos: [0, 0.5, 0], rot: [0, 0, 0], color: "#aabbcc" }];
const asset: DynamicAsset = { assetId: "a", url: "/api/assets/a.glb", title: "", author: "", license: "CC0", sourceUrl: "" };
const base = sampleMuseum.rooms[0].pieces[0];
const museum = (pieces: Museum["rooms"][number]["pieces"]): Museum => ({ ...sampleMuseum, rooms: [{ ...sampleMuseum.rooms[0], pieces }] });

describe("fillMissingModels", () => {
  const pieces = [
    { ...base, id: "hit", model: { type: "glyph" as const, shape: "box" as const }, dynamicAsset: asset },
    { ...base, id: "miss", searchKeyword: "anvil", model: { type: "glyph" as const, shape: "box" as const } },
  ];

  it("pide solo las piezas sin asset y les pone el modelo creado", async () => {
    let prompt = "";
    const out = await fillMissingModels(museum(pieces), async (p) => {
      prompt = p;
      return JSON.stringify({ miss: parts, hit: parts });
    });
    expect(prompt).toContain('"id":"miss"');
    expect(prompt).not.toContain('"id":"hit"');
    const [hit, miss] = out.rooms[0].pieces;
    expect(hit.model?.type).toBe("glyph");
    expect(miss.model?.type).toBe("procedural");
  });

  it("no llama a la IA si todas las piezas tienen asset", async () => {
    let called = false;
    await fillMissingModels(museum([pieces[0]]), async () => {
      called = true;
      return "{}";
    });
    expect(called).toBe(false);
  });

  it("ante error o JSON inválido conserva el glifo", async () => {
    const m = museum(pieces);
    expect(await fillMissingModels(m, async () => { throw new Error("x"); })).toBe(m);
    expect(await fillMissingModels(m, async () => "no es json")).toBe(m);
  });

  it("descarta partes inválidas", () => {
    const out = parseFallbackModels(JSON.stringify({ a: parts, b: [{ shape: "pyramid" }], c: [] }), ["a", "b", "c", "d"]);
    expect([...out.keys()]).toEqual(["a"]);
  });
});
