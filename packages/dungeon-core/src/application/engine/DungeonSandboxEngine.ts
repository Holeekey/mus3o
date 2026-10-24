import { DungeonGrid } from "../../domain/entities/DungeonGrid.js";
import { IAgent } from "../../domain/ports/IAgent.js";
import {
  AgentAction,
  Observation,
  Position2D,
  StepResult,
  TileType,
  Vector3D,
} from "../../shared/types.js";

export interface EngineConfig {
  grid: DungeonGrid;
  agent: IAgent;
  initialAgentPosition?: Position2D;
  fovRadius?: number;
  maxSteps?: number;
}

export class DungeonSandboxEngine {
  public readonly grid: DungeonGrid;
  public readonly agent: IAgent;
  public readonly fovRadius: number;
  public readonly maxSteps: number;

  private agentPos: Position2D;
  private hasKeyFlag: boolean = false;
  private currentStep: number = 0;
  private totalDamage: number = 0;
  private isDone: boolean = false;

  constructor(config: EngineConfig) {
    this.grid = config.grid;
    this.agent = config.agent;
    this.agentPos = { ...(config.initialAgentPosition ?? { x: 0, y: 0 }) };
    this.fovRadius = config.fovRadius ?? 2;
    this.maxSteps = config.maxSteps ?? 50;
  }

  public getAgentPosition(): Position2D {
    return { ...this.agentPos };
  }

  public getAgentPosition3D(): Vector3D {
    return this.grid.toVector3D(this.agentPos);
  }

  public hasKey(): boolean {
    return this.hasKeyFlag;
  }

  public getObservation(): Observation {
    const visibleTiles = this.grid.computeFov(this.agentPos, this.fovRadius);
    return {
      position: { ...this.agentPos },
      fovRadius: this.fovRadius,
      visibleTiles,
      hasKey: this.hasKeyFlag,
      currentStep: this.currentStep,
    };
  }

  public step(): StepResult {
    if (this.isDone || this.currentStep >= this.maxSteps) {
      return this.createStepResult("WAIT", 0);
    }

    this.currentStep++;

    // 1. Perceive
    const obs = this.getObservation();
    this.agent.perceive(obs);

    // 2. Decide
    const action = this.agent.decide();

    // 3. Apply Action
    let damageTaken = 0;
    this.applyAction(action);

    // Check tile events on landing
    const currentTile = this.grid.getTile(this.agentPos);
    if (currentTile) {
      if (currentTile.type === "SPIKE_TRAP") {
        damageTaken = 10;
        this.totalDamage += damageTaken;
      } else if (currentTile.type === "CHEST_GOAL") {
        this.isDone = true;
      }
    }

    return this.createStepResult(action, damageTaken);
  }

  private applyAction(action: AgentAction): void {
    let targetX = this.agentPos.x;
    let targetY = this.agentPos.y;

    switch (action) {
      case "MOVE_UP":
        targetY -= 1;
        break;
      case "MOVE_DOWN":
        targetY += 1;
        break;
      case "MOVE_LEFT":
        targetX -= 1;
        break;
      case "MOVE_RIGHT":
        targetX += 1;
        break;
      case "INTERACT":
        this.handleInteract();
        return;
      case "WAIT":
      default:
        return;
    }

    const targetPos: Position2D = { x: targetX, y: targetY };
    const targetTile = this.grid.getTile(targetPos);

    if (!targetTile) return;

    // Check collision / passability
    if (targetTile.isWalkable(this.hasKeyFlag)) {
      this.agentPos = targetPos;

      // Auto-pickup key when stepping on it
      if (targetTile.type === "KEY" && !this.hasKeyFlag) {
        this.hasKeyFlag = true;
        this.grid.setTileType(targetPos, "FLOOR");
      }
    }
  }

  private handleInteract(): void {
    // 1. Check if standing on key
    const currentTile = this.grid.getTile(this.agentPos);
    if (currentTile && currentTile.type === "KEY" && !this.hasKeyFlag) {
      this.hasKeyFlag = true;
      this.grid.setTileType(this.agentPos, "FLOOR");
      return;
    }

    // 2. Check if adjacent to locked door and holding key
    if (this.hasKeyFlag) {
      const neighbors = this.grid.getNeighbors(this.agentPos);
      for (const n of neighbors) {
        const tile = this.grid.getTile(n);
        if (tile && tile.type === "DOOR_LOCKED") {
          this.grid.setTileType(n, "DOOR_OPEN");
          return;
        }
      }
    }
  }

  public runEpisode(): {
    steps: StepResult[];
    completed: boolean;
    totalSteps: number;
    totalDamage: number;
  } {
    const results: StepResult[] = [];

    while (!this.isDone && this.currentStep < this.maxSteps) {
      const res = this.step();
      results.push(res);
      if (res.done) break;
    }

    return {
      steps: results,
      completed: this.isDone,
      totalSteps: this.currentStep,
      totalDamage: this.totalDamage,
    };
  }

  private createStepResult(action: AgentAction, damageTaken: number): StepResult {
    return {
      step: this.currentStep,
      action,
      agentPosition: { ...this.agentPos },
      agentPosition3D: this.getAgentPosition3D(),
      agentState: this.agent.getState(),
      hasKey: this.hasKeyFlag,
      damageTaken,
      totalDamage: this.totalDamage,
      done: this.isDone,
      observation: this.getObservation(),
    };
  }
}
