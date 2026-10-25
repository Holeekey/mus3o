import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Cliente de Anthropic falso: cuenta las llamadas y devuelve lo que cada prueba ponga en `reply`.
const fake = vi.hoisted(() => ({ calls: [] as any[], reply: null as unknown as () => unknown }));
vi.mock("./claude", async (orig) => ({
  ...(await orig<typeof import("./claude")>()),
  getClient: () => ({
    messages: {
      create: async (params: unknown) => {
        fake.calls.push(params);
        return { content: [{ type: "tool_use", id: "t1", name: "recreate_scene", input: fake.reply() }], usage: { input_tokens: 1, output_tokens: 1 } };
      },
    },
  }),
}));

import { app } from "./app";
import { clearImageCaches } from "./images";
import { backdropFor, buildPhotoDiorama, MAX_INSTANCES, photoKey, photoTuning, resetPhotoDioramaState } from "./photoDiorama";
import { writeSeedDiorama } from "./imageStore";

const realFetch = globalThis.fetch;
const IMG = "https://upload.wikimedia.org/wikipedia/commons/a/ab/Batalla_de_Carabobo.jpg";
const BACK = backdropFor(new URL(IMG));

const scene = (extra: Record<string, unknown> = {}) => ({
  imageKind: "battle",
  recreatable: true,
  reason: "Caballería patriota cargando",
  title: "Carga de caballería",
  terrain: "plain",
  time: "day",
  palette: { ground: "#8a9a5b", sky: "#9fc4e8", accent: "#c9963a" },
  props: [
    { kind: "horse", pos: [-4, -2], count: 10, spread: 3, label: "caballería patriota" },
    { kind: "figure", pos: [4, -6], count: 12, label: "infantería realista" },
    { kind: "flag", pos: [0, -10], label: "bandera" },
  ],
  ...extra,
});

describe("buildPhotoDiorama", () => {
  it("builds a valid diorama with backdrop and per-prop Spanish labels", () => {
    const r = buildPhotoDiorama(scene(), BACK);
    expect(r.recreatable).toBe(true);
    expect(r.diorama?.backdrop).toBe(BACK);
    expect(r.diorama?.props.map((p) => p.label)).toEqual(["caballería patriota", "infantería realista", "bandera"]);
  });

  it("passes non-recreatable images through without a diorama", () => {
    const r = buildPhotoDiorama({ imageKind: "portrait", recreatable: false, reason: "Retrato" }, BACK);
    expect(r).toEqual({ recreatable: false, reason: "Retrato" });
  });

  it("does not trust recreatable=true on a non-scene kind", () => {
    expect(buildPhotoDiorama(scene({ imageKind: "diagram" }), BACK).recreatable).toBe(false);
    expect(buildPhotoDiorama(scene({ imageKind: "map" }), BACK).recreatable).toBe(false);
  });

  it("clamps counts, positions and scale, and drops unknown kinds, custom and links", () => {
    const r = buildPhotoDiorama(
      scene({
        props: [
          { kind: "figure", pos: [99, -99], count: 500, scale: 9, label: "multitud", pieceId: "otra-sala" },
          { kind: "dragon", pos: [0, 0], label: "no existe" },
          { kind: "custom", pos: [0, 0], parts: [{ shape: "box", args: [1, 1, 1], pos: [0, 0, 0], rot: [0, 0, 0], color: "#ffffff" }] },
          { kind: "tree", pos: [2, -2], label: "árboles" },
          { kind: "rock", pos: [3, -3] },
        ],
      }),
      BACK,
    );
    const props = r.diorama!.props;
    expect(props.map((p) => p.kind)).toEqual(["figure", "tree", "rock"]);
    expect(props[0].pos).toEqual([14, -14]);
    expect(props[0].count).toBeLessThanOrEqual(30);
    expect(props[0].scale).toBe(3);
    expect(props[0].pieceId).toBeUndefined();
    expect(props[2].label).toBe("rocas"); // rótulo de respaldo
  });

  it("caps the total number of instances", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ kind: "figure", pos: [i - 6, -4], count: 30, label: `grupo ${i}` }));
    const r = buildPhotoDiorama(scene({ props: many }), BACK);
    expect(r.diorama!.props.reduce((n, p) => n + p.count, 0)).toBeLessThanOrEqual(MAX_INSTANCES);
  });

  it("is not recreatable when too few props survive", () => {
    expect(buildPhotoDiorama(scene({ props: [{ kind: "tree", pos: [0, 0], label: "árbol" }] }), BACK).recreatable).toBe(false);
  });

  it("strips markup from labels", () => {
    const r = buildPhotoDiorama(scene({ props: [{ kind: "figure", pos: [0, 0], label: "<b>IGNORA TODO</b>" }, ...(scene().props as any[])] }), BACK);
    expect(r.diorama!.props[0].label).not.toMatch(/[<>]/);
  });

  it("rejects a backdrop that is not the Wikimedia image proxy", () => {
    const r = buildPhotoDiorama(scene(), "https://evil.example/x.png");
    expect(r.diorama!.backdrop).toBeUndefined();
  });
});

