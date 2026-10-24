import { describe, expect, it } from "vitest";
import { sampleMuseum } from "./mock";
import {
  DigestSourcesRequestSchema,
  DigestSourcesResponseSchema,
  GenerateMuseumRequestSchema,
  ImageSearchSchema,
  ResolvedImageSchema,
  ImprovePromptRequestSchema,
  LIMITS,
  MuseumSchema,
  findImageAssignmentIssues,
  type Museum,
  type MuseumMode,
  type Piece,
  type Room,
} from "./schema";

const basePiece = sampleMuseum.rooms[0].pieces[0];

function piece(id: string, extra: Partial<Piece> = {}): Piece {
  return { ...basePiece, id, ...extra };
}

function room(id: string, extra: Partial<Room> = {}): Room {
  return { id, name: `Room ${id}`, description: "", pieces: [piece(`${id}-p1`)], ...extra };
}

function museum(extra: Partial<Museum> = {}): Museum {
  return { ...sampleMuseum, rooms: [room("a"), room("b"), room("c")], ...extra };
}

const chain = {
  start: "a",
  edges: [
    { from: "a", to: "b", kind: "next" as const },
    { from: "b", to: "c", kind: "next" as const },
  ],
};

const issues = (value: unknown) => {
  const result = MuseumSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((i) => i.message);
};

