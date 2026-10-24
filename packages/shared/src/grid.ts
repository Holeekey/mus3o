import type { GraphEdge, Museum } from "./schema";

export type GridCell = { row: number; col: number };
/** Puerta entre dos salas que quedaron vecinas en la grilla. */
export type RoomLink = { from: string; to: string };
export type RoomGridPlan = { start: string; cells: Record<string, GridCell>; links: RoomLink[] };

const DIRECTIONS: GridCell[] = [
  { row: 0, col: 1 }, // este
  { row: 1, col: 0 }, // sur
  { row: 0, col: -1 }, // oeste
  { row: -1, col: 0 }, // norte
];
const EDGE_PRIORITY: Record<GraphEdge["kind"], number> = { next: 0, prerequisite: 1, related: 2 };

const keyOf = (cell: GridCell) => `${cell.row},${cell.col}`;
const step = (cell: GridCell, dir: GridCell) => ({ row: cell.row + dir.row, col: cell.col + dir.col });

// Recorrido en serpiente: salas consecutivas siempre son vecinas en la grilla.
function serpentine(museum: Museum): RoomGridPlan {
  const cols = Math.max(1, Math.ceil(Math.sqrt(museum.rooms.length)));
  const cells: Record<string, GridCell> = {};
  museum.rooms.forEach((room, i) => {
    const row = Math.floor(i / cols);
    cells[room.id] = { row, col: row % 2 === 0 ? i % cols : cols - 1 - (i % cols) };
  });
  const links = museum.rooms.slice(1).map((room, i) => ({ from: museum.rooms[i].id, to: room.id }));
  return { start: museum.rooms[0].id, cells, links };
}

/** Vecinos de cada sala sin duplicar pares, ordenados por tipo de arista y orden de `rooms`. */
function neighbourMap(museum: Museum, edges: GraphEdge[]) {
  const order = new Map(museum.rooms.map((r, i) => [r.id, i]));
  const best = new Map<string, Map<string, number>>();
  for (const { from, to, kind } of edges) {
    for (const [a, b] of [[from, to], [to, from]]) {
      const links = best.get(a) ?? new Map<string, number>();
      links.set(b, Math.min(links.get(b) ?? Infinity, EDGE_PRIORITY[kind]));
      best.set(a, links);
    }
  }
  return (id: string) =>
    [...(best.get(id) ?? new Map<string, number>())]
      .sort(([a, pa], [b, pb]) => pa - pb || order.get(a)! - order.get(b)!)
      .map(([neighbour]) => neighbour);
}

function normalize(cells: Record<string, GridCell>) {
  const all = Object.values(cells);
  const minRow = Math.min(...all.map((c) => c.row));
  const minCol = Math.min(...all.map((c) => c.col));
  for (const cell of all) {
    cell.row -= minRow;
    cell.col -= minCol;
  }
}

/**
 * Ubica las salas en una grilla siguiendo el grafo: recorre en anchura desde `graph.start`
 * y pone cada sala junto a la que la descubrió, siguiendo derecho cuando se puede.
 * Si no queda lugar al lado, la sala va junto a la sala ubicada más cercana que tenga lugar.
 * Las aristas del árbol de recorrido se convierten en puertas, y también las demás aristas cuyas salas quedaron vecinas.
 * Sin grafo devuelve la serpiente en el orden de `rooms`.
 */
export function planRoomGrid(museum: Museum): RoomGridPlan {
  const graph = museum.graph;
  if (!graph) return serpentine(museum);

  const neighbours = neighbourMap(museum, graph.edges);
  const cells: Record<string, GridCell> = { [graph.start]: { row: 0, col: 0 } };
  const heading = new Map<string, GridCell>();
  const taken = new Set([keyOf(cells[graph.start])]);
  const placed = [graph.start];
  const links: RoomLink[] = [];

  const freeSide = (id: string) => {
    const preferred = heading.get(id);
    const dirs = preferred ? [preferred, ...DIRECTIONS.filter((d) => d !== preferred)] : DIRECTIONS;
    return dirs.find((d) => !taken.has(keyOf(step(cells[id], d))));
  };

  const place = (parent: string, child: string) => {
    let host = parent;
    let dir = freeSide(parent);
    if (!dir) {
      const distance = (id: string) =>
        Math.abs(cells[id].row - cells[parent].row) + Math.abs(cells[id].col - cells[parent].col);
      host = placed
        .filter((id) => freeSide(id))
        .sort((a, b) => distance(a) - distance(b))[0];
      dir = freeSide(host)!;
    }
    cells[child] = step(cells[host], dir);
    heading.set(child, dir);
    taken.add(keyOf(cells[child]));
    placed.push(child);
    links.push({ from: host, to: child });
  };

  const queue = [graph.start];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of neighbours(current)) {
      if (cells[next]) continue;
      place(current, next);
      queue.push(next);
    }
  }
  // El schema exige que todo sea alcanzable; esto solo cubre museos que no pasaron por él.
  for (const room of museum.rooms) {
    if (!cells[room.id]) place(placed[placed.length - 1], room.id);
  }

  // Conexiones lógicas fuera del árbol de recorrido (bucles, convergencias, cruces): si las dos salas quedaron
  // vecinas en la grilla, también tienen puerta. Así el grafo no es una cadena de puertas: se puede atajar.
  const linked = new Set(links.map((l) => [l.from, l.to].sort().join("|")));
  for (const { from, to } of graph.edges) {
    const a = cells[from];
    const b = cells[to];
    const pair = [from, to].sort().join("|");
    if (!a || !b || linked.has(pair)) continue;
    if (Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1) {
      linked.add(pair);
      links.push({ from, to });
    }
  }

  normalize(cells);
  return { start: graph.start, cells, links };
}

