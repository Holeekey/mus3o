import { IAgent } from "../../domain/ports/IAgent.js";
import {
  AgentAction,
  AgentStateKind,
  Observation,
  Position2D,
  TileType,
} from "../../shared/types.js";
import { AStarNavigator, CostProvider } from "../navigation/AStarNavigator.js";

export class AutonomousDungeonAgent implements IAgent {
  public readonly id: string;
  private currentPosition: Position2D;
  private hasKeyFlag: boolean = false;
  private state: AgentStateKind = "EXPLORING";
  private readonly exploredMemory = new Map<string, TileType>();

  // Discovered special points of interest
  private keyLocation: Position2D | null = null;
  private lockedDoorLocation: Position2D | null = null;
  private goalLocation: Position2D | null = null;

  // Planned trajectory
  private plannedPath: Position2D[] = [];
  private currentGoalTarget: Position2D | null = null;

  constructor(id: string = "hero-agent", initialPosition: Position2D = { x: 0, y: 0 }) {
    this.id = id;
    this.currentPosition = { ...initialPosition };
  }

  public getPosition(): Position2D {
    return { ...this.currentPosition };
  }

  public hasKey(): boolean {
    return this.hasKeyFlag;
  }

  public getState(): AgentStateKind {
    return this.state;
  }

  public getExploredMemory(): Map<string, TileType> {
    return new Map(this.exploredMemory);
  }

  /**
   * Perceives the environment observation, updates internal Fog of War,
   * detects items of interest and updates agent state machine.
   */
  public perceive(observation: Observation): void {
    this.currentPosition = { ...observation.position };
    this.hasKeyFlag = observation.hasKey;

    // Update explored memory with currently visible tiles
    for (const visible of observation.visibleTiles) {
      const key = this.toKey(visible.position);
      this.exploredMemory.set(key, visible.type);

      if (visible.type === "KEY" && !this.hasKeyFlag) {
        this.keyLocation = { ...visible.position };
      } else if (visible.type === "DOOR_LOCKED") {
        this.lockedDoorLocation = { ...visible.position };
      } else if (visible.type === "DOOR_OPEN" && this.lockedDoorLocation) {
        // Door was unlocked
        if (
          this.lockedDoorLocation.x === visible.position.x &&
          this.lockedDoorLocation.y === visible.position.y
        ) {
          this.lockedDoorLocation = null;
        }
      } else if (visible.type === "CHEST_GOAL") {
        this.goalLocation = { ...visible.position };
      }
    }

    // Evaluate state machine transitions
    this.updateState();
  }

  private updateState(): void {
    const currentTile = this.exploredMemory.get(this.toKey(this.currentPosition));
    if (currentTile === "CHEST_GOAL" || (this.goalLocation && this.isSamePos(this.currentPosition, this.goalLocation))) {
      this.state = "COMPLETED";
      return;
    }

    // Check if we need and can fetch the key
    if (!this.hasKeyFlag && this.keyLocation) {
      this.state = "FETCHING_KEY";
      return;
    }

    // If we have key and there is a locked door blocking progress
    if (this.hasKeyFlag && this.lockedDoorLocation) {
      this.state = "UNLOCKING_DOOR";
      return;
    }

    // If we know the goal and path is open
    if (this.goalLocation) {
      this.state = "REACHING_GOAL";
      return;
    }

    // Otherwise explore frontiers
    this.state = "EXPLORING";
  }

  /**
   * Decides next action based on current state, memory, and pathfinding.
   */
  public decide(): AgentAction {
    if (this.state === "COMPLETED") {
      return "WAIT";
    }

    // If adjacent to locked door and holding key -> UNLOCK (INTERACT)
    if (this.hasKeyFlag && this.lockedDoorLocation) {
      if (this.isAdjacent(this.currentPosition, this.lockedDoorLocation)) {
        return "INTERACT";
      }
    }

    // If standing on key tile -> PICKUP (INTERACT)
    if (this.keyLocation && this.isSamePos(this.currentPosition, this.keyLocation) && !this.hasKeyFlag) {
      return "INTERACT";
    }

    // Determine target based on state
    let target = this.selectTargetForCurrentState();
    if (!target) {
      // Fallback: try frontier exploration
      target = this.findBestFrontier();
    }

    if (!target) {
      this.state = "STUCK";
      return "WAIT";
    }

    // Recompute path if target changed or no path planned
    if (
      !this.currentGoalTarget ||
      !this.isSamePos(this.currentGoalTarget, target) ||
      this.plannedPath.length === 0
    ) {
      this.currentGoalTarget = target;
      this.plannedPath = this.computePathTo(target) ?? [];
    }

    // If we have a planned path, pop current position and take next step
    if (this.plannedPath.length > 0) {
      // Drop start position if path includes it
      if (this.isSamePos(this.plannedPath[0], this.currentPosition)) {
        this.plannedPath.shift();
      }

      if (this.plannedPath.length > 0) {
        const nextPos = this.plannedPath.shift()!;
        return this.directionToAction(this.currentPosition, nextPos);
      }
    }

    return "WAIT";
  }

