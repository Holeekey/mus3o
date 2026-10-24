import { describe, it, expect } from "vitest";
import { AutonomousDungeonAgent } from "../src/application/agent/AutonomousDungeonAgent.js";
import { DungeonSandboxEngine } from "../src/application/engine/DungeonSandboxEngine.js";
import { DungeonGrid } from "../src/domain/entities/DungeonGrid.js";
import { TileType } from "../src/shared/types.js";

describe("Dungeon Sandbox Headless Episode", () => {
  it("completes a full episode: discovers locked door, retrieves key, unlocks door, and reaches chest in < 40 steps", () => {
    // W = WALL, F = FLOOR, D = DOOR_LOCKED, K = KEY, C = CHEST_GOAL, T = SPIKE_TRAP
    const layout: TileType[][] = [
      ["WALL", "WALL",  "WALL",  "WALL",  "WALL",  "WALL",        "WALL",  "WALL",  "WALL",       "WALL"],
      ["WALL", "FLOOR", "FLOOR", "FLOOR", "WALL",  "WALL",        "WALL",  "WALL",  "WALL",       "WALL"], // Row 1 (Agent starts at 1,1)
      ["WALL", "FLOOR", "FLOOR", "FLOOR", "WALL",  "WALL",        "WALL",  "WALL",  "WALL",       "WALL"], // Row 2
      ["WALL", "FLOOR", "FLOOR", "FLOOR", "FLOOR", "DOOR_LOCKED", "FLOOR", "FLOOR", "CHEST_GOAL", "WALL"], // Row 3 (Corridor to door & chest)
      ["WALL", "FLOOR", "FLOOR", "FLOOR", "WALL",  "WALL",        "WALL",  "WALL",  "WALL",       "WALL"], // Row 4
      ["WALL", "FLOOR", "KEY",   "FLOOR", "WALL",  "WALL",        "WALL",  "WALL",  "WALL",       "WALL"], // Row 5 (Key room)
      ["WALL", "WALL",  "WALL",  "WALL",  "WALL",  "WALL",        "WALL",  "WALL",  "WALL",       "WALL"], // Row 6
    ];

    const grid = DungeonGrid.fromMatrix(layout, 2.0);
    const agent = new AutonomousDungeonAgent("hero-tester", { x: 1, y: 1 });

    const engine = new DungeonSandboxEngine({
      grid,
      agent,
      initialAgentPosition: { x: 1, y: 1 },
      fovRadius: 2,
      maxSteps: 40,
    });

    // Run headless episode
    const episodeResult = engine.runEpisode();

    // 1. Episode must succeed
    expect(episodeResult.completed).toBe(true);

    // 2. Must reach goal in strictly less than 40 steps
    expect(episodeResult.totalSteps).toBeLessThan(40);
    console.log(`Episode completed successfully in ${episodeResult.totalSteps} steps!`);

    // 3. Agent must possess key and door must be open
    expect(engine.hasKey()).toBe(true);
    const doorTile = grid.getTile({ x: 5, y: 3 });
    expect(doorTile?.type).toBe("DOOR_OPEN");

    // 4. Final position must match chest coordinates
    const finalPos = engine.getAgentPosition();
    expect(finalPos).toEqual({ x: 8, y: 3 });

    // 5. 3D coordinates must be exact: (x * tileSize, 0, y * tileSize)
    const finalPos3D = engine.getAgentPosition3D();
    expect(finalPos3D).toEqual({
      x: 8 * 2.0,
      y: 0,
      z: 3 * 2.0,
    });

    // 6. Verify each step has valid 3D coordinates and metadata
    for (const step of episodeResult.steps) {
      expect(step.agentPosition3D.x).toBe(step.agentPosition.x * 2.0);
      expect(step.agentPosition3D.z).toBe(step.agentPosition.y * 2.0);
      expect(step.observation.visibleTiles.length).toBeGreaterThan(0);
    }
  });
});
