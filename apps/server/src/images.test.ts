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

  beforeAll(async () => {
    server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise((r) => server.close(r)));

  beforeEach(() => {
    clearImageCaches();
    calls.length = 0;
    vi.stubGlobal("fetch", (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith(base)) return realFetch(url, init);
      calls.push(url);
      return Promise.resolve(handler(url));
    });
  });
  afterEach(() => vi.unstubAllGlobals());

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

  it("falls back to Commons when the Wikipedia page is a disambiguation", async () => {
    handler = (url) => (url.includes("wikipedia.org") ? json({ type: "disambiguation", title: "X" }) : json(commonsPage()));
    const res = await fetch(`${base}/api/image?wiki=Batalla&commons=Carabobo%20Tovar`);
    expect(res.status).toBe(200);
    expect((await res.json()).license).toBe("Public domain");
    expect(calls.some((u) => u.includes("generator=search"))).toBe(true);
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
