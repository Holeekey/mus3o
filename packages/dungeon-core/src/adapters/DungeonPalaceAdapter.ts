import type { Museum, Piece, Room } from "@mus3o/shared";
import { DungeonGrid } from "../domain/entities/DungeonGrid.js";
import { TileType } from "../shared/types.js";

export class DungeonPalaceAdapter {
  /**
   * Adapts a headless DungeonGrid into a visual Museum representation
   * compatible with the 3D palace scene in apps/web.
   */
  public static toMuseum(
    grid: DungeonGrid,
    title: string = "Mazmorra de la Memoria"
  ): Museum {
    const pieces: Piece[] = [];
    const placed: { piece: Piece; x: number; y: number }[] = [];
    const matrix = grid.toMatrix();

    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const type = matrix[y][x];
        const piece = this.tileToPiece(type, x, y, grid.tileSize);
        if (piece) {
          pieces.push(piece);
          placed.push({ piece, x, y });
        }
      }
    }

    // Cámara 1: lo alcanzable desde el inicio sin cruzar compuertas. Cámara 2: lo que queda tras ellas.
    const reachable = this.reachableFromStart(matrix);
    const chamber1Pieces = placed.filter((p) => reachable.has(`${p.x},${p.y}`)).map((p) => p.piece);
    const chamber2Pieces = placed.filter((p) => !reachable.has(`${p.x},${p.y}`)).map((p) => p.piece);

    const rooms: Room[] = [];

    if (chamber1Pieces.length > 0 && chamber2Pieces.length > 0) {
      rooms.push({
        id: "chamber-1",
        name: "Cámara 1: Entrada y Llave",
        description: "Primera sección de la mazmorra. Explora el entorno y recupera la llave.",
        pieces: chamber1Pieces,
      });

      rooms.push({
        id: "chamber-2",
        name: "Cámara 2: Santuario del Cofre",
        description: "Cámara sellada tras la compuerta que resguarda el cofre del conocimiento.",
        pieces: chamber2Pieces,
      });
    } else {
      const chunkSize = Math.max(1, Math.ceil(pieces.length / 2));
      for (let i = 0; i < Math.max(pieces.length, 1); i += chunkSize) {
        const roomPieces = pieces.slice(i, i + chunkSize);
        const roomIndex = rooms.length + 1;
        rooms.push({
          id: `chamber-${roomIndex}`,
          name: `Cámara ${roomIndex}: ${roomIndex === 1 ? "Entrada y Llave" : "Santuario del Cofre"}`,
          description: `Sector ${roomIndex} del laberinto procedural.`,
          pieces: roomPieces,
        });
      }
    }

    // If no interactive pieces found, ensure at least one placeholder piece
    if (rooms[0].pieces.length === 0) {
      rooms[0].pieces.push({
        id: "start-marker",
        title: "Punto de Partida",
        text: "Aquí inicia la exploración del agente autónomo.",
        fact: "Generado matemáticamente mediante coordenadas cartesianas.",
        position: [0, 1, 0],
        model: { type: "glyph", shape: "box" },
      });
    }

    return {
      title,
      theme: {
        palette: ["#2d3748", "#4a5568", "#ecc94b", "#e53e3e", "#cbd5e0"],
        ambience: "Piedra húmeda, antorchas tenues y ecos de mazmorra",
      },
      rooms: rooms.slice(0, 8),
    };
  }

  /**
   * Flood fill desde la primera celda transitable (orden fila-mayor), sin cruzar muros
   * ni compuertas cerradas. Devuelve las coordenadas "x,y" alcanzables.
   */
  private static reachableFromStart(matrix: TileType[][]): Set<string> {
    const passable = (t: TileType) => t !== "WALL" && t !== "DOOR_LOCKED";
    const reached = new Set<string>();

    let start: [number, number] | null = null;
    for (let y = 0; y < matrix.length && !start; y++) {
      for (let x = 0; x < matrix[y].length && !start; x++) {
        if (passable(matrix[y][x])) start = [x, y];
      }
    }
    if (!start) return reached;

    const queue: [number, number][] = [start];
    reached.add(`${start[0]},${start[1]}`);
    while (queue.length > 0) {
      const [x, y] = queue.shift()!;
      for (const [nx, ny] of [[x, y - 1], [x, y + 1], [x - 1, y], [x + 1, y]]) {
        const key = `${nx},${ny}`;
        if (ny < 0 || ny >= matrix.length || nx < 0 || nx >= matrix[ny].length) continue;
        if (reached.has(key) || !passable(matrix[ny][nx])) continue;
        reached.add(key);
        queue.push([nx, ny]);
      }
    }
    return reached;
  }

  private static tileToPiece(
    type: TileType,
    x: number,
    y: number,
    tileSize: number
  ): Piece | null {
    const pos3D: [number, number, number] = [x * tileSize, 1, y * tileSize];

    switch (type) {
      case "KEY":
        return {
          id: `key-${x}-${y}`,
          title: "Llave de Hierro",
          text: "Llave forjada requerida para abrir la compuerta de la mazmorra.",
          fact: "El agente busca este objetivo al toparse con una compuerta cerrada.",
          position: pos3D,
          model: { type: "catalog", id: "dungeon_key" },
        };

      case "CHEST_GOAL":
        return {
          id: `chest-${x}-${y}`,
          title: "Cofre del Conocimiento",
          text: "Meta final que contiene la información consolidada.",
          fact: "Alcanzar este punto concluye exitosamente el recorrido mnemotécnico.",
          position: pos3D,
          model: { type: "catalog", id: "dungeon_chest" },
        };

      case "SPIKE_TRAP":
        return {
          id: `trap-${x}-${y}`,
          title: "Trampa de Púas",
          text: "Obstáculo con coste de paso 10 que el agente intenta sortear.",
          fact: "A* evalúa si el desvío es más económico que recibir el daño.",
          position: pos3D,
          model: { type: "catalog", id: "dungeon_spikes" },
        };

      case "DOOR_LOCKED":
        return {
          id: `door-${x}-${y}`,
          title: "Compuerta Enrejada",
          text: "Paso sellado que requiere la acción UNLOCK con la llave.",
          fact: "Actúa como obstáculo infinito hasta interactuar.",
          position: pos3D,
          model: { type: "catalog", id: "dungeon_door" },
        };

      default:
        return null;
    }
  }
}
