import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { rm } from "node:fs/promises";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sampleMuseum, MuseumSchema, type Museum } from "@mus3o/shared";
import { app } from "./app";
import { resolveModels } from "./claude";
import {
  addGlb,
  addRecipe,
  applyLibrary,
  findInLibrary,
  libraryDir,
  listLibrary,
  normalizeKeyword,
  readLibraryGlb,
  recordGenerated,
  removeEntry,
  resetLibraryState,
  setLibraryStatus,
  updateEntry,
} from "./library";
import { resetPolyBreaker } from "./polyPizza";

const parts = (color: string) => [{ shape: "box" as const, args: [1, 1, 1], pos: [0, 0.5, 0] as [number, number, number], rot: [0, 0, 0] as [number, number, number], color }];
const glb = Buffer.concat([Buffer.from("glTF"), Buffer.alloc(32)]);
const base = sampleMuseum.rooms[0].pieces[0];
const museum = (keywords: (string | undefined)[]): Museum => ({
  ...sampleMuseum,
  rooms: [{ ...sampleMuseum.rooms[0], pieces: keywords.map((k, i) => ({ ...base, id: `p${i}`, title: `Pieza ${i}`, searchKeyword: k, dynamicAsset: undefined, model: { type: "glyph" as const, shape: "box" as const } })) }],
});

// Cada prueba parte de una biblioteca vacía (el disco persiste entre pruebas del mismo archivo).
beforeEach(async () => {
  resetLibraryState();
  await rm(libraryDir(), { recursive: true, force: true });
});

describe("normalizeKeyword", () => {
  it("minúsculas, sin signos y con espacios colapsados", () => {
    expect(normalizeKeyword("  Ancient   SWORD! ")).toBe("ancient sword");
    expect(normalizeKeyword("---")).toBe("---");
    expect(normalizeKeyword(undefined)).toBe("");
  });
});

describe("findInLibrary", () => {
  it("solo usa entradas aprobadas, por palabra exacta o por la última palabra", async () => {
    const e = await addRecipe({ keywords: ["sword"], title: "Espada", parts: parts("#111111") });
    expect((await findInLibrary("sword"))?.id).toBe(e.id);
    expect((await findInLibrary("ancient sword"))?.id).toBe(e.id);
    expect(await findInLibrary("shield")).toBeNull();
    await setLibraryStatus(e.id, "pending");
    expect(await findInLibrary("sword")).toBeNull();
    await setLibraryStatus(e.id, "rejected");
    expect(await findInLibrary("sword")).toBeNull();
  });

  it("prefiere coincidencia exacta, luego .glb, luego lo tuyo sobre lo generado", async () => {
    const generic = await addRecipe({ keywords: ["sword"], title: "genérica", parts: parts("#111111") });
    const exact = await addRecipe({ keywords: ["ancient sword"], title: "exacta", parts: parts("#222222") });
    expect((await findInLibrary("ancient sword"))?.id).toBe(exact.id);
    const model = await addGlb({ keywords: ["sword"], title: "glb", data: glb });
    expect((await findInLibrary("sword"))?.id).toBe(model.id);
    expect((await findInLibrary("ancient sword"))?.id).toBe(exact.id);
    expect(generic.id).not.toBe(model.id);
  });
});

describe("ciclo de revisión", () => {
  it("lo generado entra pendiente, sin duplicar, y al aprobarlo gana prioridad", async () => {
    await recordGenerated([{ keyword: "Anvil", title: "Yunque", parts: parts("#333333"), origin: "ai" }]);
    await recordGenerated([{ keyword: "anvil", title: "Yunque 2", parts: parts("#444444"), origin: "ai" }]);
    const pending = await listLibrary("pending");
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ origin: "ai", keywords: ["anvil"], status: "pending", uses: 0 });
    expect(await findInLibrary("anvil")).toBeNull();

    await setLibraryStatus(pending[0].id, "approved");
    expect((await findInLibrary("anvil"))?.id).toBe(pending[0].id);
  });

  it("lo rechazado no se vuelve a proponer", async () => {
    await recordGenerated([{ keyword: "anvil", title: "Yunque", parts: parts("#333333"), origin: "deterministic" }]);
    const [e] = await listLibrary();
    await setLibraryStatus(e.id, "rejected");
    await recordGenerated([{ keyword: "anvil", title: "Yunque", parts: parts("#333333"), origin: "deterministic" }]);
    expect(await listLibrary()).toHaveLength(1);
  });

  it("corregir las partes a mano la deja tuya y aprobada", async () => {
    await recordGenerated([{ keyword: "anvil", title: "Yunque", parts: parts("#333333"), origin: "ai" }]);
    const [e] = await listLibrary("pending");
    const fixed = await updateEntry(e.id, { parts: parts("#999999"), keywords: ["anvil", "Blacksmith Tool"] });
    expect(fixed).toMatchObject({ origin: "manual", status: "approved", keywords: ["anvil", "blacksmith tool"] });
    expect((await findInLibrary("blacksmith tool"))?.parts?.[0].color).toBe("#999999");
  });

  it("persiste en disco y sobrevive a un reinicio", async () => {
    const e = await addRecipe({ keywords: ["key"], title: "Llave", parts: parts("#123456") });
    resetLibraryState();
    expect((await findInLibrary("key"))?.id).toBe(e.id);
  });

  it("valida lo que entra: partes inválidas, sin palabras clave y .glb falso", async () => {
    await expect(addRecipe({ keywords: ["x"], title: "t", parts: [{ shape: "pyramid" }] })).rejects.toThrow();
    await expect(addRecipe({ keywords: ["!!!"], title: "t", parts: parts("#111111") })).rejects.toThrow(/palabra clave/);
    await expect(addRecipe({ keywords: [], title: "t", parts: parts("#111111") })).rejects.toThrow(/palabra clave/);
    await expect(addGlb({ keywords: ["x"], title: "t", data: Buffer.from("no soy un glb") })).rejects.toThrow(/glb/);
  });

  it("eliminar borra la entrada y su .glb", async () => {
    const e = await addGlb({ keywords: ["box"], title: "Caja", data: glb });
    expect((await readLibraryGlb(e.id))?.length).toBe(glb.length);
    expect(await removeEntry(e.id)).toBe(true);
    expect(await readLibraryGlb(e.id)).toBeNull();
    expect(await removeEntry(e.id)).toBe(false);
  });
});

