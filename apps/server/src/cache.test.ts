import { describe, expect, it, vi } from "vitest";
import { sampleMuseum } from "@mus3o/shared";
import { getCached, setCached } from "./cache";

const museum = (title: string) => ({ ...sampleMuseum, title });

// Las pruebas de expulsión miden la LRU en memoria: sin disco (ruta inválida) para que una lectura no la "repare".
const withoutDisk = () => {
  const prev = process.env.MUSEUM_CACHE_DIR;
  process.env.MUSEUM_CACHE_DIR = "/dev/null/no-disk";
  return () => {
    process.env.MUSEUM_CACHE_DIR = prev;
  };
};

describe("museum cache", () => {
  it("returns what was stored, ignoring case and surrounding spaces", () => {
    setCached("  Roma  ", museum("roma"));
    expect(getCached("roma")?.title).toBe("roma");
  });

  it("evicts the least recently used entry, not the oldest inserted", () => {
    const restore = withoutDisk();
    for (let i = 0; i < 100; i++) setCached(`lru-${i}`, museum(`m${i}`));
    // lru-0 es la más antigua, pero se vuelve a pedir: pasa a ser la más reciente.
    expect(getCached("lru-0")).toBeDefined();
    setCached("lru-extra", museum("extra"));
    expect(getCached("lru-0")).toBeDefined();
    expect(getCached("lru-1")).toBeUndefined();
    expect(getCached("lru-extra")).toBeDefined();
    restore();
  });

  it("does not evict when an existing key is stored again", () => {
    const restore = withoutDisk();
    for (let i = 0; i < 100; i++) setCached(`same-${i}`, museum(`m${i}`));
    setCached("same-99", museum("updated"));
    expect(getCached("same-0")).toBeDefined();
    expect(getCached("same-99")?.title).toBe("updated");
    restore();
  });

  it("survives a restart: reads back from disk, revalidated", async () => {
    setCached("persist-me", museum("persistido"));
    vi.resetModules();
    const fresh = await import("./cache");
    expect(fresh.getCached("persist-me")?.title).toBe("persistido");
    expect(fresh.getCached("never-stored")).toBeUndefined();
  });

  it("ignores a corrupt or invalid file on disk", async () => {
    const { createHash } = await import("node:crypto");
    const { mkdirSync, writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const dir = process.env.MUSEUM_CACHE_DIR as string;
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, createHash("sha256").update("broken").digest("hex") + ".json"), '{"title": 3}');
    vi.resetModules();
    const fresh = await import("./cache");
    expect(fresh.getCached("broken")).toBeUndefined();
  });
});
