import { describe, expect, it } from "vitest";
import { parseMus3oDSL } from "./dsl";
import { LIMITS } from "./schema";

describe("parseMus3oDSL", () => {
  it("parses valid low-token DSL into a strictly validated Museum", () => {
    const raw = `
ROOM: r1 | Arquitectura Von Neumann | cathedral | #1a1b26 | #16161e | crystal | 
PIECE: CPU | cpu | Un corazón de silicio palpitando en el centro de la sala
PIECE: ALU | octahedron | Una calculadora dorada con engranajes flotantes

ROOM: r2 | Jerarquía de Memoria | cyberpunk | #00ffcc | #050515 | torus | r1
PIECE: Caché L1 | box | Un rayo congelado que alimenta a la CPU
`;

    const museum = parseMus3oDSL(raw, { title: "Computadores" });

    expect(museum.title).toBe("Computadores");
    expect(museum.rooms).toHaveLength(2);

    const [r1, r2] = museum.rooms;
    expect(r1.id).toBe("r1");
    expect(r1.name).toBe("Arquitectura Von Neumann");
    expect(r1.theme).toBe("cathedral");
    expect(r1.palette).toEqual({ primary: "#1a1b26", fogColor: "#16161e" });
    expect(r1.monument).toBe("crystal");
    expect(r1.pieces).toHaveLength(2);

    expect(r1.pieces[0].title).toBe("CPU");
    expect(r1.pieces[0].mnemonicCue).toBe("Un corazón de silicio palpitando en el centro de la sala");
    expect(r1.pieces[0].model).toEqual({ type: "glyph", shape: "box" });

    expect(r2.id).toBe("r2");
    expect(r2.theme).toBe("cyberpunk");
    expect(r2.monument).toBe("torus");
    expect(r2.palette).toEqual({ primary: "#00ffcc", fogColor: "#050515" });

    expect(museum.graph).toBeDefined();
    expect(museum.graph?.start).toBe("r1");
    expect(museum.graph?.edges).toContainEqual({ from: "r1", to: "r2", kind: "prerequisite" });
    expect(museum.graph?.edges).toContainEqual({ from: "r1", to: "r2", kind: "next" });
  });

  it("handles malformed colors, themes and symbols with safe fallbacks", () => {
    const raw = `
ROOM: corrupt-room | Sala Extraña | unknown_theme | not-a-color | bad-fog | invalid_monument | non_existent_room
PIECE: Idea Rara | mystery_glyph | Metáfora surrealista
`;

    const museum = parseMus3oDSL(raw);
    expect(museum.rooms).toHaveLength(1);

    const room = museum.rooms[0];
    expect(room.theme).toBe("cathedral");
    expect(room.monument).toBe("torus");
    expect(room.palette?.primary).toBe("#3b82f6");
    expect(room.palette?.fogColor).toBe("#0f172a");

    const piece = room.pieces[0];
    expect(piece.title).toBe("Idea Rara");
    expect(piece.model).toEqual({ type: "glyph", shape: "box" });
    expect(piece.mnemonicCue).toBe("Metáfora surrealista");
  });

  it("handles markdown code fences and multi-room complex dependencies", () => {
    const raw = `\`\`\`dsl
ROOM: r1 | Sala 1 | ancient | #f59e0b | #78350f | crystal | 
PIECE: P1 | torch | Antorcha mnemotécnica

ROOM: r2 | Sala 2 | void | #6366f1 | #1e1b4b | dodecahedron | r1
PIECE: P2 | shield | Escudo protector

ROOM: r3 | Sala 3 | organic | #10b981 | #064e3b | ring_system | r2
PIECE: P3 | tree | Raíces profundas
\`\`\``;

    const museum = parseMus3oDSL(raw);
    expect(museum.rooms).toHaveLength(3);
    expect(museum.graph?.edges.filter((e) => e.kind === "next")).toHaveLength(2);
    expect(museum.graph?.edges.filter((e) => e.kind === "prerequisite")).toHaveLength(2);
  });
});