describe("applyLibrary / resolveModels", () => {
  it("receta → modelo procedural; .glb → dynamicAsset propio; cuenta los usos", async () => {
    const r = await addRecipe({ keywords: ["sword"], title: "Espada", parts: parts("#111111") });
    const g = await addGlb({ keywords: ["crown"], title: "Corona", data: glb });
    const { museum: out, resolved } = await applyLibrary(museum(["sword", "crown", "anvil", undefined]));
    const [sword, crown, anvil, none] = out.rooms[0].pieces;
    expect(sword.model?.type).toBe("procedural");
    expect(crown.dynamicAsset).toMatchObject({ assetId: g.id, url: `/api/assets/${g.id}.glb`, license: "own" });
    expect(anvil.model?.type).toBe("glyph");
    expect(none.model?.type).toBe("glyph");
    expect([...resolved].sort()).toEqual(["p0", "p1"]);
    expect(MuseumSchema.safeParse(out).success).toBe(true);
    expect((await listLibrary()).find((e) => e.id === r.id)?.uses).toBe(1);
  });

  it("resolveModels: la biblioteca gana, lo demás recibe respaldo determinista y queda pendiente de revisión", async () => {
    resetPolyBreaker();
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const own = await addRecipe({ keywords: ["sword"], title: "Espada", parts: parts("#abcdef") });
      const out = await resolveModels(museum(["sword", "anvil"]));
      const [sword, anvil] = out.rooms[0].pieces;
      expect(sword.model).toMatchObject({ type: "procedural", parts: [{ color: "#abcdef" }] });
      expect(anvil.model?.type).toBe("procedural");
      const pending = await listLibrary("pending");
      expect(pending.map((e) => [e.keywords[0], e.origin])).toEqual([["anvil", "deterministic"]]);
      expect(pending.some((e) => e.id === own.id)).toBe(false);
    } finally {
      if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
    }
  });
});

describe("/api/library", () => {
  let server: Server;
  let url = "";
  beforeAll(async () => {
    server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  });
  afterAll(() => server.close());
  afterEach(() => {
    delete process.env.ENABLE_DEBUG_ROUTES;
  });
  const json = (body: unknown, method = "POST") => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  it("404 sin ENABLE_DEBUG_ROUTES", async () => {
    expect((await fetch(`${url}/library`)).status).toBe(404);
  });

  it("alta de receta y de .glb, revisión y servicio del .glb propio", async () => {
    process.env.ENABLE_DEBUG_ROUTES = "true";
    const r = await fetch(`${url}/library/recipe`, json({ keywords: "lamp, light", title: "Lámpara", parts: parts("#ffcc00") }));
    expect(r.status).toBe(201);
    expect(((await r.json()) as { keywords: string[] }).keywords).toEqual(["lamp", "light"]);
    expect((await fetch(`${url}/library/recipe`, json({ keywords: "x", parts: [] }))).status).toBe(400);

    const bad = await fetch(`${url}/library/glb?keywords=cup`, { method: "POST", headers: { "content-type": "model/gltf-binary" }, body: Buffer.from("nope") });
    expect(bad.status).toBe(400);
    const ok = await fetch(`${url}/library/glb?keywords=cup&title=Taza`, { method: "POST", headers: { "content-type": "model/gltf-binary" }, body: glb });
    expect(ok.status).toBe(201);
    const entry = (await ok.json()) as { id: string };

    const served = await fetch(`${url}/assets/${entry.id}.glb`);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("model/gltf-binary");

    expect((await fetch(`${url}/library/${entry.id}/reject`, { method: "POST" })).status).toBe(200);
    expect((await fetch(`${url}/assets/${entry.id}.glb`)).status).toBe(404);
    expect((await fetch(`${url}/library/${entry.id}/explode`, { method: "POST" })).status).toBe(400);
    expect((await fetch(`${url}/library/nope-id/approve`, { method: "POST" })).status).toBe(404);
    const list = (await (await fetch(`${url}/library?status=rejected`)).json()) as { entries: { id: string }[] };
    expect(list.entries.map((e) => e.id)).toEqual([entry.id]);
    expect((await fetch(`${url}/library/${entry.id}`, { method: "DELETE" })).status).toBe(204);
  });
});