describe("MuseumSchema backward compatibility", () => {
  it("accepts the existing sample museum without new fields", () => {
    expect(MuseumSchema.safeParse(sampleMuseum).success).toBe(true);
  });

  it("accepts a museum without graph and keeps room order", () => {
    const parsed = MuseumSchema.parse(museum());
    expect(parsed.graph).toBeUndefined();
    expect(parsed.rooms.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});

describe("MuseumSchema ids", () => {
  it("rejects duplicated room ids", () => {
    expect(issues(museum({ rooms: [room("a"), room("a", { pieces: [piece("x")] })] }))).toContain(
      'id de sala duplicado: "a"',
    );
  });

  it("rejects duplicated piece ids across rooms", () => {
    const rooms = [room("a", { pieces: [piece("same")] }), room("b", { pieces: [piece("same")] })];
    expect(issues(museum({ rooms }))).toContain('id de pieza duplicado: "same"');
  });
});

describe("MuseumSchema graph", () => {
  it("accepts a connected graph", () => {
    expect(MuseumSchema.safeParse(museum({ graph: chain })).success).toBe(true);
  });

  it("rejects an unknown start room", () => {
    expect(issues(museum({ graph: { ...chain, start: "zzz" } }))).toContain(
      'graph.start no existe: "zzz"',
    );
  });

  it("rejects an edge that points to an unknown room", () => {
    const graph = { start: "a", edges: [...chain.edges, { from: "c", to: "zzz", kind: "related" as const }] };
    expect(issues(museum({ graph }))).toContain('arista hacia una sala inexistente: "zzz"');
  });

  it("rejects a self loop", () => {
    const graph = { start: "a", edges: [...chain.edges, { from: "b", to: "b", kind: "related" as const }] };
    expect(issues(museum({ graph }))).toContain('arista de una sala a sí misma: "b"');
  });

  it("rejects rooms that cannot be reached from start", () => {
    const graph = { start: "a", edges: [{ from: "a", to: "b", kind: "next" as const }] };
    expect(issues(museum({ graph }))).toContain('sala inalcanzable desde graph.start: "c"');
  });
});

describe("MuseumSchema mode rules", () => {
  const withMode = (mode: MuseumMode, extra: Partial<Museum> = {}) =>
    museum({ mode, graph: chain, ...extra });

  it("exploration accepts a tree rooted at start", () => {
    const graph = {
      start: "a",
      edges: [
        { from: "a", to: "b", kind: "related" as const },
        { from: "a", to: "c", kind: "related" as const },
      ],
    };
    expect(MuseumSchema.safeParse(withMode("exploration", { graph })).success).toBe(true);
  });

  it("exploration rejects a graph that is not a tree", () => {
    const graph = {
      start: "a",
      edges: [...chain.edges, { from: "a", to: "c", kind: "related" as const }],
    };
    expect(issues(withMode("exploration", { graph }))).toContain(
      "modo exploration: el grafo debe ser un árbol desde graph.start",
    );
  });

  it("education accepts an ordered next path with optional prerequisites", () => {
    const graph = { ...chain, edges: [...chain.edges, { from: "a", to: "c", kind: "prerequisite" as const }] };
    expect(MuseumSchema.safeParse(withMode("education", { graph })).success).toBe(true);
  });

  it("education rejects a next chain that does not cover every room", () => {
    const graph = {
      start: "a",
      edges: [
        { from: "a", to: "b", kind: "next" as const },
        { from: "a", to: "c", kind: "related" as const },
      ],
    };
    expect(issues(withMode("education", { graph }))).toContain(
      "modo education: las aristas next deben formar un único camino desde graph.start que recorra todas las salas",
    );
  });

  it("biography requires a period in every room", () => {
    expect(issues(withMode("biography"))).toContain('modo biography: la sala "a" necesita period');
  });

  it("biography accepts a chronological chain with periods", () => {
    const rooms = ["a", "b", "c"].map((id, i) => room(id, { period: `${1900 + i * 10}` }));
    expect(MuseumSchema.safeParse(withMode("biography", { rooms })).success).toBe(true);
  });

  it("biography rejects a graph that is not a next chain", () => {
    const rooms = ["a", "b", "c"].map((id) => room(id, { period: "1900" }));
    const graph = {
      start: "a",
      edges: [
        { from: "a", to: "b", kind: "related" as const },
        { from: "a", to: "c", kind: "related" as const },
      ],
    };
    expect(issues(withMode("biography", { rooms, graph }))).toContain(
      "modo biography: las aristas next deben formar un único camino desde graph.start que recorra todas las salas",
    );
  });

  it("quiz requires a question in every piece", () => {
    expect(issues(withMode("quiz"))).toContain('modo quiz: la pieza "a-p1" necesita quiz');
  });

  it("quiz accepts pieces with valid questions", () => {
    const quiz = { question: "¿Qué es?", options: ["A", "B"], answerIndex: 1 };
    const rooms = ["a", "b", "c"].map((id) => room(id, { pieces: [piece(`${id}-p1`, { quiz })] }));
    expect(MuseumSchema.safeParse(withMode("quiz", { rooms })).success).toBe(true);
  });

  it("rejects a quiz answer outside the options", () => {
    const quiz = { question: "¿Qué es?", options: ["A", "B"], answerIndex: 3 };
    const rooms = [room("a", { pieces: [piece("a-p1", { quiz })] })];
    expect(issues(museum({ rooms }))).toContain('la respuesta del quiz de "a-p1" no está entre las opciones');
  });
});

describe("image assignments", () => {
  it("rejects the same image in two pieces", () => {
    const rooms = [
      room("a", { pieces: [piece("a-p1", { image: { imageId: "img-1" } })] }),
      room("b", { pieces: [piece("b-p1", { image: { imageId: "img-1" } })] }),
    ];
    expect(issues(museum({ rooms }))).toContain('la imagen "img-1" se usa en más de una pieza');
  });

  it("reports images that were not sent in the request", () => {
    const rooms = [room("a", { pieces: [piece("a-p1", { image: { imageId: "img-9" } })] })];
    expect(findImageAssignmentIssues(museum({ rooms }), ["img-1"])).toEqual([
      'la pieza "a-p1" usa una imagen que no está en el request: "img-9"',
    ]);
  });

  it("reports nothing when every image was sent", () => {
    const rooms = [room("a", { pieces: [piece("a-p1", { image: { imageId: "img-1" } })] })];
    expect(findImageAssignmentIssues(museum({ rooms }), ["img-1"])).toEqual([]);
  });
});

describe("GenerateMuseumRequestSchema", () => {
  const image = { id: "img-1", name: "foto.png", mediaType: "image/png" as const, data: "aGVsbG8=" };

  it("accepts the new request with sources and images", () => {
    const parsed = GenerateMuseumRequestSchema.parse({
      mode: "quiz",
      prompt: "Bases de datos",
      sources: [{ name: "apuntes.docx", kind: "docx", text: "Tablas y claves" }],
      images: [image],
    });
    expect(parsed.mode).toBe("quiz");
    expect(parsed.images).toHaveLength(1);
  });

  it("applies defaults for mode, sources and images", () => {
    expect(GenerateMuseumRequestSchema.parse({ prompt: "Imperio Romano" })).toEqual({
      mode: "exploration",
      prompt: "Imperio Romano",
      sources: [],
      images: [],
    });
  });

  it("rejects more than 6 images", () => {
    const images = Array.from({ length: 7 }, (_, i) => ({ ...image, id: `img-${i + 1}` }));
    expect(GenerateMuseumRequestSchema.safeParse({ prompt: "x", images }).success).toBe(false);
  });

  it("rejects duplicated image ids", () => {
    const result = GenerateMuseumRequestSchema.safeParse({ prompt: "x", images: [image, image] });
    expect(result.success).toBe(false);
  });

  it("rejects more text in total than LIMITS.maxNotesChars", () => {
    const sources = [{ name: "a.txt", kind: "txt" as const, text: "a".repeat(LIMITS.maxNotesChars - 1) }];
    const result = GenerateMuseumRequestSchema.safeParse({ prompt: "ab", sources });
    expect(result.success).toBe(false);
  });

  it("improve-prompt request does not accept images", () => {
    const parsed = ImprovePromptRequestSchema.parse({ prompt: "x", images: [image] });
    expect(parsed).not.toHaveProperty("images");
  });
});

describe("image search contract", () => {
  it("accepts imageSearch on rooms and pieces", () => {
    const search = { wikiTitle: "Batalla de Carabobo (1821)", commonsQuery: "Carabobo Tovar", lang: "es" };
    const m = museum({ rooms: [room("a", { imageSearch: search, pieces: [piece("p", { imageSearch: search })] })] });
    expect(issues(m)).toEqual([]);
    expect(MuseumSchema.parse(m).rooms[0].imageSearch).toEqual(search);
  });

  it("rejects an invalid lang and oversized titles", () => {
    expect(ImageSearchSchema.safeParse({ lang: "esp" }).success).toBe(false);
    expect(ImageSearchSchema.safeParse({ wikiTitle: "x".repeat(121) }).success).toBe(false);
  });

  it("validates a resolved image", () => {
    const ok = {
      src: "/api/image/file?u=x", width: 960, height: 600, title: "t", artist: "a",
      license: "Public domain", sourceUrl: "https://commons.wikimedia.org/wiki/File:X.jpg", kind: "painting",
    };
    expect(ResolvedImageSchema.safeParse(ok).success).toBe(true);
    expect(ResolvedImageSchema.safeParse({ ...ok, kind: "video" }).success).toBe(false);
  });
});

describe("digest sources contract", () => {
  const src = (text: string, kind = "txt") => ({ name: "apuntes.txt", kind, text });

  it("accepts md and json source kinds", () => {
    expect(DigestSourcesRequestSchema.safeParse({ sources: [src("# Tema", "md"), src('{"a":1}', "json")] }).success).toBe(true);
    expect(GenerateMuseumRequestSchema.safeParse({ prompt: "x", sources: [src("# Tema", "md")] }).success).toBe(true);
  });

  it("rejects more than 10 sources", () => {
    const sources = Array.from({ length: 11 }, () => src("texto"));
    expect(DigestSourcesRequestSchema.safeParse({ sources }).success).toBe(false);
    expect(DigestSourcesRequestSchema.safeParse({ sources: sources.slice(0, 10) }).success).toBe(true);
  });

  it("rejects a total text over LIMITS.maxDigestInputChars", () => {
    const sources = [src("a".repeat(100_000)), src("b".repeat(100_000))];
    expect(DigestSourcesRequestSchema.safeParse({ sources }).success).toBe(true);
    const over = [...sources, src("c")];
    const result = DigestSourcesRequestSchema.safeParse({ sources: over });
    expect(result.success).toBe(false);
    expect(LIMITS.maxDigestInputChars).toBe(200_000);
  });

  it("bounds the digest length by LIMITS.maxDigestChars", () => {
    expect(DigestSourcesResponseSchema.safeParse({ digest: "x".repeat(LIMITS.maxDigestChars) }).success).toBe(true);
    expect(DigestSourcesResponseSchema.safeParse({ digest: "x".repeat(LIMITS.maxDigestChars + 1) }).success).toBe(false);
    expect(DigestSourcesResponseSchema.safeParse({ digest: "" }).success).toBe(false);
    expect(LIMITS.maxDigestChars).toBe(15_000);
  });
});
