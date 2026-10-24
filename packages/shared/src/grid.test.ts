import { describe, expect, it } from "vitest";
import { planRoomGrid, type RoomGridPlan } from "./grid";
import type { Graph, Museum } from "./schema";

function museum(ids: string[], graph?: Graph): Museum {
  return {
    title: "Test",
    rooms: ids.map((id) => ({ id, name: id, description: "", pieces: [] })),
    ...(graph ? { graph } : {}),
  };
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => `r${i}`);

const adjacent = (plan: RoomGridPlan, a: string, b: string) => {
  const p = plan.cells[a];
  const q = plan.cells[b];
  return Math.abs(p.row - q.row) + Math.abs(p.col - q.col) === 1;
};

function expectValidPlan(plan: RoomGridPlan, roomIds: string[]) {
  // Una sala por celda.
  const occupied = roomIds.map((id) => `${plan.cells[id].row},${plan.cells[id].col}`);
  expect(new Set(occupied).size).toBe(roomIds.length);
  // Cada puerta une salas vecinas en la grilla.
  for (const { from, to } of plan.links) expect(adjacent(plan, from, to)).toBe(true);
  // Todas las salas se alcanzan desde start caminando por las puertas.
  const seen = new Set([plan.start]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const { from, to } of plan.links) {
      if (seen.has(from) !== seen.has(to)) {
        seen.add(from);
        seen.add(to);
        grew = true;
      }
    }
  }
  expect([...seen].sort()).toEqual([...roomIds].sort());
  // Celdas normalizadas: la fila y la columna mínimas son 0.
  expect(Math.min(...roomIds.map((id) => plan.cells[id].row))).toBe(0);
  expect(Math.min(...roomIds.map((id) => plan.cells[id].col))).toBe(0);
}

describe("planRoomGrid without graph", () => {
  it("keeps the serpentine order and links consecutive rooms", () => {
    const plan = planRoomGrid(museum(ids(5)));
    expect(plan.start).toBe("r0");
    expect(plan.cells).toEqual({
      r0: { row: 0, col: 0 },
      r1: { row: 0, col: 1 },
      r2: { row: 0, col: 2 },
      r3: { row: 1, col: 2 },
      r4: { row: 1, col: 1 },
    });
    expect(plan.links).toEqual([
      { from: "r0", to: "r1" },
      { from: "r1", to: "r2" },
      { from: "r2", to: "r3" },
      { from: "r3", to: "r4" },
    ]);
  });

  it("handles a single room", () => {
    expect(planRoomGrid(museum(["solo"]))).toEqual({
      start: "solo",
      cells: { solo: { row: 0, col: 0 } },
      links: [],
    });
  });
});

describe("planRoomGrid with graph", () => {
  it("starts at graph.start and follows the next chain, not the rooms order", () => {
    const graph: Graph = {
      start: "c",
      edges: [
        { from: "c", to: "a", kind: "next" },
        { from: "a", to: "b", kind: "next" },
      ],
    };
    const plan = planRoomGrid(museum(["a", "b", "c"], graph));
    expect(plan.start).toBe("c");
    expect(plan.links).toEqual([
      { from: "c", to: "a" },
      { from: "a", to: "b" },
    ]);
    expectValidPlan(plan, ["a", "b", "c"]);
  });

  it("lays out a hub with more children than free sides", () => {
    const children = ids(8).slice(1);
    const graph: Graph = {
      start: "r0",
      edges: children.map((to) => ({ from: "r0", to, kind: "related" as const })),
    };
    const plan = planRoomGrid(museum(ids(8), graph));
    expect(plan.links).toHaveLength(7);
    expectValidPlan(plan, ids(8));
    // Las 4 primeras ramas quedan pegadas al hub.
    expect(children.slice(0, 4).every((id) => adjacent(plan, "r0", id))).toBe(true);
  });

  it("creates one door per pair even with repeated next and prerequisite edges", () => {
    const graph: Graph = {
      start: "a",
      edges: [
        { from: "a", to: "b", kind: "next" },
        { from: "b", to: "c", kind: "next" },
        { from: "a", to: "b", kind: "prerequisite" },
        { from: "b", to: "c", kind: "prerequisite" },
      ],
    };
    const plan = planRoomGrid(museum(["a", "b", "c"], graph));
    expect(plan.links).toEqual([
      { from: "a", to: "b" },
      { from: "b", to: "c" },
    ]);
  });

  it("only uses tree edges as doors and skips the extra ones", () => {
    const graph: Graph = {
      start: "a",
      edges: [
        { from: "a", to: "b", kind: "next" },
        { from: "b", to: "c", kind: "next" },
        { from: "c", to: "a", kind: "related" },
      ],
    };
    const plan = planRoomGrid(museum(["a", "b", "c"], graph));
    expect(plan.links).toHaveLength(2);
    expectValidPlan(plan, ["a", "b", "c"]);
  });

  it("produces a valid plan for every tree shape up to 8 rooms", () => {
    // Árbol pseudoaleatorio determinista: el padre de i es alguna sala anterior.
    for (let n = 1; n <= 8; n++) {
      for (let seed = 0; seed < 25; seed++) {
        const edges = ids(n)
          .slice(1)
          .map((to, k) => ({ from: `r${(seed * 7 + k * 3) % (k + 1)}`, to, kind: "related" as const }));
        const plan = planRoomGrid(museum(ids(n), { start: "r0", edges }));
        expect(plan.links).toHaveLength(n - 1);
        expectValidPlan(plan, ids(n));
      }
    }
  });

  it("is deterministic", () => {
    const graph: Graph = { start: "r2", edges: ids(6).filter((id) => id !== "r2").map((to) => ({ from: "r2", to, kind: "related" as const })) };
    expect(planRoomGrid(museum(ids(6), graph))).toEqual(planRoomGrid(museum(ids(6), graph)));
  });
});
