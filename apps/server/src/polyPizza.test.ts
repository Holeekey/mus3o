import { afterEach, describe, expect, it, vi } from "vitest";
import { sampleMuseum, type DynamicAsset, type Museum } from "@mus3o/shared";
import { hydrateMuseumAssets, pickCandidate, resolveAsset } from "./polyPizza";
import { isAllowedDownload, isGlb } from "./assetStore";

const r = (ID: string, Licence: string) => ({ ID, Licence, Title: ID, Download: `https://static.poly.pizza/${ID}.glb`, Creator: { Username: "ana" } });
const asset: DynamicAsset = { assetId: "abc", url: "/api/assets/abc.glb", title: "t", author: "a", license: "CC0", sourceUrl: "https://poly.pizza/m/abc" };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("pickCandidate", () => {
  it("prefiere CC0 sobre CC-BY", () => {
    expect(pickCandidate([r("a", "CC-BY 3.0"), r("b", "CC0 1.0")])?.id).toBe("b");
  });
  it("cae a CC-BY si no hay CC0", () => {
    expect(pickCandidate([r("a", "CC-BY 3.0")])).toMatchObject({ id: "a", license: "CC-BY" });
  });
  it("descarta licencias no compatibles, ids inválidos y sin descarga", () => {
    expect(pickCandidate([r("a", "CC-BY-NC 4.0"), r("b", "All rights reserved"), r("../x", "CC0 1.0"), { ID: "c", Licence: "CC0 1.0" }])).toBeNull();
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
});

describe("resolveAsset", () => {
  it("devuelve null si la búsqueda excede el timeout", async () => {
    vi.stubEnv("POLY_PIZZA_API_KEY", "k");
    vi.stubGlobal("fetch", (_u: string, init: RequestInit) => new Promise((_res, rej) => init.signal?.addEventListener("abort", () => rej(new DOMException("x", "AbortError")))));
    expect(await resolveAsset("slowthing", 30)).toBeNull();
  });
  it("devuelve null si la API responde error", async () => {
    vi.stubEnv("POLY_PIZZA_API_KEY", "k");
    vi.stubGlobal("fetch", async () => new Response("no", { status: 500 }));
    expect(await resolveAsset("broken")).toBeNull();
  });
});

describe("hydrateMuseumAssets", () => {
  const museum: Museum = {
    ...sampleMuseum,
    rooms: [{ ...sampleMuseum.rooms[0], pieces: sampleMuseum.rooms[0].pieces.slice(0, 2).map((p, i) => ({ ...p, searchKeyword: i === 0 ? "castle" : "ghost" })) }],
  };
  it("adjunta el modelo solo donde se resolvió y tolera fallos parciales", async () => {
    const out = await hydrateMuseumAssets(museum, async (k) => {
      if (k === "ghost") throw new Error("boom");
      return asset;
    });
    const [a, b] = out.rooms[0].pieces;
    expect(a.dynamicAsset?.assetId).toBe("abc");
    expect(b.dynamicAsset).toBeUndefined();
  });
  it("sin API key no hace nada", async () => {
    vi.stubEnv("POLY_PIZZA_API_KEY", "");
    expect(await hydrateMuseumAssets(museum)).toBe(museum);
  });
});