// ── Colocación incremental (palacio que se levanta sala a sala mientras la IA lo escribe) ─────────────────
//
// Misma regla que `planRoomGrid` (seguir derecho, si no hay lugar al lado va junto a la sala ubicada más
// cercana con lugar), pero en el orden en que llegan las salas y sin mirar las que aún no existen: la celda
// de una sala solo depende de las anteriores y de sus aristas con ellas, así que una sala ya ubicada nunca se
// mueve (tampoco se normaliza el origen: la primera sala queda en 0,0).

export type IncrementalGrid = {
  ids: string[];
  /** Celda de cada sala, por índice de llegada. */
  cells: GridCell[];
  headings: Array<GridCell | undefined>;
  /** Puertas del árbol de colocación `[anfitriona, nueva]` (índices), en orden de llegada. */
  links: Array<[number, number]>;
};

export const emptyGrid = (): IncrementalGrid => ({ ids: [], cells: [], headings: [], links: [] });

/**
 * Ubica la sala `id` junto a su vecina anterior mejor enlazada (tipo de arista y luego orden de llegada).
 * `edges` son las aristas de la sala con las anteriores; sin ninguna, cuelga de la última. Pura.
 */
export function placeRoom(grid: IncrementalGrid, id: string, edges: GraphEdge[]): IncrementalGrid {
  const i = grid.ids.length;
  if (i === 0) return { ids: [id], cells: [{ row: 0, col: 0 }], headings: [undefined], links: [] };

  const index = new Map(grid.ids.map((roomId, k) => [roomId, k]));
  let parent = i - 1;
  let best = Infinity;
  for (const { from, to, kind } of edges) {
    const other = index.get(from === id ? to : from);
    if (other === undefined || (from !== id && to !== id)) continue;
    const score = EDGE_PRIORITY[kind] * 100 + other;
    if (score < best) {
      best = score;
      parent = other;
    }
  }

  const taken = new Set(grid.cells.map(keyOf));
  const freeSide = (k: number) => {
    const preferred = grid.headings[k];
    const dirs = preferred ? [preferred, ...DIRECTIONS.filter((d) => d !== preferred)] : DIRECTIONS;
    return dirs.find((d) => !taken.has(keyOf(step(grid.cells[k], d))));
  };

  let host = parent;
  let dir = freeSide(parent);
  if (!dir) {
    const distance = (k: number) => Math.abs(grid.cells[k].row - grid.cells[parent].row) + Math.abs(grid.cells[k].col - grid.cells[parent].col);
    host = grid.cells
      .map((_, k) => k)
      .filter((k) => freeSide(k))
      .sort((a, b) => distance(a) - distance(b))[0];
    dir = freeSide(host)!;
  }
  return {
    ids: [...grid.ids, id],
    cells: [...grid.cells, step(grid.cells[host], dir)],
    headings: [...grid.headings, dir],
    links: [...grid.links, [host, i]],
  };
}

/**
 * Puertas extra del grafo final: las aristas fuera del árbol de colocación (bucles, convergencias, cruces)
 * cuyas salas quedaron vecinas, como en `planRoomGrid`. No cambia ninguna posición.
 */
export function extraGridLinks(grid: IncrementalGrid, edges: GraphEdge[]): Array<[number, number]> {
  const index = new Map(grid.ids.map((id, k) => [id, k]));
  const linked = new Set(grid.links.map(([a, b]) => [a, b].sort().join("|")));
  const extra: Array<[number, number]> = [];
  for (const { from, to } of edges) {
    const a = index.get(from);
    const b = index.get(to);
    if (a === undefined || b === undefined) continue;
    const pair = [a, b].sort().join("|");
    if (linked.has(pair)) continue;
    const p = grid.cells[a];
    const q = grid.cells[b];
    if (Math.abs(p.row - q.row) + Math.abs(p.col - q.col) === 1) {
      linked.add(pair);
      extra.push([a, b]);
    }
  }
  return extra;
}
