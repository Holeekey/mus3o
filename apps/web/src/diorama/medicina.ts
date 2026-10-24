import { parseDiorama } from './dioramaSchema'

// Dioramas escritos a mano para la demo ?demo=medicina. Son el mismo formato que produciría el LLM.
// Se mira desde +z hacia -z; el jugador aparece en (0, 10.6).

export const CORAZON_PIECES = {
  auricula: 'corazon-auricula-derecha',
  tricuspide: 'corazon-valvula-tricuspide',
  ventriculoD: 'corazon-ventriculo-derecho',
  mitral: 'corazon-valvula-mitral',
  ventriculoI: 'corazon-ventriculo-izquierdo',
  nodo: 'corazon-nodo-sinoauricular',
} as const

export const CELULA_PIECES = {
  nucleo: 'celula-nucleo',
  mitocondria: 'celula-mitocondria',
  ribosoma: 'celula-ribosoma',
  reticulo: 'celula-reticulo-rugoso',
  membrana: 'celula-membrana',
} as const

export const NEURONA_PIECES = {
  dendritas: 'neurona-dendritas',
  axon: 'neurona-axon',
  sinapsis: 'neurona-sinapsis',
} as const

type P3 = [number, number, number]
/** Fracción del recorrido (longitud de la poligonal) a la que está el punto `idx`: dónde se encuentra la válvula. */
function gateAt(path: P3[], idx: number) {
  const seg = (a: P3, b: P3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
  let total = 0
  let upTo = 0
  for (let i = 1; i < path.length; i++) {
    const d = seg(path[i - 1], path[i])
    total += d
    if (i <= idx) upTo += d
  }
  return Math.round((upTo / total) * 100) / 100
}

// Centro del anillo tricúspide: R = 1,25 · 2,2 = 2,75 m; centro a 1,3 R = 3,6 m del suelo.
const VALVE: P3 = [0, 3.6, -13.8]
const FROM_SVC: P3[] = [[-17, 5.4, -5], [-9, 5.6, -6.5], [-3, 4.6, -10], VALVE, [0, 3.6, -26]]
const FROM_IVC: P3[] = [[-17, 3.2, 8], [-10, 3.8, 5], [-4, 4.2, -4], VALVE, [0, 3.6, -26]]

export const CORAZON = parseDiorama({
  title: 'Dentro del corazón: aurícula derecha',
  terrain: 'organic',
  time: 'day',
  palette: { ground: '#b4514b', sky: '#4a1a21', accent: '#ecd2a6' },
  props: [
    // La válvula tricúspide en el tabique auriculoventricular: 3 valvas que laten, cuerdas y papilares.
    { kind: 'heart-chamber-valve', valveType: 'tricuspid', pos: [0, -13.8], scale: 2.2, label: 'Válvula tricúspide', pieceId: CORAZON_PIECES.tricuspide },
    // Miocardio de los ventrículos, pegado al tabique: se contrae con cada latido.
    { kind: 'muscle-wall', pos: [-9.6, -13.1], scale: 1.3, label: 'Ventrículo derecho', pieceId: CORAZON_PIECES.ventriculoD },
    { kind: 'muscle-wall', pos: [9.6, -13.1], scale: 1.5, color: '#8f2f35', label: 'Ventrículo izquierdo', pieceId: CORAZON_PIECES.ventriculoI },
    // Pared de la aurícula con músculos pectíneos.
    { kind: 'muscle-wall', pos: [-13.4, 5.5], rotY: Math.PI / 2, scale: 1.2, label: 'Aurícula derecha', pieceId: CORAZON_PIECES.auricula },
    // Válvula mitral (modelo de corte) del lado izquierdo.
    { kind: 'heart-chamber-valve', valveType: 'mitral', pos: [8.2, -3.2], rotY: -0.5, scale: 1.4, spread: 2.4, label: 'Válvula mitral', pieceId: CORAZON_PIECES.mitral },
    // Entradas de las venas cavas.
    { kind: 'vessel-mouth', pos: [-13.6, -5], y: 2, rotY: Math.PI / 2, scale: 1.4, label: 'Venas cavas' },
    { kind: 'vessel-mouth', pos: [-13.6, 8], y: 0, rotY: Math.PI / 2 + 0.15, scale: 1.4, color: '#7c4a82' },
    // Marcapasos natural.
    { kind: 'node-pacemaker', pos: [13.4, 1.5], y: 1.0, rotY: -Math.PI / 2, scale: 1.3, label: 'Nodo sinoauricular', pieceId: CORAZON_PIECES.nodo },
    // Circulación: la sangre llega por las cavas, espera a que la válvula abra y pasa al ventrículo.
    { kind: 'blood-cell', cell: 'red', pos: [-17, -5], scale: 1.1, count: 28, spread: 1.5, flow: { path: FROM_SVC, speed: 3.2, gate: gateAt(FROM_SVC, 3) } },
    { kind: 'blood-cell', cell: 'red', pos: [-17, 8], scale: 1.1, count: 28, spread: 1.5, flow: { path: FROM_IVC, speed: 3.0, gate: gateAt(FROM_IVC, 3) } },
    { kind: 'blood-cell', cell: 'white', pos: [-17, -5], scale: 1.0, count: 3, spread: 1.2, flow: { path: FROM_SVC, speed: 2.4, gate: gateAt(FROM_SVC, 3) } },
    { kind: 'blood-cell', cell: 'platelet', pos: [-17, 8], scale: 1.3, count: 9, spread: 1.6, flow: { path: FROM_IVC, speed: 3.4, gate: gateAt(FROM_IVC, 3) } },
  ],
})

export const CELULA = parseDiorama({
  title: 'Dentro de una célula animal',
  terrain: 'cellular',
  time: 'day',
  palette: { ground: '#9a6a86', sky: '#bfe4d8', accent: '#f0c968' },
  props: [
    { kind: 'nucleus', pos: [-3, -12.5], scale: 1.3, label: 'Núcleo', pieceId: CELULA_PIECES.nucleo },
    { kind: 'dna-helix', pos: [2.4, -4.5], scale: 1.0, rotY: 0.4 },
    { kind: 'mitochondrion', pos: [6.5, 0.5], rotY: 0.35, label: 'Mitocondria', pieceId: CELULA_PIECES.mitocondria },
    { kind: 'mitochondrion', pos: [10.5, -7], rotY: -0.4, scale: 1.15 },
    { kind: 'mitochondrion', pos: [-10, 6], rotY: 0.55, scale: 0.9 },
    { kind: 'ribosome', pos: [-3, 3.5], rotY: 0.3, scale: 1.6, label: 'Ribosoma', pieceId: CELULA_PIECES.ribosoma },
    { kind: 'ribosome', pos: [-1, -1], count: 10, spread: 9, scale: 1.0, y: 0.8 },
    { kind: 'rough-er', pos: [-10, -4], rotY: 0.55, scale: 1.2, label: 'Retículo endoplasmático rugoso', pieceId: CELULA_PIECES.reticulo },
    { kind: 'golgi', pos: [9, -12], rotY: -0.45, scale: 1.0 },
    { kind: 'membrane-protein', pos: [11.5, 7], rotY: -0.9, scale: 1.0, label: 'Membrana celular', pieceId: CELULA_PIECES.membrana },
    { kind: 'atp', pos: [1, 1], count: 9, spread: 11, scale: 1.0, y: 1.8 },
    { kind: 'atp', pos: [3, -3], count: 6, spread: 9, scale: 0.9, y: 4.8 },
    { kind: 'vesicle', pos: [-6, 8], count: 4, spread: 6, scale: 1.0, y: 1.5 },
  ],
})

export const NEURONA = parseDiorama({
  title: 'Una neurona y su impulso',
  terrain: 'cellular',
  time: 'day',
  palette: { ground: '#8a82c0', sky: '#c8c3ee', accent: '#e4d2ff' },
  props: [
    // El soma y las dendritas a la izquierda; el axón cruza la escena hacia la derecha y el impulso lo recorre.
    { kind: 'neuron', pos: [-13, -4], rotY: -1.45, scale: 1.25, label: 'Dendritas', pieceId: NEURONA_PIECES.dendritas },
    // Un canal iónico en la membrana del axón, que es lo que propaga el impulso.
    { kind: 'membrane-protein', pos: [-1, -9], rotY: -0.7, scale: 0.8, label: 'Axón', pieceId: NEURONA_PIECES.axon },
    // Vesículas sinápticas en el terminal.
    { kind: 'vesicle', pos: [8.5, -5], count: 7, spread: 2.2, scale: 0.9, y: 1.6, label: 'Sinapsis', pieceId: NEURONA_PIECES.sinapsis },
    { kind: 'atp', pos: [2, 3], count: 7, spread: 9, scale: 0.9, y: 3.2 },
    { kind: 'mitochondrion', pos: [8, 6], rotY: 0.3, scale: 0.85 },
    { kind: 'ribosome', pos: [-6, 6], count: 8, spread: 6, scale: 0.9, y: 0.6 },
  ],
})
