import { MuseumSchema, type Museum } from "@mus3o/shared";
import { CELULA, CELULA_PIECES, CORAZON, CORAZON_PIECES, NEURONA, NEURONA_PIECES } from "../diorama/medicina";

// Museo de prueba para ?demo=medicina: "Cardiología y biología celular". Cada sala tiene un cuadro
// principal real (Wikimedia, vía imageSearch) que es un portal a un diorama interior.
// Los textos de las piezas son los hechos que enlazan los props del diorama (ver diorama/medicina.ts).

const glyph = (shape: "icosahedron" | "octahedron" | "dodecahedron" | "tetrahedron" | "torus" | "cone" | "box" | "sphere") => ({ type: "glyph" as const, shape });

const medicina: Museum = {
  title: "Cardiología y biología celular",
  theme: { palette: ["#a8323a", "#e8c9a0", "#3b5ba5", "#f3ece0"], ambience: "Teatro anatómico" },
  mode: "exploration",
  rooms: [
    {
      id: "corazon",
      name: "El corazón",
      description: "La bomba que mueve la sangre por todo el cuerpo.",
      imageSearch: { wikiTitle: "Corazón", commonsQuery: "heart anatomy diagram", lang: "es" },
      // Al acercarse al cuadro se disuelve en este diorama (se entra con E).
      diorama: CORAZON,
      pieces: [
        { id: CORAZON_PIECES.auricula, title: "Aurícula derecha", text: "Recibe la sangre sin oxígeno que llega por las venas cavas.", fact: "", model: glyph("sphere"), imageSearch: { wikiTitle: "Aurícula derecha", commonsQuery: "right atrium heart", lang: "es" } },
        { id: CORAZON_PIECES.tricuspide, title: "Válvula tricúspide", text: "Separa la aurícula derecha del ventrículo derecho; tiene tres valvas.", fact: "", model: glyph("tetrahedron"), imageSearch: { wikiTitle: "Válvula tricúspide", commonsQuery: "tricuspid valve", lang: "es" } },
        { id: CORAZON_PIECES.ventriculoD, title: "Ventrículo derecho", text: "Bombea la sangre hacia los pulmones por la arteria pulmonar.", fact: "", model: glyph("dodecahedron") },
        { id: CORAZON_PIECES.mitral, title: "Válvula mitral", text: "Separa la aurícula izquierda del ventrículo izquierdo; tiene dos valvas.", fact: "", model: glyph("octahedron"), imageSearch: { wikiTitle: "Válvula mitral", commonsQuery: "mitral valve", lang: "es" } },
        { id: CORAZON_PIECES.ventriculoI, title: "Ventrículo izquierdo", text: "Bombea la sangre oxigenada a todo el cuerpo por la aorta.", fact: "", model: glyph("icosahedron") },
        { id: CORAZON_PIECES.nodo, title: "Nodo sinoauricular", text: "Es el marcapasos natural del corazón; inicia cada latido.", fact: "", model: glyph("torus"), imageSearch: { wikiTitle: "Nódulo sinoauricular", commonsQuery: "sinoatrial node", lang: "es" } },
      ],
    },
    {
      id: "celula",
      name: "La célula",
      description: "La unidad básica de la vida y sus orgánulos.",
      imageSearch: { wikiTitle: "Célula", commonsQuery: "animal cell diagram", lang: "es" },
      // Al acercarse al cuadro se disuelve en este diorama (se entra con E).
      diorama: CELULA,
      pieces: [
        { id: CELULA_PIECES.nucleo, title: "Núcleo", text: "Guarda el ADN de la célula.", fact: "", model: glyph("sphere"), imageSearch: { wikiTitle: "Núcleo celular", commonsQuery: "cell nucleus", lang: "es" } },
        { id: CELULA_PIECES.mitocondria, title: "Mitocondria", text: "Produce la mayor parte del ATP de la célula.", fact: "", model: glyph("dodecahedron"), imageSearch: { wikiTitle: "Mitocondria", commonsQuery: "mitochondrion structure", lang: "es" } },
        { id: CELULA_PIECES.ribosoma, title: "Ribosoma", text: "Fabrica proteínas leyendo el ARN mensajero.", fact: "", model: glyph("octahedron"), imageSearch: { wikiTitle: "Ribosoma", commonsQuery: "ribosome", lang: "es" } },
        { id: CELULA_PIECES.reticulo, title: "Retículo endoplasmático rugoso", text: "Membranas con ribosomas donde se sintetizan proteínas.", fact: "", model: glyph("icosahedron") },
        { id: CELULA_PIECES.membrana, title: "Membrana celular", text: "Bicapa de lípidos que controla qué entra y sale.", fact: "", model: glyph("torus"), imageSearch: { wikiTitle: "Membrana celular", commonsQuery: "cell membrane lipid bilayer", lang: "es" } },
      ],
    },
    {
      id: "neurona",
      name: "La neurona",
      description: "La célula que conduce el impulso nervioso.",
      imageSearch: { wikiTitle: "Neurona", commonsQuery: "neuron diagram", lang: "es" },
      // Al acercarse al cuadro se disuelve en este diorama (se entra con E).
      diorama: NEURONA,
      pieces: [
        { id: NEURONA_PIECES.dendritas, title: "Dendritas", text: "Reciben señales de otras neuronas.", fact: "", model: glyph("cone") },
        { id: NEURONA_PIECES.axon, title: "Axón", text: "Conduce el impulso nervioso.", fact: "", model: glyph("box") },
        { id: NEURONA_PIECES.sinapsis, title: "Sinapsis", text: "Punto de comunicación entre dos neuronas.", fact: "", model: glyph("sphere") },
      ],
    },
  ],
  graph: {
    start: "corazon",
    edges: [
      { from: "corazon", to: "celula", kind: "next" },
      { from: "celula", to: "neurona", kind: "next" },
    ],
  },
};

export const medicinaMuseum: Museum = MuseumSchema.parse(medicina);
