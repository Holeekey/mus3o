import { DungeonGrid, DungeonPalaceAdapter, type TileType } from "@mus3o/dungeon-core";

const W: TileType = "WALL";
const F: TileType = "FLOOR";
const K: TileType = "KEY";
const D: TileType = "DOOR_LOCKED";
const S: TileType = "SPIKE_TRAP";
const C: TileType = "CHEST_GOAL";

// Mazmorra de muestra para probar el adaptador en la escena (?demo=dungeon).
const layout: TileType[][] = [
  [W, W, W, W, W, W, W, W, W],
  [W, F, F, F, W, K, F, F, W],
  [W, F, W, F, W, F, W, S, W],
  [W, F, W, F, F, F, W, F, W],
  [W, F, F, W, W, D, W, F, W],
  [W, W, F, F, S, F, F, F, W],
  [W, F, F, W, W, W, W, F, W],
  [W, F, W, F, F, F, F, C, W],
  [W, W, W, W, W, W, W, W, W],
];

export const dungeonDemoMuseum = DungeonPalaceAdapter.toMuseum(DungeonGrid.fromMatrix(layout, 2), "Mazmorra de la Memoria");
