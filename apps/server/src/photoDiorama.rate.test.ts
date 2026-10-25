import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "./app";

describe("rate limit of POST /api/diorama-from-image", () => {
  let server: Server;
  let base: string;
  beforeAll(async () => {
    process.env.PHOTO_DIORAMA_RATE_LIMIT = "3";
    server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise((r) => server.close(r)));

  it("answers 429 over the dedicated limit, without touching the global 10/min one", async () => {
    const post = () => fetch(`${base}/api/diorama-from-image`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await post()).status);
    expect(statuses).toEqual([400, 400, 400, 429, 429]);
  });
});
