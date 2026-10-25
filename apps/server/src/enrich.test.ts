import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { countSources, MuseumSchema, parseMus3oDSL } from "@mus3o/shared";
import { enrichMuseum } from "./claude";
import { detectLang } from "./enrich";
import { clearImageCaches, genericKind, resolveImage } from "./images";

const NOTES = [
  "# Batalla de Carabobo",
  "- José Antonio Páez lideró la carga de caballería en Carabobo",
  "- Simón Bolívar comandó el ejército patriota",
  "Las fechas importan poco para este examen",
].join("\n");

const fakeDsl = () =>
  parseMus3oDSL(
    [
      "ROOM: r1 | Batalla de Carabobo | ancient | #8a6a3a | #20180c | torus |",
      "PIECE: José Antonio Páez",
      "PIECE: Simón Bolívar",
      "PIECE: Concepto inventado por la IA",
    ].join("\n"),
    { title: "Independencia" },
  );

describe("enrichMuseum", () => {
  it("fake DSL museum is a valid base", () => {
    expect(MuseumSchema.safeParse(fakeDsl()).success).toBe(true);
  });

  it("sets imageSearch with context on rooms and pieces, without mutating the input", () => {
    const base = fakeDsl();
    const snapshot = JSON.stringify(base);
    const out = enrichMuseum(base);
    expect(JSON.stringify(base)).toBe(snapshot);
    const room = out.rooms[0];
    expect(room.imageSearch).toEqual({ wikiTitle: room.name, lang: "es", context: base.title });
    expect(room.pieces[0].imageSearch).toEqual({ wikiTitle: "José Antonio Páez", lang: "es", context: `${room.name} · ${base.title}` });
  });

  it("keeps an existing imageSearch", () => {
    const base = fakeDsl();
    base.rooms[0].pieces[0].imageSearch = { wikiTitle: "Otra", lang: "es" };
    expect(enrichMuseum(base).rooms[0].pieces[0].imageSearch).toEqual({ wikiTitle: "Otra", lang: "es" });
  });

  it("retrieves sources from the notes and marks the rest unverified", () => {
    const out = enrichMuseum(fakeDsl(), NOTES);
    const [paez, bolivar, invented] = out.rooms[0].pieces;
    expect(paez.source).toEqual({ quote: "- José Antonio Páez lideró la carga de caballería en Carabobo", line: 2 });
    expect(bolivar.source?.line).toBe(3);
    expect(invented.source).toBeUndefined();
    expect(invented.unverified).toBe(true);
    expect(countSources(out)).toEqual({ total: 3, verified: 2, unverified: 1 });
    expect(out.sourceTextHash).toMatch(/^[0-9a-f]{64}$/);
    expect(MuseumSchema.safeParse(out).success).toBe(true);
  });

  it("detects the language", () => {
    expect(detectLang("La célula es la unidad de la vida")).toBe("es");
    expect(detectLang("The cell is the unit of life and the nucleus is the center of the cell, which is where the DNA is")).toBe("en");
  });
});

describe("resolver retrieval", () => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  const summary = (title: string, withImage: boolean, type = "standard") => ({
    type,
    title,
    ...(withImage
      ? { thumbnail: { source: `https://upload.wikimedia.org/thumb/a/ab/${title}.jpg/320px-${title}.jpg`, width: 320, height: 200 } }
      : {}),
    content_urls: { desktop: { page: `https://es.wikipedia.org/wiki/${title}` } },
  });
  const calls: string[] = [];
  let handler: (url: string) => Response;

  beforeEach(() => {
    clearImageCaches();
    calls.length = 0;
    vi.stubGlobal("fetch", (input: string | URL) => {
      calls.push(String(input));
      return Promise.resolve(handler(String(input)));
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("falls back to the Wikipedia search with context when the exact summary is a disambiguation", async () => {
    handler = (url) => {
      if (url.includes("/page/summary/Paez")) return json(summary("Paez", false, "disambiguation"));
      if (url.includes("list=search")) return json({ query: { search: [{ title: "Río Paez" }, { title: "José Antonio Páez" }] } });
      if (url.includes("/page/summary/Jos")) return json(summary("José_Antonio_Páez", true));
      if (url.includes("commons.wikimedia.org")) return json({});
      return json({}, 404);
    };
    const image = await resolveImage({ wiki: "Paez", context: "Antonio Páez Carabobo", lang: "es" });
    expect(image?.title).toBe("José_Antonio_Páez");
    expect(calls.some((c) => c.includes("srsearch=Paez%20Antonio%20P"))).toBe(true);
  });

  it("caches misses (including context) and does not hit the network twice", async () => {
    handler = (url) => (url.includes("list=search") ? json({ query: { search: [] } }) : json({}, 404));
    expect(await resolveImage({ wiki: "Inexistente", context: "Tema", lang: "es" })).toBeNull();
    const first = calls.length;
    expect(first).toBeGreaterThan(0);
    expect(await resolveImage({ wiki: "  inexistente ", context: "tema", lang: "es" })).toBeNull();
    expect(calls.length).toBe(first);
  });

  it("makes no network calls for generic words like Fecha", async () => {
    handler = () => json({}, 404);
    expect(genericKind("Fecha")).toBe("strict");
    expect(genericKind("fecha")).toBe("strict");
    expect(genericKind("mitocondria")).toBe("weak");
    expect(genericKind("Mitocondria")).toBeNull();
    expect(genericKind("Batalla de Carabobo")).toBeNull();
    expect(await resolveImage({ wiki: "Fecha", context: "Batalla de Carabobo", lang: "es" })).toBeNull();
    expect(calls).toEqual([]);
  });

  it("rejects search hits that share no words with the query", async () => {
    handler = (url) => {
      if (url.includes("list=search")) return json({ query: { search: [{ title: "Totalmente ajeno" }] } });
      if (url.includes("commons.wikimedia.org")) return json({});
      return json({}, 404);
    };
    expect(await resolveImage({ wiki: "Zzz Qqq", context: "Xyz", lang: "es" })).toBeNull();
    expect(calls.some((c) => c.includes("/page/summary/Totalmente"))).toBe(false);
  });
});
