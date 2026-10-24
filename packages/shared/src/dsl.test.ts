import { describe, expect, it } from "vitest";
import { parseMus3oDSL } from "./dsl";

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
    const p = parse("PIECE: A | box | idea | con barra | anvil");
    expect(p.searchKeyword).toBe("anvil");
    expect(p.mnemonicCue).toBe("idea con barra");
  });
});
