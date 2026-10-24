import type * as THREE from 'three'

// Extras de los props científicos que el render genérico (PropMesh) no sabe dibujar:
// células que circulan, ondas del marcapasos, impulsos nerviosos. Los lee ScienceOverlay.

export type FlowSpec = {
  /** Recorrido (coordenadas del diorama, y = altura sobre el suelo). */
  path: [number, number, number][]
  speed: number
  /** Fracción del recorrido donde hay una válvula. */
  gate?: number
  /** Radio del haz de células alrededor del recorrido (m). */
  radius: number
}

export type ScienceExtra = {
  /** La geometría usa el material animado (válvulas, ADN, corazón...). */
  shader?: boolean
  /** No dibujar las instancias estáticas: las posiciona el overlay. */
  dynamicOnly?: boolean
  flow?: FlowSpec
  /** Ondas expansivas sobre la pared (nodo sinusal), en coordenadas locales. */
  pulse?: { y: number; radius: number }
  /** Bolita que recorre una curva local (axón). */
  impulse?: { points: THREE.Vector3[]; speed: number; radius: number }
}
