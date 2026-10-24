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
    const matrix = grid.toMatrix();

    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const type = matrix[y][x];
        const piece = this.tileToPiece(type, x, y, grid.tileSize);
        if (piece) {
          pieces.push(piece);
        }
      }
    }

    // Divide en cámaras temáticas conectadas por pasillos y puertas
    const rooms: Room[] = [];
    const doorIndex = pieces.findIndex((p) => p.id.startsWith("door"));

    if (doorIndex !== -1 && pieces.length > 2) {
      // Divide por compuerta: Cámara 1 (Entrada y Llave) y Cámara 2 (Santuario del Cofre)
      const chamber1Pieces = pieces.slice(0, doorIndex);
      const chamber2Pieces = pieces.slice(doorIndex);

      rooms.push({
        id: "chamber-1",
        name: "Cámara 1: Entrada y Llave",
        description: "Primera sección de la mazmorra. Explora el entorno y recupera la llave.",
        pieces: chamber1Pieces.length > 0 ? chamber1Pieces : [pieces[0]],
      });

      rooms.push({
        id: "chamber-2",
        name: "Cámara 2: Santuario del Cofre",
        description: "Cámara sellada tras la compuerta que resguarda el cofre del conocimiento.",
        pieces: chamber2Pieces.length > 0 ? chamber2Pieces : pieces.slice(1),
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
