import { TileType } from "../../shared/types.js";

export class Tile {
  constructor(
    public readonly type: TileType,
    public readonly x: number,
    public readonly y: number
  ) {}

  public isWalkable(hasKey: boolean = false): boolean {
    switch (this.type) {
      case "WALL":
        return false;
      case "DOOR_LOCKED":
        return hasKey; // Walkable if agent possesses key to unlock
      case "FLOOR":
      case "DOOR_OPEN":
      case "KEY":
      case "SPIKE_TRAP":
      case "CHEST_GOAL":
        return true;
      default:
        return false;
    }
  }

  public getBaseCost(): number {
    switch (this.type) {
      case "FLOOR":
      case "DOOR_OPEN":
      case "KEY":
      case "CHEST_GOAL":
        return 1;
      case "SPIKE_TRAP":
        return 10;
      case "DOOR_LOCKED":
      case "WALL":
      default:
        return Infinity;
    }
  }

  public blocksVision(): boolean {
    return this.type === "WALL" || this.type === "DOOR_LOCKED";
  }
}
