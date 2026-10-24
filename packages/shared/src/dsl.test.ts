import { describe, expect, it } from "vitest";
import { assembleDslMuseum, Mus3oDslStream, parseMus3oDSL } from "./dsl";

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

describe("Mus3oDslStream", () => {
  const RAW = [
    "ROOM: r1 | Sala 1 | ancient | #f59e0b | #78350f | crystal |",
    "PIECE: P1 | torch | Antorcha mnemotécnica",
    "PIECE: P2 | box | Caja",
    "",
    "ROOM: r2 | Sala 2 | void | #6366f1 | #1e1b4b | dodecahedron | r1",
    "PIECE: P3 | shield | Escudo protector",
    "",
    "ROOM: r3 | Sala 3 | organic | #10b981 | #064e3b | ring_system | r2",
    "PIECE: P4 | tree | Raíces profundas",
  ].join("\n");

  const run = (chunks: string[]) => {
    const s = new Mus3oDslStream();
    const emitted: string[][] = [];
    for (const c of chunks) emitted.push(s.push(c).map((r) => r.id));
    emitted.push(s.end().map((r) => r.id));
    return { s, emitted };
  };

  it("emits a room when the next ROOM line starts, and the last one at end()", () => {
    const { s, emitted } = run([RAW]);
    expect(emitted).toEqual([["r1", "r2"], ["r3"]]);
    expect(s.rooms.map((r) => r.id)).toEqual(["r1", "r2", "r3"]);
  });

  it("handles chunks that split lines mid-way, down to one character at a time", () => {
    const { s, emitted } = run([...RAW]);
    expect(emitted.flat()).toEqual(["r1", "r2", "r3"]);
    // La sala 1 sale en cuanto la línea ROOM de la 2 empieza, no antes.
    const firstAt = emitted.findIndex((e) => e.includes("r1"));
    expect(RAW.slice(0, firstAt + 1).endsWith("ROOM:")).toBe(true);
    expect(s.rooms[0].pieces.map((p) => p.title)).toEqual(["P1", "P2"]);
  });

  it("produces the same museum as parseMus3oDSL for any chunking", () => {
    const whole = parseMus3oDSL(RAW);
    for (const size of [1, 3, 7, 50, 1000]) {
      const chunks = RAW.match(new RegExp(`[\\s\\S]{1,${size}}`, "g")) ?? [];
      const { s } = run(chunks);
      const museum = assembleDslMuseum(s.rooms);
      expect(museum.rooms).toEqual(whole.rooms);
      expect(museum.graph).toEqual(whole.graph);
    }
  });

  it("flushes a trailing partial line and room on end()", () => {
    const s = new Mus3oDslStream();
    expect(s.push("ROOM: a | A | void | #fff | #000 | torus |\nPIECE: X | box | cue")).toEqual([]);
    const done = s.end();
    expect(done).toHaveLength(1);
    expect(done[0].pieces[0].mnemonicCue).toBe("cue");
  });

  it("gives empty rooms a central piece, handles CRLF, fences and PIECE before ROOM", () => {
    const { s } = run(["```dsl\r\nPIECE: Suelto | box | c\r\nROOM: b | B | void | #fff | #000 | torus |\r\n```"]);
    expect(s.rooms.map((r) => r.id)).toEqual(["room-1", "b"]);
    expect(s.rooms[1].pieces).toHaveLength(1);
    expect(s.rooms[1].pieces[0].title).toBe("B");
  });

  it("caps pieces per room at 12 like the one-shot parser", () => {
    const pieces = Array.from({ length: 15 }, (_, i) => `PIECE: C${i} | box | c`).join("\n");
    const { s } = run([`ROOM: a | A | void | #fff | #000 | torus |\n${pieces}`]);
    expect(s.rooms[0].pieces).toHaveLength(12);
  });
});
