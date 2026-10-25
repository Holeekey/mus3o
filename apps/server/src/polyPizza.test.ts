import { afterEach, describe, expect, it, vi } from "vitest";
import { sampleMuseum, type DynamicAsset, type Museum } from "@mus3o/shared";
import { findCandidates, hydrateMuseumAssets, polyBlocked, resetPolyBreaker, resetPolyFound, keywordVariants, pickCandidate, rankCandidates, relevance, type PolyCandidate } from "./polyPizza";
import { ensureAsset, isAllowedDownload, isGlb } from "./assetStore";

const r = (ID: string, Licence: string, Title = ID, extra: object = {}) => ({ ID, Licence, Title, Download: `https://static.poly.pizza/${ID}.glb`, Creator: { Username: "ana" }, ...extra });
const asset: DynamicAsset = { assetId: "abc", url: "/api/assets/abc.glb", title: "t", author: "a", license: "CC0", sourceUrl: "https://poly.pizza/m/abc" };
const cand = (id: string): PolyCandidate => ({ id, title: id, author: "a", license: "CC0", downloadUrl: `https://static.poly.pizza/${id}.glb`, score: 6, tris: 0 });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("relevance y selección", () => {
  it("puntúa título exacto > contiene > parcial > etiqueta > nada", () => {
    expect(relevance("shield", r("a", "CC0", "Shield"))).toBe(6);
    expect(relevance("shield", r("a", "CC0", "Round Shield"))).toBe(4);
    expect(relevance("ancient shield", r("a", "CC0", "Shield"))).toBe(2);
    expect(relevance("shield", r("a", "CC0", "Armor", { Tags: ["shield"] }))).toBe(1);
    expect(relevance("shield", r("a", "CC0", "Banana"))).toBe(0);
  });
  it("tolera plurales", () => {
    expect(relevance("shields", r("a", "CC0", "Shield"))).toBe(6);
  });
  it("la coincidencia manda sobre la licencia; a igual coincidencia, CC0 primero", () => {
    expect(pickCandidate("shield", [r("a", "CC0", "Round Shield Pack"), r("b", "CC-BY 3.0", "Shield")])?.id).toBe("b");
    expect(pickCandidate("shield", [r("a", "CC-BY 3.0", "Shield"), r("b", "CC0 1.0", "Shield")])?.id).toBe("b");
  });
  it("lee la licencia de la atribución real de la API (URL de Creative Commons)", () => {
    const cc0 = { ID: "srN1KGAO7f", Title: "Shield", Download: "https://static.poly.pizza/x.glb", Attribution: '"Shield" by Quaternius. Licence at https://creativecommons.org/publicdomain/zero/1.0/' };
    const by = { ID: "b1", Title: "Shield", Download: "https://static.poly.pizza/y.glb", Attribution: "Licence at https://creativecommons.org/licenses/by/3.0/" };
    const nc = { ID: "n1", Title: "Shield", Download: "https://static.poly.pizza/z.glb", Attribution: "https://creativecommons.org/licenses/by-nc/4.0/" };
    expect(rankCandidates("shield", [by, nc, cc0]).map((c) => [c.id, c.license])).toEqual([["srN1KGAO7f", "CC0"], ["b1", "CC-BY"]]);
  });
  it("descarta modelos pesados y a igual coincidencia y licencia prefiere el más liviano", () => {
    const real = r("srN1KGAO7f", "CC0 1.0", "Shield", { Category: "Objects", Tags: ["Armor"], "Tri Count": 1272 });
    const heavy = r("h", "CC0 1.0", "Shield", { "Tri Count": 90_000 });
    const light = r("l", "CC0 1.0", "Shield", { "Tri Count": 300 });
    expect(rankCandidates("shield", [heavy, real, light]).map((c) => c.id)).toEqual(["l", "srN1KGAO7f"]);
  });
  it("cae a CC-BY si no hay CC0", () => {
    expect(pickCandidate("key", [r("a", "CC-BY 3.0", "Key")])).toMatchObject({ id: "a", license: "CC-BY" });
  });
  it("descarta sin coincidencia, licencias no compatibles, ids inválidos y sin descarga", () => {
    expect(rankCandidates("key", [r("a", "CC-BY-NC 4.0", "Key"), r("b", "All rights reserved", "Key"), r("../x", "CC0 1.0", "Key"), { ID: "c", Licence: "CC0 1.0", Title: "Key" }, r("d", "CC0 1.0", "Banana")])).toEqual([]);
  });
  it("genera variantes de búsqueda de más a menos específica", () => {
    expect(keywordVariants("Ancient  Shield")).toEqual(["ancient shield", "shield"]);
    expect(keywordVariants("key")).toEqual(["key"]);
  });
});

describe("assetStore helpers", () => {
  it("solo permite https en poly.pizza", () => {
    expect(isAllowedDownload("https://static.poly.pizza/a.glb")).toBe(true);
    expect(isAllowedDownload("http://static.poly.pizza/a.glb")).toBe(false);
    expect(isAllowedDownload("https://evilpoly.pizza/a.glb")).toBe(false);
    expect(isAllowedDownload("https://127.0.0.1/a.glb")).toBe(false);
  });
  it("reconoce la firma glTF", () => {
    expect(isGlb(Buffer.from("glTF" + "\0".repeat(8), "latin1"))).toBe(true);
    expect(isGlb(Buffer.from("<html>not a model"))).toBe(false);
  });
  it("rechaza descargas que redirigen a dominios externos no permitidos", async () => {
    vi.stubGlobal("fetch", async () => {
      return {
        ok: true,
        status: 200,
        url: "https://attacker.example/malicious.glb",
        headers: new Headers({ "content-type": "model/gltf-binary" }),
        body: (async function* () {
          yield Buffer.from("glTF" + "\0".repeat(8), "latin1");
        })(),
      } as unknown as Response;
    });
    const ok = await ensureAsset("test-ssrf", "https://poly.pizza/download/test-ssrf.glb");
    expect(ok).toBe(false);
  });
});

