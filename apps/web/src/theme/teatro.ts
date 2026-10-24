import type { Theme } from './types'

// Teatro de la Memoria: cámaras pintadas del arte de la memoria del siglo XVI
// (Giulio Camillo, Giordano Bruno). Muros de color pleno, objetos de yeso, luz dura de mediodía.
// Nada de neón, degradados ni vidrio: el color es plano y la profundidad la dan las sombras.
export const teatro: Theme = {
  id: 'teatro',
  name: 'Teatro de la Memoria',

  // Pigmentos de fresco, elegidos para que salas vecinas no se confundan (tono y luminosidad distintos).
  rooms: [
    { name: 'Rojo pompeyano', wall: '#8E2A1E', floor: '#5A1C14', trim: '#C9963A', ink: '#F6EFE8' },
    { name: 'Verde cardenillo', wall: '#3F6E5A', floor: '#26453A', trim: '#D8C9A3', ink: '#F3F1EA' },
    { name: 'Ocre amarillo', wall: '#B7832A', floor: '#7A5518', trim: '#4A2A14', ink: '#1E140B' },
    { name: 'Azul cobalto', wall: '#26408B', floor: '#17285A', trim: '#C9963A', ink: '#F1F2F8' },
    { name: 'Bermellón', wall: '#D2643A', floor: '#83351B', trim: '#2B1A12', ink: '#1B0F0A' },
    { name: 'Morellone', wall: '#5E2B3A', floor: '#3C1B25', trim: '#D8C9A3', ink: '#F5EDEF' },
    { name: 'Tierra verde', wall: '#7C8A5B', floor: '#4F5A39', trim: '#2E2A1E', ink: '#15170F' },
    { name: 'Negro de humo', wall: '#2B2A28', floor: '#1A1918', trim: '#C9963A', ink: '#EFEDE8' },
  ],

  scene: {
    // Sobre los muros se ve una bóveda clara de yeso, no un vacío oscuro.
    background: '#D6CFC4',
    fog: { color: '#D6CFC4', near: 22, far: 80 },
    object: { color: '#F2F1EE', roughness: 0.95 },
    pedestal: { color: '#E4E1DB', segments: 8 },
    corridor: { wall: '#D9D4CB', floor: '#8E877C' },
    sun: { color: '#FFF1DC', intensity: 2.2, position: [8, 14, 5] },
    ambient: { sky: '#E9D9C4', ground: '#3A2620', intensity: 1.1 },
    shadows: true,
    architecture: { cornice: true, plinth: true, wallThickness: 0.4 },
  },

  ui: {
    fonts: {
      display: "'Gloock', 'Times New Roman', serif",
      body: "'Hanken Grotesk', system-ui, sans-serif",
    },
    // La landing va "empapada" del primer pigmento; las fichas son de yeso (blanco sin tinte cálido).
    tokens: {
      bg: '#8E2A1E',
      'bg-ink': '#F6EFE8',
      surface: '#F2F1EE',
      ink: '#1F1411',
      'ink-muted': '#5C4B45',
      accent: '#C9963A',
      line: '#1F1411',
      danger: '#8E2A1E',
      ok: '#3F6E5A',
      shadow: '#1F1411',
    },
  },
}
