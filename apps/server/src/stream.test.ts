import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  MuseumSchema,
  MuseumStreamEventSchema,
  parseMus3oDSL,
  repairAndSanitizeMuseum,
  type MuseumStreamEvent,
} from "@mus3o/shared";
import { app } from "./app";
import { enrichMuseum, setTextStreamerForTests, type TextStreamer } from "./claude";
import { streamNewMuseum } from "./stream";

const DSL = [
  "ROOM: r1 | Arquitectura Von Neumann | cathedral | #1a1b26 | #16161e | crystal |",
  "PIECE: CPU | cpu | Un corazón de silicio palpitando en el centro de la sala",
  "PIECE: ALU | octahedron | Una calculadora dorada con engranajes flotantes",
  "",
  "ROOM: r2 | Jerarquía de Memoria | cyberpunk | #00ffcc | #050515 | torus | r1",
  "PIECE: Caché L1 | box | Un rayo congelado que alimenta a la CPU",
  "",
  "ROOM: r3 | Buses y E/S | organic | #10b981 | #064e3b | ring_system | r2",
  "PIECE: Bus de datos | torus | Una autopista de luz",
].join("\n");

const NOTES = "La CPU ejecuta instrucciones.\nLa ALU realiza operaciones aritméticas.\nLa caché L1 es la memoria más rápida.\nEl bus de datos transporta información.";

const chunked = (text: string, size = 11) => text.match(new RegExp(`[\\s\\S]{1,${size}}`, "g")) ?? [];

/** Streamer falso: entrega el texto en trozos que cortan líneas por la mitad. */
const fakeStreamer = (text = DSL, calls = { n: 0 }): TextStreamer =>
  async function* () {
    calls.n++;
    for (const c of chunked(text)) yield c;
  };

