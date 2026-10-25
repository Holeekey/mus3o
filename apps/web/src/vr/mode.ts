// Elección del modo VR. Lógica pura: no toca el DOM, para poder probarla.

/** 'xr' = WebXR immersive-vr; 'cardboard' = estéreo lado a lado con sensores del teléfono. */
export type VrKind = 'xr' | 'cardboard'
/** Forzado por URL (?vr=cardboard | xr | off). */
export type VrForce = VrKind | 'off' | null

export function parseVrFlag(search: string): VrForce {
  const v = new URLSearchParams(search).get('vr')
  return v === 'cardboard' || v === 'xr' || v === 'off' ? v : null
}

export type VrProbe = {
  force: VrForce
  /** `navigator.xr.isSessionSupported('immersive-vr')`. */
  xrSupported: boolean
  /** Puntero grueso (teléfono o tableta). */
  touch: boolean
}

/**
 * Qué camino toma "Ver en VR":
 * - `?vr=off` lo desactiva; `?vr=cardboard` fuerza el respaldo (pruebas en escritorio); `?vr=xr` fuerza WebXR (emulado).
 * - WebXR si el navegador lo soporta (Chrome en Android).
 * - Respaldo "cardboard" en cualquier otro móvil/tableta (iOS Safari, navegadores sin WebXR).
 * - En escritorio sin WebXR no hay botón ('none').
 */
export function selectVrMode(p: VrProbe): VrKind | 'none' {
  if (p.force === 'off') return 'none'
  if (p.force === 'cardboard') return 'cardboard'
  if (p.force === 'xr') return 'xr'
  if (p.xrSupported) return 'xr'
  if (p.touch) return 'cardboard'
  return 'none'
}
