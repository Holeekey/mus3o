// Estado de la mirada que se escribe cada frame y leen los componentes visuales (retícula, panel, marcador).
// Mutable a propósito: nada de esto debe provocar renders de React.

export const gazeView = {
  /** Objetivo bajo la retícula (clave de GazeCandidate) o null. */
  key: null as string | null,
  kind: null as string | null,
  /** 0..1, avance del anillo. */
  progress: 0,
  /** Distancia (m) a la que se dibuja la retícula. */
  dist: 3,
  /** Marcador de teletransporte. */
  floor: { show: false, valid: false, x: 0, z: 0 },
  /** Panel del concepto: posición del centro y giro Y para mirar al usuario. */
  panel: { x: 0, y: 1.6, z: 0, yaw: 0 },
  /** Botón de salida del cuadro (dentro del diorama). */
  exit: { show: false, x: 0, y: 0, z: 0, yaw: 0 },
}

export const PANEL_W = 1.7
export const PANEL_H = 1.2
export const PANEL_DIST = 1.9

/** Botones del panel (coordenadas locales). */
export const PANEL_BUTTONS = {
  memorize: { id: 'ui:memorize', x: -0.43, y: -0.49, w: 0.78, h: 0.2 },
  close: { id: 'ui:close', x: 0.43, y: -0.49, w: 0.78, h: 0.2 },
} as const

export const EXIT_BUTTON = { key: 'exit:diorama', w: 0.9, h: 0.3 }