  public act(): AgentAction {
    return this.decide();
  }

  private selectTargetForCurrentState(): Position2D | null {
    switch (this.state) {
      case "FETCHING_KEY":
        return this.keyLocation;

      case "UNLOCKING_DOOR":
        if (this.lockedDoorLocation) {
          // Target tile adjacent to the door
          return this.findWalkableTileAdjacentTo(this.lockedDoorLocation) ?? this.lockedDoorLocation;
        }
        return null;

      case "REACHING_GOAL":
        return this.goalLocation;

      case "EXPLORING":
      default:
        return this.findBestFrontier();
    }
  }

  /**
   * Finds the best unexplored frontier cell (an unexplored tile adjacent to a known walkable tile).
   */
  private findBestFrontier(): Position2D | null {
    const candidateFrontiers: Position2D[] = [];

    for (const [key, tileType] of this.exploredMemory.entries()) {
      if (tileType === "WALL") continue;

      const [x, y] = key.split(",").map(Number);
      const pos: Position2D = { x, y };

      const neighbors: Position2D[] = [
        { x: pos.x, y: pos.y - 1 },
        { x: pos.x, y: pos.y + 1 },
        { x: pos.x - 1, y: pos.y },
        { x: pos.x + 1, y: pos.y },
      ];

      for (const n of neighbors) {
        const nKey = this.toKey(n);
        if (!this.exploredMemory.has(nKey)) {
          // This known walkable tile pos is adjacent to an unexplored tile
          candidateFrontiers.push(pos);
          break;
        }
      }
    }

    if (candidateFrontiers.length === 0) return null;

    // Pick closest frontier to current position
    let bestFrontier: Position2D | null = null;
    let minDistance = Infinity;

    for (const frontier of candidateFrontiers) {
      const dist = AStarNavigator.manhattanDistance(this.currentPosition, frontier);
      if (dist < minDistance) {
        minDistance = dist;
        bestFrontier = frontier;
      }
    }

    return bestFrontier;
  }

  private findWalkableTileAdjacentTo(target: Position2D): Position2D | null {
    const neighbors: Position2D[] = [
      { x: target.x, y: target.y - 1 },
      { x: target.x, y: target.y + 1 },
      { x: target.x - 1, y: target.y },
      { x: target.x + 1, y: target.y },
    ];

    let closest: Position2D | null = null;
    let minD = Infinity;

    for (const n of neighbors) {
      const tile = this.exploredMemory.get(this.toKey(n));
      if (tile && tile !== "WALL" && tile !== "DOOR_LOCKED") {
        const d = AStarNavigator.manhattanDistance(this.currentPosition, n);
        if (d < minD) {
          minD = d;
          closest = n;
        }
      }
    }

    return closest;
  }

  private computePathTo(goal: Position2D): Position2D[] | null {
    const costProvider: CostProvider = {
      getTileCost: (pos, hasKey) => {
        const tile = this.exploredMemory.get(this.toKey(pos));
        if (!tile) return 1; // Assume standard floor cost for unexplored territory in frontier search
        if (tile === "SPIKE_TRAP") return 10;
        if (tile === "DOOR_LOCKED") return hasKey ? 1 : Infinity;
        if (tile === "WALL") return Infinity;
        return 1;
      },
      isWalkable: (pos, hasKey) => {
        const tile = this.exploredMemory.get(this.toKey(pos));
        if (!tile) return true; // Optimistic exploration
        if (tile === "WALL") return false;
        if (tile === "DOOR_LOCKED") return hasKey;
        return true;
      },
      getNeighbors: (pos) => [
        { x: pos.x, y: pos.y - 1 },
        { x: pos.x, y: pos.y + 1 },
        { x: pos.x - 1, y: pos.y },
        { x: pos.x + 1, y: pos.y },
      ],
    };

    const navigator = new AStarNavigator(costProvider);
    return navigator.findPath(this.currentPosition, goal, this.hasKeyFlag);
  }

  private directionToAction(from: Position2D, to: Position2D): AgentAction {
    if (to.y < from.y) return "MOVE_UP";
    if (to.y > from.y) return "MOVE_DOWN";
    if (to.x < from.x) return "MOVE_LEFT";
    if (to.x > from.x) return "MOVE_RIGHT";
    return "WAIT";
  }

  private isAdjacent(a: Position2D, b: Position2D): boolean {
    return AStarNavigator.manhattanDistance(a, b) === 1;
  }

  private isSamePos(a: Position2D, b: Position2D): boolean {
    return a.x === b.x && a.y === b.y;
  }

  private toKey(pos: Position2D): string {
    return `${pos.x},${pos.y}`;
  }
}
