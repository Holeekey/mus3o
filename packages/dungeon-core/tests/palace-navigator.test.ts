import { describe, it, expect } from "vitest";
import type { Museum } from "@mus3o/shared";
import { PalaceGraphNavigator } from "../src/adapters/PalaceGraphNavigator.js";

describe("PalaceGraphNavigator (A* on Museum Graph)", () => {
  const sampleMuseum: Museum = {
    title: "Palacio de Prueba",
    rooms: [
      { id: "r1", name: "Vestíbulo", description: "", pieces: [] },
      { id: "r2", name: "Galería de Arte", description: "", pieces: [] },
      { id: "r3", name: "Sala de Armas", description: "", pieces: [] },
      { id: "r4", name: "Cámara del Trono", description: "", pieces: [] },
    ],
    graph: {
      start: "r1",
      edges: [
        { from: "r1", to: "r2", kind: "next" },
        { from: "r2", to: "r3", kind: "next" },
        { from: "r3", to: "r4", kind: "next" },
        { from: "r1", to: "r4", kind: "related" }, // Atajo directo r1 -> r4
      ],
    },
  };

  it("encuentra la ruta más corta usando el atajo A* entre r1 y r4", () => {
    const result = PalaceGraphNavigator.findPath(sampleMuseum, "r1", "r4");
    expect(result).not.toBeNull();
    // Gracias al atajo r1 -> r4, la distancia es 1 sala en lugar de 3
    expect(result!.distance).toBe(1);
    expect(result!.roomIds).toEqual(["r1", "r4"]);
  });

  it("calcula la ruta paso a paso cuando no hay atajo directo", () => {
    const result = PalaceGraphNavigator.findPath(sampleMuseum, "r2", "r4");
    expect(result).not.toBeNull();
    expect(result!.distance).toBe(2);
    expect(result!.roomIds).toHaveLength(3);
    expect(result!.roomIds[0]).toBe("r2");
    expect(result!.roomIds[2]).toBe("r4");
  });

  it("describe la ruta en lenguaje natural para Aris", () => {
    const result = PalaceGraphNavigator.findPath(sampleMuseum, "r2", "r4")!;
    const desc = PalaceGraphNavigator.describePath(result, "Cámara del Trono");
    expect(desc).toContain("Cámara del Trono");
    expect(desc).toContain("Sala de Armas");
  });

  it("devuelve null si una sala no existe en el museo", () => {
    const result = PalaceGraphNavigator.findPath(sampleMuseum, "r1", "inexistente");
    expect(result).toBeNull();
  });
});
