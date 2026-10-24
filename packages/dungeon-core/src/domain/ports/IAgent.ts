import { AgentAction, AgentStateKind, Observation, Position2D, TileType } from "../../shared/types.js";

export interface IAgent {
  readonly id: string;
  perceive(observation: Observation): void;
  decide(): AgentAction;
  act(): AgentAction;
  getState(): AgentStateKind;
  getPosition(): Position2D;
  hasKey(): boolean;
  getExploredMemory(): Map<string, TileType>;
}
