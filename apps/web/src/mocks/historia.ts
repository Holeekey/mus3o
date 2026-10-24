import { MuseumSchema, sampleMuseum, type Museum, type Part } from "@mus3o/shared";
import { CARABOBO } from "./caraboboDiorama";

const part = (shape: Part["shape"], args: number[], pos: [number, number, number], color: string, rot: [number, number, number] = [0, 0, 0]): Part => ({
  shape,
  args,
  pos,
  rot,
  color,
});

const saber = {
  type: "procedural" as const,
  parts: [
    part("box", [0.12, 1.4, 0.04], [0, 1.1, 0], "#e8e4da"),
    part("box", [0.5, 0.1, 0.1], [0, 0.4, 0], "#d9c39a"),
    part("cylinder", [0.05, 0.05, 0.4, 8], [0, 0.15, 0], "#8a6a3a"),
  ],
};

const flag = {
  type: "procedural" as const,
  parts: [
    part("cylinder", [0.04, 0.04, 2, 8], [0, 1, 0], "#8a6a3a"),
    part("box", [0.9, 0.2, 0.03], [0.47, 1.85, 0], "#f2d24b"),
    part("box", [0.9, 0.2, 0.03], [0.47, 1.65, 0], "#3b5ba5"),
    part("box", [0.9, 0.2, 0.03], [0.47, 1.45, 0], "#c0392b"),
  ],
};

const ship = {
  type: "procedural" as const,
  parts: [
    part("box", [1.6, 0.35, 0.5], [0, 0.35, 0], "#8a6a3a"),
    part("cone", [0.3, 0.4, 4], [0.95, 0.35, 0], "#8a6a3a", [0, 0, -Math.PI / 2]),
    part("cylinder", [0.04, 0.04, 1.5, 8], [0, 1.3, 0], "#d9c39a"),
    part("box", [0.9, 1.0, 0.03], [0, 1.4, 0], "#f1ece0"),
  ],
};

const scroll = {
  type: "procedural" as const,
  parts: [
    part("cylinder", [0.18, 0.18, 1.1, 14], [0, 0.6, 0], "#efe6cf", [0, 0, Math.PI / 2]),
    part("cylinder", [0.22, 0.22, 0.08, 14], [-0.6, 0.6, 0], "#8a6a3a", [0, 0, Math.PI / 2]),
    part("cylinder", [0.22, 0.22, 0.08, 14], [0.6, 0.6, 0], "#8a6a3a", [0, 0, Math.PI / 2]),
  ],
};

const lance = {
  type: "procedural" as const,
  parts: [
    part("cylinder", [0.03, 0.03, 2, 8], [0, 1, 0], "#8a6a3a"),
    part("cone", [0.1, 0.35, 8], [0, 2.1, 0], "#e8e4da"),
  ],
};

const crown = {
  type: "procedural" as const,
  parts: [
    part("cylinder", [0.45, 0.45, 0.25, 16], [0, 0.2, 0], "#e0c25a"),
    part("cone", [0.1, 0.3, 6], [0.35, 0.5, 0], "#e0c25a"),
    part("cone", [0.1, 0.3, 6], [-0.35, 0.5, 0], "#e0c25a"),
    part("cone", [0.1, 0.3, 6], [0, 0.5, 0.35], "#e0c25a"),
    part("cone", [0.1, 0.3, 6], [0, 0.5, -0.35], "#e0c25a"),
  ],
};

