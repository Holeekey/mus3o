import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { sampleMuseum, type Museum } from "@mus3o/shared";
import { app } from "./app";
import { assetDir } from "./assetStore";
import { isRejected, listReview, recordAssignment, resetReviewState, setStatus } from "./assetReview";
import { hydrateMuseumAssets, type PolyCandidate } from "./polyPizza";

let server: Server;
let base = "";
beforeAll(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());
afterEach(() => {
  delete process.env.ENABLE_DEBUG_ROUTES;
});

const rec = (assetId: string, keyword = "key") =>
  recordAssignment({ keyword, assetId, title: assetId, author: "a", license: "CC0", score: 6, sourceUrl: `https://poly.pizza/m/${assetId}` });

describe("assetReview", () => {
  it("registra asignaciones, acumula palabras y usos, y persiste en disco", async () => {
    await rec("r1", "key");
    await rec("r1", "door key");
    resetReviewState();
    const e = (await listReview()).find((x) => x.assetId === "r1");
    expect(e).toMatchObject({ status: "pending", uses: 2, keywords: ["key", "door key"] });
  });

  it("soporta asignaciones concurrentes sin colisión de archivos temporales", async () => {
    resetReviewState();
    await Promise.all(
      Array.from({ length: 12 }, (_, i) => rec(`concurrent-${i}`, `kw-${i}`))
    );
    const list = await listReview();
    expect(list.filter((x) => x.assetId.startsWith("concurrent-"))).toHaveLength(12);
  });

  it("rechazar borra el .glb y deja el modelo en lista negra", async () => {
    await mkdir(assetDir(), { recursive: true });
    await writeFile(join(assetDir(), "r2.glb"), "glTF");
    await rec("r2");
    expect((await setStatus("r2", "rejected"))?.status).toBe("rejected");
    expect(existsSync(join(assetDir(), "r2.glb"))).toBe(false);
    expect(await isRejected("r2")).toBe(true);
    expect(await setStatus("nope", "approved")).toBeNull();
  });

  it("la hidratación no vuelve a asignar un modelo rechazado", async () => {
    await rec("r3");
    await setStatus("r3", "rejected");
    const c = (id: string): PolyCandidate => ({ id, title: id, author: "a", license: "CC0", downloadUrl: "", score: 6, tris: 0 });
    const museum: Museum = { ...sampleMuseum, rooms: [{ ...sampleMuseum.rooms[0], pieces: [{ ...sampleMuseum.rooms[0].pieces[0], id: "p0", searchKeyword: "key" }] }] };
    const out = await hydrateMuseumAssets(museum, async () => [c("r3"), c("r4")], async (l) => ({ assetId: l[0].id, url: `/api/assets/${l[0].id}.glb`, title: "", author: "", license: "CC0", sourceUrl: "" }));
    expect(out.rooms[0].pieces[0].dynamicAsset?.assetId).toBe("r4");
  });
});

describe("/api/assets-review", () => {
  it("responde 404 sin ENABLE_DEBUG_ROUTES", async () => {
    expect((await fetch(`${base}/api/assets-review`)).status).toBe(404);
  });

  it("lista y cambia el estado con ENABLE_DEBUG_ROUTES", async () => {
    process.env.ENABLE_DEBUG_ROUTES = "true";
    await rec("r5");
    const list = (await (await fetch(`${base}/api/assets-review?status=pending`)).json()) as { assets: { assetId: string }[] };
    expect(list.assets.some((a) => a.assetId === "r5")).toBe(true);
    const ok = await fetch(`${base}/api/assets-review/r5/approve`, { method: "POST" });
    expect(((await ok.json()) as { status: string }).status).toBe("approved");
    expect((await fetch(`${base}/api/assets-review/r5/explode`, { method: "POST" })).status).toBe(400);
    expect((await fetch(`${base}/api/assets-review/zzz/reject`, { method: "POST" })).status).toBe(404);
  });
});
