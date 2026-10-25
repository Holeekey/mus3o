import { describe, expect, it } from "vitest";
import { sampleMuseum, type DynamicAsset, type Museum } from "@mus3o/shared";
import { fillMissingModels, parseFallbackModels } from "./modelFallback";
import { resolveModels } from "./claude";

const parts = [{ shape: "box", args: [1, 1, 1], pos: [0, 0.5, 0], rot: [0, 0, 0], color: "#aabbcc" }];
const asset: DynamicAsset = { assetId: "a", url: "/api/assets/a.glb", title: "", author: "", license: "CC0", sourceUrl: "" };
const base = sampleMuseum.rooms[0].pieces[0];
const museum = (pieces: Museum["rooms"][number]["pieces"]): Museum => ({ ...sampleMuseum, rooms: [{ ...sampleMuseum.rooms[0], pieces }] });

describe("fillMissingModels", () => {
  const pieces = [
    { ...base, id: "hit", model: { type: "glyph" as const, shape: "box" as const }, dynamicAsset: asset },
    { ...base, id: "miss", searchKeyword: "anvil", model: { type: "glyph" as const, shape: "box" as const } },
  ];

  it("dibuja también las piezas con asset por descargar (es su respaldo si falla) y salta las que ya resolvió la biblioteca", async () => {
    let prompt = "";
    const out = await fillMissingModels(
      museum(pieces),
      async (p) => {
        prompt = p;
        return JSON.stringify({ miss: parts, hit: parts });
      },
      new Set(["hit"]),
    );
    expect(prompt).toContain('"id":"miss"');
    expect(prompt).not.toContain('"id":"hit"');
    const [hit, miss] = out.rooms[0].pieces;
    expect(hit.model?.type).toBe("glyph");
    expect(miss.model?.type).toBe("procedural");

    const withAsset = await fillMissingModels(museum(pieces), async () => JSON.stringify({ miss: parts, hit: parts }));
    expect(withAsset.rooms[0].pieces.map((p) => p.model?.type)).toEqual(["procedural", "procedural"]);
  });

  it("no llama a la IA si todas las piezas ya están resueltas", async () => {
    let called = false;
    await fillMissingModels(museum([pieces[0]]), async () => {
      called = true;
      return "{}";
    }, new Set(["hit"]));
    expect(called).toBe(false);
  });

  it("ante error o JSON inválido conserva el glifo", async () => {
    const m = museum(pieces);
    expect(await fillMissingModels(m, async () => { throw new Error("x"); })).toBe(m);
    expect(await fillMissingModels(m, async () => "no es json")).toBe(m);
  });

  it("recupera las piezas completas cuando la salida se corta a medias", () => {
    const cut = `{"a": ${JSON.stringify(parts)}, "b": ${JSON.stringify(parts)}, "c": [{"shape":"box","args":[1,`;
    expect([...parseFallbackModels(cut, ["a", "b", "c"]).keys()]).toEqual(["a", "b"]);
  });

  it("pide por lotes en paralelo: un lote fallido no deja sin modelo a los demás", async () => {
    const many = Array.from({ length: 13 }, (_, i) => ({ ...base, id: `p${i}`, searchKeyword: "anvil", model: { type: "glyph" as const, shape: "box" as const } }));
    const prompts: string[] = [];
    const out = await fillMissingModels(museum(many), async (p) => {
      prompts.push(p);
      if (p.includes('"id":"p6"')) throw new Error("lote caído");
      return JSON.stringify(Object.fromEntries(many.map((m) => [m.id, parts])));
    });
    expect(prompts).toHaveLength(3);
    const types = out.rooms[0].pieces.map((p) => p.model?.type);
    expect(types.slice(0, 6).every((t) => t === "procedural")).toBe(true);
    expect(types.slice(6, 12).every((t) => t === "glyph")).toBe(true);
    expect(types[12]).toBe("procedural");
  });

  it("descarta partes inválidas", () => {
    const out = parseFallbackModels(JSON.stringify({ a: parts, b: [{ shape: "pyramid" }], c: [] }), ["a", "b", "c", "d"]);
    expect([...out.keys()]).toEqual(["a"]);
  });
});

describe("resolveModels", () => {
  it("sin ANTHROPIC_API_KEY retorna el museo hidratado sin llamar al fallback", async () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const out = await resolveModels(sampleMuseum);
      expect(out).toBeDefined();
    } finally {
      if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
    }
  });
});
