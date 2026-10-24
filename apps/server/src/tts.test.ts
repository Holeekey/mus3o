import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "./app";

const realFetch = globalThis.fetch;
let server: Server;
let base = "";

beforeAll(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());
afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.ELEVENLABS_API_KEY;
});

const post = (body: unknown) =>
  realFetch(`${base}/api/tts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("/api/tts", () => {
  it("reports disabled and answers 503 without ELEVENLABS_API_KEY", async () => {
    expect(await (await realFetch(`${base}/api/tts/status`)).json()).toEqual({ enabled: false });
    expect((await post({ text: "hola" })).status).toBe(503);
  });

  it("rejects invalid bodies when enabled", async () => {
    process.env.ELEVENLABS_API_KEY = "test-key";
    expect((await post({ text: "" })).status).toBe(400);
    expect((await post({ text: "x".repeat(501) })).status).toBe(400);
    expect((await post({ text: "hola", voice: "otra" })).status).toBe(400);
  });

  it("proxies audio, sends the key only upstream and strips HTML from the text", async () => {
    process.env.ELEVENLABS_API_KEY = "test-key";
    const upstream = vi.fn(async (_url: string, _init: RequestInit) => new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) =>
      String(url).startsWith("https://api.elevenlabs.io/") ? upstream(String(url), init as RequestInit) : realFetch(url, init)) as typeof fetch;
    const res = await post({ text: "Hola <script>alert(1)</script> mundo" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/mpeg");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    const init = (upstream.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)["xi-api-key"]).toBe("test-key");
    expect(String(init.body)).not.toContain("<");
  });

  it("falls back to the browser (502, no provider body) when ElevenLabs fails", async () => {
    process.env.ELEVENLABS_API_KEY = "test-key";
    globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) =>
      String(url).startsWith("https://api.elevenlabs.io/")
        ? Promise.resolve(new Response("secret account detail", { status: 401 }))
        : realFetch(url, init)) as typeof fetch;
    const res = await post({ text: "hola" });
    expect(res.status).toBe(502);
    const body = await res.text();
    expect(body).toContain("browser");
    expect(body).not.toContain("secret");
  });
});
