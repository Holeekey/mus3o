import { Position2D, TileType } from "../../shared/types.js";
import { INavigationGraph } from "../../domain/ports/INavigationGraph.js";

export interface CostProvider {
  getTileCost(pos: Position2D, hasKey: boolean): number;
  isWalkable(pos: Position2D, hasKey: boolean): boolean;
  getNeighbors(pos: Position2D): Position2D[];
}

export class AStarNavigator implements INavigationGraph {
  /**
   * `heuristic` es opcional (por defecto Manhattan, válida en rejillas). Para grafos cuyas coordenadas no
   * reflejan la distancia real (p. ej. salas indexadas en una línea) hay que pasar una heurística admisible.
   */
  constructor(
    private readonly costProvider: CostProvider,
    private readonly heuristic: (a: Position2D, b: Position2D) => number = AStarNavigator.manhattanDistance
  ) {}

  public getNeighbors(pos: Position2D): Position2D[] {
    return this.costProvider.getNeighbors(pos);
  }

  public getCost(to: Position2D, hasKey: boolean = false): number {
    return this.costProvider.getTileCost(to, hasKey);
  }

  public static manhattanDistance(a: Position2D, b: Position2D): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  public findPath(
    start: Position2D,
    goal: Position2D,
    hasKey: boolean = false
  ): Position2D[] | null {
    if (start.x === goal.x && start.y === goal.y) {
      return [start];
    }

    const startKey = this.toKey(start);
    const goalKey = this.toKey(goal);

    const openSet = new Set<string>([startKey]);
    const cameFrom = new Map<string, Position2D>();

    const gScore = new Map<string, number>();
    gScore.set(startKey, 0);

    const fScore = new Map<string, number>();
    fScore.set(startKey, this.heuristic(start, goal));

    const positions = new Map<string, Position2D>();
    positions.set(startKey, start);

    while (openSet.size > 0) {
      // Find node in openSet with lowest fScore
      let currentKey = "";
      let lowestF = Infinity;

      for (const key of openSet) {
        const score = fScore.get(key) ?? Infinity;
        if (score < lowestF) {
          lowestF = score;
          currentKey = key;
        }
      }

      if (!currentKey || lowestF === Infinity) {
        break; // No reachable path
      }

      const current = positions.get(currentKey)!;

      if (current.x === goal.x && current.y === goal.y) {
        return this.reconstructPath(cameFrom, current);
      }

      openSet.delete(currentKey);

      const neighbors = this.costProvider.getNeighbors(current);
      for (const neighbor of neighbors) {
        const neighborKey = this.toKey(neighbor);
        positions.set(neighborKey, neighbor);

        const stepCost = this.costProvider.getTileCost(neighbor, hasKey);
        if (!isFinite(stepCost) || !this.costProvider.isWalkable(neighbor, hasKey)) {
          // Allow stepping onto the goal tile even if it has a special entity type, as long as it's not a solid wall
          const isGoal = neighbor.x === goal.x && neighbor.y === goal.y;
          if (!isGoal) continue;
        }

        const tentativeG = (gScore.get(currentKey) ?? Infinity) + stepCost;

        if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
          cameFrom.set(neighborKey, current);
          gScore.set(neighborKey, tentativeG);
          const h = this.heuristic(neighbor, goal);
          fScore.set(neighborKey, tentativeG + h);
          openSet.add(neighborKey);
        }
      }
    }

    return null;
  }

  private reconstructPath(
    cameFrom: Map<string, Position2D>,
    current: Position2D
  ): Position2D[] {
    const totalPath: Position2D[] = [current];
    let currKey = this.toKey(current);

    while (cameFrom.has(currKey)) {
      current = cameFrom.get(currKey)!;
      currKey = this.toKey(current);
      totalPath.unshift(current);
    }

    return totalPath;
  }

  private toKey(pos: Position2D): string {
    return `${pos.x},${pos.y}`;
  }
}
