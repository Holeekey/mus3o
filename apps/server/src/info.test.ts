import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "./app";
import { clearImageCaches } from "./images";
import { capAtSentence, clearInfoCaches, plainText } from "./info";

const realFetch = globalThis.fetch;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const summary = (title: string, extract: string, extra: object = {}) => ({
  type: "standard",
  title,
  extract,
  content_urls: { desktop: { page: `https://es.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}` } },
  ...extra,
});

const calls: string[] = [];
let handler: (url: string) => Response | Promise<Response>;

describe("text helpers", () => {
  it("strips html to plain text", () => {
    expect(plainText('<b>Hola</b> &amp; <a href="x">mundo</a>\n  ok')).toBe("Hola & mundo ok");
  });
  it("caps at a sentence boundary, not mid-sentence or after an initial", () => {
    const s = "J. A. Páez fue un militar. ".repeat(40);
    const out = capAtSentence(s, 700);
    expect(out.length).toBeLessThanOrEqual(700);
    expect(out.endsWith("militar.")).toBe(true);
    expect(capAtSentence("Corto.")).toBe("Corto.");
  });
  it("falls back to a word cut with an ellipsis when there is no sentence end", () => {
    const out = capAtSentence("palabra ".repeat(200), 300);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(301);
  });
});

describe("GET /api/info", () => {
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
    tmp = mkdtempSync(join(tmpdir(), "mus3o-info-"));
    process.env.IMAGE_CACHE_DIR = join(tmp, "cache");
    process.env.IMAGE_SEED_DIR = join(tmp, "seed");
    clearImageCaches();
    clearInfoCaches();
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

  it("returns the Wikipedia extract with attribution", async () => {
    handler = () => json(summary("Mitocondria", "La mitocondria es un orgánulo. <b>Produce</b> ATP."));
    const res = await fetch(`${base}/api/info?wiki=Mitocondria&context=La%20c%C3%A9lula&lang=es`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      title: "Mitocondria",
      extract: "La mitocondria es un orgánulo. Produce ATP.",
      url: "https://es.wikipedia.org/wiki/Mitocondria",
      license: "CC BY-SA 4.0",
      source: "Wikipedia",
    });
    expect(calls.every((u) => /wikipedia\.org/.test(u))).toBe(true);
  });

  it("ignores a non-Wikipedia url from upstream", async () => {
    handler = () => json({ ...summary("Roma", "Roma es una ciudad."), content_urls: { desktop: { page: "https://evil.example/x" } } });
    const body = await (await fetch(`${base}/api/info?wiki=Roma`)).json();
    expect(body.url).toBe("https://es.wikipedia.org/wiki/Roma");
  });

  it("disambiguates with the context through the search API", async () => {
    handler = (url) => {
      if (url.includes("list=search")) return json({ query: { search: [{ title: "José Antonio Páez" }] } });
      if (url.includes("/page/summary/P%C3%A1ez")) return json({ type: "disambiguation", title: "Páez" });
      return json(summary("José Antonio Páez", "José Antonio Páez fue un militar venezolano."));
    };
    const res = await fetch(`${base}/api/info?wiki=P%C3%A1ez&context=Batalla%20de%20Carabobo`);
    expect(res.status).toBe(200);
    expect((await res.json()).title).toBe("José Antonio Páez");
    expect(calls.some((u) => decodeURIComponent(u).includes("Páez Batalla de Carabobo"))).toBe(true);
  });

  it("returns 404 without calling Wikipedia for generic one-word titles", async () => {
    handler = () => json(summary("Fecha", "x"));
    const res = await fetch(`${base}/api/info?wiki=Fecha&context=Historia`);
    expect(res.status).toBe(404);
    expect(calls.length).toBe(0);
  });

  it("returns 404 when search hits share no words with the query", async () => {
    handler = (url) =>
      url.includes("list=search") ? json({ query: { search: [{ title: "Zzz Qqq" }] } }) : json({}, 404);
    expect((await fetch(`${base}/api/info?wiki=Nada&context=Otro`)).status).toBe(404);
  });

  it("caches misses but not transient errors", async () => {
    handler = () => json({}, 404);
    expect((await fetch(`${base}/api/info?wiki=Inexistente`)).status).toBe(404);
    const first = calls.length;
    expect((await fetch(`${base}/api/info?wiki=${encodeURIComponent(" inexistente ")}`)).status).toBe(404);
    expect(calls.length).toBe(first);

    handler = () => json({}, 500);
    expect((await fetch(`${base}/api/info?wiki=Roma`)).status).toBe(502);
    handler = () => json(summary("Roma", "Roma es una ciudad."));
    expect((await fetch(`${base}/api/info?wiki=Roma`)).status).toBe(200);
  });

  it("answers 404 without a title", async () => {
    handler = () => json({}, 404);
    expect((await fetch(`${base}/api/info`)).status).toBe(404);
    expect(calls.length).toBe(0);
  });
});
