import { describe, it, expect } from "vitest";
import { AStarNavigator, CostProvider } from "../src/application/navigation/AStarNavigator.js";
import { DungeonGrid } from "../src/domain/entities/DungeonGrid.js";
import { Position2D, TileType } from "../src/shared/types.js";

function createGridCostProvider(grid: DungeonGrid): CostProvider {
  return {
    getTileCost(pos: Position2D, hasKey: boolean): number {
      const tile = grid.getTile(pos);
      if (!tile) return Infinity;
      if (tile.type === "DOOR_LOCKED") {
        return hasKey ? 1 : Infinity;
      }
      return tile.getBaseCost();
    },
    isWalkable(pos: Position2D, hasKey: boolean): boolean {
      const tile = grid.getTile(pos);
      if (!tile) return false;
      return tile.isWalkable(hasKey);
    },
    getNeighbors(pos: Position2D): Position2D[] {
      return grid.getNeighbors(pos);
    },
  };
}

describe("AStarNavigator", () => {
  it("finds the direct path on open floor", () => {
    const matrix: TileType[][] = [
      ["FLOOR", "FLOOR", "FLOOR"],
      ["FLOOR", "FLOOR", "FLOOR"],
      ["FLOOR", "FLOOR", "FLOOR"],
    ];
    const grid = DungeonGrid.fromMatrix(matrix);
    const navigator = new AStarNavigator(createGridCostProvider(grid));

    const path = navigator.findPath({ x: 0, y: 0 }, { x: 2, y: 2 });
    expect(path).not.toBeNull();
    expect(path!.length).toBe(5); // Start, (1,0), (2,0), (2,1), (2,2) or equivalent 4 steps
    expect(path![0]).toEqual({ x: 0, y: 0 });
    expect(path![path!.length - 1]).toEqual({ x: 2, y: 2 });
  });

  it("avoids wall obstacles", () => {
    // 0: [F, W, F]
    // 1: [F, W, F]
    // 2: [F, F, F]
    const matrix: TileType[][] = [
      ["FLOOR", "WALL", "FLOOR"],
      ["FLOOR", "WALL", "FLOOR"],
      ["FLOOR", "FLOOR", "FLOOR"],
    ];
    const grid = DungeonGrid.fromMatrix(matrix);
    const navigator = new AStarNavigator(createGridCostProvider(grid));

    const path = navigator.findPath({ x: 0, y: 0 }, { x: 2, y: 0 });
    expect(path).not.toBeNull();
    // Must go down around the wall: (0,0) -> (0,1) -> (0,2) -> (1,2) -> (2,2) -> (2,1) -> (2,0)
    expect(path!.some((p) => p.x === 1 && p.y === 0)).toBe(false);
    expect(path!.some((p) => p.x === 1 && p.y === 1)).toBe(false);
  });

  it("chooses a detour to avoid high-cost spike traps", () => {
    // Row 0: F - T - F   (Trap cost = 10, total straight cost = 1 + 10 + 1 = 12)
    // Row 1: F - F - F   (Detour cost = 1 + 1 + 1 + 1 = 4)
    const matrix: TileType[][] = [
      ["FLOOR", "SPIKE_TRAP", "FLOOR"],
      ["FLOOR", "FLOOR",      "FLOOR"],
    ];
    const grid = DungeonGrid.fromMatrix(matrix);
    const navigator = new AStarNavigator(createGridCostProvider(grid));

    const path = navigator.findPath({ x: 0, y: 0 }, { x: 2, y: 0 });
    expect(path).not.toBeNull();

    // The path should detour via row 1 to avoid the trap at (1, 0)
    const steppedOnTrap = path!.some((p) => p.x === 1 && p.y === 0);
    expect(steppedOnTrap).toBe(false);
    expect(path).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 0 },
    ]);
  });

  it("blocks path through locked door without key and allows it with key", () => {
    const matrix: TileType[][] = [
      ["FLOOR", "DOOR_LOCKED", "FLOOR"],
      ["WALL",  "WALL",        "WALL"],
    ];
    const grid = DungeonGrid.fromMatrix(matrix);
    const navigator = new AStarNavigator(createGridCostProvider(grid));

    const pathWithoutKey = navigator.findPath({ x: 0, y: 0 }, { x: 2, y: 0 }, false);
    expect(pathWithoutKey).toBeNull();

    const pathWithKey = navigator.findPath({ x: 0, y: 0 }, { x: 2, y: 0 }, true);
    expect(pathWithKey).not.toBeNull();
    expect(pathWithKey!.length).toBe(3);
  });
});
