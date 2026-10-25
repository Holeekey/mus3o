import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PartSchema } from "@mus3o/shared";
import { z } from "zod";
import { normalizeKeyword } from "./library";

// Integridad de la semilla versionada (apps/server/seed/library): lo que se commitea siempre debe poder cargarse y usarse.
const seed = JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../seed/library/index.json"), "utf8")) as {
  id: string;
  kind: string;
  keywords: string[];
  parts?: unknown;
  status: string;
}[];

describe("semilla de la biblioteca propia", () => {
  it("tiene entradas, ids únicos y solo estados válidos", () => {
    expect(seed.length).toBeGreaterThan(50);
    expect(new Set(seed.map((e) => e.id)).size).toBe(seed.length);
    // Las pendientes (aún sin revisar) viven en la semilla, pero la biblioteca solo sirve las aprobadas.
    expect(seed.every((e) => e.status === "approved" || e.status === "pending")).toBe(true);
    expect(seed.filter((e) => e.status === "approved").length).toBeGreaterThan(50);
  });

  it("cada receta tiene partes válidas y palabras clave normalizadas", () => {
    for (const e of seed) {
      expect(e.kind).toBe("recipe");
      expect(z.array(PartSchema).min(1).max(40).safeParse(e.parts).success).toBe(true);
      expect(e.keywords.length).toBeGreaterThan(0);
      for (const k of e.keywords) expect(normalizeKeyword(k)).toBe(k);
    }
  });

  it("no repite palabra clave", () => {
    const all = seed.flatMap((e) => e.keywords);
    expect(new Set(all).size).toBe(all.length);
  });
});