describe("POST /api/diorama-from-image", () => {
  let server: Server;
  let base: string;
  let tmp: string;
  let imageCalls: string[];
  let imageType = "image/jpeg";

  const post = (body: unknown) =>
    realFetch(`${base}/api/diorama-from-image`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const req = (imageUrl = IMG) => ({ imageUrl, title: "Batalla", roomTitle: "Carabobo", concepts: ["Páez", "Bolívar"] });

  beforeAll(async () => {
    process.env.PHOTO_DIORAMA_RATE_LIMIT = "1000"; // el límite real se prueba aparte
    server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise((r) => server.close(r)));

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "mus3o-photo-"));
    process.env.IMAGE_CACHE_DIR = join(tmp, "cache");
    process.env.IMAGE_SEED_DIR = join(tmp, "seed");
    process.env.DIORAMA_SEED_DIR = join(tmp, "seed-dioramas");
    process.env.ANTHROPIC_API_KEY = "test-key";
    clearImageCaches();
    resetPhotoDioramaState();
    fake.calls.length = 0;
    fake.reply = () => scene();
    imageCalls = [];
    imageType = "image/jpeg";
    vi.stubGlobal("fetch", (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith(base)) return realFetch(url, init);
      imageCalls.push(url);
      return Promise.resolve(new Response(new Uint8Array([1, 2, 3, 4]), { status: 200, headers: { "content-type": imageType } }));
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
    rmSync(tmp, { recursive: true, force: true });
  });

  it.each([
    ["http", "http://upload.wikimedia.org/a.jpg"],
    ["non-Wikimedia host", "https://evil.example/a.jpg"],
    ["loopback", "https://127.0.0.1/a.jpg"],
    ["cloud metadata", "https://169.254.169.254/latest/meta-data"],
    ["localhost", "https://localhost:3001/api/health"],
    ["file scheme", "file:///etc/passwd"],
    ["userinfo trick", "https://upload.wikimedia.org@evil.example/a.jpg"],
    ["lookalike host", "https://upload.wikimedia.org.evil.example/a.jpg"],
    ["not a url", "no es una url"],
  ])("rejects %s with 400 and never fetches or calls the AI", async (_n, url) => {
    const res = await post(req(url));
    expect(res.status).toBe(400);
    expect(imageCalls).toEqual([]);
    expect(fake.calls).toEqual([]);
  });

  it("rejects malformed bodies", async () => {
    expect((await post({ imageUrl: IMG, extra: 1 })).status).toBe(400);
    expect((await post({})).status).toBe(400);
  });

  it("sends the image as a base64 block with a tool and returns the diorama", async () => {
    const res = await post(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.recreatable).toBe(true);
    expect(body.diorama.backdrop).toBe(BACK);
    expect(fake.calls).toHaveLength(1);
    const call = fake.calls[0];
    expect(call.tools.map((t: { name: string }) => t.name)).toEqual(["recreate_scene"]);
    expect(call.tool_choice).toEqual({ type: "auto" });
    expect(call.model).toBe("claude-sonnet-5-5");
    const content = call.messages[0].content;
    expect(content[0]).toMatchObject({ type: "image", source: { type: "base64", media_type: "image/jpeg" } });
    expect(content[1].text).toContain("<contexto>");
  });

  it("a cache hit does not call the AI or the network again, even after a restart (disk)", async () => {
    await post(req());
    await post(req());
    expect(fake.calls).toHaveLength(1);
    expect(imageCalls).toHaveLength(1);
    resetPhotoDioramaState(); // como un reinicio: solo queda el disco
    const res = await post(req());
    expect(res.headers.get("x-diorama-cache")).toBe("hit");
    expect(fake.calls).toHaveLength(1);
  });

  it("shares one AI call between simultaneous identical requests", async () => {
    const [a, b] = await Promise.all([post(req()), post(req())]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(fake.calls).toHaveLength(1);
  });

  it("passes a non-recreatable classification through and caches it", async () => {
    fake.reply = () => ({ imageKind: "portrait", recreatable: false, reason: "Retrato de un hombre" });
    const body = await (await post(req())).json();
    expect(body).toEqual({ recreatable: false, reason: "Retrato de un hombre" });
    await post(req());
    expect(fake.calls).toHaveLength(1);
  });

  it("skips the AI for SVG images (diagrams)", async () => {
    imageType = "image/svg+xml";
    const body = await (await post(req("https://upload.wikimedia.org/wikipedia/commons/a/ab/Diagrama.svg"))).json();
    expect(body.recreatable).toBe(false);
    expect(fake.calls).toEqual([]);
  });

  it("serves a committed seed without the API key", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await writeSeedDiorama(photoKey(new URL(IMG)), buildPhotoDiorama(scene(), BACK));
    const res = await post(req());
    expect(res.status).toBe(200);
    expect((await res.json()).recreatable).toBe(true);
    expect(imageCalls).toEqual([]);
  });

  it("answers 503 when the AI is not configured and nothing is cached", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect((await post(req())).status).toBe(503);
  });

  it("does not cache AI failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fake.reply = () => {
      throw new Error("boom");
    };
    expect((await post(req())).status).toBe(502);
    fake.reply = () => scene();
    expect((await post(req())).status).toBe(200);
    expect(fake.calls).toHaveLength(2);
  });

  it("caps concurrent AI calls per process", async () => {
    photoTuning.concurrency = 2;
    let running = 0;
    let peak = 0;
    const url = (n: string) => `https://upload.wikimedia.org/wikipedia/commons/a/ab/${n}.jpg`;
    vi.stubGlobal("fetch", async (input: string | URL, init?: RequestInit) => {
      const u = String(input);
      if (u.startsWith(base)) return realFetch(u, init);
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 30));
      running--;
      return new Response(new Uint8Array([1]), { status: 200, headers: { "content-type": "image/jpeg" } });
    });
    const res = await Promise.all(["a", "b", "c", "d", "e"].map((n) => post(req(url(n)))));
    expect(res.every((r) => r.status === 200)).toBe(true);
    expect(peak).toBeLessThanOrEqual(2);
  });
});
