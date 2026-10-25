import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "./app";
import { classify, clearImageCaches } from "./images";

const realFetch = globalThis.fetch;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const commonsPage = () => ({
  query: {
    pages: {
      "1": {
        title: "File:Batalla de Carabobo.jpg",
        index: 1,
        imageinfo: [
          {
            thumburl: "https://upload.wikimedia.org/thumb/x/960px-Batalla.jpg",
            thumbwidth: 960,
            thumbheight: 600,
            descriptionurl: "https://commons.wikimedia.org/wiki/File:Batalla_de_Carabobo.jpg",
            mime: "image/jpeg",
            extmetadata: {
              LicenseShortName: { value: "Public domain" },
              Artist: { value: '<a href="x">Martín Tovar y Tovar</a>' },
              DateTimeOriginal: { value: "1887" },
              ImageDescription: { value: "Oil painting" },
            },
          },
        ],
      },
    },
  },
});

const calls: string[] = [];
let handler: (url: string) => Response | Promise<Response>;

describe("image endpoints", () => {
  let server: Server;
  let base: string;
  let tmp: string;

  beforeAll(async () => {
    server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise((r) => server.close(r)));

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "mus3o-img-"));
    process.env.IMAGE_CACHE_DIR = join(tmp, "cache");
    process.env.IMAGE_SEED_DIR = join(tmp, "seed");
    clearImageCaches();
    calls.length = 0;
    vi.stubGlobal("fetch", (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith(base)) return realFetch(url, init);
      calls.push(url);
      return Promise.resolve(handler(url));
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    rmSync(tmp, { recursive: true, force: true });
  });

  it("resolves a Wikipedia summary image with Commons license data", async () => {
    handler = (url) =>
      url.includes("wikipedia.org")
        ? json({ type: "standard", title: "Batalla de Carabobo", originalimage: { source: "https://upload.wikimedia.org/wikipedia/commons/a/ab/Batalla_de_Carabobo.jpg" } })
        : json(commonsPage());
    const res = await fetch(`${base}/api/image?wiki=Batalla%20de%20Carabobo&lang=es`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      title: "Batalla de Carabobo",
      artist: "Martín Tovar y Tovar, 1887",
      license: "Public domain",
      kind: "painting",
      width: 960,
    });
    expect(body.src).toBe("/api/image/file?u=" + encodeURIComponent("https://upload.wikimedia.org/thumb/x/960px-Batalla.jpg"));
    expect(calls.every((u) => /wikipedia\.org|commons\.wikimedia\.org/.test(u))).toBe(true);
  });

  it("finds the Commons file from a thumbnail-only summary", async () => {
    handler = (url) =>
      url.includes("wikipedia.org")
        ? json({ type: "standard", title: "Carabobo", thumbnail: { source: "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0a/Batalla%20Carabobo.JPG/330px-Batalla%20Carabobo.JPG" } })
        : json(commonsPage());
    const res = await fetch(`${base}/api/image?wiki=Carabobo`);
    expect(res.status).toBe(200);
    expect(calls.some((u) => u.includes("titles=File%3ABatalla%20Carabobo.JPG"))).toBe(true);
  });

  it("does not cache transient upstream errors", async () => {
    handler = () => json({}, 500);
    expect((await fetch(`${base}/api/image?wiki=Roma`)).status).toBe(502);
    const first = calls.length;
    handler = () => json({}, 404);
    expect((await fetch(`${base}/api/image?wiki=Roma`)).status).toBe(404);
    expect(calls.length).toBeGreaterThan(first);
  });

  it("keeps the Wikipedia thumbnail when the Commons license lookup fails", async () => {
    handler = (url) =>
      url.includes("wikipedia.org")
        ? json({ type: "standard", title: "Codón", thumbnail: { source: "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/05/Codon.png/330px-Codon.png", width: 330, height: 200 } })
        : json({}, 500);
    const res = await fetch(`${base}/api/image?wiki=Cod%C3%B3n`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      src: "/api/image/file?u=" + encodeURIComponent("https://thumb.wikimedia.org/wikipedia/commons/thumb/0/05/Codon.png/330px-Codon.png"),
      title: "Codón",
      license: "Ver fuente",
    });
  });

  it("falls back to Commons when the Wikipedia page is a disambiguation", async () => {
    handler = (url) => (url.includes("wikipedia.org") ? json({ type: "disambiguation", title: "X" }) : json(commonsPage()));
    const res = await fetch(`${base}/api/image?wiki=Batalla&commons=Carabobo%20Tovar`);
    expect(res.status).toBe(200);
    expect((await res.json()).license).toBe("Public domain");
    expect(calls.some((u) => u.includes("generator=search"))).toBe(true);
  });

  describe("relevance gate on search fallbacks", () => {
    const TOPIC = "El conflicto del 3 de enero de 2026 entre Estados Unidos y Venezuela";
    const summary = (title: string) =>
      json({ type: "standard", title, originalimage: { source: `https://upload.wikimedia.org/wikipedia/commons/a/ab/${encodeURIComponent(title)}.jpg` } });
    /** Wikipedia simulada: la búsqueda devuelve `search`; el resumen exacto de la consulta no existe, el de cada resultado sí. */
    const wiki = (search: string[], exactMissing = true) => {
      handler = (url) => {
        if (url.includes("list=search")) return json({ query: { search: search.map((title) => ({ title })) } });
        const m = /page\/summary\/([^?]+)/.exec(url);
        if (m) {
          const t = decodeURIComponent(m[1]).replace(/_/g, " ");
          return search.includes(t) || !exactMissing ? summary(t) : json({}, 404);
        }
        return json({ query: { pages: {} } });
      };
    };
    const get = (wikiTitle: string, context: string) =>
      fetch(`${base}/api/image?wiki=${encodeURIComponent(wikiTitle)}&context=${encodeURIComponent(context)}&lang=es`);

    it("rejects a different country: 'Armada en el Caribe' never becomes 'Armada Argentina'", async () => {
      wiki(["Armada Argentina"]);
      const res = await get("Armada en el Caribe", `Despliegue militar en el Caribe · ${TOPIC}`);
      expect(res.status).toBe(404);
      expect(calls.some((u) => u.includes("Armada_Argentina"))).toBe(false);
    });

    it("rejects 'Elecciones generales de Uruguay de 2024' for a US-Venezuela palace and takes the next hit", async () => {
      wiki(["Elecciones generales de Uruguay de 2024", "Elecciones presidenciales de Venezuela de 2024"]);
      const res = await get("Elecciones de 2024 disputadas", `Antecedentes de la tensión · ${TOPIC}`);
      expect(res.status).toBe(200);
      expect((await res.json()).title).toBe("Elecciones presidenciales de Venezuela de 2024");
      expect(calls.some((u) => u.includes("Uruguay"))).toBe(false);
    });

    it("rejects the Uruguay elections even when the context names no country at all", async () => {
      wiki(["Elecciones generales de Uruguay de 2024"]);
      expect((await get("Elecciones de 2024 disputadas", "Antecedentes de la tensión")).status).toBe(404);
    });

    it("accepts a hit that names a country present in the context (demonyms count)", async () => {
      wiki(["Ataques de Estados Unidos contra supuestos narcotraficantes (2025-presente)"]);
      const res = await get("Ataques a lanchas", `Despliegue militar · ${TOPIC}`);
      expect(res.status).toBe(200);
      expect((await res.json()).title).toMatch(/^Ataques de Estados Unidos/);
      // El gentilicio no cuenta como otro país (relevance.test.ts); aquí, un artículo que además trata del tema.
      wiki(["Armada Bolivariana de Venezuela"]);
      expect((await get("Armada naval", `Flota · ${TOPIC}`)).status).toBe(200);
    });

    it("accepts a generic room title that matches the palace topic through the context", async () => {
      wiki(["Relaciones Estados Unidos-Venezuela"]);
      const res = await get("Antecedentes de la tensión", TOPIC);
      expect(res.status).toBe(200);
      expect((await res.json()).title).toBe("Relaciones Estados Unidos-Venezuela");
    });

    it("rejects a hit that shares no word with the title and fewer than two with the context", async () => {
      wiki(["Venezuela"]);
      expect((await get("Fuga a Varennes", "República y Terror · La Revolución Francesa")).status).toBe(404);
    });

    it("a generic word alone is not a match: 'Operación del 3 de enero' is not 'Operación Westindien'", async () => {
      wiki(["Operación Westindien"]);
      expect((await get("Operación del 3 de enero", TOPIC)).status).toBe(404);
      wiki(["Operación Resolución Absoluta de 2026 en Venezuela", "Operación Westindien"]);
      expect((await get("Operación del 3 de enero", TOPIC)).status).toBe(404); // sin palabra distintiva ni dos del contexto...
    });

    it("searches Wikipedia with the piece and its room only; the palace in the context just feeds the gate", async () => {
      wiki(["Ataques de Estados Unidos contra supuestos narcotraficantes (2025-presente)"]);
      const res = await get("Ataques a lanchas", `Despliegue militar · ${TOPIC}`);
      expect(res.status).toBe(200);
      const search = calls.find((u) => u.includes("list=search"))!;
      expect(decodeURIComponent(search)).toContain("srsearch=Ataques a lanchas Despliegue militar&");
    });

    it("rejects a city or state of another country once the query names one (República de Florencia, crisis asiática)", async () => {
      wiki(["República de Florencia"]);
      expect((await get("República y ejecución del rey", "República y Terror · La Revolución Francesa")).status).toBe(404);
      wiki(["Crisis financiera asiática"]);
      expect((await get("Crisis financiera", "Crisis y Estados Generales · La Revolución Francesa")).status).toBe(404);
    });

    it("does not gate an exact title hit", async () => {
      wiki([], false);
      const res = await get("Armada Argentina", TOPIC);
      expect(res.status).toBe(200);
      expect((await res.json()).title).toBe("Armada Argentina");
    });

    it("gates the automatic Commons search by file name, but trusts an explicit commons query", async () => {
      const files = (name: string) => {
        const page = commonsPage();
        (page.query.pages["1"] as { title: string }).title = `File:${name}`;
        return json(page);
      };
      const onlyCommons = (name: string) => {
        handler = (url) => (url.includes("generator=search") ? files(name) : json({}, 404));
      };
      onlyCommons("Armada Argentina 2010.jpg");
      expect((await get("Armada en el Caribe", TOPIC)).status).toBe(404);
      onlyCommons("US Navy ships.jpg");
      expect((await get("Flota en el Caribe", TOPIC)).status).toBe(404);
      onlyCommons("Flota del Caribe.jpg");
      expect((await get("Flota naval del Caribe", TOPIC)).status).toBe(200);
      onlyCommons("US Navy ships.jpg");
      const explicit = await fetch(`${base}/api/image?wiki=Armada%20en%20el%20Caribe&commons=navy%20caribbean&lang=es`);
      expect(explicit.status).toBe(200);
    });
  });

  it("answers 404 when nothing has an image", async () => {
    handler = (url) => (url.includes("wikipedia.org") ? json({}, 404) : json({ query: { pages: {} } }));
    const res = await fetch(`${base}/api/image?wiki=Nada&commons=nothing`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Sin imagen" });
  });

  it("caches by normalized query, negative results included", async () => {
    handler = () => json({}, 404);
    await fetch(`${base}/api/image?wiki=Mitocondria`);
    const first = calls.length;
    expect(first).toBeGreaterThan(0);
    await fetch(`${base}/api/image?wiki=${encodeURIComponent(" Mitocóndria ")}`);
    await fetch(`${base}/api/image?wiki=MITOCONDRIA`);
    expect(calls.length).toBe(first);
  });

  it("rejects the file proxy for non-Wikimedia hosts", async () => {
    handler = () => new Response("secret", { headers: { "Content-Type": "image/png" } });
    for (const u of ["https://evil.example.com/a.png", "http://upload.wikimedia.org/a.png", "https://upload.wikimedia.org.evil.com/a.png", "nope"]) {
      const res = await fetch(`${base}/api/image/file?u=${encodeURIComponent(u)}`);
      expect(res.status).toBe(400);
    }
    expect(calls).toHaveLength(0);
  });

  it("proxies Wikimedia files and serves repeats from cache", async () => {
    handler = () => new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "image/jpeg" } });
    const u = encodeURIComponent("https://upload.wikimedia.org/wikipedia/commons/a/ab/X.jpg");
    const a = await fetch(`${base}/api/image/file?u=${u}`);
    expect(a.status).toBe(200);
    expect(a.headers.get("content-type")).toBe("image/jpeg");
    expect(a.headers.get("cache-control")).toBe("public, max-age=86400");
    expect(new Uint8Array(await a.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    await fetch(`${base}/api/image/file?u=${u}`);
    expect(calls).toHaveLength(1);
  });

  describe("simultaneous identical requests", () => {
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const wikiHits = () => calls.filter((u) => u.includes("wikipedia.org")).length;

    it("share one Wikimedia lookup when resolving the same image", async () => {
      handler = async (url) => {
        await delay(60);
        return url.includes("wikipedia.org")
          ? json({ type: "standard", title: "Roma", originalimage: { source: "https://upload.wikimedia.org/wikipedia/commons/a/ab/Roma.jpg" } })
          : json(commonsPage());
      };
      const [a, b] = await Promise.all([fetch(`${base}/api/image?wiki=Roma`), fetch(`${base}/api/image?wiki=Roma`)]);
      expect(a.status).toBe(200);
      expect(b.status).toBe(200);
      expect(await a.json()).toEqual(await b.json());
      expect(wikiHits()).toBe(1);
    });

    it("share one download when proxying the same file", async () => {
      handler = async () => {
        await delay(60);
        return new Response(new Uint8Array([7, 8, 9]), { headers: { "Content-Type": "image/jpeg" } });
      };
      const u = encodeURIComponent("https://upload.wikimedia.org/wikipedia/commons/a/ab/Y.jpg");
      const [a, b] = await Promise.all([fetch(`${base}/api/image/file?u=${u}`), fetch(`${base}/api/image/file?u=${u}`)]);
      expect(a.status).toBe(200);
      expect(b.status).toBe(200);
      expect(new Uint8Array(await b.arrayBuffer())).toEqual(new Uint8Array([7, 8, 9]));
      expect(calls).toHaveLength(1);
    });

    it("do not cache a transient error that all waiters received", async () => {
      handler = async () => {
        await delay(60);
        return json({}, 500);
      };
      const [a, b] = await Promise.all([fetch(`${base}/api/image?wiki=Paris`), fetch(`${base}/api/image?wiki=Paris`)]);
      expect(a.status).toBe(502);
      expect(b.status).toBe(502);
      handler = () => json({}, 404);
      expect((await fetch(`${base}/api/image?wiki=Paris`)).status).toBe(404);
    });
  });
});

describe("classify", () => {
  it("detects diagrams, paintings and photos", () => {
    expect(classify("image/svg+xml", "Krebs", "", "")).toBe("diagram");
    expect(classify("image/png", "Esquema del ciclo", "", "")).toBe("diagram");
    expect(classify("image/jpeg", "X", "", "1887")).toBe("painting");
    expect(classify("image/jpeg", "X", "Óleo sobre tela", "")).toBe("painting");
    expect(classify("image/jpeg", "X", "", "2015")).toBe("photo");
  });
});
