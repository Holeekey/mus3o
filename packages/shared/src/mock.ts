import type { Museum } from "./schema";

/** Mus3o mínimo de ejemplo: lo usan el servidor (sin API key) y el frontend (fallback). */
export const sampleMuseum: Museum = {
  title: "Imperio Romano",
  theme: {
    palette: ["#b5543c", "#e8d5b0", "#6b5b4a", "#2f3e46"],
    ambience: "Mármol cálido y terracota bajo luz de atardecer",
  },
  rooms: [
    {
      id: "foro",
      name: "El Foro",
      description: "El corazón político y social de Roma.",
      pieces: [
        {
          id: "columna",
          title: "Columna corintia",
          text: "Las columnas corintias, coronadas con hojas de acanto, adornaban templos y edificios públicos.",
          fact: "El orden corintio fue el favorito de los romanos por su ornamentación.",
          position: [0, 1, -2],
          model: {
            type: "procedural",
            parts: [
              { shape: "cylinder", args: [0.35, 0.4, 1.8, 12], pos: [0, 0.9, 0], rot: [0, 0, 0], color: "#e8d5b0" },
              { shape: "box", args: [1, 0.2, 1], pos: [0, 1.9, 0], rot: [0, 0, 0], color: "#d9c39a" },
              { shape: "box", args: [1, 0.2, 1], pos: [0, 0.1, 0], rot: [0, 0, 0], color: "#d9c39a" },
            ],
          },
        },
        {
          id: "casco",
          title: "Casco legionario",
          text: "Los cascos de hierro protegían a los legionarios con cubrenuca y guardamejillas.",
          fact: "Una legión contaba con unos 5.000 soldados.",
          position: [4, 1, 2],
          model: {
            type: "procedural",
            parts: [
              { shape: "sphere", args: [0.5, 12, 8], pos: [0, 0.5, 0], rot: [0, 0, 0], color: "#9aa0a6" },
              { shape: "box", args: [0.9, 0.08, 0.3], pos: [0, 0.9, 0], rot: [0, 0, 0], color: "#b5543c" },
            ],
          },
        },
      ],
    },
  ],
};
