import type { Museum, Room, GraphEdge } from "@mus3o/shared";
import { Position2D } from "../shared/types.js";
import { AStarNavigator, CostProvider } from "../application/navigation/AStarNavigator.js";

/**
 * Adaptador que permite navegar el grafo topológico de un palacio/museo
 * usando el algoritmo de búsqueda óptima A* de dungeon-core.
 */

export interface RoomPathResult {
  roomIds: string[];
  distance: number;
  steps: string[];
}

export class PalaceGraphNavigator {
  /**
   * Encuentra la ruta óptima de salas entre startRoomId y goalRoomId
   * recorriendo las aristas y conexiones de puertas del palacio.
   */
  public static findPath(
    museum: Museum,
    startRoomId: string,
    goalRoomId: string
  ): RoomPathResult | null {
    if (startRoomId === goalRoomId) {
      const room = museum.rooms.find((r) => r.id === startRoomId);
      return {
        roomIds: [startRoomId],
        distance: 0,
        steps: [room?.name ?? startRoomId],
      };
    }

    const rooms = museum.rooms;
    const roomMap = new Map<string, Room>();
    const roomIndex = new Map<string, number>();

    rooms.forEach((r, idx) => {
      roomMap.set(r.id, r);
      roomIndex.set(r.id, idx);
    });

    if (!roomMap.has(startRoomId) || !roomMap.has(goalRoomId)) {
      return null;
    }

    // Construir adyacencias bidireccionales del grafo
    const neighbors = new Map<string, Set<string>>();
    rooms.forEach((r) => neighbors.set(r.id, new Set<string>()));

    // 1. Aristas declaradas en el grafo (las conexiones reales; la dirección no importa al caminar)
    let declared = 0;
    for (const edge of museum.graph?.edges ?? []) {
      if (neighbors.has(edge.from) && neighbors.has(edge.to) && edge.from !== edge.to) {
        neighbors.get(edge.from)!.add(edge.to);
        neighbors.get(edge.to)!.add(edge.from);
        declared++;
      }
    }

    // 2. Cadena secuencial solo si el museo no trae aristas utilizables: con grafo real no se inventan conexiones
    if (declared === 0) {
      for (let i = 0; i < rooms.length - 1; i++) {
        neighbors.get(rooms[i].id)!.add(rooms[i + 1].id);
        neighbors.get(rooms[i + 1].id)!.add(rooms[i].id);
      }
    }

    // Mapeo a coordenadas 2D discretas para usar AStarNavigator
    // Coordenada x = índice de sala, y = 0
    // El índice no refleja distancia real (una arista puede saltar varias salas), así que la heurística es 0:
    // admisible, y A* devuelve siempre la ruta más corta.
    const startIndex = roomIndex.get(startRoomId)!;
    const goalIndex = roomIndex.get(goalRoomId)!;

    const indexToId = new Map<number, string>();
    roomIndex.forEach((idx, id) => indexToId.set(idx, id));

    const costProvider: CostProvider = {
      getTileCost: () => 1,
      isWalkable: () => true,
      getNeighbors: (pos: Position2D): Position2D[] => {
        const id = indexToId.get(pos.x);
        if (!id) return [];
        const adj = neighbors.get(id);
        if (!adj) return [];
        const out: Position2D[] = [];
        for (const nId of adj) {
          const nIdx = roomIndex.get(nId);
          if (nIdx !== undefined) {
            out.push({ x: nIdx, y: 0 });
          }
        }
        return out;
      },
    };

    const navigator = new AStarNavigator(costProvider, () => 0);
    const pathPositions = navigator.findPath(
      { x: startIndex, y: 0 },
      { x: goalIndex, y: 0 }
    );

    if (!pathPositions || pathPositions.length === 0) {
      return null;
    }

    const roomIds = pathPositions.map((pos) => indexToId.get(pos.x)!);
    const steps = roomIds.map((id) => roomMap.get(id)?.name ?? id);

    return {
      roomIds,
      distance: roomIds.length - 1,
      steps,
    };
  }

  /**
   * Genera una descripción en lenguaje natural de la ruta para que Aris
   * oriente al usuario en primera persona.
   */
  public static describePath(
    result: RoomPathResult,
    targetName: string
  ): string {
    if (result.distance === 0) {
      return `Ya te encuentras en "${targetName}".`;
    }

    if (result.distance === 1) {
      return `"${targetName}" está justo en la sala contigua. Cruza la compuerta hacia "${result.steps[1]}".`;
    }

    const intermediate = result.steps.slice(1, -1);
    if (intermediate.length === 1) {
      return `Para llegar a "${targetName}", cruza primero hacia "${intermediate[0]}" y luego sigue hacia la compuerta de destino (a 2 salas de distancia).`;
    }

    return `Para llegar a "${targetName}", la ruta óptima pasa por ${intermediate.map((s) => `"${s}"`).join(" y luego por ")} (a ${result.distance} salas de distancia).`;
  }
}
