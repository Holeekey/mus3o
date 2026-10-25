import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "./app";
import { resetBudgetForTesting } from "./budgetStore";

const realFetch = globalThis.fetch;
let server: Server;
let base = "";

beforeAll(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());
beforeEach(async () => {
  await resetBudgetForTesting("stt_sessions");
});
afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.ELEVENLABS_API_KEY;
  delete process.env.ELEVENLABS_STT_MODEL;
  delete process.env.MAX_DAILY_STT_SESSIONS;
  vi.restoreAllMocks();
});

const mintToken = () => realFetch(`${base}/api/stt/token`, { method: "POST" });

/** Intercepta solo las llamadas a ElevenLabs; el resto va al servidor real. */
function mockUpstream(handler: (url: string, init: RequestInit) => Response) {
  const upstream = vi.fn(async (url: string, init: RequestInit) => handler(url, init));
  globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) =>
    String(url).startsWith("https://api.elevenlabs.io/") ? upstream(String(url), init as RequestInit) : realFetch(url, init)) as typeof fetch;
  return upstream;
}

describe("/api/stt", () => {
  it("reports disabled and answers 503 without ELEVENLABS_API_KEY", async () => {
    expect(await (await realFetch(`${base}/api/stt/status`)).json()).toEqual({ enabled: false });
    expect((await mintToken()).status).toBe(503);
  });

  it("mints a single-use token, sends the key only upstream and never caches it", async () => {
    process.env.ELEVENLABS_API_KEY = "test-key";
    const upstream = mockUpstream(() => new Response(JSON.stringify({ token: "tok_123" }), { status: 200 }));
    expect(await (await realFetch(`${base}/api/stt/status`)).json()).toEqual({ enabled: true });
    const res = await mintToken();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ token: "tok_123", modelId: "scribe_v2_realtime" });
    const [url, init] = upstream.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.elevenlabs.io/v1/single-use-token/realtime_scribe");
    expect((init.headers as Record<string, string>)["xi-api-key"]).toBe("test-key");
  });

  it("uses ELEVENLABS_STT_MODEL when valid and ignores it when not", async () => {
    process.env.ELEVENLABS_API_KEY = "test-key";
    mockUpstream(() => new Response(JSON.stringify({ token: "t" }), { status: 200 }));
    process.env.ELEVENLABS_STT_MODEL = "scribe_v2_realtime_lite";
    expect(((await (await mintToken()).json()) as { modelId: string }).modelId).toBe("scribe_v2_realtime_lite");
    process.env.ELEVENLABS_STT_MODEL = "../evil?x=1";
    expect(((await (await mintToken()).json()) as { modelId: string }).modelId).toBe("scribe_v2_realtime");
  });

  it("falls back to the browser (502, no provider body) and logs only the error code", async () => {
    process.env.ELEVENLABS_API_KEY = "test-key";
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mockUpstream(() => new Response(JSON.stringify({ detail: { code: "quota_exceeded", message: "secret account detail" } }), { status: 401 }));
    const res = await mintToken();
    expect(res.status).toBe(502);
    const body = await res.text();
    expect(body).toContain("browser");
    expect(body).not.toContain("secret");
    expect(log).toHaveBeenCalledWith("stt token falló: HTTP 401 (quota_exceeded)");
  });

  it("answers 502 when ElevenLabs replies without a token", async () => {
    process.env.ELEVENLABS_API_KEY = "test-key";
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockUpstream(() => new Response(JSON.stringify({}), { status: 200 }));
    expect((await mintToken()).status).toBe(502);
  });

  it("answers 429 with a browser fallback once the daily session cap is reached", async () => {
    process.env.ELEVENLABS_API_KEY = "test-key";
    process.env.MAX_DAILY_STT_SESSIONS = "1";
    mockUpstream(() => new Response(JSON.stringify({ token: "t" }), { status: 200 }));
    expect((await mintToken()).status).toBe(200);
    const res = await mintToken();
    expect(res.status).toBe(429);
    expect(await res.text()).toContain("browser");
  });
});