async function collect(gen: AsyncIterable<MuseumStreamEvent>) {
  const out: MuseumStreamEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

describe("streamNewMuseum", () => {
  const live = (signal = new AbortController().signal) => ({ signal });

  it("emits meta, one room per ROOM block and the full museum, in order (topic)", async () => {
    const events = await collect(streamNewMuseum({ topic: "Computadores" }, { streamText: fakeStreamer(), ...live() }));
    expect(events.map((e) => e.type)).toEqual(["meta", "room", "room", "room", "done"]);
    expect(events[0]).toEqual({ type: "meta", title: "Computadores" });
    events.forEach((e) => expect(MuseumStreamEventSchema.safeParse(e).success).toBe(true));
    const rooms = events.flatMap((e) => (e.type === "room" ? [e.room] : []));
    expect(rooms.map((r) => r.id)).toEqual(["r1", "r2", "r3"]);
    // Cada sala llega ya enriquecida, igual que en la respuesta sin streaming.
    for (const room of rooms) {
      expect(room.imageSearch?.wikiTitle).toBe(room.name);
      expect(room.pieces.every((p) => p.imageSearch)).toBe(true);
    }
  });

  it("final museum equals what the non-streaming path would build from the same text", async () => {
    const events = await collect(streamNewMuseum({ topic: "Computadores" }, { streamText: fakeStreamer(), ...live() }));
    const done = events[events.length - 1];
    if (done.type !== "done") throw new Error("sin done");
    const reference = enrichMuseum(repairAndSanitizeMuseum(parseMus3oDSL(DSL, { title: "Computadores" })));
    expect(done.museum).toEqual(reference);
    expect(MuseumSchema.safeParse(done.museum).success).toBe(true);
    // Las salas emitidas son exactamente las del museo final.
    const rooms = events.flatMap((e) => (e.type === "room" ? [e.room] : []));
    expect(done.museum.rooms).toEqual(rooms);
  });

  it("notes mode: title comes with the first room, sources are attached per room, hash on the museum", async () => {
    const events = await collect(streamNewMuseum({ notes: NOTES }, { streamText: fakeStreamer(), ...live() }));
    expect(events.map((e) => e.type)).toEqual(["meta", "room", "room", "room", "done"]);
    expect(events[0]).toEqual({ type: "meta", title: "Arquitectura Von Neumann" });
    const done = events[events.length - 1];
    if (done.type !== "done") throw new Error("sin done");
    const reference = enrichMuseum(repairAndSanitizeMuseum(parseMus3oDSL(DSL)), NOTES);
    expect(done.museum).toEqual(reference);
    expect(done.museum.sourceTextHash).toBeDefined();
    const first = events[1];
    if (first.type !== "room") throw new Error("sin sala");
    expect(first.room.pieces.some((p) => p.source || p.unverified)).toBe(true);
  });

  it("renames duplicated room ids so the final museum stays valid", async () => {
    const dup = DSL.replace("ROOM: r2 ", "ROOM: r1 ").replace("| r1\n", "|\n");
    const events = await collect(streamNewMuseum({ topic: "T" }, { streamText: fakeStreamer(dup), ...live() }));
    const done = events[events.length - 1];
    if (done.type !== "done") throw new Error("sin done");
    expect(done.museum.rooms.map((r) => r.id)).toEqual(["r1", "r1-2", "r3"]);
    expect(MuseumSchema.safeParse(done.museum).success).toBe(true);
  });

  it("stops asking the model once the room cap is reached", async () => {
    let consumed = 0;
    const many = Array.from({ length: 12 }, (_, i) => `ROOM: s${i} | Sala ${i} | void | #fff | #000 | torus |\nPIECE: X${i} | box | c`).join("\n");
    const streamer: TextStreamer = async function* () {
      for (const line of many.split("\n")) {
        consumed++;
        yield line + "\n";
      }
    };
    const events = await collect(streamNewMuseum({ topic: "T" }, { streamText: streamer, ...live() }));
    expect(events.filter((e) => e.type === "room")).toHaveLength(8);
    expect(consumed).toBeLessThan(24);
  });

  it("falls back to the JSON parser when the model ignores the DSL", async () => {
    const json = JSON.stringify(parseMus3oDSL(DSL, { title: "J" }));
    const events = await collect(streamNewMuseum({ topic: "J" }, { streamText: fakeStreamer(json), ...live() }));
    expect(events.map((e) => e.type)).toEqual(["meta", "room", "room", "room", "done"]);
  });

  it("emits an error event (not an exception) when the model fails midway, after the rooms already built", async () => {
    const streamer: TextStreamer = async function* () {
      yield* chunked(DSL.slice(0, DSL.indexOf("ROOM: r3")));
      throw new Error("conexión rota");
    };
    const events = await collect(streamNewMuseum({ topic: "T" }, { streamText: streamer, ...live() }));
    // r2 nunca se cerró (no llegó su fin), solo r1 se emitió.
    expect(events.map((e) => e.type)).toEqual(["meta", "room", "error"]);
    const err = events[events.length - 1];
    expect(err.type === "error" && err.message).toBe("No se pudo generar el mus3o");
    expect(JSON.stringify(err)).not.toContain("conexión");
  });

  it("emits nothing more after the signal aborts", async () => {
    const ac = new AbortController();
    const streamer: TextStreamer = async function* () {
      yield* chunked(DSL.slice(0, DSL.indexOf("ROOM: r2") + 8));
      ac.abort();
      yield "x";
    };
    const events = await collect(streamNewMuseum({ topic: "T" }, { streamText: streamer, signal: ac.signal }));
    expect(events.some((e) => e.type === "done" || e.type === "error")).toBe(false);
  });
});

describe("POST /api/generate-museum/stream", () => {
  let server: Server;
  let base = "";
  const savedKey = process.env.ANTHROPIC_API_KEY;
  const savedDelay = process.env.STREAM_REPLAY_DELAY_MS;

  beforeAll(async () => {
    server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => {
    server.close();
    if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = savedKey;
    if (savedDelay === undefined) delete process.env.STREAM_REPLAY_DELAY_MS;
    else process.env.STREAM_REPLAY_DELAY_MS = savedDelay;
  });
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.STREAM_REPLAY_DELAY_MS = "0";
  });
  afterEach(() => setTextStreamerForTests(null));

  const post = (body: unknown, signal?: AbortSignal) =>
    fetch(`${base}/api/generate-museum/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });

  /** Lee el cuerpo NDJSON línea a línea según llega. */
  async function* lines(res: Response): AsyncGenerator<MuseumStreamEvent> {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (line) yield MuseumStreamEventSchema.parse(JSON.parse(line));
      }
    }
  }

  it("answers application/x-ndjson and flushes each event as soon as it exists", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const streamer: TextStreamer = async function* () {
      // Primero solo la sala 1 completa y el comienzo de la 2; el resto espera a que el cliente haya leído.
      yield DSL.slice(0, DSL.indexOf("ROOM: r2") + 6);
      await gate;
      yield DSL.slice(DSL.indexOf("ROOM: r2") + 6);
    };
    setTextStreamerForTests(streamer);
    const res = await post({ topic: "Flush streaming" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");
    expect(res.headers.get("cache-control")).toContain("no-transform");

    const seen: string[] = [];
    for await (const event of lines(res)) {
      seen.push(event.type);
      // La sala 1 llegó mientras el modelo seguía escribiendo (la compuerta aún está cerrada).
      if (event.type === "room" && seen.filter((t) => t === "room").length === 1) release();
    }
    expect(seen).toEqual(["meta", "room", "room", "room", "done"]);
  });

  it("aborts the model stream when the client disconnects", async () => {
    let started!: () => void;
    const ready = new Promise<void>((r) => (started = r));
    let aborted!: () => void;
    const wasAborted = new Promise<void>((r) => (aborted = r));
    const streamer: TextStreamer = async function* ({ signal }) {
      yield DSL.slice(0, DSL.indexOf("ROOM: r2") + 6);
      started();
      try {
        await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
        yield "nunca se envía";
      } finally {
        if (signal.aborted) aborted();
      }
    };
    setTextStreamerForTests(streamer);
    const ac = new AbortController();
    const res = await post({ topic: "Cliente que se va" }, ac.signal);
    const reader = lines(res);
    await reader.next(); // meta
    await ready;
    ac.abort();
    await expect(Promise.race([wasAborted, new Promise((_, rej) => setTimeout(() => rej(new Error("no se abortó")), 3000))])).resolves.toBeUndefined();
  });

  it("replays a cached museum room by room without calling the model again", async () => {
    const calls = { n: 0 };
    setTextStreamerForTests(fakeStreamer(DSL, calls));
    const first = await collect(lines(await post({ topic: "Cache replay" })));
    expect(calls.n).toBe(1);
    const second = await collect(lines(await post({ topic: "Cache replay" })));
    expect(calls.n).toBe(1);
    expect(second.map((e) => e.type)).toEqual(["meta", "room", "room", "room", "done"]);
    expect(second).toEqual(first);
  });

  it("keeps the rooms built and does not cache when the model fails midway", async () => {
    const calls = { n: 0 };
    const streamer: TextStreamer = async function* () {
      calls.n++;
      yield* chunked(DSL.slice(0, DSL.indexOf("ROOM: r3")));
      throw new Error("boom");
    };
    setTextStreamerForTests(streamer);
    const events = await collect(lines(await post({ topic: "Falla a medias" })));
    expect(events.map((e) => e.type)).toEqual(["meta", "room", "error"]);
    await collect(lines(await post({ topic: "Falla a medias" })));
    expect(calls.n).toBe(2);
  });

  it("rejects invalid bodies before streaming", async () => {
    const res = await post({ nope: true });
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("answers 503 for notes when the AI is not configured", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await post({ notes: NOTES });
    expect(res.status).toBe(503);
  });
});
