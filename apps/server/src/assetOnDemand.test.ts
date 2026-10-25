import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "./app";
import { recordAssignment, resetReviewState } from "./assetReview";
import { assetDir } from "./assetStore";
import { resetPolyBreaker, polyBlocked } from "./polyPizza";
import { rm } from "node:fs/promises";

const GLB = Buffer.concat([Buffer.from("glTF"), Buffer.alloc(64)]);
const realFetch = globalThis.fetch;
let server: Server;
let base = "";
beforeAll(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());
afterEach(async () => {
  vi.unstubAllGlobals();
  resetPolyBreaker();
  resetReviewState();
  await rm(assetDir(), { recursive: true, force: true });
});

/** fetch falso solo para poly.pizza; las peticiones al servidor de la prueba siguen siendo reales. */
function stubPoly(handler: (url: string) => Response | Promise<Response>) {
  vi.stubGlobal("fetch", (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith(base)) return realFetch(input, init);
    return Promise.resolve(handler(url)).then((res) => {
      // Una respuesta real trae la URL final; el código valida que siga en poly.pizza.
      Object.defineProperty(res, "url", { value: url });
      return res;
    });
  });
}
const glbResponse = () => new Response(GLB, { status: 200, headers: { "content-type": "model/gltf-binary" } });
const register = (id: string) => recordAssignment({ keyword: "key", assetId: id, title: id, author: "a", license: "CC0", score: 6, sourceUrl: `https://poly.pizza/m/${id}`, downloadUrl: `https://static.poly.pizza/${id}.glb` });

describe("GET /api/assets/:id.glb descarga bajo demanda", () => {
  it("baja el modelo la primera vez, lo guarda y la segunda lo sirve sin volver a descargar", async () => {
    await register("od1");
    let downloads = 0;
    stubPoly(() => {
      downloads++;
      return glbResponse();
    });
    const first = await fetch(`${base}/api/assets/od1.glb`);
    expect(first.status).toBe(200);
    expect(first.headers.get("content-type")).toBe("model/gltf-binary");
    expect(Buffer.from(await first.arrayBuffer()).length).toBe(GLB.length);
    expect((await fetch(`${base}/api/assets/od1.glb`)).status).toBe(200);
    expect(downloads).toBe(1);
  });

  it("peticiones simultáneas del mismo modelo comparten una sola descarga", async () => {
    await register("od2");
    let downloads = 0;
    stubPoly(async () => {
      downloads++;
      await new Promise((r) => setTimeout(r, 40));
      return glbResponse();
    });
    const results = await Promise.all([1, 2, 3, 4].map(() => fetch(`${base}/api/assets/od2.glb`)));
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200]);
    expect(downloads).toBe(1);
  });

  it("404 si el modelo no está registrado o la descarga falla, sin tumbar el servidor", async () => {
    stubPoly(() => new Response("nope", { status: 404 }));
    expect((await fetch(`${base}/api/assets/nunca.glb`)).status).toBe(404);
    await register("od3");
    expect((await fetch(`${base}/api/assets/od3.glb`)).status).toBe(404);
  });

  it("un bloqueo 403 activa el cortacircuito y las siguientes peticiones ni intentan descargar", async () => {
    await register("od4");
    await register("od5");
    let downloads = 0;
    stubPoly(() => {
      downloads++;
      return new Response("<html>Just a moment</html>", { status: 403, headers: { "content-type": "text/html" } });
    });
    expect((await fetch(`${base}/api/assets/od4.glb`)).status).toBe(404);
    expect(polyBlocked()).toBe(true);
    expect((await fetch(`${base}/api/assets/od5.glb`)).status).toBe(404);
    expect(downloads).toBe(1);
  });
});