const historia: Museum = {
  title: "Independencia de Venezuela",
  theme: sampleMuseum.theme,
  mode: "exploration",
  rooms: [
    {
      id: "carabobo",
      name: "Batalla de Carabobo (1821)",
      description: "La batalla que selló la independencia de Venezuela.",
      imageSearch: { wikiTitle: "Batalla de Carabobo (1821)", commonsQuery: "Batalla de Carabobo Tovar", lang: "es" },
      // Al acercarse al cuadro se disuelve en este diorama (se entra con E).
      diorama: CARABOBO,
      pieces: [
        {
          id: "carabobo-fecha",
          title: "24 de junio de 1821",
          text: "La batalla se libró en la sabana de Carabobo, en el actual estado Carabobo.",
          fact: "",
          model: { type: "glyph", shape: "dodecahedron" },
        },
        {
          id: "carabobo-bolivar",
          title: "Simón Bolívar",
          text: "Comandó el ejército patriota.",
          fact: "",
          model: saber,
          imageSearch: { wikiTitle: "Simón Bolívar", lang: "es" },
        },
        {
          id: "carabobo-paez",
          title: "José Antonio Páez",
          text: "Encabezó la primera división, con los llaneros y la Legión Británica.",
          fact: "",
          model: lance,
          imageSearch: { wikiTitle: "José Antonio Páez", lang: "es" },
        },
        {
          id: "carabobo-torre",
          title: "Miguel de la Torre",
          text: "Comandó el ejército realista.",
          fact: "",
          model: flag,
          imageSearch: { wikiTitle: "Miguel de la Torre", lang: "es" },
        },
        {
          id: "carabobo-camejo",
          title: "Pedro Camejo, Negro Primero",
          text: "Lancero de Páez, murió en la batalla.",
          fact: "",
          model: lance,
          imageSearch: { wikiTitle: "Pedro Camejo", lang: "es" },
        },
        {
          id: "carabobo-consecuencia",
          title: "Consecuencia",
          text: "Aseguró la independencia de Venezuela.",
          fact: "",
          model: { type: "glyph", shape: "octahedron" },
        },
      ],
    },
    {
      id: "boyaca",
      name: "Batalla de Boyacá (1819)",
      description: "La victoria que liberó la Nueva Granada.",
      imageSearch: { wikiTitle: "Batalla de Boyacá", lang: "es" },
      pieces: [
        {
          id: "boyaca-fecha",
          title: "7 de agosto de 1819",
          text: "Victoria patriota que liberó la Nueva Granada.",
          fact: "",
          model: flag,
        },
        {
          id: "boyaca-santander",
          title: "Francisco de Paula Santander",
          text: "Uno de los comandantes patriotas.",
          fact: "",
          model: saber,
          imageSearch: { wikiTitle: "Francisco de Paula Santander", lang: "es" },
        },
      ],
    },
    {
      id: "angostura",
      name: "Congreso de Angostura (1819)",
      description: "El congreso que dio forma a la República.",
      imageSearch: { wikiTitle: "Congreso de Angostura", lang: "es" },
      pieces: [
        {
          id: "angostura-discurso",
          title: "Discurso de Angostura",
          text: "Bolívar lo pronunció al instalar el congreso, el 15 de febrero de 1819.",
          fact: "",
          model: scroll,
        },
        {
          id: "angostura-ley",
          title: "Ley Fundamental",
          text: "El 17 de diciembre de 1819 se proclamó la República de Colombia (la Gran Colombia).",
          fact: "",
          model: crown,
        },
      ],
    },
    {
      id: "maracaibo",
      name: "Batalla Naval del Lago de Maracaibo (1823)",
      description: "La victoria naval que cerró la guerra en Venezuela.",
      imageSearch: { wikiTitle: "Batalla naval del Lago de Maracaibo", lang: "es" },
      pieces: [
        {
          id: "maracaibo-fecha",
          title: "24 de julio de 1823",
          text: "Victoria naval patriota.",
          fact: "",
          model: ship,
        },
        {
          id: "maracaibo-padilla",
          title: "José Prudencio Padilla",
          text: "Comandó la escuadra patriota.",
          fact: "",
          model: ship,
          imageSearch: { wikiTitle: "José Prudencio Padilla", lang: "es" },
        },
      ],
    },
  ],
  graph: {
    start: "carabobo",
    edges: [
      { from: "carabobo", to: "boyaca", kind: "related" },
      { from: "carabobo", to: "angostura", kind: "related" },
      { from: "carabobo", to: "maracaibo", kind: "related" },
    ],
  },
};

export const historiaMuseum: Museum = MuseumSchema.parse(historia);
