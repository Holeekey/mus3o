import { sampleMuseum, type Museum } from "@mus3o/shared";

const egypt: Museum = {
  title: "Antiguo Egipto",
  theme: { palette: ["#c9a24b", "#2a6f97", "#e9d8a6", "#5c4033"], ambience: "Arena dorada y azul lapislázuli" },
  rooms: [
    {
      id: "piramides",
      name: "Las Pirámides",
      description: "Tumbas monumentales de los faraones.",
      pieces: [
        {
          id: "piramide",
          title: "Gran Pirámide",
          text: "La pirámide de Keops fue la estructura más alta del mundo durante casi 4.000 años.",
          fact: "Se compone de unos 2,3 millones de bloques de piedra.",
          position: [0, 1, 0],
          model: { type: "procedural", parts: [{ shape: "cone", args: [1, 1.6, 4], pos: [0, 0.8, 0], rot: [0, Math.PI / 4, 0], color: "#c9a24b" }] },
        },
      ],
    },
  ],
};

export const mockMuseums: Museum[] = [sampleMuseum, egypt];

/** Mus3o de respaldo si el backend falla. */
export const fallbackMuseum = (topic: string): Museum => ({ ...mockMuseums[0], title: topic || mockMuseums[0].title });

/** Mapa simple para probar la escena 3D: dos salas conectadas por una puerta. */
export const demoMuseum: Museum = {
  title: "Demo 3D",
  theme: sampleMuseum.theme,
  rooms: [sampleMuseum.rooms[0], egypt.rooms[0]],
};
