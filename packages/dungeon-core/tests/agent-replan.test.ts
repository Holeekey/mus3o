import { describe, it, expect } from "vitest";
import { AutonomousDungeonAgent } from "../src/application/agent/AutonomousDungeonAgent.js";
import { VisibleTile } from "../src/shared/types.js";

const obs = (position: { x: number; y: number }, visibleTiles: VisibleTile[]) => ({
  position,
  fovRadius: 2,
  visibleTiles,
  hasKey: false,
  currentStep: 0,
});

describe("AutonomousDungeonAgent replanning", () => {
  it("rodea una pared descubierta en vez de seguir el path obsoleto", () => {
    // Pasillo recto en y=1 hasta el cofre en (6,1); hay un desvío por y=2.
    const rows = [
      "WWWWWWWW",
      "WFFFFFCW",
      "WFFFWWWW",
      "WWWWWWWW",
    ];
    const tiles = (overrides: Record<string, VisibleTile["type"]> = {}): VisibleTile[] => {
      const out: VisibleTile[] = [];
      rows.forEach((row, y) =>
        [...row].forEach((ch, x) => {
          const key = `${x},${y}`;
          const base = ch === "W" ? "WALL" : ch === "C" ? "CHEST_GOAL" : "FLOOR";
          out.push({ position: { x, y }, type: overrides[key] ?? (base as VisibleTile["type"]) });
        }),
      );
      return out;
    };

    const agent = new AutonomousDungeonAgent("a", { x: 1, y: 1 });

    // Primera percepción: el camino recto parece libre.
    agent.perceive(obs({ x: 1, y: 1 }, tiles()));
    expect(agent.decide()).toBe("MOVE_RIGHT");

    // Segunda percepción: (2,1) resulta ser pared. El agente debe replanificar.
    agent.perceive(obs({ x: 1, y: 1 }, tiles({ "2,1": "WALL" })));
    expect(agent.decide()).toBe("MOVE_DOWN");
  });
});
