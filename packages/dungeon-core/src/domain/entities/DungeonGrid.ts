import { Position2D, TileType, Vector3D, VisibleTile } from "../../shared/types.js";
import { Tile } from "./Tile.js";

export interface DungeonGridConfig {
  width: number;
  height: number;
  tileSize?: number;
}

export class DungeonGrid {
  public readonly width: number;
  public readonly height: number;
  public readonly tileSize: number;
  private readonly tiles: Tile[][];

  constructor(config: DungeonGridConfig, initialTiles?: TileType[][]) {
    this.width = config.width;
    this.height = config.height;
    this.tileSize = config.tileSize ?? 2.0;

    this.tiles = Array.from({ length: this.height }, (_, y) =>
      Array.from({ length: this.width }, (_, x) => {
        const type = initialTiles?.[y]?.[x] ?? "FLOOR";
        return new Tile(type, x, y);
      })
    );
  }

  public isInside(pos: Position2D): boolean {
    return pos.x >= 0 && pos.x < this.width && pos.y >= 0 && pos.y < this.height;
  }

  public getTile(pos: Position2D): Tile | undefined {
    if (!this.isInside(pos)) return undefined;
    return this.tiles[pos.y][pos.x];
  }

  public setTileType(pos: Position2D, type: TileType): void {
    if (this.isInside(pos)) {
      this.tiles[pos.y][pos.x] = new Tile(type, pos.x, pos.y);
    }
  }

  public toVector3D(pos: Position2D, heightOffset: number = 0): Vector3D {
    return {
      x: pos.x * this.tileSize,
      y: heightOffset,
      z: pos.y * this.tileSize,
    };
  }

  public getNeighbors(pos: Position2D): Position2D[] {
    const candidates: Position2D[] = [
      { x: pos.x, y: pos.y - 1 }, // UP
      { x: pos.x, y: pos.y + 1 }, // DOWN
      { x: pos.x - 1, y: pos.y }, // LEFT
      { x: pos.x + 1, y: pos.y }, // RIGHT
    ];
    return candidates.filter((c) => this.isInside(c));
  }

  /**
   * Computes visible tiles within Manhattan FOV radius r.
   * Checks line of sight along the grid.
   */
  public computeFov(origin: Position2D, radius: number = 2): VisibleTile[] {
    const visible: VisibleTile[] = [];

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > radius) continue;

        const target: Position2D = { x: origin.x + dx, y: origin.y + dy };
        if (!this.isInside(target)) continue;

        // Line-of-sight check
        if (this.hasLineOfSight(origin, target)) {
          const tile = this.getTile(target);
          if (tile) {
            visible.push({ position: target, type: tile.type });
          }
        }
      }
    }

    return visible;
  }

  private hasLineOfSight(start: Position2D, end: Position2D): boolean {
    if (start.x === end.x && start.y === end.y) return true;

    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    const sx = start.x < end.x ? 1 : -1;
    const sy = start.y < end.y ? 1 : -1;
    let err = dx - dy;

    let curX = start.x;
    let curY = start.y;

    while (curX !== end.x || curY !== end.y) {
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        curX += sx;
      }
      if (e2 < dx) {
        err += dx;
        curY += sy;
      }

      if (curX === end.x && curY === end.y) break;

      const intermediate = this.getTile({ x: curX, y: curY });
      if (intermediate && intermediate.blocksVision()) {
        return false;
      }
    }

    return true;
  }

  public toMatrix(): TileType[][] {
    return this.tiles.map((row) => row.map((t) => t.type));
  }

  public toJSON(): object {
    return {
      width: this.width,
      height: this.height,
      tileSize: this.tileSize,
      matrix: this.toMatrix(),
    };
  }

  public static fromMatrix(matrix: TileType[][], tileSize: number = 2.0): DungeonGrid {
    const height = matrix.length;
    const width = matrix[0]?.length ?? 0;
    return new DungeonGrid({ width, height, tileSize }, matrix);
  }
}
