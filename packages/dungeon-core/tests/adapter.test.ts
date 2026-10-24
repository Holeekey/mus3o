import { describe, it, expect } from "vitest";
import { MuseumSchema } from "@mus3o/shared";
import { DungeonGrid } from "../src/domain/entities/DungeonGrid.js";
import { DungeonPalaceAdapter } from "../src/adapters/DungeonPalaceAdapter.js";
import { TileType } from "../src/shared/types.js";

describe("DungeonPalaceAdapter", () => {
  it("converts a DungeonGrid into a valid Museum schema accepted by apps/web", () => {
    const layout: TileType[][] = [
      ["WALL", "WALL",  "WALL",  "WALL",  "WALL"],
      ["WALL", "FLOOR", "KEY",   "FLOOR", "WALL"],
      ["WALL", "FLOOR", "SPIKE_TRAP", "DOOR_LOCKED", "WALL"],
      ["WALL", "FLOOR", "CHEST_GOAL", "FLOOR", "WALL"],
      ["WALL", "WALL",  "WALL",  "WALL",  "WALL"],
    ];

    const grid = DungeonGrid.fromMatrix(layout, 2.0);
    const museum = DungeonPalaceAdapter.toMuseum(grid, "Test Dungeon Palace");

    // Must validate successfully against shared MuseumSchema
    const validated = MuseumSchema.parse(museum);
    expect(validated.title).toBe("Test Dungeon Palace");
    expect(validated.rooms.length).toBeGreaterThan(0);

    // Verify pieces mapped from special tiles
    const allPieces = validated.rooms.flatMap((r) => r.pieces);
    expect(allPieces.some((p) => p.id.startsWith("key"))).toBe(true);
    expect(allPieces.some((p) => p.id.startsWith("chest"))).toBe(true);
    expect(allPieces.some((p) => p.id.startsWith("trap"))).toBe(true);
    expect(allPieces.some((p) => p.id.startsWith("door"))).toBe(true);
  });
});
