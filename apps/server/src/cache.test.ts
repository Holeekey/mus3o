import { describe, expect, it } from "vitest";
import { sampleMuseum } from "@mus3o/shared";
import { getCached, setCached } from "./cache";

const museum = (title: string) => ({ ...sampleMuseum, title });

describe("museum cache", () => {
  it("returns what was stored, ignoring case and surrounding spaces", () => {
    setCached("  Roma  ", museum("roma"));
    expect(getCached("roma")?.title).toBe("roma");
  });

  it("evicts the least recently used entry, not the oldest inserted", () => {
    for (let i = 0; i < 100; i++) setCached(`lru-${i}`, museum(`m${i}`));
    // lru-0 es la más antigua, pero se vuelve a pedir: pasa a ser la más reciente.
    expect(getCached("lru-0")).toBeDefined();
    setCached("lru-extra", museum("extra"));
    expect(getCached("lru-0")).toBeDefined();
    expect(getCached("lru-1")).toBeUndefined();
    expect(getCached("lru-extra")).toBeDefined();
  });

  it("does not evict when an existing key is stored again", () => {
    for (let i = 0; i < 100; i++) setCached(`same-${i}`, museum(`m${i}`));
    setCached("same-99", museum("updated"));
    expect(getCached("same-0")).toBeDefined();
    expect(getCached("same-99")?.title).toBe("updated");
  });
});
