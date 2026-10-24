import { MuseumSchema, type Museum } from "@mus3o/shared";

// Museo de prueba para `?demo=compuesto`: ninguna sala trae diorama ni imagen. Cada una recibe uno
// compuesto por `diorama/compose.ts` (como un museo generado por IA con textos genéricos).
const p = (id: string, title: string) => ({ id, title, text: "Una idea clave de esta sala, explicada en pocas palabras.", fact: "" });

const compuesto = {
  title: "Revolución francesa y otros temas",
  theme: { palette: ["#8a2f2f", "#2a4a7a", "#c9a24b", "#3c6e47"], ambience: "Piedra, bronce y tinta" },
  rooms: [
    {
      id: "bastilla",
      name: "Toma de la Bastilla",
      description: "El 14 de julio de 1789 el pueblo de París asaltó la fortaleza.",
      pieces: [p("bastilla-launay", "Bernard de Launay"), p("bastilla-desmoulins", "Camille Desmoulins"), p("bastilla-canones", "Cañones de los Inválidos"), p("bastilla-bandera", "La escarapela tricolor")],
    },
    {
      id: "asamblea",
      name: "Asamblea Nacional",
      description: "Los diputados del Tercer Estado se declaran representantes de la nación.",
      pieces: [p("asamblea-sieyes", "Emmanuel Sieyès"), p("asamblea-juramento", "Juramento del Juego de Pelota"), p("asamblea-declaracion", "Declaración de los Derechos del Hombre")],
    },
    {
      id: "ilustracion",
      name: "Ilustración",
      description: "El siglo de las luces.",
      pieces: [p("ilus-razon", "La razón"), p("ilus-voltaire", "Voltaire"), p("ilus-enciclopedia", "La Enciclopedia"), p("ilus-contrato", "Contrato social"), p("ilus-tolerancia", "Tolerancia"), p("ilus-ciencia", "Método científico")],
    },
    {
      id: "computadoras",
      name: "Arquitectura de computadoras",
      description: "Cómo se organiza una computadora por dentro.",
      pieces: [p("pc-cpu", "CPU"), p("pc-memoria", "Memoria principal"), p("pc-cache", "Caché"), p("pc-bus", "Bus de datos"), p("pc-alu", "ALU"), p("pc-pipeline", "Pipeline"), p("pc-es", "Entrada y salida"), p("pc-isa", "Conjunto de instrucciones")],
    },
    {
      id: "andes",
      name: "Geografía de Venezuela: Los Andes",
      description: "La cordillera, sus páramos y sus climas.",
      pieces: [p("andes-bolivar", "Pico Bolívar"), p("andes-paramo", "El páramo"), p("andes-frailejon", "Frailejón"), p("andes-clima", "Pisos térmicos")],
    },
    {
      id: "navegacion",
      name: "Flota y navegación",
      description: "Los barcos y el puerto.",
      pieces: [p("nav-colon", "Cristóbal Colón"), p("nav-carabela", "La carabela"), p("nav-brujula", "Brújula"), p("nav-puerto", "El puerto de La Guaira")],
    },
    {
      id: "golgi",
      name: "Aparato de Golgi y ribosomas",
      description: "Fábricas y empaquetadoras de proteínas.",
      pieces: [p("golgi-ribosoma", "Ribosoma"), p("golgi-aparato", "Aparato de Golgi"), p("golgi-reticulo", "Retículo rugoso"), p("golgi-vesicula", "Vesícula"), p("golgi-atp", "ATP")],
    },
    {
      id: "circulatorio",
      name: "Sistema circulatorio",
      description: "La sangre y sus vasos.",
      pieces: [p("circ-arteria", "Arteria"), p("circ-vena", "Vena"), p("circ-globulos", "Glóbulos rojos"), p("circ-pulmon", "Pulmón")],
    },
  ],
  graph: {
    start: "bastilla",
    edges: [
      { from: "bastilla", to: "asamblea", kind: "next" },
      { from: "asamblea", to: "ilustracion", kind: "related" },
      { from: "ilustracion", to: "computadoras", kind: "related" },
      { from: "computadoras", to: "andes", kind: "related" },
      { from: "andes", to: "navegacion", kind: "related" },
      { from: "navegacion", to: "golgi", kind: "related" },
      { from: "golgi", to: "circulatorio", kind: "related" },
    ],
  },
};

export const compuestoMuseum: Museum = MuseumSchema.parse(compuesto);
