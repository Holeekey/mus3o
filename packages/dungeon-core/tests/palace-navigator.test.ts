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
    // r2→r4 empata por r1 (atajo) o r3: la descripción debe nombrar la sala intermedia elegida
    const result = PalaceGraphNavigator.findPath(sampleMuseum, "r2", "r4")!;
    const via = result.steps[1];
    const desc = PalaceGraphNavigator.describePath(result, "Cámara del Trono");
    expect(desc).toContain("Cámara del Trono");
    expect(desc).toContain(via);
  });

  it("devuelve null si una sala no existe en el museo", () => {
    const result = PalaceGraphNavigator.findPath(sampleMuseum, "r1", "inexistente");
    expect(result).toBeNull();
  });

  it("no inventa conexiones entre salas cuando el grafo declara aristas", () => {
    // B y C solo se conectan a través de A (modo education): la ruta B→C pasa por A
    const museum: Museum = {
      title: "Educación",
      rooms: [
        { id: "a", name: "A", description: "", pieces: [] },
        { id: "b", name: "B", description: "", pieces: [] },
        { id: "c", name: "C", description: "", pieces: [] },
      ],
      graph: {
        start: "a",
        edges: [
          { from: "a", to: "b", kind: "prerequisite" },
          { from: "a", to: "c", kind: "prerequisite" },
        ],
      },
    };
    expect(PalaceGraphNavigator.findPath(museum, "b", "c")!.roomIds).toEqual(["b", "a", "c"]);
  });

  it("devuelve la ruta más corta aunque una arista salte varias salas", () => {
    const ids = ["s0", "s1", "s2", "s3", "s4", "s5", "s6"];
    const museum: Museum = {
      title: "Saltos",
      rooms: ids.map((id) => ({ id, name: id, description: "", pieces: [] })),
      graph: {
        start: "s0",
        edges: [
          { from: "s0", to: "s1", kind: "next" },
          { from: "s1", to: "s2", kind: "next" },
          { from: "s2", to: "s3", kind: "next" },
          { from: "s3", to: "s4", kind: "next" },
          { from: "s4", to: "s5", kind: "next" },
          { from: "s5", to: "s6", kind: "next" },
          { from: "s0", to: "s5", kind: "related" },
        ],
      },
    };
    expect(PalaceGraphNavigator.findPath(museum, "s0", "s6")!.distance).toBe(2);
  });

  it("usa la cadena secuencial solo si no hay aristas", () => {
    const museum: Museum = {
      title: "Sin grafo",
      rooms: ["x", "y", "z"].map((id) => ({ id, name: id, description: "", pieces: [] })),
    } as Museum;
    expect(PalaceGraphNavigator.findPath(museum, "x", "z")!.roomIds).toEqual(["x", "y", "z"]);
  });
});
