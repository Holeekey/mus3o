export interface Position2D {
  x: number;
  y: number;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export type TileType =
  | "WALL"
  | "FLOOR"
  | "DOOR_LOCKED"
  | "DOOR_OPEN"
  | "KEY"
  | "SPIKE_TRAP"
  | "CHEST_GOAL";

export type AgentAction =
  | "MOVE_UP"
  | "MOVE_DOWN"
  | "MOVE_LEFT"
  | "MOVE_RIGHT"
  | "INTERACT"
  | "WAIT";

export type AgentStateKind =
  | "EXPLORING"
  | "FETCHING_KEY"
  | "UNLOCKING_DOOR"
  | "REACHING_GOAL"
  | "COMPLETED"
  | "STUCK";

export interface VisibleTile {
  position: Position2D;
  type: TileType;
}

export interface Observation {
  position: Position2D;
  fovRadius: number;
  visibleTiles: VisibleTile[];
  hasKey: boolean;
  currentStep: number;
}

export interface StepResult {
  step: number;
  action: AgentAction;
  agentPosition: Position2D;
  agentPosition3D: Vector3D;
  agentState: AgentStateKind;
  hasKey: boolean;
  damageTaken: number;
  totalDamage: number;
  done: boolean;
  observation: Observation;
}