describe("findCandidates", () => {
  it("devuelve [] si la búsqueda excede el timeout", async () => {
    vi.stubEnv("POLY_PIZZA_API_KEY", "k");
    vi.stubGlobal("fetch", (_u: string, init: RequestInit) => new Promise((_res, rej) => init.signal?.addEventListener("abort", () => rej(new DOMException("x", "AbortError")))));
    expect(await findCandidates("slowthing", 30)).toEqual([]);
  });
  it("devuelve [] si la API responde error", async () => {
    vi.stubEnv("POLY_PIZZA_API_KEY", "k");
    vi.stubGlobal("fetch", async () => new Response("no", { status: 500 }));
    expect(await findCandidates("broken")).toEqual([]);
  });
  it("reintenta con la última palabra si la frase completa no coincide", async () => {
    vi.stubEnv("POLY_PIZZA_API_KEY", "k");
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (u: string) => {
      urls.push(u);
      const results = u.includes("/search/shield") ? [r("s1", "CC0 1.0", "Shield")] : [];
      return new Response(JSON.stringify({ results }), { status: 200 });
    });
    const out = await findCandidates("rusty shield");
    expect(out.map((c) => c.id)).toEqual(["s1"]);
    expect(urls).toHaveLength(2);
  });
});

describe("hydrateMuseumAssets", () => {
  const withKeywords = (kws: string[]): Museum => ({
    ...sampleMuseum,
    rooms: [{ ...sampleMuseum.rooms[0], pieces: kws.map((k, i) => ({ ...sampleMuseum.rooms[0].pieces[0], id: `p${i}`, searchKeyword: k })) }],
  });
  const download = async (c: PolyCandidate[]) => ({ ...asset, assetId: c[0].id, url: `/api/assets/${c[0].id}.glb` });

  it("adjunta el modelo solo donde hubo coincidencia y tolera fallos parciales", async () => {
    const out = await hydrateMuseumAssets(
      withKeywords(["castle", "ghost", "boom"]),
      async (k) => {
        if (k === "boom") throw new Error("x");
        return k === "castle" ? [cand("c1")] : [];
      },
      download,
    );
    const [a, b, c] = out.rooms[0].pieces;
    expect(a.dynamicAsset?.assetId).toBe("c1");
    expect(b.dynamicAsset).toBeUndefined();
    expect(c.dynamicAsset).toBeUndefined();
  });
  it("evita repetir el mismo modelo entre piezas con la misma palabra si hay alternativas", async () => {
    const out = await hydrateMuseumAssets(withKeywords(["key", "key"]), async () => [cand("k1"), cand("k2")], download);
    expect(out.rooms[0].pieces.map((p) => p.dynamicAsset?.assetId)).toEqual(["k1", "k2"]);
  });
  it("repite el modelo si es el único disponible", async () => {
    const out = await hydrateMuseumAssets(withKeywords(["key", "key"]), async () => [cand("k1")], download);
    expect(out.rooms[0].pieces.map((p) => p.dynamicAsset?.assetId)).toEqual(["k1", "k1"]);
  });
  it("sin API key no hace nada", async () => {
    vi.stubEnv("POLY_PIZZA_API_KEY", "");
    const m = withKeywords(["key"]);
    expect(await hydrateMuseumAssets(m)).toBe(m);
  });
});

describe("cortacircuito de descargas", () => {
  it("cachea resultados y acota el mapa found", async () => {
    resetPolyFound();
    vi.stubEnv("POLY_PIZZA_API_KEY", "k");
    let count = 0;
    vi.stubGlobal("fetch", async () => {
      count++;
      return new Response(JSON.stringify({ results: [r("cand1", "CC0", "test")] }), { status: 200 });
    });
    const first = await findCandidates("test-kw");
    expect(count).toBe(1);
    const second = await findCandidates("test-kw");
    expect(count).toBe(1);
    expect(second).toEqual(first);
    resetPolyFound();
  });

  it("tras un bloqueo 403 deja de buscar y descargar", async () => {
    resetPolyBreaker();
    vi.stubEnv("POLY_PIZZA_API_KEY", "k");
    let searches = 0;
    vi.stubGlobal("fetch", async (u: string) => {
      if (u.includes("api.poly.pizza")) {
        searches++;
        return new Response(JSON.stringify({ results: [r("blk1", "CC0 1.0", "Key")] }), { status: 200 });
      }
      return new Response("<html>Just a moment...</html>", { status: 403, headers: { "content-type": "text/html" } });
    });
    const m = { ...sampleMuseum, rooms: [{ ...sampleMuseum.rooms[0], pieces: [{ ...sampleMuseum.rooms[0].pieces[0], id: "p0", searchKeyword: "key" }] }] };
    const out = await hydrateMuseumAssets(m);
    expect(out.rooms[0].pieces[0].dynamicAsset).toBeUndefined();
    expect(polyBlocked()).toBe(true);
    const before = searches;
    await hydrateMuseumAssets(m);
    expect(searches).toBe(before);
    resetPolyBreaker();
  });
});
