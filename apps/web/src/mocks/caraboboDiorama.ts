import { parseDiorama, type Diorama } from '@mus3o/shared'

// Batalla de Carabobo, 24 de junio de 1821 (sala "Batalla de Carabobo" del museo ?demo=historia).
// Diorama escrito a mano: es el mismo formato que
// producirá el LLM. Se mira desde +z hacia -z. La caballería patriota carga en diagonal desde el
// fondo-izquierda; la infantería realista (casacas rojas) la espera a la derecha.
export const CARABOBO_PIECES = {
  bolivar: 'carabobo-bolivar',
  paez: 'carabobo-paez',
  torre: 'carabobo-torre',
  camejo: 'carabobo-camejo',
} as const

export const CARABOBO: Diorama = parseDiorama({
  title: 'Campo de Carabobo, 24 de junio de 1821',
  terrain: 'hills',
  time: 'day',
  palette: { ground: '#a39b58', sky: '#86b4dc', accent: '#c8102e' },
  props: [
    // --- Caballería patriota en carga ---
    { kind: 'rider', pose: 'charging', color: '#2b4c94', secondary: '#efe8d8', pos: [-6.2, -5.2], rotY: 1.05, scale: 1, count: 10, spread: 4 },
    { kind: 'rider', pose: 'raising-arm', color: '#1f3a7a', secondary: '#c9a24b', pos: [-0.6, 0.6], rotY: 0.9, scale: 1.15, label: 'Simón Bolívar', pieceId: CARABOBO_PIECES.bolivar },
    { kind: 'rider', pose: 'charging', color: '#3c5aa0', secondary: '#efe8d8', pos: [-6.4, -1.4], rotY: 1.05, scale: 1.1, label: 'José Antonio Páez', pieceId: CARABOBO_PIECES.paez },
    { kind: 'rider', pose: 'charging', color: '#27407f', secondary: '#efe8d8', pos: [3.2, 3.6], rotY: 1.2, scale: 1.1, label: 'Pedro Camejo, Negro Primero', pieceId: CARABOBO_PIECES.camejo },
    // caballos sin jinete, desbocados
    { kind: 'horse', pose: 'charging', pos: [-9, 0.5], rotY: 0.8, count: 2, spread: 2 },
    // --- Infantería realista ---
    { kind: 'figure', pose: 'standing', color: '#a8322d', secondary: '#efe8d8', pos: [6.2, -5.6], rotY: -1.1, scale: 1, count: 15, spread: 3.6 },
    { kind: 'rider', pose: 'pointing', color: '#a8322d', secondary: '#efe8d8', pos: [9.4, -9.2], rotY: -1.2, scale: 1.15, label: 'Miguel de la Torre', pieceId: CARABOBO_PIECES.torre },
    // caídos
    { kind: 'figure', pose: 'fallen', color: '#a8322d', secondary: '#efe8d8', pos: [3.4, -2.4], count: 6, spread: 2.6 },
    { kind: 'figure', pose: 'fallen', color: '#2b4c94', secondary: '#efe8d8', pos: [-3.2, -0.2], count: 3, spread: 1.8 },
    // --- Banderas ---
    { kind: 'flag', color: '#f2c200', secondary: '#1f3fa0', pos: [-6.6, -1.2], rotY: 0.2, scale: 1.25 },
    { kind: 'flag', color: '#f2c200', secondary: '#1f3fa0', pos: [-2.4, -4.8], rotY: -0.3, scale: 1.1 },
    // Realistas: Cruz de Borgoña (campo blanco, aspa roja nudosa), no una bicolor.
    { kind: 'flag', pattern: 'saltire', color: '#efe8d8', secondary: '#b3262d', pos: [8.2, -3.6], rotY: 2.6, scale: 1.15 },
    { kind: 'flag', pattern: 'saltire', color: '#efe8d8', secondary: '#b3262d', pos: [8.2, -8.4], rotY: 2.9, scale: 1.1 },
    // --- Artillería ---
    { kind: 'cannon', pos: [10.2, -1.6], rotY: -1.9, scale: 1.1 },
    { kind: 'cannon', pos: [4.4, -10.4], rotY: -1.5, scale: 1.1 },
    // --- Sabana ---
    { kind: 'tree', pos: [-9.5, -10], count: 5, spread: 7, scale: 1.2 },
    { kind: 'tree', pos: [11.5, -12.5], count: 4, spread: 5, scale: 1.1 },
    { kind: 'tree', pos: [-11.5, 3], scale: 1.6 },
    { kind: 'rock', pos: [0, 1], count: 7, spread: 12, scale: 0.55 },
    { kind: 'tent', pos: [-11.5, -6.5], rotY: 0.6, scale: 1.1 },
    { kind: 'campfire', pos: [-9, -3.8], scale: 1 },
  ],
})
