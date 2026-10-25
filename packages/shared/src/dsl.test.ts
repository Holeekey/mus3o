import { describe, expect, it } from "vitest";
import { Mus3oDslStream, classifyDslLine, parseMus3oDSL } from "./dsl";
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

  const run = (chunks: string[], options = {}) => {
    const s = new Mus3oDslStream(options);
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

  it("no emite salas por encima de LIMITS.maxRooms y las piezas sobrantes no se cuelgan de otra sala", () => {
    const raw = Array.from({ length: 15 }, (_, i) => `ROOM: r${i} | Sala ${i} | ancient | #112233 | #000000 | torus |\nPIECE: P${i} | box | c | key | e`).join("\n");
    const { s } = run([raw]);
    expect(s.rooms).toHaveLength(LIMITS.maxRooms);
    expect(s.rooms.every((r) => r.pieces.length === 1)).toBe(true);
  });

  it("expone el título y las salas marcadas como diorama", () => {
    const s = new Mus3oDslStream();
    s.push("TITLE: Roma\nROOM: a | A | ancient | #112233 | #000000 | torus | | diorama\nPIECE: x | box | c | key | e\n");
    s.end();
    expect(s.docTitle).toBe("Roma");
    expect(s.dioramaRooms).toEqual(["a"]);
  });

  // DSL como lo emite el flujo completo: TITLE, PERIOD, QUIZ, IMAGE, prerrequisitos, cruces y salas diorama.
  const FLOW_DSL = [
    "```dsl",
    "TITLE: Roma antigua",
    "ROOM: origen | Origen | ancient | #112233 | #000000 | torus |",
    "PERIOD: 753 a. C.",
    "PIECE: Rómulo | box | Un lobo amamanta | wolf | Fundador legendario",
    "QUIZ: ¿Quién fundó Roma? | Rómulo | Remo | Numa | 0",
    "IMAGE: img-1",
    "ROOM: republica | República | ancient | #223344 | #000011 | crystal | origen | diorama",
    "PERIOD: 509 a. C.",
    "- **PIECE**: Senado | cube | Togas en círculo | column | Órgano de gobierno",
    "QUIZ: ¿Qué es el Senado? | Un consejo | Un río | 0",
    "IMAGE: img-1",
    "IMAGE: img-2",
    "ROOM: imperio | Imperio | cathedral | #334455 | #000022 | torus | origen, republica | | republica",
    "PERIOD: 27 a. C.",
    "PIECE: Augusto | shield | Corona de laurel | statue | Primer emperador",
    "QUIZ: ¿Primer emperador? | Augusto | Nerón | 0",
    "ROOM: origen | Origen otra vez | void | #445566 | #000033 | ring_system | imperio",
    "PERIOD: 476",
    "PIECE: Caída | box | Ruinas | ruins | Fin del imperio de occidente",
    "QUIZ: ¿Cuándo cae? | 476 | 1453 | 0",
    "```",
  ].join("\n");

  // PRNG determinista (mulberry32) para trocear el texto siempre igual.
  const prng = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const randomChunks = (text: string, seed: number) => {
    const next = prng(seed);
    const chunks: string[] = [];
    for (let i = 0; i < text.length; ) {
      const size = 1 + Math.floor(next() * 40);
      chunks.push(text.slice(i, i + size));
      i += size;
    }
    return chunks;
  };

  it("equivalencia: el museo final del stream es igual al de parseMus3oDSL (todos los modos, trozos aleatorios)", () => {
    for (const mode of [undefined, "exploration", "quiz", "education", "biography"] as const) {
      const options = { mode, imageIds: ["img-1"] };
      const whole = parseMus3oDSL(FLOW_DSL, options);
      for (let seed = 1; seed <= 25; seed++) {
        const { s } = run(randomChunks(FLOW_DSL, seed), options);
        expect(s.finish()).toEqual(whole);
      }
      // Salas emitidas = salas del museo final (mismo contenido, sin los campos internos del grafo).
      const { s } = run(randomChunks(FLOW_DSL, 99), options);
      expect(s.rooms.map(({ requires: _r, related: _l, ...room }) => room)).toEqual(whole.rooms);
    }
  });

  it("edgesOf: las aristas provisionales de cada sala suman exactamente las del grafo final, en todos los modos", () => {
    for (const mode of [undefined, "exploration", "quiz", "education", "biography"] as const) {
      const options = { mode, imageIds: ["img-1"] };
      const s = new Mus3oDslStream(options);
      const seen: string[] = [];
      const arrive = (rooms: ReturnType<typeof s.push>) => {
        for (const r of rooms) {
          // Cada arista conecta la sala que llega con una anterior.
          for (const e of s.edgesOf(r.id)) {
            expect([e.from, e.to]).toContain(r.id);
            expect(seen.concat(r.id)).toEqual(expect.arrayContaining([e.from, e.to]));
          }
          seen.push(r.id);
        }
      };
      for (const chunk of randomChunks(FLOW_DSL, 5)) arrive(s.push(chunk));
      arrive(s.end());
      const key = (e: { from: string; to: string; kind: string }) => `${e.from}>${e.to}:${e.kind}`;
      const union = new Set(s.rooms.flatMap((r) => s.edgesOf(r.id)).map(key));
      expect(union).toEqual(new Set((s.finish().graph?.edges ?? []).map(key)));
    }
  });

  it("equivalencia: título, diorama, período, quiz e imagen se leen igual que en el parser de una pasada", () => {
    const seen: string[][] = [];
    const whole = parseMus3oDSL(FLOW_DSL, { mode: "quiz", imageIds: ["img-1"], onDioramaRooms: (ids) => seen.push(ids) });
    const { s } = run(randomChunks(FLOW_DSL, 7), { mode: "quiz", imageIds: ["img-1"], onDioramaRooms: (ids: string[]) => seen.push(ids) });
    s.finish();
    expect(s.dioramaRooms).toEqual(seen[0]);
    expect(seen[1]).toEqual(seen[0]);
    expect(whole.title).toBe("Roma antigua");
    expect(whole.rooms[0].period).toBe("753 a. C.");
    expect(whole.rooms[0].pieces[0].quiz?.answerIndex).toBe(0);
    expect(whole.rooms[0].pieces[0].image).toEqual({ imageId: "img-1" });
    // Un id de imagen repetido se ignora: solo una pieza la usa.
    expect(whole.rooms.flatMap((r) => r.pieces).filter((p) => p.image).length).toBe(1);
  });
});