describe("searchKeyword en el DSL", () => {
  const parse = (piece: string) =>
    parseMus3oDSL(`ROOM: r1 | Sala | ancient | #112233 | #000000 | torus |\n${piece}`).rooms[0].pieces[0];

  it("normaliza tildes, mayúsculas, signos y limita a 3 palabras", () => {
    expect(parse("PIECE: A | box | cue | Hourglass.").searchKeyword).toBe("hourglass");
    expect(parse('PIECE: A | box | cue | "Ancient  Roman   Shield Extra"').searchKeyword).toBe("ancient roman shield");
    expect(parse("PIECE: A | box | cue | Péndulo").searchKeyword).toBe("pendulo");
  });

  it("ignora '-' o valores inservibles y deja el glifo", () => {
    expect(parse("PIECE: A | box | cue | -").searchKeyword).toBeUndefined();
    expect(parse("PIECE: A | box | cue | ¿¿ ??").searchKeyword).toBeUndefined();
    expect(parse("PIECE: A | box | cue").searchKeyword).toBeUndefined();
  });

  it("un '|' dentro del anclaje no corre los campos", () => {
    const p = parse("PIECE: A | box | idea | con barra | anvil | Explicación breve");
    expect(p.searchKeyword).toBe("anvil");
    expect(p.mnemonicCue).toBe("idea con barra");
    expect(p.text).toBe("Explicación breve");
  });

  it("acepta el formato de 4 campos (palabra clave al final) sin explicación", () => {
    const p = parse("PIECE: Yunque | box | cue | anvil");
    expect(p.searchKeyword).toBe("anvil");
    expect(p.text).toBe("Yunque");
  });
});

describe("robustez del parser DSL", () => {
  it("tolera viñetas, negritas, minúsculas y barras de ancho completo", () => {
    const m = parseMus3oDSL(`- **ROOM**: r1 | Sala | ancient | #112233 | #000000 | torus |
1. piece: Uno｜box｜cue｜key｜Explica uno
* **PIECE:** Dos | sphere | cue2 | compass | Explica dos`);
    expect(m.rooms).toHaveLength(1);
    expect(m.rooms[0].pieces.map((p) => [p.title, p.searchKeyword, p.text])).toEqual([
      ["Uno", "key", "Explica uno"],
      ["Dos", "compass", "Explica dos"],
    ]);
  });

  it("desambigua ids de sala repetidos y mantiene el grafo válido", () => {
    const m = parseMus3oDSL(`ROOM: a | Una | ancient | #112233 | #000000 | torus |
PIECE: X | box | c | key | e
ROOM: a | Otra | void | #112233 | #000000 | torus | a
PIECE: Y | box | c | key | e`);
    expect(m.rooms.map((r) => r.id)).toEqual(["a", "a-2"]);
  });

  it("recorta a LIMITS.maxRooms y maxPiecesPerRoom sin lanzar ni mezclar piezas", () => {
    const rooms = Array.from({ length: 15 }, (_, i) => `ROOM: r${i} | Sala ${i} | ancient | #112233 | #000000 | torus |\n` + Array.from({ length: 14 }, (_, j) => `PIECE: P${i}-${j} | box | c | key | e`).join("\n")).join("\n");
    const m = parseMus3oDSL(rooms);
    expect(m.rooms).toHaveLength(LIMITS.maxRooms);
    expect(m.rooms.every((r) => r.pieces.length === LIMITS.maxPiecesPerRoom)).toBe(true);
  });
});

