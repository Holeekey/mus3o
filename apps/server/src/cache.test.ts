import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { sampleMuseum } from "@mus3o/shared";
import { getCached, setCached } from "./cache";

const museum = (title: string) => ({ ...sampleMuseum, title });

// Las pruebas de expulsión miden la LRU en memoria: sin disco para que una lectura no la "repare".
// Una carpeta dentro de un archivo es inválida en todo SO (/dev/null/... en Windows sí se puede crear).
const blocker = join(tmpdir(), "mus3o-no-disk");
writeFileSync(blocker, "");
const withoutDisk = () => {
  const prev = process.env.MUSEUM_CACHE_DIR;
  process.env.MUSEUM_CACHE_DIR = join(blocker, "museums");
  return () => {
    if (prev === undefined) {
      delete process.env.MUSEUM_CACHE_DIR;
    } else {
      process.env.MUSEUM_CACHE_DIR = prev;
    }
  };
};

describe("museum cache", () => {
  it("returns what was stored, ignoring case and surrounding spaces", async () => {
    await setCached("  Roma  ", museum("roma"));
    expect((await getCached("roma"))?.title).toBe("roma");
  });

  it("evicts the least recently used entry, not the oldest inserted", async () => {
    const restore = withoutDisk();
    for (let i = 0; i < 100; i++) await setCached(`lru-${i}`, museum(`m${i}`));
    // lru-0 es la más antigua, pero se vuelve a pedir: pasa a ser la más reciente.
    expect(await getCached("lru-0")).toBeDefined();
    await setCached("lru-extra", museum("extra"));
    expect(await getCached("lru-0")).toBeDefined();
    expect(await getCached("lru-1")).toBeUndefined();
    expect(await getCached("lru-extra")).toBeDefined();
    restore();
  });

  it("does not evict when an existing key is stored again", async () => {
    const restore = withoutDisk();
    for (let i = 0; i < 100; i++) await setCached(`same-${i}`, museum(`m${i}`));
    await setCached("same-99", museum("updated"));
    expect(await getCached("same-0")).toBeDefined();
    expect((await getCached("same-99"))?.title).toBe("updated");
    restore();
  });

  it("survives a restart: reads back from disk, revalidated", async () => {
    await setCached("persist-me", museum("persistido"));
    vi.resetModules();
    const fresh = await import("./cache");
    expect((await fresh.getCached("persist-me"))?.title).toBe("persistido");
    expect(await fresh.getCached("never-stored")).toBeUndefined();
  });

  it("ignores a corrupt or invalid file on disk", async () => {
    const { createHash } = await import("node:crypto");
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const dir = process.env.MUSEUM_CACHE_DIR as string;
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, createHash("sha256").update("broken").digest("hex") + ".json"), '{"title": 3}');
    vi.resetModules();
    const fresh = await import("./cache");
    expect(await fresh.getCached("broken")).toBeUndefined();
  });
});