describe("micro-DSL de dioramas (DIO / D_PROP)", () => {
  const DIORAMA_DSL = [
    "ROOM: batalla | Batalla de Carabobo | ancient | #a8322d | #1c1203 | torus | | diorama |",
    "PIECE: Bolívar | box | Un jinete | horse | Líder patriota.",
    "PIECE: Páez | box | Una carga | horse | Jefe de caballería.",
    "DIO: battle | sunset",
    "D_PROP: center | figure | pointing | 1 | p1 | Bolívar",
    "D_PROP: front | rider | charging | 6 | batalla-p2 | Carga de Páez | #2b4c94",
    "D_PROP: background | flag | standing | 2 | - | Estandartes | #ffffff | #a8322d | saltire",
    "D_PROP: nowhere | dragon | idle | x | p1 | inválido",
    "ROOM: otra | Otra sala | void | #111111 | #000000 | torus | batalla | |",
    "PIECE: Algo | box | cue | thing | texto",
  ].join("\n");

  it("lee DIO y D_PROP bajo su sala con piezas por número, colores y patrón", () => {
    const [room, other] = parseMus3oDSL(DIORAMA_DSL).rooms;
    expect(room.dioramaDirectives?.archetype).toBe("battle");
    expect(room.dioramaDirectives?.time).toBe("sunset");
    const props = room.dioramaDirectives?.props ?? [];
    expect(props.map((p) => p.kind)).toEqual(["figure", "rider", "flag"]);
    expect(props[0]).toMatchObject({ zone: "center", pose: "pointing", count: 1, piece: 1, label: "Bolívar" });
    expect(props[1]).toMatchObject({ zone: "front", count: 6, piece: 2, color: "#2b4c94" });
    expect(props[2]).toMatchObject({ pattern: "saltire", color: "#ffffff", secondary: "#a8322d" });
    expect(props[2].piece).toBeUndefined();
    expect(other.dioramaDirectives).toBeUndefined();
  });

  it("descarta la línea inválida sin afectar a la sala ni al museo", () => {
    const museum = parseMus3oDSL(DIORAMA_DSL);
    expect(museum.rooms).toHaveLength(2);
    expect(museum.rooms[0].pieces).toHaveLength(2);
    expect(museum.rooms[0].dioramaDirectives?.props.some((p) => p.label === "inválido")).toBe(false);
  });

  it("solo las 2 primeras salas con directivas y como mucho 8 props", () => {
    const room = (n: number) => `ROOM: s${n} | Sala ${n} | void | #111111 | #000000 | torus | | |\nPIECE: A | box | c | thing | t\nDIO: nature | day\n${Array.from({ length: 12 }, () => "D_PROP: center | tree | - | 1 | - | Árbol").join("\n")}`;
    const museum = parseMus3oDSL([1, 2, 3].map(room).join("\n"));
    expect(museum.rooms.map((r) => r.dioramaDirectives?.props.length)).toEqual([8, 8, undefined]);
  });

  it("una DIO inválida o vacía no gasta el cupo de 2 salas", () => {
    const room = (n: number, body: string) => `ROOM: s${n} | Sala ${n} | void | #111111 | #000000 | torus | | |\nPIECE: A | box | c | thing | t\n${body}`;
    const good = "DIO: nature | day\nD_PROP: center | tree | - | 1 | - | Árbol";
    const museum = parseMus3oDSL([room(1, "DIO: foo | bar"), room(2, good), room(3, good), room(4, good)].join("\n"));
    expect(museum.rooms.map((r) => r.dioramaDirectives?.props.length ?? 0)).toEqual([0, 1, 1, 0]);
  });

  it("un segundo DIO con campos vacíos no borra lo pedido", () => {
    const m = parseMus3oDSL(["ROOM: a | A | void | #111111 | #000000 | torus | | |", "PIECE: A | box | c | thing | t", "DIO: battle | night | hills", "DIO: - | - | -"].join("\n"));
    expect(m.rooms[0].dioramaDirectives).toMatchObject({ archetype: "battle", time: "night", terrain: "hills" });
  });

  it("el campo pieza solo acepta número, pN o <sala>-pN", () => {
    const prop = (piece: string) => `D_PROP: center | figure | - | 1 | ${piece} | X`;
    const m = parseMus3oDSL(["ROOM: a | A | void | #111111 | #000000 | torus | | |", "PIECE: A | box | c | thing | t", ...["2", "p3", "a-p4", "x-5", "sala-2024", "-6"].map(prop)].join("\n"));
    expect(m.rooms[0].dioramaDirectives?.props.map((p) => p.piece)).toEqual([2, 3, 4, undefined, undefined, undefined]);
  });

  it("el parser incremental lee las directivas igual que el de una pasada", () => {
    const whole = parseMus3oDSL(DIORAMA_DSL);
    const s = new Mus3oDslStream();
    for (let i = 0; i < DIORAMA_DSL.length; i += 7) s.push(DIORAMA_DSL.slice(i, i + 7));
    s.end();
    const streamed = s.finish();
    expect(streamed.rooms.map((r) => r.dioramaDirectives)).toEqual(whole.rooms.map((r) => r.dioramaDirectives));
  });

  describe("resiliencia ante variaciones de sintaxis de LLMs", () => {
    it("soporta dos puntos asiáticos (full-width) y barras full-width", () => {
      const raw = `
ROOM：sala-asia ｜ Sala Asia ｜ ancient ｜ #ffaa00 ｜ #111111 ｜ crystal
PIECE：Concepto Asia ｜ sphere ｜ Anclaje de memoria asiático
`;
      const museum = parseMus3oDSL(raw);
      expect(museum.rooms).toHaveLength(1);
      expect(museum.rooms[0].name).toBe("Sala Asia");
      expect(museum.rooms[0].pieces[0].title).toBe("Concepto Asia");
    });

    it("soporta viñetas Markdown complejas, numeradas y con negrita", () => {
      const raw = `
- **ROOM**: r-markdown | Sala Markdown | cyberpunk | #00ff00 | #001100 | torus
1.1. **PIECE**: Token A | box | Mnemotecnia uno
* [x] PIECE: Token B | tetrahedron | Mnemotecnia dos
> PIECE: Token C | cone | Mnemotecnia tres
`;
      const museum = parseMus3oDSL(raw);
      expect(museum.rooms).toHaveLength(1);
      expect(museum.rooms[0].pieces).toHaveLength(3);
      expect(museum.rooms[0].pieces[0].title).toBe("Token A");
      expect(museum.rooms[0].pieces[1].title).toBe("Token B");
      expect(museum.rooms[0].pieces[2].title).toBe("Token C");
    });

    it("soporta separadores alternativos con guion o pipe directo", () => {
      const raw = `
ROOM | r-pipe | Sala Pipe | cathedral | #333333 | #000000 | dodecahedron
PIECE - Concepto Guion | octahedron | Anclaje de prueba
`;
      const museum = parseMus3oDSL(raw);
      expect(museum.rooms).toHaveLength(1);
      expect(museum.rooms[0].name).toBe("Sala Pipe");
      expect(museum.rooms[0].pieces[0].title).toBe("Concepto Guion");
    });

    it("asigna valores seguros ante líneas con campos mínimos", () => {
      const raw = `
ROOM: r-min | SoloNombre
PIECE: SoloConcepto
`;
      const museum = parseMus3oDSL(raw);
      expect(museum.rooms).toHaveLength(1);
      expect(museum.rooms[0].name).toBe("SoloNombre");
      expect(museum.rooms[0].theme).toBe("cathedral");
      const piece = museum.rooms[0]?.pieces[0];
      expect(piece?.title).toBe("SoloConcepto");
      expect(piece?.model?.type).toBe("glyph");
      if (piece?.model && piece.model.type === "glyph") {
        expect(piece.model.shape).toBe("box");
      }
    });

    it("respeta los dos puntos de ancho completo del contenido (solo normaliza la etiqueta)", () => {
      const raw = `
ROOM：r-fw | Sala Ancha | cathedral
PIECE：Hora | box | Abre a las 10：30 en punto
`;
      const museum = parseMus3oDSL(raw);
      expect(museum.rooms[0].name).toBe("Sala Ancha");
      expect(JSON.stringify(museum.rooms[0].pieces[0])).toContain("10：30");
    });

    it("no toma como etiqueta la prosa con guion pegado a la palabra", () => {
      expect(classifyDslLine("Room-based learning es útil").kind).toBeUndefined();
      expect(classifyDslLine("- [x] PIECE: CPU | box | desc").kind).toBe("PIECE");
    });

    it("no descarta una pieza con pipes consecutivos o campos vacíos", () => {
      const raw = `
ROOM: r-gap | Sala Hueco | cathedral
PIECE: Concepto || | 
`;
      const museum = parseMus3oDSL(raw);
      expect(museum.rooms[0].pieces).toHaveLength(1);
      expect(museum.rooms[0].pieces[0].title).toBe("Concepto");
    });
  });
});