describe("DSL del flujo completo (modo, período, quiz, imágenes)", () => {
  const rooms = (extra = "") => `TITLE: Roma
ROOM: a | Origen | ancient | #112233 | #000000 | torus |
${extra}PIECE: Rómulo | box | cue | wolf | Fundador legendario
ROOM: b | República | ancient | #112233 | #000000 | torus | a
PIECE: Senado | box | cue | column | Órgano de gobierno
ROOM: c | Imperio | ancient | #112233 | #000000 | torus | a
PIECE: Augusto | box | cue | statue | Primer emperador`;

  it("exploration: árbol de n-1 aristas 'related' y título del DSL", () => {
    const m = parseMus3oDSL(rooms(), { mode: "exploration" });
    expect(m.title).toBe("Roma");
    expect(m.graph?.edges).toEqual([
      { from: "a", to: "b", kind: "related" },
      { from: "a", to: "c", kind: "related" },
    ]);
  });

  it("education: DAG de prerrequisitos (ramas y convergencias) alcanzable desde la primera sala", () => {
    const m = parseMus3oDSL(rooms(), { mode: "education" });
    expect(m.graph?.edges).toEqual([
      { from: "a", to: "b", kind: "prerequisite" },
      { from: "a", to: "c", kind: "prerequisite" },
    ]);
  });

  it("education: converge con varios prerrequisitos y descarta los que apuntan hacia adelante (sin ciclos)", () => {
    const raw = `ROOM: a | A | ancient | #112233 | #000000 | torus |
PIECE: x | box | c | key | e
ROOM: b | B | ancient | #112233 | #000000 | torus | a
PIECE: x | box | c | key | e
ROOM: c | C | ancient | #112233 | #000000 | torus | a
PIECE: x | box | c | key | e
ROOM: d | D | ancient | #112233 | #000000 | torus | b, c, e
PIECE: x | box | c | key | e
ROOM: e | E | ancient | #112233 | #000000 | torus |
PIECE: x | box | c | key | e`;
    const m = parseMus3oDSL(raw, { mode: "education" });
    const intoD = m.graph!.edges.filter((e) => e.to === "d").map((e) => e.from);
    expect(intoD).toEqual(["b", "c"]);
  });

  it("related: agrega conexiones transversales sin romper el modo", () => {
    const raw = rooms().replace("| torus | a\nPIECE: Augusto", "| torus | a | | b\nPIECE: Augusto");
    const m = parseMus3oDSL(raw, { mode: "exploration" });
    expect(m.graph!.edges.some((e) => e.kind === "related" && [e.from, e.to].sort().join() === "b,c")).toBe(true);
  });

  it("biography: exige PERIOD en cada sala", () => {
    expect(() => parseMus3oDSL(rooms(), { mode: "biography" })).toThrow();
    const withPeriod = rooms().replace(/(ROOM: \w \| [^\n]*\n)/g, "$1PERIOD: 100–200\n");
    const m = parseMus3oDSL(withPeriod, { mode: "biography" });
    expect(m.rooms.every((r) => r.period === "100–200")).toBe(true);
  });

  it("quiz: toma QUIZ de la pieza anterior y falla si falta en alguna", () => {
    expect(() => parseMus3oDSL(rooms(), { mode: "quiz" })).toThrow();
    const quiz = "QUIZ: ¿Quién fundó Roma? | Rómulo | Remo | Numa | 0\n";
    const all = (rooms() + "\n").replace(/(PIECE: [^\n]*\n)/g, `$1${quiz}`);
    const m = parseMus3oDSL(all, { mode: "quiz" });
    expect(m.rooms[0].pieces[0].quiz).toEqual({ question: "¿Quién fundó Roma?", options: ["Rómulo", "Remo", "Numa"], answerIndex: 0 });
  });

  it("IMAGE: acepta solo ids del request y una vez", () => {
    const raw = (rooms() + "\n").replace(/(PIECE: [^\n]*\n)/g, "$1IMAGE: img-1\n");
    const m = parseMus3oDSL(raw, { mode: "exploration", imageIds: ["img-1"] });
    expect(m.rooms.flatMap((r) => r.pieces).filter((p) => p.image).length).toBe(1);
    const none = parseMus3oDSL(raw, { mode: "exploration", imageIds: [] });
    expect(none.rooms.flatMap((r) => r.pieces).some((p) => p.image)).toBe(false);
  });
});
