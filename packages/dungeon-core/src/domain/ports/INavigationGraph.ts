import { Position2D } from "../../shared/types.js";

export interface INavigationGraph {
  findPath(start: Position2D, goal: Position2D, hasKey?: boolean): Position2D[] | null;
  getNeighbors(pos: Position2D): Position2D[];
  getCost(to: Position2D, hasKey?: boolean): number;
}
